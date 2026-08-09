import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal, get_db
from app.models import Agent, Post, TopicDecision
from app.schemas import (
    AgentSummary,
    FeedPost,
    FeedResponse,
    InitRequest,
    InitResponse,
    PublishNowResponse,
    QueuedPost,
    TelemetryDecision,
    TelemetryResponse,
)
from app.services.editorial import publish_specific_post, run_editorial_cycle
from app.services.persona import build_voice_profile, generate_persona_profile
from app.services.state import get_scan_state

router = APIRouter(prefix="/api/agent", tags=["agent"])


async def initial_cycle(agent_id: str) -> None:
    db = SessionLocal()
    try:
        await run_editorial_cycle(db, agent_id)
    finally:
        db.close()


@router.post("/init", response_model=InitResponse, status_code=status.HTTP_201_CREATED)
async def init_agent(payload: InitRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> InitResponse:
    name = payload.persona.name.strip()
    domain = payload.persona.domain.strip()
    # One-time persona generation (LLM if a key is configured, template
    # fallback otherwise) -- cheap since it only happens once per agent, even
    # under a tight rate limit.
    persona_profile = await generate_persona_profile(name, domain)

    agent = Agent(
        name=name,
        domain=domain,
        voice_profile=build_voice_profile(name, domain, persona_profile),
        persona_profile=json.dumps(persona_profile),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    background_tasks.add_task(initial_cycle, agent.id)
    return InitResponse(agentId=agent.id)


@router.get("/feed", response_model=FeedResponse)
def get_feed(agentId: str, db: Session = Depends(get_db)) -> FeedResponse:
    if not db.get(Agent, agentId):
        raise HTTPException(status_code=404, detail="Unknown agentId")
    # Only ever show PUBLISHED posts on the public feed -- queued (drafted
    # but not yet released) posts show up separately in telemetry/queue.
    posts = db.scalars(
        select(Post)
        .where(Post.agent_id == agentId, Post.status == "published")
        .order_by(Post.published_at.desc())
    ).all()
    feed_posts = [
        FeedPost(
            id=post.id,
            sequenceNumber=post.sequence_number,
            createdAt=post.published_at,
            text=post.text,
            rationale=post.rationale,
            sources=post.sources,
            # Real per-post scores, carried over from scoring at queue time.
            # The frontend uses these instead of any made-up formula; they
            # are Optional because posts published before this field existed
            # won't have them, and the UI shows "N/A" rather than a fake
            # number in that case.
            overallScore=post.overall_score,
            credibilityScore=post.credibility_score,
            domainRelevance=post.domain_relevance,
            technicalDepth=post.technical_depth,
            noveltyScore=post.novelty_score,
        )
        for post in posts
    ]
    return FeedResponse(posts=feed_posts)


@router.get("/telemetry", response_model=TelemetryResponse)
def get_telemetry(agentId: str, db: Session = Depends(get_db)) -> TelemetryResponse:
    agent = db.get(Agent, agentId)
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agentId")

    settings = get_settings()

    # No more hard cap at 30 rows. Instead, a decision simply ages out of
    # this response once it's older than telemetry_window_minutes -- so the
    # live log never visibly "stops" once 30 accumulate, it just keeps
    # showing whatever happened recently. This ONLY affects what's returned
    # here for display; the underlying TopicDecision row is never deleted,
    # so source_seen()/recently_covered() (permanent dedup) are completely
    # unaffected by this window.
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.telemetry_window_minutes)
    decisions = db.scalars(
        select(TopicDecision)
        .where(TopicDecision.agent_id == agentId, TopicDecision.decided_at >= cutoff)
        .order_by(TopicDecision.decided_at.desc())
    ).all()

    # Every queued post, ranked the same way the publisher will release them
    # (best score first) -- so "next up" in the UI matches what will
    # actually publish next. No limit here either: this is the full queue,
    # meant to be browsed in its own dedicated UI section.
    queued = db.scalars(
        select(Post)
        .where(Post.agent_id == agentId, Post.status == "queued")
        .order_by(Post.overall_score.desc(), Post.created_at.asc())
    ).all()

    state = get_scan_state(agentId)

    return TelemetryResponse(
        active_source_url=state.active_source_url,
        scan_status=state.scan_status,
        chunks_processed=state.chunks_processed,
        decisions=list(decisions),
        queue=[
            QueuedPost(
                id=p.id,
                text=p.text,
                rationale=p.rationale,
                sources=p.sources,
                overallScore=p.overall_score,
                credibilityScore=p.credibility_score,
                domainRelevance=p.domain_relevance,
                technicalDepth=p.technical_depth,
                noveltyScore=p.novelty_score,
                queuedAt=p.created_at,
            )
            for p in queued
        ],
        queue_size=len(queued),
        next_publish_at=agent.next_publish_at,
        telemetry_window_minutes=settings.telemetry_window_minutes,
    )


@router.get("/status")
def get_status(agentId: str, db: Session = Depends(get_db)) -> dict:
    """Lightweight status endpoint returning scheduler/queue state for monitoring."""
    agent = db.get(Agent, agentId)
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agentId")
    state = get_scan_state(agentId)
    queue_size = db.scalar(
        select(Post).where(Post.agent_id == agentId, Post.status == "queued").count()
    ) if agent else 0
    return {
        "agentId": agentId,
        "scan_status": state.scan_status,
        "active_source_url": state.active_source_url,
        "queue_size": queue_size,
        "next_publish_at": agent.next_publish_at,
        "last_run_at": agent.last_run_at,
    }


@router.post("/queue/{post_id}/publish-now", response_model=PublishNowResponse)
async def publish_now(post_id: str, agentId: str, db: Session = Depends(get_db)) -> PublishNowResponse:
    """Manually release one specific queued post immediately and reset the
    publish timer, in response to a person clicking "Publish now" in the
    queue UI.

    Deliberately declared `async def` (not `def`): FastAPI runs `def`
    endpoints in a worker threadpool, which could run genuinely concurrently
    with the background publisher tick (also touching the same row) and
    risk a double-publish race. An `async def` endpoint that never awaits
    mid-operation runs on the single asyncio event loop instead, so it
    always executes atomically relative to the loop's own background tasks
    -- no other coroutine gets a chance to run until this one returns.
    """
    if not db.get(Agent, agentId):
        raise HTTPException(status_code=404, detail="Unknown agentId")

    ok = publish_specific_post(db, agentId, post_id)
    if not ok:
        raise HTTPException(
            status_code=409,
            detail="That post is no longer queued -- it may have just been published automatically.",
        )
    return PublishNowResponse(ok=True, postId=post_id)


@router.get("/{agent_id}", response_model=AgentSummary)
def get_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentSummary:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agentId")
    persona = json.loads(agent.persona_profile) if agent.persona_profile else {}
    return AgentSummary(
        id=agent.id,
        name=agent.name,
        domain=agent.domain,
        createdAt=agent.created_at,
        personaThroughline=persona.get("throughline"),
        personaBiases=persona.get("biases", []),
        personaSignatureMove=persona.get("signature_move"),
    )