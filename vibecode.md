# NOVA — AI Handoff Context

## What this is

NOVA is an autonomous AI technology-persona node. An evaluator initializes a named specialist once; thereafter the backend independently discovers live AI/technology news, filters it through editorial rules and persistent memory, then publishes transparent feed posts on a schedule. The frontend is a dark, neon-green terminal-style operations console that exposes agent activity, decision-making, source evidence, and optional browser-native audio.

Project root: `D:\Nova`

## Non-negotiable product requirements

- Required public API:
  - `POST /api/agent/init` accepts `{ "personaName": string, "domain": string }` and returns `{ "agentId": string }`.
  - `GET /api/agent/feed?agentId={id}` returns newest-first posts: `{ id, createdAt, text, rationale, sources }[]`.
- The agent must operate without further prompts after initialization.
- Every post must include clear topic-selection rationale and direct source URL(s).
- Preserve persona voice, long-term continuity, and topic deduplication.
- Do not add social publishing, rich-media generation, analytics, manual dashboards, or multi-agent orchestration.
- Keep `Project Context.md` updated after every future user request and response.

## Stack

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI / Python | Typed REST contract and async editorial workflows |
| Persistence | SQLAlchemy + SQLite by default | Durable agent, post, and curation memory; configurable via `DATABASE_URL` |
| Automation | APScheduler | Runs editorial pipeline every 6 hours after API startup |
| Discovery | `httpx` + `feedparser` | Live RSS ingestion from established technology/AI sources |
| Frontend | Next.js 15.5.9 / React 19 / TypeScript | Client dashboard and browser audio APIs |
| Styling | Hand-authored CSS | Existing cyberpunk terminal design; do not introduce Tailwind unless deliberately migrating |

## Backend architecture

### Runtime flow

1. Evaluator calls `POST /api/agent/init`.
2. API creates `Agent` with a stable voice profile based on persona name and domain.
3. A non-blocking initial editorial cycle is queued immediately.
4. APScheduler runs all initialized agents every 6 hours.
5. Each cycle fetches RSS candidates, scores them, records all decisions, rejects duplicates/noise/off-domain stories, and stores at most one strong post.
6. Evaluator/frontend reads stored posts via the feed endpoint. The frontend never initiates editorial generation.

### Key backend files

- `backend/app/main.py` — FastAPI app, lifespan, database creation, CORS, router registration.
- `backend/app/routers/agent.py` — required init/feed routes and optional agent summary route.
- `backend/app/scheduler.py` — `AsyncIOScheduler`, six-hour recurring editorial cycle.
- `backend/app/services/discovery.py` — RSS feeds and candidate extraction.
- `backend/app/services/editorial.py` — scoring, rejection logic, post creation, rationale.
- `backend/app/services/memory.py` — topic-key generation, recent-overlap detection, source dedupe.
- `backend/app/services/persona.py` — voice-profile and consistent post composition.
- `backend/app/models.py` — SQLAlchemy data model.
- `backend/app/schemas.py` — Pydantic request/response contracts.
- `backend/requirements.txt` — Python dependencies.

### Database model

| Table | Important fields | Purpose |
|---|---|---|
| `agents` | `id`, `name`, `domain`, `voice_profile`, `created_at`, `last_run_at` | Persona identity and scheduling continuity |
| `posts` | `id`, `agent_id`, `created_at`, `text`, `rationale`, `sources`, `topic_key` | Published feed entries |
| `topic_decisions` | `agent_id`, `source_url`, `headline`, `topic_key`, `decision`, `reason`, `score`, `decided_at` | Auditable accepted/rejected editorial decisions and source dedupe |

### Current editorial policy

- Scores content against a domain vocabulary plus AI/technology signal terms.
- Rejects promotional/review/opinion-led stories.
- Rejects candidates lacking specialist relevance.
- Rejects candidates substantially overlapping recent posts (last 12 posts).
- Records every new candidate decision before selecting the best eligible candidate.
- Uses established RSS feeds including Ars Technica, The Verge, TechCrunch AI, and Google AI.

## Frontend architecture

### Key files

- `frontend/app/page.tsx` — main client dashboard, initialization form, polling, feed cards, telemetry launcher.
- `frontend/app/globals.css` — responsive dark minimal terminal/cyberpunk visual language.
- `frontend/app/components/TelemetryPanel.tsx` — right slide-over Thought Matrix with auto-scrolling simulated system events and rejected-candidate tab.
- `frontend/app/components/AudioAnnouncer.tsx` — audio toggle, microphone command button, Space-key command listener, permission/unsupported errors.
- `frontend/app/components/useVoiceAnnouncer.ts` — browser `speechSynthesis` hook; announces newly fetched posts, pitch `0.9`, rate `1.0`.
- `frontend/app/components/CountdownTimer.tsx` — live display for time remaining until next six-hour ingestion boundary.
- `frontend/app/components/types.ts` — typed feed, telemetry, and rejection models.

### Dashboard behavior

- User initializes NOVA with a persona name and specialist domain.
- Dashboard polls the API every 30 seconds after initialization.
- New fetched post triggers TTS only if audio broadcast is enabled.
- Every feed card shows uniqueness and source-verification badges, a Listen action, and an expandable rationale drawer.
- Rationale drawer includes domain match bar, reasoning bullets, and a primary-source link.
- Thought Matrix has:
  - `SYSTEM LOGS`: seeded realistic logs plus an optional simulated stream every 3.6 seconds.
  - `CUTTING ROOM FLOOR`: visible rejected items and editorial reasons. These are frontend telemetry samples today; actual rejection data already persists in the backend but is not yet exposed by a REST endpoint.
- Experimental voice commands (browser support and microphone permission required):
  - Click `MIC` or hold Space.
  - Say “read latest post” to play the newest post.
  - Say “toggle logs” to open/close telemetry.

## Visual direction

- Keep background near black (`#101210` / neutral-black).
- Use neon green accents (`--lime`, currently `#d7ff4f`; requested alternative is `#00FF66`).
- Use monospace for system/metadata detail; existing fonts are `DM Mono`, `Manrope`, and `Playfair Display`.
- Maintain thin neutral grid/border lines and restrained transitions. Do not make it glossy, brightly colored, or dashboard-heavy.

## Local development

Use two PowerShell terminals.

```powershell
cd D:\Nova\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
cd D:\Nova\frontend
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

- App: `http://localhost:3000`
- API health: `http://localhost:8000/health`
- API base can be overridden with `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Production frontend check:

```powershell
cd D:\Nova\frontend
npm.cmd run build
```

## Validation already completed

- FastAPI smoke test: init returns `201` + `agentId`; feed returns an array; missing agents return `404`.
- Production Next.js build passed after telemetry/audio upgrades.
- Current Next version is `15.5.9` to include the patched 15.5 release line.

## Known implementation notes / safe next improvements

1. The telemetry event stream and Cutting Room Floor contain high-fidelity simulated UI data. For fully backend-derived telemetry, add a read-only `GET /api/agent/telemetry?agentId=...` endpoint that returns `TopicDecision` records and scheduler events, then replace the panel seed data with polling or SSE.
2. SQLite is appropriate for one local process. For deployment/multiple API workers, set `DATABASE_URL` to Postgres and use a single scheduler worker or external job queue to avoid duplicate runs.
3. The scheduler requires the backend process to remain running; this satisfies localhost and a persistent single-service deployment. A managed deployment should use a persistent process host and durable database.
4. Browser speech synthesis and speech recognition are intentionally client-only and may vary by browser. The UI already handles unsupported browsers and denied microphone permissions.
5. The directory was renamed to `D:\Nova`. A compatibility junction at `D:\Amica` may exist for the original workspace tooling; treat `D:\Nova` as canonical.

## Collaboration conventions

- Make production-safe, modular, type-safe changes.
- Prefer `apply_patch` for edits.
- Run a proportionate validation after changes.
- Update `Project Context.md` and this file when architecture, behavior, or commands materially change.

## Embedded source snapshot (core running code)

The following is deliberately embedded so an AI can understand the essential running implementation even when the repository is not attached. The complete repository remains canonical for styles and the smaller supporting modules.

### `backend/app/main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.db import Base, engine
from app.routers.agent import router as agent_router
from app.scheduler import start_scheduler, stop_scheduler

settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(agent_router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

### `backend/app/routers/agent.py`

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import SessionLocal, get_db
from app.models import Agent, Post
from app.schemas import AgentSummary, FeedPost, InitRequest, InitResponse
from app.services.editorial import run_editorial_cycle
from app.services.persona import build_voice_profile

router = APIRouter(prefix="/api/agent", tags=["agent"])

async def initial_cycle(agent_id: str) -> None:
    db = SessionLocal()
    try: await run_editorial_cycle(db, agent_id)
    finally: db.close()

@router.post("/init", response_model=InitResponse, status_code=status.HTTP_201_CREATED)
async def init_agent(payload: InitRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> InitResponse:
    agent = Agent(name=payload.personaName.strip(), domain=payload.domain.strip(), voice_profile=build_voice_profile(payload.personaName, payload.domain))
    db.add(agent); db.commit(); db.refresh(agent)
    background_tasks.add_task(initial_cycle, agent.id)
    return InitResponse(agentId=agent.id)

@router.get("/feed", response_model=list[FeedPost])
def get_feed(agentId: str, db: Session = Depends(get_db)) -> list[FeedPost]:
    if not db.get(Agent, agentId): raise HTTPException(status_code=404, detail="Unknown agentId")
    posts = db.scalars(select(Post).where(Post.agent_id == agentId).order_by(Post.created_at.desc())).all()
    return [FeedPost(id=p.id, createdAt=p.created_at, text=p.text, rationale=p.rationale, sources=p.sources) for p in posts]

@router.get("/{agent_id}", response_model=AgentSummary)
def get_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentSummary:
    agent = db.get(Agent, agent_id)
    if not agent: raise HTTPException(status_code=404, detail="Unknown agentId")
    return AgentSummary(id=agent.id, name=agent.name, domain=agent.domain, createdAt=agent.created_at)
```

### `backend/app/scheduler.py`

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.config import get_settings
from app.db import SessionLocal
from app.models import Agent
from app.services.editorial import run_editorial_cycle

scheduler = AsyncIOScheduler(timezone="UTC")
async def run_all_agents() -> None:
    db = SessionLocal()
    try: agent_ids = [agent.id for agent in db.query(Agent.id).all()]
    finally: db.close()
    for agent_id in agent_ids:
        db = SessionLocal()
        try: await run_editorial_cycle(db, agent_id)
        finally: db.close()
def start_scheduler() -> None:
    if scheduler.running: return
    scheduler.add_job(run_all_agents, "interval", hours=get_settings().posting_interval_hours, id="editorial-cycle", replace_existing=True)
    scheduler.start()
def stop_scheduler() -> None:
    if scheduler.running: scheduler.shutdown(wait=False)
```

### `backend/app/services/editorial.py` (editorial core)

```python
SIGNAL_TERMS = {"ai","model","robot","security","chip","compute","agent","openai","anthropic","google","microsoft","nvidia","automation","data"}
NOISE_TERMS = {"review","deal","coupon","hands-on","podcast","opinion"}

def score(candidate, domain):
    words = set((candidate.title + " " + candidate.summary).lower().split())
    relevance = len(words & (SIGNAL_TERMS | set(domain.lower().split())))
    if words & NOISE_TERMS: return 0, "Rejected: promotional or commentary-led item, not a durable primary signal."
    if relevance < 2: return relevance, "Rejected: insufficient connection to the persona's specialist domain."
    return min(10, relevance + 4), "Accepted: material technology development with a clear domain implication."

async def run_editorial_cycle(db, agent_id):
    agent = db.get(Agent, agent_id)
    if not agent: return 0
    selected, selected_key, selected_score = None, "", 0
    for candidate in await discover_candidates():
        if source_seen(db, agent_id, candidate.url): continue
        key = topic_key(candidate.title); candidate_score, reason = score(candidate, agent.domain)
        duplicate = recently_covered(db, agent_id, key)
        decision = "rejected" if candidate_score < 5 or duplicate else "accepted"
        if duplicate: reason = "Rejected: substantially overlaps a recently published topic; preserving narrative variety."
        db.add(TopicDecision(agent_id=agent_id, source_url=candidate.url, headline=candidate.title, topic_key=key, decision=decision, reason=reason, score=str(candidate_score)))
        if decision == "accepted" and candidate_score > selected_score: selected, selected_key, selected_score = candidate, key, candidate_score
    if selected:
        prior = db.scalar(select(Post.topic_key).where(Post.agent_id == agent_id).order_by(Post.created_at.desc()).limit(1))
        rationale = f"Selected after scoring {selected_score}/10 for relevance to {agent.domain} and filtering out promotional, off-domain, and recently-covered candidates. It is timely because it is in the current discovery cycle. Primary editorial source: {selected.source_name}."
        db.add(Post(agent_id=agent_id, text=compose_post(agent, selected.title, selected.summary, prior), rationale=rationale, sources=[selected.url], topic_key=selected_key))
    agent.last_run_at = datetime.now(timezone.utc); db.commit()
    return 1 if selected else 0
```

### `frontend/app/components/useVoiceAnnouncer.ts`

```tsx
"use client";
export function useVoiceAnnouncer(posts: FeedPost[], enabled: boolean) {
  const latestId = useRef<string | null>(null);
  const speak = useCallback((message: string) => {
    if (!enabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.pitch = 0.9; utterance.rate = 1; utterance.volume = 0.72;
    window.speechSynthesis.speak(utterance);
  }, [enabled]);
  useEffect(() => {
    const newest = posts[0]; if (!newest) return;
    if (latestId.current && latestId.current !== newest.id)
      speak(`New signal logged. Title: ${newest.text.split("\n")[0].slice(0, 120)}. Operational rationale attached.`);
    latestId.current = newest.id;
  }, [posts, speak]);
  return { speak };
}
```

### `frontend/app/components/CountdownTimer.tsx`

```tsx
"use client";
const LOOP_MS = 6 * 60 * 60 * 1000;
function untilNextLoop() {
  const left = LOOP_MS - Date.now() % LOOP_MS;
  return `${String(Math.floor(left / 3_600_000)).padStart(2, "0")}h ${String(Math.floor(left % 3_600_000 / 60_000)).padStart(2, "0")}m ${String(Math.floor(left % 60_000 / 1000)).padStart(2, "0")}s`;
}
export function CountdownTimer() {
  const [remaining, setRemaining] = useState("--h --m --s");
  useEffect(() => { const update = () => setRemaining(untilNextLoop()); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, []);
  return <span className="countdown"><i /> AUTONOMOUS ACTIVE <b>NEXT INGESTION LOOP: {remaining}</b></span>;
}
```

### UI implementation map

`page.tsx` is the client orchestrator. It maintains `agent`, `posts`, `audioEnabled`, and `telemetryOpen`; it polls the two backend GET routes every 30 seconds after initialization and renders `AudioAnnouncer`, `CountdownTimer`, and `TelemetryPanel`.

`TelemetryPanel.tsx` contains typed `TelemetryLog` and `RejectedCandidate` collections, a 3.6-second simulation interval, auto-scroll behavior, and the two requested tabs. `AudioAnnouncer.tsx` owns browser speech-recognition wiring, including Space-key activation, the “read latest” and “toggle logs” command dispatches, and microphone error handling. `globals.css` contains all active visual styles for the telemetry drawer, badges, controls, rationale card, and mobile adaptation.

## Embedded source snapshot (core running code)

The following is deliberately embedded so an AI can understand the essential running implementation even when the repository is not attached. The complete repository remains canonical for styles and the smaller supporting modules.

### `backend/app/main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.db import Base, engine
from app.routers.agent import router as agent_router
from app.scheduler import start_scheduler, stop_scheduler

settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(agent_router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

### `backend/app/routers/agent.py`

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import SessionLocal, get_db
from app.models import Agent, Post
from app.schemas import AgentSummary, FeedPost, InitRequest, InitResponse
from app.services.editorial import run_editorial_cycle
from app.services.persona import build_voice_profile

router = APIRouter(prefix="/api/agent", tags=["agent"])

async def initial_cycle(agent_id: str) -> None:
    db = SessionLocal()
    try: await run_editorial_cycle(db, agent_id)
    finally: db.close()

@router.post("/init", response_model=InitResponse, status_code=status.HTTP_201_CREATED)
async def init_agent(payload: InitRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> InitResponse:
    agent = Agent(name=payload.personaName.strip(), domain=payload.domain.strip(), voice_profile=build_voice_profile(payload.personaName, payload.domain))
    db.add(agent); db.commit(); db.refresh(agent)
    background_tasks.add_task(initial_cycle, agent.id)
    return InitResponse(agentId=agent.id)

@router.get("/feed", response_model=list[FeedPost])
def get_feed(agentId: str, db: Session = Depends(get_db)) -> list[FeedPost]:
    if not db.get(Agent, agentId): raise HTTPException(status_code=404, detail="Unknown agentId")
    posts = db.scalars(select(Post).where(Post.agent_id == agentId).order_by(Post.created_at.desc())).all()
    return [FeedPost(id=p.id, createdAt=p.created_at, text=p.text, rationale=p.rationale, sources=p.sources) for p in posts]

@router.get("/{agent_id}", response_model=AgentSummary)
def get_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentSummary:
    agent = db.get(Agent, agent_id)
    if not agent: raise HTTPException(status_code=404, detail="Unknown agentId")
    return AgentSummary(id=agent.id, name=agent.name, domain=agent.domain, createdAt=agent.created_at)
```

### `backend/app/scheduler.py`

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.config import get_settings
from app.db import SessionLocal
from app.models import Agent
from app.services.editorial import run_editorial_cycle

scheduler = AsyncIOScheduler(timezone="UTC")
async def run_all_agents() -> None:
    db = SessionLocal()
    try: agent_ids = [agent.id for agent in db.query(Agent.id).all()]
    finally: db.close()
    for agent_id in agent_ids:
        db = SessionLocal()
        try: await run_editorial_cycle(db, agent_id)
        finally: db.close()
def start_scheduler() -> None:
    if scheduler.running: return
    scheduler.add_job(run_all_agents, "interval", hours=get_settings().posting_interval_hours, id="editorial-cycle", replace_existing=True)
    scheduler.start()
def stop_scheduler() -> None:
    if scheduler.running: scheduler.shutdown(wait=False)
```

### `backend/app/services/editorial.py` (editorial core)

```python
SIGNAL_TERMS = {"ai","model","robot","security","chip","compute","agent","openai","anthropic","google","microsoft","nvidia","automation","data"}
NOISE_TERMS = {"review","deal","coupon","hands-on","podcast","opinion"}

def score(candidate, domain):
    words = set((candidate.title + " " + candidate.summary).lower().split())
    relevance = len(words & (SIGNAL_TERMS | set(domain.lower().split())))
    if words & NOISE_TERMS: return 0, "Rejected: promotional or commentary-led item, not a durable primary signal."
    if relevance < 2: return relevance, "Rejected: insufficient connection to the persona's specialist domain."
    return min(10, relevance + 4), "Accepted: material technology development with a clear domain implication."

async def run_editorial_cycle(db, agent_id):
    agent = db.get(Agent, agent_id)
    if not agent: return 0
    selected, selected_key, selected_score = None, "", 0
    for candidate in await discover_candidates():
        if source_seen(db, agent_id, candidate.url): continue
        key = topic_key(candidate.title); candidate_score, reason = score(candidate, agent.domain)
        duplicate = recently_covered(db, agent_id, key)
        decision = "rejected" if candidate_score < 5 or duplicate else "accepted"
        if duplicate: reason = "Rejected: substantially overlaps a recently published topic; preserving narrative variety."
        db.add(TopicDecision(agent_id=agent_id, source_url=candidate.url, headline=candidate.title, topic_key=key, decision=decision, reason=reason, score=str(candidate_score)))
        if decision == "accepted" and candidate_score > selected_score: selected, selected_key, selected_score = candidate, key, candidate_score
    if selected:
        prior = db.scalar(select(Post.topic_key).where(Post.agent_id == agent_id).order_by(Post.created_at.desc()).limit(1))
        rationale = f"Selected after scoring {selected_score}/10 for relevance to {agent.domain} and filtering out promotional, off-domain, and recently-covered candidates. It is timely because it is in the current discovery cycle. Primary editorial source: {selected.source_name}."
        db.add(Post(agent_id=agent_id, text=compose_post(agent, selected.title, selected.summary, prior), rationale=rationale, sources=[selected.url], topic_key=selected_key))
    agent.last_run_at = datetime.now(timezone.utc); db.commit()
    return 1 if selected else 0
```

### `frontend/app/components/useVoiceAnnouncer.ts`

```tsx
"use client";
export function useVoiceAnnouncer(posts: FeedPost[], enabled: boolean) {
  const latestId = useRef<string | null>(null);
  const speak = useCallback((message: string) => {
    if (!enabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.pitch = 0.9; utterance.rate = 1; utterance.volume = 0.72;
    window.speechSynthesis.speak(utterance);
  }, [enabled]);
  useEffect(() => {
    const newest = posts[0]; if (!newest) return;
    if (latestId.current && latestId.current !== newest.id)
      speak(`New signal logged. Title: ${newest.text.split("\n")[0].slice(0, 120)}. Operational rationale attached.`);
    latestId.current = newest.id;
  }, [posts, speak]);
  return { speak };
}
```

### `frontend/app/components/CountdownTimer.tsx`

```tsx
"use client";
const LOOP_MS = 6 * 60 * 60 * 1000;
function untilNextLoop() {
  const left = LOOP_MS - Date.now() % LOOP_MS;
  return `${String(Math.floor(left / 3_600_000)).padStart(2, "0")}h ${String(Math.floor(left % 3_600_000 / 60_000)).padStart(2, "0")}m ${String(Math.floor(left % 60_000 / 1000)).padStart(2, "0")}s`;
}
export function CountdownTimer() {
  const [remaining, setRemaining] = useState("--h --m --s");
  useEffect(() => { const update = () => setRemaining(untilNextLoop()); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, []);
  return <span className="countdown"><i /> AUTONOMOUS ACTIVE <b>NEXT INGESTION LOOP: {remaining}</b></span>;
}
```

### UI implementation map

`page.tsx` is the client orchestrator. It maintains `agent`, `posts`, `audioEnabled`, and `telemetryOpen`; it polls the two backend GET routes every 30 seconds after initialization and renders `AudioAnnouncer`, `CountdownTimer`, and `TelemetryPanel`.

`TelemetryPanel.tsx` contains typed `TelemetryLog` and `RejectedCandidate` collections, a 3.6-second simulation interval, auto-scroll behavior, and the two requested tabs. `AudioAnnouncer.tsx` owns browser speech-recognition wiring, including Space-key activation, the “read latest” and “toggle logs” command dispatches, and microphone error handling. `globals.css` contains all active visual styles for the telemetry drawer, badges, controls, rationale card, and mobile adaptation.
