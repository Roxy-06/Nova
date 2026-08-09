from datetime import datetime, timedelta, timezone
import json
import logging
import random

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Agent, Post, TopicDecision
from app.services.discovery import Candidate, SOURCES, discover_source_candidates
from app.services.llm import GeminiUnavailable, call_gemini
from app.services.memory import recently_covered, source_seen, topic_key
from app.services.persona import compose_post
from app.services.state import get_scan_state

logger = logging.getLogger(__name__)


def backup_score(title: str, summary: str, domain: str, recent_topics: list[str]) -> dict:
    words = set((title + " " + summary).lower().split())
    domain_words = set(domain.lower().split())
    SIGNAL_TERMS = {"ai", "model", "robot", "security", "chip", "compute", "agent", "openai", "anthropic", "google", "microsoft", "nvidia", "automation", "data"}
    NOISE_TERMS = {"review", "deal", "coupon", "hands-on", "podcast", "opinion"}

    relevance_words = words & (SIGNAL_TERMS | domain_words)
    has_noise = any(w in words for w in NOISE_TERMS)

    domain_relevance = min(10.0, float(len(relevance_words) * 2.0))
    if domain_relevance < 2:
        domain_relevance = 1.0

    credibility_score = 9.0 if not has_noise else 4.0
    technical_depth = min(10.0, float(len(words & SIGNAL_TERMS) * 1.5))
    if technical_depth < 1:
        technical_depth = 3.0

    novelty_score = 10.0
    title_words = set(title.lower().split())
    for t in recent_topics:
        overlap = len(title_words & set(t.lower().split()))
        if overlap >= 3:
            novelty_score = 2.0
            break
        elif overlap >= 1:
            novelty_score = min(novelty_score, 10.0 - overlap * 2.0)

    reason = "Backup Scorer: "
    if has_noise:
        reason += "Rejected content containing promotional key terms. "
    if domain_relevance < 7.0:
        reason += f"Failed domain match with score {domain_relevance}/10. "
    else:
        reason += "Sufficient domain match and credibility indicators. "

    return {
        "credibility_score": credibility_score,
        "domain_relevance": domain_relevance,
        "technical_depth": technical_depth,
        "novelty_score": novelty_score,
        "reason": reason,
    }


async def evaluate_candidates_batch(
    candidates: list[Candidate],
    domain: str,
    voice_profile: str,
    recent_topics: list[str],
) -> list[dict]:
    """Score every candidate in ONE Gemini call instead of one call per
    candidate. Free-tier quotas (as low as 5 requests/minute) make a
    per-candidate call architecturally unworkable once a cycle turns up more
    than a handful of new articles. Returns a list aligned index-for-index
    with `candidates`. Falls back to the keyword-based backup_score for
    every candidate (still per-candidate, but free/local/instant) if no key
    is configured or the batch call fails for any reason."""
    if not candidates:
        return []

    settings = get_settings()
    if not settings.gemini_api_key:
        return [backup_score(c.title, c.summary, domain, recent_topics) for c in candidates]

    recent_topics_str = "\n".join([f"- {t}" for t in recent_topics]) if recent_topics else "None"
    articles_block = "\n\n".join(
        f"[{i}] Title: {c.title}\nSummary: {c.summary}" for i, c in enumerate(candidates)
    )

    prompt = f"""You are an autonomous AI technology editorial scoring model. Score EVERY article below independently.

Agent Specialty Domain: {domain}
Agent Voice Profile Description: {voice_profile}

Recently Covered Topics in Memory:
{recent_topics_str}

Articles to score (indexed):
{articles_block}

For EACH article, evaluate 4 metrics as floating-point scores 0.0-10.0:
1. credibility_score: source authority, absence of clickbait/sensationalism, factuality.
2. domain_relevance: alignment with the specialist domain.
3. technical_depth: substantive technical value vs superficial hype.
4. novelty_score: differentiation from recently covered topics.

Return a JSON array with exactly {len(candidates)} objects, in the same order as the articles above, each with: index, credibility_score, domain_relevance, technical_depth, novelty_score, reason."""

    schema = {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "index": {"type": "NUMBER"},
                "credibility_score": {"type": "NUMBER"},
                "domain_relevance": {"type": "NUMBER"},
                "technical_depth": {"type": "NUMBER"},
                "novelty_score": {"type": "NUMBER"},
                "reason": {"type": "STRING"},
            },
            "required": ["index", "credibility_score", "domain_relevance", "technical_depth", "novelty_score", "reason"],
        },
    }

    try:
        text = await call_gemini(settings.gemini_scoring_model, prompt, response_schema=schema)
        data = json.loads(text)
        by_index = {int(item["index"]): item for item in data}
        results = []
        for i in range(len(candidates)):
            item = by_index.get(i)
            if item is None:
                results.append(backup_score(candidates[i].title, candidates[i].summary, domain, recent_topics))
                continue
            results.append({
                "credibility_score": round(float(item.get("credibility_score", 0.0)), 1),
                "domain_relevance": round(float(item.get("domain_relevance", 0.0)), 1),
                "technical_depth": round(float(item.get("technical_depth", 0.0)), 1),
                "novelty_score": round(float(item.get("novelty_score", 0.0)), 1),
                "reason": str(item.get("reason", "No reason provided.")),
            })
        return results
    except GeminiUnavailable as e:
        logger.warning(f"Batch scoring unavailable, using backup scorer for {len(candidates)} candidates: {e}")
        return [backup_score(c.title, c.summary, domain, recent_topics) for c in candidates]
    except Exception as e:
        logger.error(f"Batch scoring response malformed, using backup scorer: {e}")
        return [backup_score(c.title, c.summary, domain, recent_topics) for c in candidates]


async def run_editorial_cycle(db: Session, agent_id: str) -> int:
    """Discover, score, and QUEUE candidates (does not publish directly --
    see publish_due_posts for that). Returns the number newly queued."""
    agent = db.get(Agent, agent_id)
    if not agent:
        return 0

    state = get_scan_state(agent_id)
    state.scan_status = "fetching"
    state.chunks_processed = 0
    state.active_source_url = None

    candidates: list[Candidate] = []
    headers = {"User-Agent": "SignalCraft/1.0"}
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers=headers) as client:
        for source in SOURCES:
            state.active_source_url = source["url"]
            state.scan_status = "fetching"
            source_candidates = await discover_source_candidates(client, source)
            candidates.extend(source_candidates)

    # De-dupe by URL up front (overlapping sources like HN scrape + HN
    # Algolia API can return the same story in one pass).
    seen_urls: set[str] = set()
    deduped: list[Candidate] = []
    for c in candidates:
        if c.url in seen_urls:
            continue
        seen_urls.add(c.url)
        deduped.append(c)
    candidates = deduped

    # Only score candidates we haven't already decided on -- this is also
    # what keeps the batch call small.
    state.scan_status = "analyzing"
    unseen = [c for c in candidates if not source_seen(db, agent_id, c.url)]
    state.chunks_processed = len(unseen)

    if not unseen:
        agent.last_run_at = datetime.now(timezone.utc)
        db.commit()
        state.scan_status = "idle"
        state.active_source_url = None
        return 0

    recent_topics = list(db.scalars(
        select(TopicDecision.headline)
        .where(TopicDecision.agent_id == agent_id, TopicDecision.decision == "accepted")
        .order_by(TopicDecision.decided_at.desc())
        .limit(15)
    ).all())

    persona_profile = json.loads(agent.persona_profile) if agent.persona_profile else None

    state.scan_status = "verifying"
    assessments = await evaluate_candidates_batch(unseen, agent.domain, agent.voice_profile, recent_topics)

    # Continuity reference for opinion-writing: the most recently PUBLISHED
    # post's topic (queued-but-not-yet-published items don't count -- the
    # reader hasn't seen them yet, so referencing them as "recent" would be
    # incoherent).
    continuity_key = db.scalar(
        select(Post.topic_key)
        .where(Post.agent_id == agent_id, Post.status == "published")
        .order_by(Post.published_at.desc())
        .limit(1)
    )

    queued_count = 0

    for candidate, assessment in zip(unseen, assessments):
        state.active_source_url = candidate.url
        key = topic_key(candidate.title)

        credibility_score = assessment["credibility_score"]
        domain_relevance = assessment["domain_relevance"]
        technical_depth = assessment["technical_depth"]
        novelty_score = assessment["novelty_score"]
        reason = assessment["reason"]

        duplicate = recently_covered(db, agent_id, key)
        if duplicate:
            novelty_score = min(novelty_score, 2.0)

        overall_credibility_index = round((credibility_score + domain_relevance + technical_depth + novelty_score) / 4.0, 1)

        decision = "rejected"
        if duplicate:
            reason = f"Rejected: shares too much overlap with recently published posts. {reason}"
        elif credibility_score >= 8.0 and domain_relevance >= 7.0:
            decision = "accepted"
        else:
            reasons = []
            if credibility_score < 8.0:
                reasons.append(f"Low Credibility ({credibility_score:.1f}/10)")
            if domain_relevance < 7.0:
                reasons.append(f"Insufficient Domain Relevance ({domain_relevance:.1f}/10)")
            reason = f"Rejected: {', '.join(reasons)}. {reason}"

        db.add(TopicDecision(
            agent_id=agent_id,
            source_url=candidate.url,
            headline=candidate.title,
            topic_key=key,
            decision=decision,
            reason=reason,
            score=f"{overall_credibility_index:.1f}",
            credibility_score=credibility_score,
            domain_relevance=domain_relevance,
            technical_depth=technical_depth,
            novelty_score=novelty_score,
            overall_credibility_index=overall_credibility_index,
        ))

        queued_this_candidate = False
        if decision == "accepted":
            state.scan_status = "drafting"
            state.active_source_url = candidate.url

            take_text = await compose_post(agent, candidate.title, candidate.summary, continuity_key, persona_profile)

            rationale = (
                f"Queued after scoring {overall_credibility_index}/10 overall credibility index. "
                f"credibility={credibility_score:.1f}, domain_relevance={domain_relevance:.1f}, "
                f"technical_depth={technical_depth:.1f}, novelty={novelty_score:.1f}. "
                f"Primary source: {candidate.source_name}. "
                f"Why relevant now: discovered on {candidate.source_name} and surfaced by our continuous scan. "
                f"Selection rationale: accepted because it met the credibility and domain thresholds and added sufficient novelty relative to recent coverage."
            )

            db.add(Post(
                agent_id=agent_id,
                status="queued",
                overall_score=overall_credibility_index,
                credibility_score=credibility_score,
                domain_relevance=domain_relevance,
                technical_depth=technical_depth,
                novelty_score=novelty_score,
                text=take_text,
                rationale=rationale,
                sources=[candidate.url],
                topic_key=key,
            ))
            queued_this_candidate = True

        # Commit per-candidate rather than batching the whole cycle into one
        # transaction: holding one long write transaction open across many
        # sequential network calls previously caused SQLite "database is
        # locked" errors against normal API requests.
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            logger.warning(f"Duplicate source_url for agent {agent_id}, skipping: {candidate.url}")
            continue

        if queued_this_candidate:
            recent_topics.insert(0, candidate.title)
            recent_topics = recent_topics[:15]
            continuity_key = key
            queued_count += 1

    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()

    state.scan_status = "idle"
    state.active_source_url = None
    return queued_count


def _do_publish(db: Session, agent: Agent, post: Post, now: datetime) -> None:
    """Shared release logic used by both the automatic timer-driven publish
    and the manual "Publish now" action, so both paths number posts and
    reset the timer identically -- a manual publish is not a special case,
    it's just a normal publish that happened to be triggered by a click
    instead of a timer."""
    settings = get_settings()
    agent.post_count += 1
    post.status = "published"
    post.published_at = now
    post.sequence_number = agent.post_count
    agent.next_publish_at = now + timedelta(
        minutes=random.uniform(settings.publish_min_minutes, settings.publish_max_minutes)
    )


def publish_due_posts(db: Session, agent_id: str) -> int:
    """Release at most one queued post if the agent's cooldown has elapsed.
    Picks the highest-scored queued item, not strict FIFO. Runs on its own
    fast, independent tick -- separate from the (slower) discovery/scoring
    cycle -- so scanning is never blocked waiting on the publish timer, and
    the publish timer is never blocked waiting on a slow scan."""
    agent = db.get(Agent, agent_id)
    if not agent:
        return 0

    now = datetime.now(timezone.utc)
    if agent.next_publish_at is not None and now < agent.next_publish_at:
        return 0

    next_post = db.scalar(
        select(Post)
        .where(Post.agent_id == agent_id, Post.status == "queued")
        .order_by(Post.overall_score.desc(), Post.created_at.asc())
        .limit(1)
    )
    if next_post is None:
        # Nothing ready yet -- leave next_publish_at alone so a post
        # publishes immediately once one becomes available, instead of
        # forcing an extra full wait on top of an already-elapsed timer.
        return 0

    _do_publish(db, agent, next_post, now)
    db.commit()
    return 1


def publish_specific_post(db: Session, agent_id: str, post_id: str) -> bool:
    """Manually publish one specific queued post right now, out of score
    order, in response to a person clicking "Publish now" in the queue UI.
    Uses the exact same numbering + timer-reset logic as an automatic
    publish (_do_publish), so the next scheduled release still waits a
    fresh randomized 10-15 min window from this moment rather than firing
    immediately right behind a manual publish."""
    agent = db.get(Agent, agent_id)
    if not agent:
        return False

    post = db.get(Post, post_id)
    if not post or post.agent_id != agent_id or post.status != "queued":
        # Either it doesn't exist, belongs to a different agent, or someone
        # else (the automatic publisher tick) already published it a moment
        # ago -- either way there's nothing valid left to do here.
        return False

    _do_publish(db, agent, post, datetime.now(timezone.utc))
    db.commit()
    return True