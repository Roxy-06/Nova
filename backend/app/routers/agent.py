import asyncio

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
    TelemetryDecision,
    TelemetryResponse,
)
from app.services.editorial import run_editorial_cycle
from app.services.persona import build_voice_profile
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
    agent = Agent(
        name=payload.persona.name.strip(),
        domain=payload.persona.domain.strip(),
        voice_profile=build_voice_profile(payload.persona.name, payload.persona.domain),
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
    posts = db.scalars(select(Post).where(Post.agent_id == agentId).order_by(Post.created_at.desc())).all()
    feed_posts = [FeedPost(id=post.id, createdAt=post.created_at, text=post.text, rationale=post.rationale, sources=post.sources) for post in posts]
    return FeedResponse(posts=feed_posts)


@router.get("/telemetry", response_model=TelemetryResponse)
def get_telemetry(agentId: str, db: Session = Depends(get_db)) -> TelemetryResponse:
    if not db.get(Agent, agentId):
        raise HTTPException(status_code=404, detail="Unknown agentId")
    
    decisions = db.scalars(
        select(TopicDecision)
        .where(TopicDecision.agent_id == agentId)
        .order_by(TopicDecision.decided_at.desc())
        .limit(30)
    ).all()
    
    state = get_scan_state(agentId)
    
    return TelemetryResponse(
        active_source_url=state.active_source_url,
        scan_status=state.scan_status,
        chunks_processed=state.chunks_processed,
        decisions=list(decisions)
    )


@router.get("/{agent_id}", response_model=AgentSummary)
def get_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentSummary:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agentId")
    return AgentSummary(id=agent.id, name=agent.name, domain=agent.domain, createdAt=agent.created_at)
