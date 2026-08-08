# NOVA — Autonomous AI Technology Editorial Node

**An LLM-assisted autonomous news curation system that discovers, evaluates, and publishes technology insights.**

## Quick Overview

NOVA initializes a specialized AI technology persona once. The system then:
- **Discovers** live technology news from RSS feeds, web scraping, and APIs
- **Evaluates** candidates using Gemini LLM with semantic scoring (credibility, domain relevance, technical depth, novelty)
- **Deduplicates** against editorial memory to maintain narrative variety
- **Remembers** all editorial decisions for transparency and audit trails
- **Publishes** to a feed with full reasoning and source attribution

No further prompts required after initialization. The system runs autonomously every 6 hours.

## Honest Status: 8.0/10


## Architecture

### Stack

| Layer | Tech | Why |
|-------|------|-----|
| **API** | FastAPI + Python 3.10+ | Async editorial workflows, type safety |
| **Database** | SQLAlchemy + SQLite | Durable decisions; switch to Postgres for scale |
| **Automation** | APScheduler | 6-hourly autonomous cycles |
| **Discovery** | httpx + feedparser | Async RSS, web scraping, API polling |
| **LLM Eval** | Gemini 1.5 Flash API | Semantic scoring with JSON schema responses |
| **Frontend** | Next.js 15.5.9 + React 19 | Real-time telemetry, dual-view UI |
| **Styling** | Hand-authored CSS | Cyberpunk terminal aesthetic (no Tailwind) |

### Backend Files

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, lifespan, CORS
│   ├── config.py               # Settings (database, CORS origins, posting interval)
│   ├── db.py                   # SQLAlchemy setup
│   ├── models.py               # Agent, Post, TopicDecision ORM models
│   ├── schemas.py              # Pydantic request/response contracts
│   ├── scheduler.py            # APScheduler setup (6-hour cycles)
│   ├── routers/
│   │   └── agent.py            # POST /init, GET /feed, GET /telemetry
│   └── services/
│       ├── discovery.py        # RSS, scraping, API candidate fetching
│       ├── editorial.py        # LLM eval + backup scoring, gating logic
│       ├── memory.py           # Deduplication, topic_key generation
│       ├── persona.py          # Voice profile + post composition
│       └── state.py            # Scan state tracking (active_source_url, status, chunks)
├── requirements.txt
└── main.py                     # Compatibility entrypoint
```

### Frontend Files

```
frontend/app/
├── page.tsx                    # Main orchestrator, polling logic, dual views
├── layout.tsx                  # Metadata, font imports
├── globals.css                 # All visual styles (terminal aesthetic)
└── components/
    ├── TelemetryPanel.tsx      # Right-side slide-over with SYSTEM LOGS & CUTTING ROOM FLOOR tabs
    ├── AudioAnnouncer.tsx      # Audio toggle, microphone button, voice commands
    ├── CountdownTimer.tsx      # 6-hour ingestion loop countdown
    ├── useVoiceAnnouncer.ts    # Hook: TTS announcements on new posts
    └── types.ts                # FeedPost, TelemetryDecision, TelemetryLog types
```

### Data Model

| Table | Purpose |
|-------|---------|
| **agents** | Persona identity (name, domain, voice_profile, created_at, last_run_at) |
| **posts** | Published feed entries (text, rationale, sources, topic_key) |
| **topic_decisions** | Audit trail: every candidate + accept/reject reason + LLM scores |

---

## How It Works

### Initialization (User Action)

```
User initializes: name="NOVA", domain="AI safety and frontier ML"
↓
POST /api/agent/init creates Agent record
↓
Background task queues immediate editorial cycle
↓
APScheduler schedules repeat cycles every 6 hours
```

### Editorial Cycle (Autonomous, Every 6 Hours)

1. **Ingest:** Fetch from all sources (RSS, scraping, APIs)
2. **Process:** For each candidate:
   - Check if source URL already seen (skip if yes)
   - Generate topic_key from headline
   - Call `evaluate_candidate_llm()` → Gemini API
   - Receive: credibility_score, domain_relevance, technical_depth, novelty_score
   - Fallback to `backup_score()` if GEMINI_API_KEY missing
   - Store TopicDecision (accept or reject)
3. **Gate:** Accept only if credibility ≥ 8.0 AND domain_relevance ≥ 7.0
4. **Dedup:** Reject if topic overlaps recent 12 posts (word intersection ≥ 3)
5. **Publish:** Create Post with composite text + rationale
6. **Update:** Agent.last_run_at timestamp

### API Contracts

**POST /api/agent/init**
```json
Request: {"persona": {"name": "NOVA", "domain": "AI safety"}}
Response: {"agentId": "uuid-here"}
Status: 201
```

**GET /api/agent/feed?agentId=...**
```json
Response: {"posts": [
  {
    "id": "uuid",
    "createdAt": "2026-08-08T...",
    "text": "...",
    "rationale": "...",
    "sources": ["https://..."]
  }
]}
Status: 200 or 404
```

**GET /api/agent/telemetry?agentId=...**
```json
Response: {
  "active_source_url": "https://...",
  "scan_status": "analyzing",
  "chunks_processed": 42,
  "decisions": [
    {
      "source_url": "https://...",
      "headline": "...",
      "topic_key": "...",
      "decision": "accepted|rejected",
      "reason": "...",
      "score": "8.5",
      "credibility_score": 8.5,
      "domain_relevance": 7.8,
      "technical_depth": 8.2,
      "novelty_score": 9.0,
      "overall_credibility_index": 8.4
    }
  ]
}
Status: 200 or 404
```

---

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- SQLite (included)

### Backend

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Health check: `http://localhost:8000/health` → `{"status": "ok"}`

**Environment Variables (Optional)**
```env
GEMINI_API_KEY=sk-...  # If missing, uses backup keyword scorer
DATABASE_URL=sqlite:///./signalcraft.db
CORS_ORIGINS=http://localhost:3000
POSTING_INTERVAL_HOURS=6
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

App: `http://localhost:3000`

Production build:
```powershell
npm run build
npm run start
```

---

## Key Implementation Details

### Editorial Scoring

**With GEMINI_API_KEY:**
- Sends structured prompt to Gemini 1.5 Flash
- Asks for JSON with credibility, domain_relevance, technical_depth, novelty_score
- Gating: accept if cred ≥ 8.0 AND domain ≥ 7.0

**Without GEMINI_API_KEY (Fallback):**
- `backup_score()` counts signal terms (ai, model, security, etc.)
- Deducts for noise terms (review, deal, podcast, etc.)
- Static credibility (9.0 if clean, 4.0 if noisy)
- **Weaker but functional**

### Deduplication

```python
# Check recent 12 posts
recent_topics = db.query(Post.topic_key).order_by(Post.created_at.desc()).limit(12)

# Extract word sets
candidate_words = set(candidate_headline.lower().split())
recent_words = set(recent_topic.lower().split())

# Reject if ≥ 3 words overlap
if len(candidate_words & recent_words) >= 3:
    novelty_score = 2.0  # Fail gate
```

### Voice Profile

```python
def build_voice_profile(name: str, domain: str) -> str:
    return (
        f"{name} is a precise, independent technology analyst focused on {domain}. "
        "Voice: calm, skeptical, specific, and forward-looking. It avoids hype, uses one clear "
        "insight per post, and connects new developments to an ongoing risk or capability narrative."
    )
```

### Post Composition

```python
def compose_post(agent: Agent, headline: str, summary: str, continuity: str | None) -> str:
    context = f"Building on the recent thread about {continuity}, " if continuity else ""
    clean_summary = " ".join(summary.split())[:340]
    return (
        f"{context}{headline}.\n\n"
        f"My read for {agent.domain}: {clean_summary}\n\n"
        "The signal is not the announcement itself; it is the operational constraint it changes. "
        "Watch the evidence, not the launch cadence."
    )
```

---

## Frontend Highlights

### Dual-View Design

**Public Persona Feed:**
- Shows only published posts
- Clean narrative with reasoning drawer
- Uniqueness badges, source links
- Read aloud via TTS

**Operator Control Room:**
- Shows ALL decisions (accepted + rejected)
- Four-score breakdown: credibility, domain_relevance, tech_depth, novelty
- "Cutting Room Floor" tab: rejected candidates with reason
- Audit trail for editorial transparency

### Real Telemetry

```tsx
// Polls backend every 4 seconds
const fetchTelemetry = async () => {
  const res = await fetch(`${API}/api/agent/telemetry?agentId=${agentId}`);
  const data = await res.json();  // Real TelemetryResponse from DB
  setTelemetryData(data);
};

// Displays real scanning state
<div className="scanning-banner">
  SCANNING: {telemetryData.active_source_url} ... {telemetryData.scan_status.toUpperCase()}
</div>

// Shows real decisions
{telemetryData.decisions.map(d => (
  <div className="micro-metric">
    <span>CREDIBILITY: {d.credibility_score}/10</span>
    <span>DOMAIN: {d.domain_relevance}/10</span>
  </div>
))}
```

### Log Streaming

```tsx
// Generates synthetic logs from real decisions
decisions.forEach(d => {
  logs.push({ category: "INGEST", message: `Discovered: "${d.headline}"` });
  logs.push({ category: "SCORE", message: `Credibility: ${d.credibility_score}/10` });
  logs.push({ category: "MEMORY", message: d.reason });
});

// Streams with 450ms delay for readability
setInterval(() => {
  if (logQueue.length > 0) {
    const log = logQueue.shift();
    setDisplayedLogs(curr => [...curr.slice(-99), log]);
  }
}, 450);
```

---

## Known Limitations & Next Steps

### High Priority (Would Increase Rating to 8.5+)

1. **Add publishing:**
   - Email webhook: `POST /api/config/publish-webhook`
   - RSS export: `GET /api/feed/{agentId}.xml`
   - Telegram bot integration
   - This gives the system **distribution**

2. **Add feedback loop:**
   - `POST /api/post/{postId}/feedback?rating=good|bad|unclear`
   - Store in new `PostFeedback` table
   - Monthly reweighting based on user ratings
   - This gives the system **learning**

3. **Persist telemetry logs:**
   - New `TelemetryLog` table
   - `GET /api/agent/logs?agentId=...` endpoint
   - Replace synthetic frontend logs with real persisted data

4. **Fix public feed metrics:**
   - Add `uniqueness_pct`, `credibility_score`, `domain_relevance` to `FeedPost` schema
   - Use real values instead of `99 - index * 2`

### Medium Priority (Would Reach 8.8+)

5. **Test suite:**
   - pytest for `editorial.py`, `memory.py`, `discovery.py`
   - Mock Gemini API calls
   - Edge cases: empty summaries, duplicates, malformed feeds

6. **Performance:**
   - Add database indexes on `agent_id`, `topic_key`, `decided_at`
   - Cache LLM responses by headline hash
   - Rate limiting on `/api/agent/telemetry`

7. **Observability:**
   - Structured logging (Python `logging` module)
   - Request/response latency tracking
   - Error alerting (Sentry or similar)

### Nice to Have (Would Reach 9.0+)

8. **Multi-agent orchestration:** Manage multiple personas from one dashboard
9. **Social media posting:** Direct integration with Twitter API
10. **Analytics:** Track post engagement, topic trends, scoring accuracy over time

---

## Testing

### Backend Health Check

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### Initialize an Agent

```bash
curl -X POST http://localhost:8000/api/agent/init \
  -H "Content-Type: application/json" \
  -d '{"persona": {"name": "NOVA", "domain": "AI safety"}}'
# {"agentId": "uuid-here"}
```

### Fetch Feed

```bash
curl "http://localhost:8000/api/agent/feed?agentId=uuid-here"
# {"posts": [...]}
```

### Fetch Telemetry

```bash
curl "http://localhost:8000/api/agent/telemetry?agentId=uuid-here"
# {"active_source_url": "...", "scan_status": "idle", "decisions": [...]}
```

### Frontend Build

```bash
cd frontend
npm run build
# .next/ directory ready for deployment
```

---

## Visual Design

- **Background:** Near-black (`#101210`)
- **Accent:** Neon green (`#00FF66`)
- **Typography:** DM Mono (code), Manrope (prose), Playfair Display (headings)
- **Grid overlay:** 76px + opacity for subtle texture
- **Orbs:** Radial gradients (lime and purple) for depth
- **Aesthetic:** Cyberpunk terminal (intentional, not generic dashboard)

---

## Deployment

### Docker (Single Container)

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ ./backend/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

```env
GEMINI_API_KEY=sk-...              # Required for LLM eval
DATABASE_URL=postgresql://...      # Switch to Postgres for scale
CORS_ORIGINS=https://yourdomain.com
POSTING_INTERVAL_HOURS=6
```

### Production Frontend

```bash
npm run build
npm run start
```

---

## Collaboration

- **Code style:** Black (Python), Prettier (TypeScript)
- **Type safety:** Always required (Pydantic + TypeScript strict mode)
- **PR process:** Test locally, update `Project Context.md`, run production build
- **Questions:** Check `vibecode.md` for implementation details

---

## License

MIT

---

## Author

Built with intent. Maintained with care.

**Last Updated:** August 8, 2026

**Current Rating:** 8.0/10 (Needs publishing + feedback to reach 9.0+)
