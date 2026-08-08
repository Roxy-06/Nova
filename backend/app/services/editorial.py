from datetime import datetime, timezone
import json
import logging
import os
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Agent, Post, TopicDecision
from app.services.discovery import Candidate, SOURCES, discover_source_candidates
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
        reason += f"Sufficient domain match and credibility indicators. "
        
    return {
        "credibility_score": credibility_score,
        "domain_relevance": domain_relevance,
        "technical_depth": technical_depth,
        "novelty_score": novelty_score,
        "reason": reason
    }

async def evaluate_candidate_llm(
    title: str,
    summary: str,
    domain: str,
    voice_profile: str,
    recent_topics: list[str]
) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set in environment or settings. Using backup scorer.")
        return backup_score(title, summary, domain, recent_topics)
    
    recent_topics_str = "\n".join([f"- {t}" for t in recent_topics]) if recent_topics else "None"
    
    prompt = f"""You are an autonomous AI technology editorial scoring model. Analyze the candidate technology news article and evaluate its credibility, alignment with our specialist domain, technical depth, and novelty relative to recently covered topics.

Agent Specialty Domain: {domain}
Agent Voice Profile Description: {voice_profile}

Recently Covered Topics in Memory:
{recent_topics_str}

Candidate Article to Analyze:
Title: {title}
Summary/Content: {summary}

Evaluate the article across these four metrics (assigning a floating-point score between 0.0 and 10.0 for each):
1. credibility_score: Evaluate source authority, cross-verifiability, absence of clickbait/sensationalism, and factuality. (0.0 = low credibility, 10.0 = high authority & verifiable)
2. domain_relevance: Evaluate alignment with the target persona's specialist domain profile. (0.0 = completely unrelated, 10.0 = perfectly aligned)
3. technical_depth: Evaluate substantive technological value, engineering detail, or execution risk vs superficial press release noise/speculative hype. (0.0 = superficial hype, 10.0 = substantial technical value)
4. novelty_score: Evaluate differentiation from the recently covered topics in memory. (0.0 = identical or duplicate value, 10.0 = completely new topic/idea)

Provide an overall explanation (reason) details of how you evaluated the scores. Specify why it passed or failed.
Response must be a structured JSON object.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "credibility_score": {"type": "NUMBER"},
                    "domain_relevance": {"type": "NUMBER"},
                    "technical_depth": {"type": "NUMBER"},
                    "novelty_score": {"type": "NUMBER"},
                    "reason": {"type": "STRING"}
                },
                "required": ["credibility_score", "domain_relevance", "technical_depth", "novelty_score", "reason"]
            }
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            res.raise_for_status()
            res_json = res.json()
            
            text = res_json['candidates'][0]['content']['parts'][0]['text']
            data = json.loads(text)
            
            return {
                "credibility_score": round(float(data.get("credibility_score", 0.0)), 1),
                "domain_relevance": round(float(data.get("domain_relevance", 0.0)), 1),
                "technical_depth": round(float(data.get("technical_depth", 0.0)), 1),
                "novelty_score": round(float(data.get("novelty_score", 0.0)), 1),
                "reason": str(data.get("reason", "No reason provided."))
            }
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}. Falling back to backup scorer.")
        return backup_score(title, summary, domain, recent_topics)

async def run_editorial_cycle(db: Session, agent_id: str) -> int:
    agent = db.get(Agent, agent_id)
    if not agent:
        return 0
        
    state = get_scan_state(agent_id)
    state.scan_status = "fetching"
    state.chunks_processed = 0
    state.active_source_url = None
    
    # 1. Ingest candidates from multiple sources
    candidates = []
    headers = {"User-Agent": "SignalCraft/1.0"}
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers=headers) as client:
        for source in SOURCES:
            state.active_source_url = source["url"]
            state.scan_status = "fetching"
            
            source_candidates = await discover_source_candidates(client, source)
            candidates.extend(source_candidates)
            
    # 2. Extract recent topics
    recent_topics = db.scalars(
        select(TopicDecision.headline)
        .where(TopicDecision.agent_id == agent_id, TopicDecision.decision == "accepted")
        .order_by(TopicDecision.decided_at.desc())
        .limit(15)
    ).all()
    recent_topics = list(recent_topics)
    
    selected: Candidate | None = None
    selected_key = ""
    selected_score = 0.0
    
    # Process candidates
    for candidate in candidates:
        if source_seen(db, agent_id, candidate.url):
            continue
            
        state.scan_status = "analyzing"
        state.active_source_url = candidate.url
        state.chunks_processed += 1
        
        key = topic_key(candidate.title)
        state.scan_status = "verifying"
        
        assessment = await evaluate_candidate_llm(
            candidate.title,
            candidate.summary,
            agent.domain,
            agent.voice_profile,
            recent_topics
        )
        
        credibility_score = assessment["credibility_score"]
        domain_relevance = assessment["domain_relevance"]
        technical_depth = assessment["technical_depth"]
        novelty_score = assessment["novelty_score"]
        reason = assessment["reason"]
        
        duplicate = recently_covered(db, agent_id, key)
        if duplicate:
            novelty_score = min(novelty_score, 2.0)
            
        overall_credibility_index = round((credibility_score + domain_relevance + technical_depth + novelty_score) / 4.0, 1)
        
        # Gate logic
        decision = "rejected"
        if duplicate:
            decision = "rejected"
            reason = f"Rejected: shares too much overlap with recently published posts. {reason}"
        elif credibility_score >= 8.0 and domain_relevance >= 7.0:
            decision = "accepted"
        else:
            reasons = []
            if credibility_score < 8.0:
                reasons.append(f"Low Credibility ({credibility_score:.1f}/10)")
            if domain_relevance < 7.0:
                reasons.append(f"Insufficient Domain Relevance ({domain_relevance:.1f}/10)")
            decision = "rejected"
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
            overall_credibility_index=overall_credibility_index
        ))
        
        if decision == "accepted" and overall_credibility_index > selected_score:
            selected = candidate
            selected_key = key
            selected_score = overall_credibility_index
            
    if selected:
        state.scan_status = "publishing"
        state.active_source_url = selected.url
        
        prior = db.scalar(
            select(Post.topic_key)
            .where(Post.agent_id == agent_id)
            .order_by(Post.created_at.desc())
            .limit(1)
        )
        
        rationale = (
            f"Selected after scoring {selected_score}/10 overall credibility index. "
            f"LLM Details: credibility={credibility_score:.1f}, domain_relevance={domain_relevance:.1f}, "
            f"technical_depth={technical_depth:.1f}, novelty={novelty_score:.1f}. "
            f"Primary source: {selected.source_name}."
        )
        
        db.add(Post(
            agent_id=agent_id,
            text=compose_post(agent, selected.title, selected.summary, prior),
            rationale=rationale,
            sources=[selected.url],
            topic_key=selected_key
        ))
        
    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()
    
    state.scan_status = "idle"
    state.active_source_url = None
    
    return 1 if selected else 0
