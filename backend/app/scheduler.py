import asyncio
import logging

from app.config import get_settings
from app.db import SessionLocal
from app.models import Agent
from app.services.editorial import run_editorial_cycle

logger = logging.getLogger(__name__)

# Non-stop editorial loop. There is no APScheduler interval anymore: as soon as
# one full pass over every agent finishes, the next pass starts immediately.
# The only pause is a short courtesy cooldown between passes (configurable via
# Settings.cycle_cooldown_seconds) so we don't hammer RSS/HN endpoints in a
# tight loop — it is not a standby/idle state. The loop runs until the backend
# process is stopped (or stop_scheduler() is called on shutdown).
_loop_task: "asyncio.Task | None" = None
_stop_event: "asyncio.Event | None" = None


async def run_all_agents() -> None:
    db = SessionLocal()
    try:
        agent_ids = [agent.id for agent in db.query(Agent.id).all()]
    finally:
        db.close()
    for agent_id in agent_ids:
        db = SessionLocal()
        try:
            published = await run_editorial_cycle(db, agent_id)
            if published:
                logger.info("Agent %s published %s post(s) this cycle", agent_id, published)
        except Exception:
            logger.exception("Editorial cycle failed for agent %s", agent_id)
        finally:
            db.close()


async def _continuous_loop() -> None:
    settings = get_settings()
    assert _stop_event is not None
    while not _stop_event.is_set():
        await run_all_agents()
        if _stop_event.is_set():
            break
        # Short, interruptible pause — NOT an idle/standby period. If
        # stop_scheduler() fires mid-cooldown we exit immediately instead of
        # waiting out the full cooldown.
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=settings.cycle_cooldown_seconds)
        except asyncio.TimeoutError:
            pass


def start_scheduler() -> None:
    global _loop_task, _stop_event
    if _loop_task is not None and not _loop_task.done():
        return
    _stop_event = asyncio.Event()
    _loop_task = asyncio.create_task(_continuous_loop())


def stop_scheduler() -> None:
    global _loop_task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _loop_task is not None:
        _loop_task.cancel()