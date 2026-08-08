import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models import Agent, Post, TopicDecision
from app.schemas import (
    AgentSummary,
    FeedPost,
    FeedResponse,
    InitRequest,
    InitResponse,
    QueuedPost,
    TelemetryDecision,
    TelemetryResponse,
)
from app.services.editorial import run_editorial_cycle
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
    # but not yet released) posts show up separately in telemetry.
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
        )
        for post in posts
    ]
    return FeedResponse(posts=feed_posts)


@router.get("/telemetry", response_model=TelemetryResponse)
def get_telemetry(agentId: str, db: Session = Depends(get_db)) -> TelemetryResponse:
    agent = db.get(Agent, agentId)
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agentId")

    decisions = db.scalars(
        select(TopicDecision)
        .where(TopicDecision.agent_id == agentId)
        .order_by(TopicDecision.decided_at.desc())
        .limit(30)
    ).all()

    # Every queued post, ranked the same way the publisher will release them
    # (best score first) -- so "next up" in the UI matches what will
    # actually publish next.
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
            QueuedPost(id=p.id, text=p.text, sources=p.sources, overallScore=p.overall_score, queuedAt=p.created_at)
            for p in queued
        ],
        queue_size=len(queued),
        next_publish_at=agent.next_publish_at,
    )


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