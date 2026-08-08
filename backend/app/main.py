from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.db import Base, engine
from app.routers.agent import router as agent_router
from app.scheduler import start_scheduler, stop_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    
    # Safely perform local SQLite database migrations on startup
    with engine.connect() as conn:
        for col_name in [
            "credibility_score",
            "domain_relevance",
            "technical_depth",
            "novelty_score",
            "overall_credibility_index"
        ]:
            try:
                # SQLite ALTER command; will error safely if column already exists
                conn.execute(text(f"ALTER TABLE topic_decisions ADD COLUMN {col_name} FLOAT"))
                conn.commit()
            except Exception:
                pass
                
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
# backend/app/main.py