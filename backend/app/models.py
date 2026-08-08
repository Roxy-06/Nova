import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(100))
    domain: Mapped[str] = mapped_column(String(160))
    voice_profile: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Monotonically increasing counter, persisted in SQL. Never resets, even across
    # backend restarts, so post numbering always continues where it left off.
    post_count: Mapped[int] = mapped_column(default=0)
    posts: Mapped[list["Post"]] = relationship(back_populates="agent", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    # Persisted, per-agent post number (1, 2, 3, ...). Set once at creation from
    # Agent.post_count, so a restarted backend resumes numbering instead of
    # starting back at post one.
    sequence_number: Mapped[int] = mapped_column(default=0, index=True)
    text: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    sources: Mapped[list[str]] = mapped_column(JSON)
    topic_key: Mapped[str] = mapped_column(String(180), index=True)
    agent: Mapped[Agent] = relationship(back_populates="posts")


class TopicDecision(Base):
    __tablename__ = "topic_decisions"
    __table_args__ = (UniqueConstraint("agent_id", "source_url", name="uq_agent_source"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    source_url: Mapped[str] = mapped_column(String(1000))
    headline: Mapped[str] = mapped_column(Text)
    topic_key: Mapped[str] = mapped_column(String(180), index=True)
    decision: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str] = mapped_column(Text)
    score: Mapped[str] = mapped_column(String(16))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Reasoning matrices fields
    credibility_score: Mapped[float | None] = mapped_column(nullable=True)
    domain_relevance: Mapped[float | None] = mapped_column(nullable=True)
    technical_depth: Mapped[float | None] = mapped_column(nullable=True)
    novelty_score: Mapped[float | None] = mapped_column(nullable=True)
    overall_credibility_index: Mapped[float | None] = mapped_column(nullable=True)