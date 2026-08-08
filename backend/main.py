from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.models import Agent, Post
from app.routers.agent import router as agent_router
from app.scheduler import start_scheduler, stop_scheduler

settings = get_settings()

# (table, column, sql type) migrations applied idempotently to existing local
# SQLite databases. Each ALTER TABLE errors safely (and is ignored) if the
# column already exists.
_COLUMN_MIGRATIONS = [
    ("topic_decisions", "credibility_score", "FLOAT"),
    ("topic_decisions", "domain_relevance", "FLOAT"),
    ("topic_decisions", "technical_depth", "FLOAT"),
    ("topic_decisions", "novelty_score", "FLOAT"),
    ("topic_decisions", "overall_credibility_index", "FLOAT"),
    ("agents", "post_count", "INTEGER DEFAULT 0"),
    ("agents", "persona_profile", "TEXT DEFAULT ''"),
    ("agents", "next_publish_at", "DATETIME"),
    ("posts", "sequence_number", "INTEGER DEFAULT 0"),
    ("posts", "status", "VARCHAR(16) DEFAULT 'queued'"),
    ("posts", "published_at", "DATETIME"),
    ("posts", "overall_score", "FLOAT DEFAULT 0.0"),
]


def _backfill_sequence_numbers() -> None:
    """Assign sequence numbers to posts created before this feature existed,
    so an already-running deployment resumes numbering instead of restarting
    at post one after upgrading."""
    db = SessionLocal()
    try:
        agents = db.query(Agent).filter(Agent.post_count == 0).all()
        for agent in agents:
            agent_posts = (
                db.query(Post)
                .filter(Post.agent_id == agent.id)
                .order_by(Post.created_at.asc())
                .all()
            )
            if not agent_posts:
                continue
            for i, post in enumerate(agent_posts, start=1):
                if not post.sequence_number:
                    post.sequence_number = i
            agent.post_count = len(agent_posts)
        db.commit()
    finally:
        db.close()


def _backfill_queue_status() -> None:
    """Posts created before the publish-queue feature existed have no
    `status`/`published_at` -- without this, the new "only show status ==
    'published'" filter in get_feed would make every existing post vanish
    from the UI. Anything that already has a sequence_number was clearly
    already live, so mark it published (using created_at as its publish
    time, since that's the closest we have)."""
    db = SessionLocal()
    try:
        legacy_posts = (
            db.query(Post)
            .filter(Post.sequence_number > 0, Post.status == "queued")
            .all()
        )
        for post in legacy_posts:
            post.status = "published"
            if post.published_at is None:
                post.published_at = post.created_at
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)

    # Safely perform local SQLite database migrations on startup
    with engine.connect() as conn:
        for table, col_name, col_type in _COLUMN_MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

    _backfill_sequence_numbers()
    _backfill_queue_status()

    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(agent_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}