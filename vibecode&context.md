# NOVA — Implementation Handoff (vibecode.md)

**Complete technical reference for understanding and extending NOVA.**

**Audit Date:** August 8, 2026  
**Codebase Size:** ~1,440 lines  
**Rating:** 8.0/10 (Genuine editorial intelligence + real-time telemetry + no publishing yet)

---

## ⚠️ READ THIS FIRST (2026-08-08, Session 6): Current Pipeline Shape

This file has grown across six sessions and several sections below are
explicitly marked stale. Here is the actual current shape of the system,
which supersedes anything below that conflicts with it. See `Prompts.md`
Sessions 3-6 for the full history of how it got here.

**Two independent backend loops** (`app/scheduler.py`), not one:
- **Discovery loop** (`run_all_agents` → `run_editorial_cycle`): fetches all
  sources, batch-scores every new candidate in ONE Gemini call (not one call
  per candidate — free-tier quotas as low as 5 req/min made per-candidate
  calls architecturally broken), and **queues** anything that clears the
  gate. It never publishes directly.
- **Publisher loop** (`publish_due_posts`, ~5s tick, independent of the slow
  discovery loop): releases at most one queued post — highest `overall_score`
  first — once `Agent.next_publish_at` has elapsed, then reschedules itself
  `random(10, 15)` minutes out (`.env`: `PUBLISH_MIN_MINUTES`/`MAX_MINUTES`).

**Persona is real, not a one-line tone description.** `app/services/persona.py`
generates a persistent `throughline` + `biases` + `signature_move` once per
agent (`Agent.persona_profile`, LLM-generated if a key exists, template
fallback otherwise), and `compose_post()` makes an actual LLM call instructed
to take a stance using that identity — it does not template-summarize the
article anymore (that only happens as a last-resort fallback with no key).

**Timestamps are timezone-safe.** `app/models.py` has a `UTCDateTime`
TypeDecorator wrapping every datetime column. Without it, SQLite silently
drops tzinfo on read, FastAPI serializes an offset-less ISO string, and
browsers parse that as *local* time per the JS Date spec — silently
shifting every timestamp by the viewer's UTC offset. Don't remove this type
or add a new `DateTime(timezone=True)` column without it.

**Gemini calls go through `app/services/llm.py`**, not raw `httpx` calls
scattered in `editorial.py`/`persona.py`. It tracks a per-model 429 backoff
(parses Google's own "retry in Ns" hint) so a rate-limited model isn't
hammered again until the window clears. `gemini_model` (opinion-writing) and
`gemini_scoring_model` (bulk scoring) are separate `.env` settings on
purpose — pick different models/tiers for each if one's quota is tighter.

**Not yet built (explicitly deferred, not forgotten):** RAG/embeddings-based
memory. Current dedup (`memory.py`) is still literal word-overlap on topic
keys, not semantic similarity. This was item 5 of the Session 5 roadmap and
is the next planned piece of work.

---

## Executive Summary

NOVA is an **LLM-assisted autonomous news curator** that:

1. **Initializes** once with a persona name and specialist domain
2. **Discovers** technology news from RSS feeds, web scraping, and APIs (async, multi-source)
3. **Evaluates** using Gemini 1.5 Flash API (4 semantic dimensions via JSON schema)
4. **Deduplicates** against editorial memory (12 prior posts, word overlap ≥3)
5. **Publishes** to SQLite with full reasoning and source attribution
6. **Remembers** every decision in an audit table for transparency

**No prompting after initialization.** As of 2026-08-08, runs continuously and non-stop via a plain `asyncio` loop — no fixed interval. As soon as one full pass across every agent finishes, the next starts immediately, with only a short (default 10s) courtesy cooldown between passes. It never enters a real standby state; it only stops when the backend process is stopped.

---

## What's Real vs. What's Not

### Real ✅

| Component | Status | Evidence |
|-----------|--------|----------|
| Editorial scoring | Real | Calls Gemini API with structured JSON request |
| Deduplication | Real | Word overlap detection + source tracking in DB |
| Discovery | Real | Live RSS, web scraping, API fetching |
| Telemetry display | Real | Frontend shows actual TelemetryDecision records from SQLite |
| Auto-scheduling | Real | Plain `asyncio` loop runs cycles back-to-back, forever (no fixed interval, no standby) |
| Post numbering | Real | `Agent.post_count` + `Post.sequence_number` persisted in SQL; survives backend restarts |
| Database audit trail | Real | Every decision persisted to topic_decisions table |
| Voice announcer | Real | Browser speechSynthesis API on new posts |

### Fake/Placeholder ⚠️

| Component | Issue | Impact |
|-----------|-------|--------|
| Public feed metrics | Hardcoded `99 - index * 2` | Shows fake uniqueness % instead of real scores |
| Telemetry logs | Synthetic generation | Logs generated from decisions, disappear on refresh (not persisted) |
| Voice commands | Experimental | Browser speech recognition unreliable; only 2 commands |

---

## Non-Negotiable Product Constraints (All Met ✅)

```
✅ Required API:
   - POST /api/agent/init → returns agentId
   - GET /api/agent/feed?agentId=... → returns posts
   - GET /api/agent/telemetry?agentId=... → returns decisions

✅ Agent operates without further prompts after initialization
✅ Every post includes rationale and primary source URL(s)
✅ Persona voice is preserved and consistent
✅ Topic deduplication prevents repetition
✅ No social publishing or analytics bloat added
✅ All decisions recorded in database for audit trail
```

---

## Stack & Dependencies

```
Backend:
  fastapi==0.115.6                # REST API
  uvicorn[standard]==0.34.0       # ASGI server
  sqlalchemy==2.0.36              # ORM
  pydantic-settings==2.7.0        # Config management
  httpx==0.28.1                   # Async HTTP (discovery)
  feedparser==6.0.11              # RSS parsing

Frontend:
  next==15.5.9                    # React framework
  react==19                       # UI
  typescript==latest              # Type safety
  (no Tailwind - hand-authored CSS)
```

---

## Backend Architecture Deep Dive

### Entry Point: `app/main.py`

```python
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
    # 1. Create tables on startup
    Base.metadata.create_all(bind=engine)
    
    # 2. Safely add new columns (SQLite ALTER safe pattern)
    with engine.connect() as conn:
        for col_name in [
            "credibility_score",
            "domain_relevance",
            "technical_depth",
            "novelty_score",
            "overall_credibility_index"
        ]:
            try:
                conn.execute(text(f"ALTER TABLE topic_decisions ADD COLUMN {col_name} FLOAT"))
                conn.commit()
            except Exception:
                pass  # Column exists; safe to ignore
                
    # 3. Start scheduler for autonomous cycles
    start_scheduler()
    yield
    # 4. Cleanup on shutdown
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
```

**Key insights:**
- Lifespan pattern is async-aware (no blocking)
- Safe column additions for SQLite (graceful no-op if exists)
- CORS allows frontend to communicate
- Health endpoint for monitoring

---

### Database Engine: `app/db.py` (updated 2026-08-08 — concurrency hardening)

Now that the editorial loop runs continuously instead of once every 6 hours,
SQLite write contention with normal API requests became a real issue (see
Session 4 in `Prompts.md` — `database is locked` on `POST /api/agent/init`
while a cycle was mid-write). Fixed via:

```python
connect_args = {"check_same_thread": False, "timeout": 30} if is_sqlite else {}
engine = create_engine(settings.database_url, connect_args=connect_args)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()
```

`journal_mode=WAL` lets reads (feed/telemetry polling) proceed without
blocking on the scanner's writes; `busy_timeout=30000` (backed up by the
matching `connect_args` timeout) means a genuinely overlapping write waits up
to 30s instead of erroring immediately like SQLite's 5s default did.

---

### Data Model: `app/models.py`

```python
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
    voice_profile: Mapped[str] = mapped_column(Text)  # Persona description
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Added 2026-08-08. Running counter, persisted in SQL, never resets.
    # Next post gets sequence_number = post_count + 1, even after a restart.
    post_count: Mapped[int] = mapped_column(default=0)
    posts: Mapped[list["Post"]] = relationship(back_populates="agent", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    # Added 2026-08-08. Assigned once at creation from Agent.post_count.
    # Existing pre-upgrade posts are backfilled on startup (see main.py
    # _backfill_sequence_numbers) so numbering never resets on upgrade.
    sequence_number: Mapped[int] = mapped_column(default=0, index=True)
    text: Mapped[str] = mapped_column(Text)  # Final composed post
    rationale: Mapped[str] = mapped_column(Text)  # Why this was selected
    sources: Mapped[list[str]] = mapped_column(JSON)  # URL list
    topic_key: Mapped[str] = mapped_column(String(180), index=True)  # Slug for dedup
    agent: Mapped[Agent] = relationship(back_populates="posts")

class TopicDecision(Base):
    __tablename__ = "topic_decisions"
    __table_args__ = (UniqueConstraint("agent_id", "source_url", name="uq_agent_source"),)
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    source_url: Mapped[str] = mapped_column(String(1000))  # Original source
    headline: Mapped[str] = mapped_column(Text)  # Candidate title
    topic_key: Mapped[str] = mapped_column(String(180), index=True)  # Dedup key
    decision: Mapped[str] = mapped_column(String(16))  # "accepted" or "rejected"
    reason: Mapped[str] = mapped_column(Text)  # Audit explanation
    score: Mapped[str] = mapped_column(String(16))  # Overall credibility index
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    
    # LLM-generated semantic scores
    credibility_score: Mapped[float | None] = mapped_column(nullable=True)
    domain_relevance: Mapped[float | None] = mapped_column(nullable=True)
    technical_depth: Mapped[float | None] = mapped_column(nullable=True)
    novelty_score: Mapped[float | None] = mapped_column(nullable=True)
    overall_credibility_index: Mapped[float | None] = mapped_column(nullable=True)
```

**Key design:**
- UUIDs for global uniqueness (not autoincrement)
- UTC timestamps for consistency
- topic_key for O(1) deduplication lookups
- JSON for sources list (flexible, single column)
- Unique constraint on (agent_id, source_url) prevents duplicate ingestion
- Semantic score columns are nullable (graceful fallback if LLM fails)

---

### Discovery: `app/services/discovery.py`

```python
from dataclasses import dataclass
from datetime import datetime, timezone
import re
import logging
import feedparser
import httpx

logger = logging.getLogger(__name__)

SOURCES = [
    {"type": "rss", "url": "https://feeds.arstechnica.com/arstechnica/technology-lab", "name": "Ars Technica"},
    {"type": "rss", "url": "https://www.theverge.com/rss/index.xml", "name": "The Verge"},
    {"type": "rss", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "name": "TechCrunch AI"},
    {"type": "rss", "url": "https://blog.google/technology/ai/rss/", "name": "Google AI"},
    {"type": "scrape", "url": "https://news.ycombinator.com/", "name": "Hacker News"},
    {"type": "api", "url": "https://hn.algolia.com/api/v1/search?tags=front_page", "name": "HN Algolia API"}
]

@dataclass(frozen=True)
class Candidate:
    title: str
    url: str
    summary: str
    source_name: str
    published_at: datetime

def _strip_html(value: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    return re.sub(r"<[^>]+>", " ", value or "").replace("&nbsp;", " ").strip()

async def discover_source_candidates(client: httpx.AsyncClient, source: dict) -> list[Candidate]:
    """Fetch candidates from one source (RSS/scrape/API)."""
    candidates: list[Candidate] = []
    stype = source["type"]
    url = source["url"]
    name = source["name"]
    
    try:
        if stype == "rss":
            # Standard feedparser flow
            response = await client.get(url, timeout=12)
            response.raise_for_status()
            parsed = feedparser.parse(response.content)
            for entry in parsed.entries[:10]:  # Top 10 per source
                link = entry.get("link", "")
                title = _strip_html(entry.get("title", ""))
                if not title or not link:
                    continue
                summary = _strip_html(entry.get("summary", entry.get("description", "")))
                candidates.append(Candidate(
                    title=title, url=link, summary=summary,
                    source_name=parsed.feed.get("title", name), published_at=datetime.now(timezone.utc)
                ))
        
        elif stype == "scrape":
            # Web scraping with browser-like headers
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            res = await client.get(url, headers=headers, timeout=12)
            res.raise_for_status()
            html = res.text
            
            if "news.ycombinator.com" in url:
                # HN-specific regex for <span class="titleline">
                matches = re.finditer(r'<span class="titleline"><a href="(?P<url>[^"]+)"[^>]*>(?P<title>[^<]+)</a>', html)
                count = 0
                for m in matches:
                    if count >= 10:
                        break
                    url_at = m.group("url")
                    title_at = _strip_html(m.group("title"))
                    if url_at.startswith("item?id="):
                        url_at = "https://news.ycombinator.com/" + url_at
                    if title_at and url_at:
                        candidates.append(Candidate(
                            title=title_at, url=url_at, summary="Live signal from Hacker News.",
                            source_name="Hacker News (Scraped)", published_at=datetime.now(timezone.utc)
                        ))
                        count += 1
        
        elif stype == "api":
            # Hacker News Algolia API
            res = await client.get(url, timeout=12)
            res.raise_for_status()
            data = res.json()
            if "hits" in data:
                for hit in data["hits"][:10]:
                    title = _strip_html(hit.get("title", ""))
                    url_val = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                    if title:
                        summary = hit.get("story_text") or "Via Algolia HN feed."
                        candidates.append(Candidate(
                            title=title, url=url_val, summary=_strip_html(summary),
                            source_name="Hacker News API", published_at=datetime.now(timezone.utc)
                        ))
    
    except Exception as e:
        logger.error(f"Error fetching {name} ({url}): {e}")
    
    return candidates

async def discover_candidates() -> list[Candidate]:
    """Fetch from all sources concurrently."""
    candidates = []
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": "SignalCraft/1.0"}) as client:
        for source in SOURCES:
            res = await discover_source_candidates(client, source)
            candidates.extend(res)
    return candidates
```

**Key insights:**
- Async fetching (no blocking on network I/O)
- Graceful error handling per-source (one failure doesn't break entire discovery)
- HTML stripping for summary cleanliness
- 10 items per source (prevents overwhelming downstream processing)
- Timeout=12s per source (prevents hanging)

---

### Editorial Engine: `app/services/editorial.py` (The Core)

This is where **semantic intelligence** lives:

```python
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

> **⚠️ Note (2026-08-08):** The `editorial.py` snapshot below predates several
> fixes and is kept for historical reference only — do not copy code from it.
> Current real behavior: `evaluate_candidate_llm()` reads `gemini_api_key` and
> `gemini_model` from `Settings` (backed by `backend/.env`), not raw
> `os.environ`; it calls `gemini-2.5-flash` (not the retired
> `gemini-1.5-flash`) via the `x-goog-api-key` header (not `?key=` query
> param); and `run_editorial_cycle()` commits per-candidate with de-duped
> URLs (see Session 4 & 5 in `Prompts.md`) rather than one batched commit at
> the end. See `app/services/editorial.py` itself for the current source of
> truth.

def backup_score(title: str, summary: str, domain: str, recent_topics: list[str]) -> dict:
    """
    Fallback scoring when GEMINI_API_KEY is not available.
    Uses keyword matching + heuristics.
    """
    words = set((title + " " + summary).lower().split())
    domain_words = set(domain.lower().split())
    
    SIGNAL_TERMS = {"ai", "model", "robot", "security", "chip", "compute", "agent", 
                   "openai", "anthropic", "google", "microsoft", "nvidia", "automation", "data"}
    NOISE_TERMS = {"review", "deal", "coupon", "hands-on", "podcast", "opinion"}
    
    relevance_words = words & (SIGNAL_TERMS | domain_words)
    has_noise = any(w in words for w in NOISE_TERMS)
    
    # Calculate scores (0-10 scale)
    domain_relevance = min(10.0, float(len(relevance_words) * 2.0))
    if domain_relevance < 2:
        domain_relevance = 1.0
    
    credibility_score = 9.0 if not has_noise else 4.0
    technical_depth = min(10.0, float(len(words & SIGNAL_TERMS) * 1.5))
    if technical_depth < 1:
        technical_depth = 3.0
    
    # Novelty check
    novelty_score = 10.0
    title_words = set(title.lower().split())
    for t in recent_topics:
        overlap = len(title_words & set(t.lower().split()))
        if overlap >= 3:
            novelty_score = 2.0
            break
        elif overlap >= 1:
            novelty_score = min(novelty_score, 10.0 - overlap * 2.0)
    
    # Build reason
    reason = "Backup Scorer: "
    if has_noise:
        reason += "Rejected content containing promotional key terms. "
    if domain_relevance < 7.0:
        reason += f"Failed domain match with score {domain_relevance:.1f}/10. "
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
    """
    **THIS IS THE REAL INTELLIGENCE.**
    
    Calls Gemini 1.5 Flash with structured JSON schema.
    Returns 4 semantic scores: credibility, domain_relevance, technical_depth, novelty.
    Falls back to backup_score() if API unavailable or fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set. Using backup scorer.")
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

Provide an overall explanation (reason) detailing how you evaluated the scores. Specify why it passed or failed.
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
    """
    **THE AUTONOMOUS LOOP.**
    
    1. Fetch candidates from all sources
    2. Evaluate each with LLM (or backup)
    3. Record all decisions in DB (for audit trail)
    4. Apply gating logic (cred ≥ 8.0 AND domain ≥ 7.0)
    5. Select best eligible candidate
    6. Compose and publish Post
    
    Returns 1 if post created, 0 otherwise.
    """
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
    
    # 2. Extract recent topics for novelty checking
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
    
    # 3. Process each candidate
    for candidate in candidates:
        # Skip if we've already seen this URL
        if source_seen(db, agent_id, candidate.url):
            continue
        
        state.scan_status = "analyzing"
        state.active_source_url = candidate.url
        state.chunks_processed += 1
        
        # Generate topic key for deduplication
        key = topic_key(candidate.title)
        state.scan_status = "verifying"
        
        # Call LLM (or fallback)
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
        
        # Check for duplicates in recent posts
        duplicate = recently_covered(db, agent_id, key)
        if duplicate:
            novelty_score = min(novelty_score, 2.0)
        
        # Calculate overall index
        overall_credibility_index = round((credibility_score + domain_relevance + technical_depth + novelty_score) / 4.0, 1)
        
        # Gating logic
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
        
        # Record decision in audit trail
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
        
        # Track best eligible candidate
        if decision == "accepted" and overall_credibility_index > selected_score:
            selected = candidate
            selected_key = key
            selected_score = overall_credibility_index
    
    # 4. Publish the best eligible post
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
    
    # 5. Update agent timestamp and commit
    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()
    
    state.scan_status = "idle"
    state.active_source_url = None
    
    return 1 if selected else 0
```

**Key architectural decisions:**

1. **LLM-first with graceful fallback** — If GEMINI_API_KEY exists, use semantic scoring. If not, use keyword backup.
2. **Gating is strict** — credibility ≥ 8.0 AND domain_relevance ≥ 7.0. Both must pass.
3. **Duplication degrades novelty** — Word overlap (≥3 words) sets novelty to 2.0 (below gate).
4. **All decisions persisted** — Every candidate (accept/reject) recorded for transparency.
5. **State tracking** — Updates scan_status and active_source_url in memory for frontend telemetry.

---

### Memory: `app/services/memory.py`

```python
import re
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Post, TopicDecision

def topic_key(text: str) -> str:
    """Generate deterministic topic slug from headline."""
    words = re.findall(r"[a-z0-9]{3,}", text.lower())
    return "-".join(words[:8])[:180]

def recently_covered(db: Session, agent_id: str, key: str) -> bool:
    """Check if topic has been covered in last 12 posts."""
    recent = db.scalars(
        select(Post.topic_key)
        .where(Post.agent_id == agent_id)
        .order_by(Post.created_at.desc())
        .limit(12)
    ).all()
    key_words = set(key.split("-"))
    return any(len(key_words.intersection(existing.split("-"))) >= 3 for existing in recent)

def source_seen(db: Session, agent_id: str, url: str) -> bool:
    """Check if URL has been ingested before."""
    return db.scalar(
        select(TopicDecision.id)
        .where(TopicDecision.agent_id == agent_id, TopicDecision.source_url == url)
    ) is not None
```

**Logic:**
- `topic_key()`: Extract nouns (3+ chars) from headline, create slug (prevents trivial dupes)
- `recently_covered()`: Last 12 posts, word overlap ≥3 = duplicate
- `source_seen()`: DB constraint prevents re-ingesting same URL

---

### Scheduling: `app/scheduler.py` (rewritten 2026-08-08 — continuous, no fixed interval)

`apscheduler` was removed entirely. The agent now scans **non-stop**: as soon as
one full pass over every agent finishes, the next pass starts immediately. The
only pause is a short, interruptible courtesy cooldown between passes
(`Settings.cycle_cooldown_seconds`, default 10s) so RSS/HN endpoints aren't
hammered in a tight loop — this is not a standby state. The loop only stops
when `stop_scheduler()` runs during FastAPI shutdown (i.e. the backend process
is stopped).

```python
import asyncio
import logging

from app.config import get_settings
from app.db import SessionLocal
from app.models import Agent
from app.services.editorial import run_editorial_cycle

logger = logging.getLogger(__name__)

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
```

**Also changed in the same pass (2026-08-08):** `run_editorial_cycle()` in
`editorial.py` used to publish only the single highest-scoring accepted
candidate per cycle and discard every other qualifying article. It now
publishes **every** accepted, non-duplicate candidate found in a pass, each
getting its own persisted `sequence_number` (see below).

**Revised again same day (Session 4, bugfix):** the first version of this
change used `db.flush()` after each publish and one `db.commit()` at the end
of the whole cycle. That held a single write transaction open across every
slow LLM call in the loop, which caused real `database is locked` errors
against concurrent API requests once the loop started running continuously.
It's now: candidates are de-duplicated by URL immediately after discovery
(overlapping sources like the HN scrape + HN Algolia API can return the same
URL in one pass), and **each candidate commits immediately** — `TopicDecision`
+ optional `Post` together — with a `try/except IntegrityError` fallback that
rolls back and skips just that one candidate if a duplicate URL ever slips
through, instead of losing the whole cycle's work. This also means
`recently_covered()`/`source_seen()` see each candidate's outcome for the
rest of the same cycle without any extra flush bookkeeping.

**Key point:** Runs all initialized agents in sequence. One failed cycle doesn't block others.


---

### API: `app/routers/agent.py`

Three key endpoints:

```python
@router.post("/init", response_model=InitResponse, status_code=status.HTTP_201_CREATED)
async def init_agent(
    payload: InitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> InitResponse:
    """Initialize a new agent."""
    agent = Agent(
        name=payload.persona.name.strip(),
        domain=payload.persona.domain.strip(),
        voice_profile=build_voice_profile(payload.persona.name, payload.persona.domain),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    # Queue immediate editorial cycle
    background_tasks.add_task(initial_cycle, agent.id)
    
    return InitResponse(agentId=agent.id)

@router.get("/feed", response_model=FeedResponse)
def get_feed(agentId: str, db: Session = Depends(get_db)) -> FeedResponse:
    """Get published posts for an agent."""
    if not db.get(Agent, agentId):
        raise HTTPException(status_code=404, detail="Unknown agentId")
    
    posts = db.scalars(
        select(Post)
        .where(Post.agent_id == agentId)
        .order_by(Post.created_at.desc())
    ).all()
    
    feed_posts = [
        FeedPost(
            id=post.id,
            createdAt=post.created_at,
            text=post.text,
            rationale=post.rationale,
            sources=post.sources
        )
        for post in posts
    ]
    
    return FeedResponse(posts=feed_posts)

@router.get("/telemetry", response_model=TelemetryResponse)
def get_telemetry(agentId: str, db: Session = Depends(get_db)) -> TelemetryResponse:
    """Get all editorial decisions (audit trail + real-time state)."""
    if not db.get(Agent, agentId):
        raise HTTPException(status_code=404, detail="Unknown agentId")
    
    decisions = db.scalars(
        select(TopicDecision)
        .where(TopicDecision.agent_id == agentId)
        .order_by(TopicDecision.decided_at.desc())
        .limit(30)
    ).all()
    
    state = get_scan_state(agentId)
    
    return TelemetryResponse(
        active_source_url=state.active_source_url,
        scan_status=state.scan_status,
        chunks_processed=state.chunks_processed,
        decisions=list(decisions)
    )
```

---

## Frontend Architecture Deep Dive

### Main Orchestrator: `app/page.tsx`

```tsx
"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AudioAnnouncer } from "./components/AudioAnnouncer";
import { CountdownTimer } from "./components/CountdownTimer";
import { TelemetryPanel } from "./components/TelemetryPanel";
import type { FeedPost, TelemetryResponse } from "./components/types";
import { useVoiceAnnouncer } from "./components/useVoiceAnnouncer";

type Agent = { id: string; name: string; domain: string; createdAt: string };
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [telemetryData, setTelemetryData] = useState<TelemetryResponse | null>(null);
  const [viewMode, setViewMode] = useState<"public" | "operator">("public");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const { speak } = useVoiceAnnouncer(posts, audioEnabled);

  // Main refresh (30s interval)
  const refresh = useCallback(async (agentId: string) => {
    const [agentResponse, feedResponse, telemetryResponse] = await Promise.all([
      fetch(`${API}/api/agent/${agentId}`),
      fetch(`${API}/api/agent/feed?agentId=${agentId}`),
      fetch(`${API}/api/agent/telemetry?agentId=${agentId}`)
    ]);
    if (!agentResponse.ok || !feedResponse.ok || !telemetryResponse.ok) {
      throw new Error("The signal could not be refreshed.");
    }
    const agentData = await agentResponse.json();
    const feedData = await feedResponse.json();
    const telData = await telemetryResponse.json();

    setAgent(agentData);
    setPosts(feedData.posts || []);
    setTelemetryData(telData);
  }, []);

  // Poll posts every 30 seconds
  useEffect(() => {
    if (!agent) return;
    const agentId = agent.id;
    const timer = window.setInterval(() => refresh(agentId).catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [agent, refresh]);

  // Poll telemetry every 4 seconds (faster, for scanning updates)
  useEffect(() => {
    if (!agent) return;
    const agentId = agent.id;
    let active = true;
    async function fetchTelemetry() {
      try {
        const response = await fetch(`${API}/api/agent/telemetry?agentId=${agentId}`);
        if (response.ok && active) {
          const data = await response.json();
          setTelemetryData(data);
        }
      } catch (err) {
        console.error("Failed to fetch telemetry on fast interval", err);
      }
    }
    fetchTelemetry();
    const intervalId = setInterval(fetchTelemetry, 4000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [agent]);

  async function initialize(event: FormEvent) {
    event.preventDefault();
    // POST to init, await refresh
    // ...
  }

  return (
    <main>
      {!agent ? (
        // Initialization form
        <section className="hero">
          {/* launch-card form */}
        </section>
      ) : (
        // Live console
        <section className="console">
          {/* Dual view: public feed vs operator control room */}
          {viewMode === "public" ? (
            <div className="feed">
              {posts.map(post => (
                <article className="post" key={post.id}>
                  {/* Post rendering with rationale drawer */}
                </article>
              ))}
            </div>
          ) : (
            <div className="feed">
              {telemetryData?.decisions.map(d => (
                <article className="post" key={d.source_url}>
                  {/* Decision card with 4 scores */}
                </article>
              ))}
            </div>
          )}

          <TelemetryPanel open={telemetryOpen} onClose={() => setTelemetryOpen(false)} telemetryData={telemetryData} />
        </section>
      )}
    </main>
  );
}
```

**Polling strategy:**
- **30 seconds:** Main refresh (posts, agent info, telemetry)
- **4 seconds:** Telemetry-only poll (scanning state updates without full refresh)

---

### Telemetry Panel: `app/components/TelemetryPanel.tsx`

```tsx
export function TelemetryPanel({ open, onClose, telemetryData }: TelemetryPanelProps) {
    const [tab, setTab] = useState<"logs" | "rejected">("logs");
    const [displayedLogs, setDisplayedLogs] = useState<TelemetryLog[]>([]);
    const logQueue = useRef<TelemetryLog[]>([]);
    const processedDecisions = useRef<Set<string>>(new Set());

    // Generate synthetic logs from real backend decisions
    useEffect(() => {
        if (!telemetryData) return;
        const decisions = [...telemetryData.decisions].reverse();
        let newLogs: TelemetryLog[] = [];

        decisions.forEach((d, idx) => {
            const uniqueId = `${d.source_url}-${d.decided_at}`;
            if (!processedDecisions.current.has(uniqueId)) {
                processedDecisions.current.add(uniqueId);

                const timestamp = new Date(d.decided_at).toLocaleTimeString("en-GB", { hour12: false });
                const cleanHeadline = d.headline.slice(0, 50);
                const isAccepted = d.decision.toLowerCase() === "accepted";

                // Push 4 synthetic logs per decision (real data → synthetic logs)
                newLogs.push({
                    id: `${uniqueId}-ingest`,
                    timestamp,
                    category: "INGEST",
                    message: `Discovered signal candidate: "${cleanHeadline}..."`
                });

                newLogs.push({
                    id: `${uniqueId}-memory`,
                    timestamp,
                    category: "MEMORY",
                    message: d.reason.includes("substantially overlaps")
                        ? `[CHECKING DUPES] Substantial overlap detected -> FAIL`
                        : `[CHECKING DUPES] Overlap check passed -> UNIQUE`
                });

                // Real scores in the log
                const cred = d.credibility_score ?? 8.0;
                const dom = d.domain_relevance ?? 7.0;
                newLogs.push({
                    id: `${uniqueId}-score`,
                    timestamp,
                    category: "SCORE",
                    message: `[VERIFYING CREDIBILITY] Scores: credibility=${cred}/10, domain=${dom}/10`
                });

                newLogs.push({
                    id: `${uniqueId}-publish`,
                    timestamp,
                    category: isAccepted ? "PUBLISH" : "SCORE",
                    message: isAccepted
                        ? `[PUBLISH] Overall index: ${d.score}/10 -> PASS & DEPLOYED`
                        : `[PUBLISH] Decision: REJECTED -> Reason: ${d.reason}`
                });
            }
        });

        if (newLogs.length > 0) {
            logQueue.current = [...logQueue.current, ...newLogs];
        }
    }, [telemetryData]);

    // Stream logs with 450ms delay (readability)
    useEffect(() => {
        const timer = setInterval(() => {
            if (logQueue.current.length > 0) {
                const nextLog = logQueue.current.shift();
                if (nextLog) {
                    setDisplayedLogs(curr => [...curr.slice(-99), nextLog]);
                }
            }
        }, 450);
        return () => clearInterval(timer);
    }, []);

    return (
        <aside className={`telemetry ${open ? "telemetry-open" : ""}`}>
            <div className="telemetry-tabs">
                <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
                    SYSTEM LOGS
                </button>
                <button className={tab === "rejected" ? "active" : ""} onClick={() => setTab("rejected")}>
                    CUTTING ROOM FLOOR
                </button>
            </div>

            {tab === "logs" ? (
                <div className="terminal" ref={terminalRef}>
                    {displayedLogs.map((log) => (
                        <p key={log.id} className="log-line">
                            <time>[{log.timestamp}]</time> <b>{log.category}</b> {log.message}
                        </p>
                    ))}
                </div>
            ) : (
                <div className="rejected-list">
                    {rejectedDecisions.map((d) => (
                        <article key={d.source_url} className="rejected-card">
                            <div className="rejected-badge">FLAGGED & REJECTED</div>
                            <h3>{d.headline}</h3>
                            <div className="scores-grid">
                                <div className="score-metric">
                                    <span>Credibility</span>
                                    <div className="metric-bar bg-red">
                                        <i style={{ width: `${(d.credibility_score ?? 0) * 10}%` }} />
                                    </div>
                                    <b>{d.credibility_score?.toFixed(1)}/10</b>
                                </div>
                                {/* Other scores... */}
                            </div>
                            <a href={d.source_url} target="_blank" rel="noreferrer" className="rejected-source-link">
                                VERIFY SOURCE CONTENT ↗
                            </a>
                        </article>
                    ))}
                </div>
            )}
        </aside>
    );
}
```

**Key insight:** Uses real `TelemetryDecision` objects from backend to generate synthetic log entries. Logs disappear on refresh (not persisted), but data is always real.

---

## Type Contracts

### Frontend → Backend

```typescript
// POST /api/agent/init
{
  "persona": {
    "name": "NOVA",
    "domain": "AI safety, agents, frontier ML"
  }
}
```

### Backend → Frontend

```typescript
// GET /api/agent/feed
{
  "posts": [
    {
      "id": "uuid",
      "createdAt": "2026-08-08T...",
      "text": "...",
      "rationale": "...",
      "sources": ["https://..."]
    }
  ]
}

// GET /api/agent/telemetry
{
  "active_source_url": "https://...",
  "scan_status": "analyzing",
  "chunks_processed": 42,
  "decisions": [
    {
      "source_url": "https://...",
      "headline": "...",
      "decision": "accepted|rejected",
      "credibility_score": 8.5,
      "domain_relevance": 7.8,
      "technical_depth": 8.2,
      "novelty_score": 9.0,
      "score": "8.4",
      "reason": "..."
    }
  ]
}
```

---

## Known Issues & High-Priority Fixes

### Issue 1: Public Feed Metrics Are Hardcoded

**Current:**
```tsx
<span>DEDUPLICATION: {99 - index}.{4 - index}% UNIQUE</span>
```

**Should be:**
Add to FeedPost schema:
```python
class FeedPost(BaseModel):
    uniqueness_pct: float  # From TopicDecision novelty_score
    credibility_score: float
```

### Issue 2: Telemetry Logs Are Transient

**Current:** Logs generated client-side, disappear on refresh.

**Fix:** Create `TelemetryLog` table, persist all logs, fetch via `/api/agent/logs`.

### Issue 3: No Publishing Endpoint

**Fix:** Add webhook support:
```python
@router.post("/config/publish-webhook")
def set_webhook_url(agent_id: str, url: str, db: Session):
    # Store in new WebhookConfig table
    # Call on each new Post creation
```

---

## Quick Reference

| Concept | File | Key Function |
|---------|------|--------------|
| LLM evaluation | `editorial.py` | `evaluate_candidate_llm()` |
| Fallback scoring | `editorial.py` | `backup_score()` |
| Deduplication | `memory.py` | `recently_covered()` |
| Discovery | `discovery.py` | `discover_candidates()` |
| Scheduling | `scheduler.py` | `run_all_agents()` |
| API routes | `routers/agent.py` | `/init`, `/feed`, `/telemetry` |
| Frontend orchestration | `page.tsx` | Polling + dual views |
| Telemetry UI | `TelemetryPanel.tsx` | Real decision visualization |
| Voice | `useVoiceAnnouncer.ts` | TTS on new posts |

---

## Success Metrics

- **Execution:** All API tests pass (init → feed → telemetry)
- **Editorial:** Accepts only articles with cred ≥ 8.0 AND domain ≥ 7.0
- **Deduplication:** No duplicate topics across 12 prior posts
- **Performance:** Editorial cycle completes in <5 minutes
- **UI:** Telemetry updates within 4 seconds of backend decision

---

## Future Enhancements (9.0+ rating)

1. **Publishing:** Email, Telegram, RSS, webhooks
2. **Feedback:** User ratings → reweighting
3. **Analytics:** Post engagement, scoring accuracy, topic trends
4. **Multi-agent:** Dashboard for multiple personas
5. **Persistence:** All logs, metrics, performance tracking

---

**Last Updated:** August 8, 2026

**Status:** 8.0/10 — Ready for distribution & feedback improvements

## Telemetry Window (updated 2026-08-08 — replaced hard cap with aging window)

`GET /api/agent/telemetry` no longer does `.limit(30)`. `Settings.telemetry_window_minutes`
(default 6.0, configurable via `.env`) now bounds the response by time instead
of row count:

```python
cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.telemetry_window_minutes)
decisions = db.scalars(
    select(TopicDecision)
    .where(TopicDecision.agent_id == agentId, TopicDecision.decided_at >= cutoff)
    .order_by(TopicDecision.decided_at.desc())
).all()
```

This only affects what this endpoint *returns*. `TopicDecision` rows are
never deleted, so `source_seen()`/`recently_covered()` (permanent dedup) see
the complete history regardless of this window. `TelemetryResponse` echoes
`telemetry_window_minutes` back so the frontend label is never a second,
independently-hardcoded guess.

---

## Publish Queue: Manual Publish Now (added 2026-08-08)

Alongside the automatic timer-driven `publish_due_posts()` (Session 7), there
is now a manual path for a person to force one specific queued post live
immediately from the UI. Both paths share the exact same release logic via a
new private helper:

```python
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


def publish_specific_post(db: Session, agent_id: str, post_id: str) -> bool:
    """Manually publish one specific queued post right now, out of score
    order, in response to a person clicking "Publish now" in the queue UI."""
    agent = db.get(Agent, agent_id)
    if not agent:
        return False
    post = db.get(Post, post_id)
    if not post or post.agent_id != agent_id or post.status != "queued":
        return False
    _do_publish(db, agent, post, datetime.now(timezone.utc))
    db.commit()
    return True
```

Exposed via `POST /api/agent/queue/{post_id}/publish-now?agentId=...`.

**Why this endpoint is `async def` and not `def` (deliberate, not a style
choice):** FastAPI runs `def` endpoints in a worker threadpool. The
background `_publisher_loop` (Session 7) ticks every 5s on the asyncio event
loop and also calls into `publish_due_posts`, touching the same `Post` rows.
If the manual endpoint were `def`, it could run in a threadpool thread
genuinely concurrently with that event-loop tick — both could read
`status == "queued"` as still true before either had committed, and both
publish the same post (double sequence number issued). Declaring the
endpoint `async def` with no `await` in the critical section means it
executes on the single asyncio event loop instead, so it's cooperatively
scheduled against `_publisher_loop` rather than truly parallel to it — no
other coroutine gets a chance to run until this one returns, so the
check-then-act on `post.status` is effectively atomic.

---

## Per-Post Score Breakdown (added 2026-08-08 — replaced hardcoded feed placeholders)

`Post` gained four nullable columns, populated at queue time from the same
assessment that scored the candidate (`credibility_score`, `domain_relevance`,
`technical_depth`, `novelty_score`), alongside the existing `overall_score`.
These are now exposed on both `FeedPost` and `QueuedPost` schemas.

This directly replaces two formulas that were previously hardcoded in
`page.tsx` and had no relationship to the actual post being rendered:

```tsx
// REMOVED -- was index-based, not data-based:
<span>DEDUPLICATION: {99 - index}.{4 - index}% UNIQUE</span>
...
<span>DOMAIN MATCH: {94 - index * 2}%</span>
```

Replaced with the real per-post scores, rendering "N/A" for posts published
before these columns existed rather than inventing a number:

```tsx
<span>NOVELTY: {post.noveltyScore != null ? `${post.noveltyScore.toFixed(1)}/10` : "N/A"}</span>
<span>CREDIBILITY: {post.credibilityScore != null ? `${post.credibilityScore.toFixed(1)}/10` : "N/A"}</span>
...
<span>DOMAIN MATCH: {post.domainRelevance != null ? `${(post.domainRelevance * 10).toFixed(0)}%` : "N/A"}</span>
```

---

## CountdownTimer.tsx (rewritten 2026-08-08 — bugfix: props existed in caller but not in component)

Found while wiring up the queue UI: `page.tsx` was already calling
`<CountdownTimer nextPublishAt={...} queueSize={...} />`, but the component
itself (unchanged since the Session 3 "continuous loop" rewrite) still took
zero props and only rendered session uptime -- the props were being silently
dropped by React and the countdown the UI appeared to show didn't actually
exist. Rewritten to accept both props and render a live countdown sourced
entirely from backend state (`Agent.next_publish_at`), with no client-side
timer math beyond formatting `Date.now()` against that timestamp every
second:

```tsx
type Props = {
  nextPublishAt: string | null;
  queueSize: number;
};

export function CountdownTimer({ nextPublishAt, queueSize }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let statusLabel: string;
  if (queueSize === 0) {
    statusLabel = "QUEUE EMPTY — SCANNING FOR CANDIDATES";
  } else if (!nextPublishAt) {
    statusLabel = "READY TO PUBLISH";
  } else {
    const remainingMs = new Date(nextPublishAt).getTime() - now;
    statusLabel = remainingMs <= 0
      ? "PUBLISHING NOW…"
      : `NEXT AUTO-PUBLISH IN ${formatRemaining(remainingMs)}`;
  }
  ...
}
```

Because this reads `next_publish_at` straight from the backend on every 4s
telemetry poll, a manual "Publish now" click (which resets that field via
`_do_publish`) is reflected in the countdown on the very next poll with no
special-case wiring needed.

---

## QueueView.tsx (new, 2026-08-08)

Dedicated, scrollable section for browsing the *entire* publish queue --
distinct from the small `PendingQueue.tsx` teaser (which only ever showed
"1 + N more"). Renders every queued `Post` with its real score breakdown and
a Publish Now button that calls the new endpoint above, then triggers a full
`refresh()` so the feed, queue, and countdown all update together. Reachable
via a new third tab in `page.tsx`'s view toggle: PUBLIC FEED / PUBLISH QUEUE
(N) / OPERATOR ROOM.