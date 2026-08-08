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
    ("posts", "sequence_number", "INTEGER DEFAULT 0"),
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