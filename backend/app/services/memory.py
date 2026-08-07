import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Post, TopicDecision


def topic_key(text: str) -> str:
    words = re.findall(r"[a-z0-9]{3,}", text.lower())
    return "-".join(words[:8])[:180]


def recently_covered(db: Session, agent_id: str, key: str) -> bool:
    recent = db.scalars(select(Post.topic_key).where(Post.agent_id == agent_id).order_by(Post.created_at.desc()).limit(12)).all()
    key_words = set(key.split("-"))
    return any(len(key_words.intersection(existing.split("-"))) >= 3 for existing in recent)


def source_seen(db: Session, agent_id: str, url: str) -> bool:
    return db.scalar(select(TopicDecision.id).where(TopicDecision.agent_id == agent_id, TopicDecision.source_url == url)) is not None
