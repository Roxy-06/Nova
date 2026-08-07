from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Agent, Post, TopicDecision
from app.services.discovery import Candidate, discover_candidates
from app.services.memory import recently_covered, source_seen, topic_key
from app.services.persona import compose_post

SIGNAL_TERMS = {"ai", "model", "robot", "security", "chip", "compute", "agent", "openai", "anthropic", "google", "microsoft", "nvidia", "automation", "data"}
NOISE_TERMS = {"review", "deal", "coupon", "hands-on", "podcast", "opinion"}


def score(candidate: Candidate, domain: str) -> tuple[int, str]:
    words = set((candidate.title + " " + candidate.summary).lower().split())
    domain_words = set(domain.lower().split())
    relevance = len(words & (SIGNAL_TERMS | domain_words))
    if words & NOISE_TERMS:
        return 0, "Rejected: promotional or commentary-led item, not a durable primary signal."
    if relevance < 2:
        return relevance, "Rejected: insufficient connection to the persona's specialist domain."
    return min(10, relevance + 4), "Accepted: material technology development with a clear domain implication."


async def run_editorial_cycle(db: Session, agent_id: str) -> int:
    agent = db.get(Agent, agent_id)
    if not agent:
        return 0
    candidates = await discover_candidates()
    selected: Candidate | None = None
    selected_key = ""
    selected_score = 0
    for candidate in candidates:
        if source_seen(db, agent_id, candidate.url):
            continue
        key = topic_key(candidate.title)
        candidate_score, reason = score(candidate, agent.domain)
        duplicate = recently_covered(db, agent_id, key)
        decision = "rejected" if candidate_score < 5 or duplicate else "accepted"
        if duplicate:
            reason = "Rejected: substantially overlaps a recently published topic; preserving narrative variety."
        db.add(TopicDecision(agent_id=agent_id, source_url=candidate.url, headline=candidate.title, topic_key=key, decision=decision, reason=reason, score=str(candidate_score)))
        if decision == "accepted" and candidate_score > selected_score:
            selected, selected_key, selected_score = candidate, key, candidate_score
    if selected:
        prior = db.scalar(select(Post.topic_key).where(Post.agent_id == agent_id).order_by(Post.created_at.desc()).limit(1))
        rationale = (
            f"Selected after scoring {selected_score}/10 for relevance to {agent.domain} and filtering out "
            "promotional, off-domain, and recently-covered candidates. It is timely because it is in the current "
            f"discovery cycle. Primary editorial source: {selected.source_name}."
        )
        db.add(Post(agent_id=agent_id, text=compose_post(agent, selected.title, selected.summary, prior), rationale=rationale, sources=[selected.url], topic_key=selected_key))
    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()
    return 1 if selected else 0
