import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models import Agent, Post
from app.schemas import AgentSummary, FeedPost, InitRequest, InitResponse
from app.services.editorial import run_editorial_cycle
from app.services.persona import build_voice_profile

router = APIRouter(prefix="/api/agent", tags=["agent"])


async def initial_cycle(agent_id: str) -> None:
    db = SessionLocal()
    try:
        await run_editorial_cycle(db, agent_id)
    finally:
        db.close()


@router.post("/init", response_model=InitResponse, status_code=status.HTTP_201_CREATED)
async def init_agent(payload: InitRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> InitResponse:
    agent = Agent(name=payload.personaName.strip(), domain=payload.domain.strip(), voice_profile=build_voice_profile(payload.personaName, payload.domain))
    db.add(agent)
    db.commit()
    db.refresh(agent)
    background_tasks.add_task(initial_cycle, agent.id)
    return InitResponse(agentId=agent.id)


@router.get("/feed", response_model=list[FeedPost])
def get_feed(agentId: str, db: Session = Depends(get_db)) -> list[FeedPost]:
    if not db.get(Agent, agentId):
        raise HTTPException(status_code=404, detail="Unknown agentId")
    posts = db.scalars(select(Post).where(Post.agent_id == agentId).order_by(Post.created_at.desc())).all()
    return [FeedPost(id=post.id, createdAt=post.created_at, text=post.text, rationale=post.rationale, sources=post.sources) for post in posts]


@router.get("/{agent_id}", response_model=AgentSummary)
def get_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentSummary:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown agentId")
    return AgentSummary(id=agent.id, name=agent.name, domain=agent.domain, createdAt=agent.created_at)
