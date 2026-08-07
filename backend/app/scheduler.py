from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.db import SessionLocal
from app.models import Agent
from app.services.editorial import run_editorial_cycle

scheduler = AsyncIOScheduler(timezone="UTC")


async def run_all_agents() -> None:
    db = SessionLocal()
    try:
        agent_ids = [agent.id for agent in db.query(Agent.id).all()]
    finally:
        db.close()
    for agent_id in agent_ids:
        db = SessionLocal()
        try:
            await run_editorial_cycle(db, agent_id)
        finally:
            db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(run_all_agents, "interval", hours=get_settings().posting_interval_hours, id="editorial-cycle", replace_existing=True)
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
