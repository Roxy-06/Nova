import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, TypeDecorator, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """DateTime that is always timezone-aware (UTC) once it comes back out of
    the database.

    SQLite has no native timezone-aware datetime type: it just stores a plain
    string, and SQLAlchemy's DateTime(timezone=True) hint doesn't actually
    make SQLite remember an offset. The practical effect: every timestamp
    saved as `datetime.now(timezone.utc)` came back out of the DB as a NAIVE
    datetime. FastAPI/Pydantic then serialized it as an ISO string with no
    "Z"/offset suffix (e.g. "2026-08-08T07:09:53"), and per the JS Date spec,
    an offset-less ISO string is parsed as LOCAL time, not UTC -- so every
    timestamp shown in the UI was silently shifted by the viewer's own
    timezone offset. This type fixes it at the source: values are always
    treated as UTC on the way in and always come back tz-aware on the way
    out, so the API always serializes a proper UTC offset and the browser
    converts to local time correctly.
    """
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(100))
    domain: Mapped[str] = mapped_column(String(160))
    voice_profile: Mapped[str] = mapped_column(Text)
    # JSON-encoded {"throughline": ..., "biases": [...], "signature_move": ...}
    # -- a persistent editorial identity, not just a one-line tone
    # description. Generated once at agent creation (LLM if a key is
    # configured, template fallback otherwise) and reused on every post.
    persona_profile: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_run_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    # When the queue is next allowed to release a post. None means "publish
    # as soon as anything is queued" (e.g. a brand new agent).
    next_publish_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    # Monotonically increasing counter, persisted in SQL. Never resets, even across
    # backend restarts, so post numbering always continues where it left off.
    # Only incremented when a post actually PUBLISHES (leaves the queue), not
    # when it's drafted/queued.
    post_count: Mapped[int] = mapped_column(default=0)
    posts: Mapped[list["Post"]] = relationship(back_populates="agent", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    # When this take was drafted and placed in the queue.
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    # When it actually left the queue and went live. Null while queued.
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, index=True)
    # "queued" | "published". The public feed only ever shows "published".
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    # Persisted, per-agent post number (1, 2, 3, ...), assigned only at the
    # moment of actual publish (not when queued) so numbering reflects real
    # publish order. A restarted backend resumes numbering instead of
    # starting back at post one.
    sequence_number: Mapped[int] = mapped_column(default=0, index=True)
    # Overall credibility index carried over from scoring, so the queue can
    # release the best-ranked queued item first rather than strict FIFO.
    overall_score: Mapped[float] = mapped_column(default=0.0)
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
    decided_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    # Reasoning matrices fields
    credibility_score: Mapped[float | None] = mapped_column(nullable=True)
    domain_relevance: Mapped[float | None] = mapped_column(nullable=True)
    technical_depth: Mapped[float | None] = mapped_column(nullable=True)
    novelty_score: Mapped[float | None] = mapped_column(nullable=True)
    overall_credibility_index: Mapped[float | None] = mapped_column(nullable=True)