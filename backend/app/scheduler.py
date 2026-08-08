import asyncio
import logging

from app.config import get_settings
from app.db import SessionLocal
from app.models import Agent
from app.services.editorial import publish_due_posts, run_editorial_cycle

logger = logging.getLogger(__name__)

# Two independent, non-stop loops:
#   - discovery loop: fetch, score, and QUEUE candidates. Slow (network +
#     LLM calls), so it can't be the thing that paces publishing.
#   - publisher loop: fast, cheap DB-only tick that releases at most one
#     queued post per agent once that agent's cooldown has elapsed. This is
#     what makes publishing spaced out and independent of how fast/slow
#     discovery happens to be running.
# Both stop only when the backend process is stopped.
_discovery_task: "asyncio.Task | None" = None
_publisher_task: "asyncio.Task | None" = None
_stop_event: "asyncio.Event | None" = None

PUBLISHER_TICK_SECONDS = 5


async def run_all_agents() -> None:
    db = SessionLocal()
    try:
        agent_ids = [agent.id for agent in db.query(Agent.id).all()]
    finally:
        db.close()
    for agent_id in agent_ids:
        db = SessionLocal()
        try:
            queued = await run_editorial_cycle(db, agent_id)
            if queued:
                logger.info("Agent %s queued %s new post(s) this cycle", agent_id, queued)
        except Exception:
            logger.exception("Editorial cycle failed for agent %s", agent_id)
        finally:
            db.close()


async def _discovery_loop() -> None:
    settings = get_settings()
    assert _stop_event is not None
    while not _stop_event.is_set():
        await run_all_agents()
        if _stop_event.is_set():
            break
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=settings.cycle_cooldown_seconds)
        except asyncio.TimeoutError:
            pass


async def _publisher_loop() -> None:
    assert _stop_event is not None
    while not _stop_event.is_set():
        db = SessionLocal()
        try:
            agent_ids = [agent.id for agent in db.query(Agent.id).all()]
        finally:
            db.close()

        for agent_id in agent_ids:
            db = SessionLocal()
            try:
                published = publish_due_posts(db, agent_id)
                if published:
                    logger.info("Agent %s published a queued post", agent_id)
            except Exception:
                logger.exception("Publish tick failed for agent %s", agent_id)
            finally:
                db.close()

        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=PUBLISHER_TICK_SECONDS)
        except asyncio.TimeoutError:
            pass


def start_scheduler() -> None:
    global _discovery_task, _publisher_task, _stop_event
    if _discovery_task is not None and not _discovery_task.done():
        return
    _stop_event = asyncio.Event()
    _discovery_task = asyncio.create_task(_discovery_loop())
    _publisher_task = asyncio.create_task(_publisher_loop())


def stop_scheduler() -> None:
    global _discovery_task, _publisher_task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _discovery_task is not None:
        _discovery_task.cancel()
    if _publisher_task is not None:
        _publisher_task.cancel()