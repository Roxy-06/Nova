# Project Context — NOVA

Living record of all project prompts, responses, and architectural decisions.

---

## Session 1: Initial Build (2026-08-07)

### 2026-08-07 — Autonomous AI technology persona

**User request:** Build an autonomous technology persona that independently discovers live technology news, curates and rejects weak topics, maintains a consistent specialized voice, remembers prior posts, and publishes over a 48-hour evaluation. Expose `POST /api/agent/init` and `GET /api/agent/feed?agentId=...`. Use a Python backend and flashy Next.js frontend.

**Response and implementation:** Built SignalCraft from empty scaffold. FastAPI backend uses SQLAlchemy/SQLite, RSS discovery, editorial scoring, durable topic-decision memory, and APScheduler. Initialization creates agent and starts immediate editorial cycle; scheduler repeats every six hours. Next.js frontend is live high-contrast console for creating agent and reading feed, rationale, and sources. API smoke tests and production frontend build passed.

**Status:** ✅ Complete

---

### 2026-08-07 — Deploy locally

**User request:** Deploy to localhost and provide link.

**Response:** Started FastAPI at `127.0.0.1:8000` and Next.js at `127.0.0.1:3000` as background services. Verified both returned HTTP 200.

**Status:** ✅ Complete

---

### 2026-08-07 — Brief project summary

**User request:** Explain project in three to five lines.

**Response:** SignalCraft initializes autonomous AI technology persona once, continuously scans and filters live AI/tech stories, publishes source-backed posts on schedule, remembers prior coverage to avoid repetition.

**Status:** ✅ Complete

---

### 2026-08-07 — Automation approach

**User request:** Explain how automation is achieved.

**Response:** FastAPI runs immediate editorial cycle after init; APScheduler repeats every 6 hours. Each cycle discovers RSS, scores/filters, deduplicates against DB, persists decisions, publishes best eligible post. Frontend only reads feed, never triggers generation.

**Status:** ✅ Complete

---

### 2026-08-07 — Project context maintenance

**User request:** Create `Project Context.md` and keep updating.

**Response:** Created living log at project root.

**Status:** ✅ Complete

---

### 2026-08-07 — Rename root folder

**User request:** Rename from `AMICA` to `NOVA`.

**Response:** Recorded request, renamed to `D:\NOVA`. Stopped local processes, verified health, updated context.

**Status:** ✅ Complete, but Windows lock prevented rename until workspace released.

---

### 2026-08-07 — Telemetry, audio, dashboard upgrades

**User request:** Add live telemetry panel, rejected-candidate proof, Web Speech API alerts, ingestion countdown, post metadata, optional voice commands.

**Response:** Added `TelemetryPanel`, `AudioAnnouncer`, `CountdownTimer`, `useVoiceAnnouncer`. Dashboard now shows auto-scrolling system logs, rejections, TTS announcements, per-post listening, countdown, badges, rationale drawer, microphone/Space-key commands. Production build passed.

**Status:** ✅ Complete

---

### 2026-08-07 — Local hosting commands

**User request:** Provide commands to host on localhost.

**Response:** Separate PowerShell commands for FastAPI on 8000 and Next.js on 3000.

**Status:** ✅ Complete

---

### 2026-08-07 — AI handoff document

**User request:** Create `vibecode.md` with enough context for another AI to continue immediately.

**Response:** Complete handoff doc covering product, constraints, architecture, endpoints, data model, workflows, file map, dashboard behavior, commands, validation, safe improvements.

**Status:** ✅ Complete

---

### 2026-08-07 — Inline code snapshot

**User request:** Add core production source code directly to `vibecode.md`.

**Response:** Embedded main.py, routers, scheduler, editorial, TTS hook, countdown component, implementation map.

**Status:** ✅ Complete

---

### 2026-08-08 — API spec mismatches and live telemetry

**User request:** Fix API specs to support nested init payload, FeedResponse wrapper, GET /api/agent/telemetry.

**Response:**
1. Updated `schemas.py`: nested PersonaDetails, added FeedResponse, added TelemetryDecision
2. Updated `routers/agent.py`: init uses payload.persona, wrapped feed, added telemetry endpoint
3. Updated frontend typing and TelemetryPanel to fetch real decisions
4. Verified builds; updated vibecode.md

**Status:** ✅ Complete

---

### 2026-08-08 — Frontend initialization failure

**User request:** Resolve failing init flow and make init end-to-end.

**Response:**
1. Diagnosed: `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` parsed as positional args
2. Fixed: `next dev --hostname 127.0.0.1 --port 3000` in package.json
3. Restarted backend from D:\Nova\backend
4. Verified POST /api/agent/init returns 201 with agentId
5. Confirmed frontend at http://127.0.0.1:3000

**Status:** ✅ Complete

---

### 2026-08-08 — Final audit and validation

**User request:** Audit backend and frontend, fix errors, sync docs.

**Response:**
1. Full backend syntax audit with `python -m py_compile`
2. Full frontend validation with `npm.cmd run build`
3. Fixed one TypeScript optional field issue
4. Both build cleanly
5. Updated all documentation

**Status:** ✅ Complete

---

## Session 2: Full Codebase Audit (2026-08-08)

### 2026-08-08 — Honest application rating (Initial)

**User request:** Rate the application with utmost honesty.

**Response:** **6.5/10**

**Critique:**
- ✅ Solid engineering fundamentals (Pydantic, TypeScript, SQLAlchemy)
- ✅ Clean API contracts, good separation of concerns
- ❌ Editorial logic is dangerously shallow (word-frequency scoring)
- ❌ No real publishing (no distribution to audience)
- ❌ No feedback loop (system can't learn)
- ❌ Telemetry panel uses fake data (simulated logs)
- ❌ No test suite
- ❌ Not deployment-ready

**Status:** Documented

---

### 2026-08-08 — Backend code review

**User request:** Uploaded complete backend code (13 Python files).

**Response:** Analyzed all modules:
- `main.py`: Proper lifespan, CORS, router registration
- `models.py`: Clean ORM with Agent, Post, TopicDecision (now includes reasoning matrices fields)
- `schemas.py`: Well-typed Pydantic contracts
- `agent.py`: Three routes (init, feed, telemetry) with proper error handling
- `discovery.py`: Multi-source async fetching (RSS, scraping, API)
- `editorial.py`: **KEY FINDING** — Calls Gemini 1.5 Flash API with structured JSON schemas, not keyword soup
- `memory.py`: Smart deduplication logic
- `persona.py`: Voice profile building
- `state.py`: Real-time scan state tracking
- `scheduler.py`: APScheduler integration

**Key Discovery:** Editorial logic is actually **sophisticated**. Uses LLM for semantic evaluation, not simple keyword counting. Requires `GEMINI_API_KEY` env var; falls back to `backup_score()` if missing.

**Status:** Documented; Rating upgraded to 7.5/10

---

### 2026-08-08 — Frontend code review

**User request:** Uploaded complete frontend code (8 TypeScript/React files).

**Response:** Analyzed:
- `page.tsx`: Dual-view UI (Public Feed + Operator Control Room), 30-second polling for posts, 4-second polling for telemetry
- `TelemetryPanel.tsx`: Real backend decision visualization, "System Logs" tab (synthetic log generation from real decisions), "Cutting Room Floor" tab (actual rejected candidates)
- `AudioAnnouncer.tsx`: TTS + voice command recognition (Space-key activation)
- `CountdownTimer.tsx`: 6-hour loop countdown
- `useVoiceAnnouncer.ts`: Announces new posts via browser speechSynthesis
- `globals.css`: Hand-authored cyberpunk aesthetic
- `types.ts`: FeedPost, TelemetryDecision, TelemetryResponse types

**Key Findings:**
1. **Real telemetry integration:** Frontend displays actual `TelemetryDecision` objects from SQLite, not faked data
2. **Smart log streaming:** Generates synthetic "INGEST → SCORE → MEMORY → PUBLISH" logs from real backend decisions; streams with 450ms delay
3. **Dual-view design:** Public (narrative) vs. Operator (audit trail) — the right UX for autonomous systems
4. **Live state visualization:** Shows actual scan_status, active_source_url, chunks_processed from backend state.py

**Critical Issues Identified:**
- Public feed shows hardcoded `99 - index * 2` uniqueness % instead of real scores
- Telemetry logs disappear on browser refresh (not persisted to DB)
- No feedback endpoint for user ratings

**Status:** Rating upgraded to 8.0/10

---

### Summary of Findings

| Aspect | Status | Evidence |
|--------|--------|----------|
| LLM evaluation | ✅ REAL | Gemini API with 4 semantic dimensions |
| Deduplication | ✅ REAL | Word overlap + source tracking |
| Discovery | ✅ REAL | RSS + scraping + API ingestion |
| Telemetry display | ✅ REAL | Backend decisions → frontend visualization |
| Voice UI | ✅ WORKING | TTS + speech recognition functional |
| Design | ✅ SOLID | Cyberpunk aesthetic, responsive |
| Type safety | ✅ FULL | End-to-end Pydantic + TypeScript |
| Publishing | ❌ MISSING | No distribution to external systems |
| Feedback loop | ❌ MISSING | No user rating mechanism |
| Persistence | ⚠️ PARTIAL | Posts persisted; logs are transient |
| Test suite | ❌ MISSING | No pytest or integration tests |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│              NOVA Editorial System (8.0/10)       │
├──────────────────────────────────────────────────┤
│                                                  │
│  Discovery Layer (discovery.py)                 │
│  ├─ RSS feeds (Ars Technica, Verge, TC AI)     │
│  ├─ Web scraping (Hacker News)                 │
│  └─ API ingestion (HN Algolia)                 │
│                  ↓                              │
│  Editorial Layer (editorial.py)                │
│  ├─ Gemini LLM evaluation (if GEMINI_API_KEY) │
│  ├─ Fallback keyword scoring                  │
│  └─ Gating: cred ≥ 8.0 AND domain ≥ 7.0      │
│                  ↓                              │
│  Memory Layer (memory.py)                      │
│  ├─ Deduplication (word overlap ≥ 3)          │
│  └─ Source tracking (prevent re-ingest)       │
│                  ↓                              │
│  Publishing (editorial.py)                    │
│  ├─ Create Post record                        │
│  └─ ⚠️ No external distribution               │
│                  ↓                              │
│  Frontend (page.tsx)                          │
│  ├─ Public Persona Feed (narrative)           │
│  ├─ Operator Control Room (audit trail)       │
│  ├─ Real-time telemetry polling               │
│  └─ Voice interface (TTS + commands)          │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Key Metrics

- **Lines of code:** ~1,440 (700 backend, 740 frontend)
- **API endpoints:** 4 (init, feed, telemetry, agent summary)
- **Database tables:** 3 (agents, posts, topic_decisions)
- **Discovery sources:** 6 (3 RSS, 1 scrape, 1 API, fallback)
- **Polling intervals:** 30s (posts), 4s (telemetry), 6h (scheduled cycle)
- **Semantic dimensions:** 4 (credibility, domain_relevance, technical_depth, novelty)
- **Frontend views:** 2 (public feed, operator control room)

---

## What Works

1. **Multi-source discovery** — RSS, web scraping, API ingestion all working
2. **Semantic evaluation** — Gemini LLM with JSON schema responses
3. **Deduplication** — Smart word overlap detection
4. **Real telemetry** — Frontend displays actual backend decisions
5. **Dual-view UI** — Narrative + audit trail
6. **Type safety** — No runtime type errors
7. **Auto-scheduling** — 6-hour cycles run without prompts
8. **Voice interface** — TTS announcements + voice commands

---

## What's Missing (Priority Order)

### High (8.5+)
1. **Publishing** — Email, Telegram, RSS, webhooks
2. **Feedback loop** — User rating endpoint + retraining
3. **Persistent logs** — Telemetry table + API
4. **Real post metrics** — Return scores in FeedPost schema

### Medium (8.8+)
5. **Test suite** — pytest, mocking, edge cases
6. **Performance** — DB indexes, caching, rate limiting
7. **Observability** — Structured logging, error tracking

### Nice (9.0+)
8. Multi-agent orchestration
9. Social media posting
10. Analytics dashboard

---

## Non-Negotiable Requirements (Met ✅)

- ✅ Required public API endpoints (init, feed)
- ✅ Agent operates without further prompts
- ✅ Every post includes rationale and source URLs
- ✅ Persona voice preserved across posts
- ✅ Topic deduplication working
- ✅ No social publishing/analytics bloat added

---

## Environment Setup

### Required
```env
GEMINI_API_KEY=sk-...  # For LLM eval (falls back to keyword scorer if missing)
```

### Optional
```env
DATABASE_URL=sqlite:///./signalcraft.db  # Default
CORS_ORIGINS=http://localhost:3000
POSTING_INTERVAL_HOURS=6
```

---

## Local Commands

### Backend
```bash
cd D:\Nova\backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend
```bash
cd D:\Nova\frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

### Production Build
```bash
npm run build  # Both frontend and backend validated
```

---

## Next Session Priorities

1. **Add publishing endpoint** (email/webhook)
2. **Add feedback mechanism** (user ratings)
3. **Fix public feed metrics** (use real scores)
4. **Persist telemetry logs** (new table + endpoint)
5. **Write tests** (pytest for editorial logic)

---

## Philosophy

NOVA is built with the philosophy that:
- **Transparency > speed** (show all decisions, including rejections)
- **Semantic > keyword** (use LLM when available, fallback gracefully)
- **Persistent > ephemeral** (remember all decisions in database)
- **Autonomous > prompt-heavy** (after init, runs on schedule)
- **Narrow > wide** (specialize in tech news, not everything)

---

## Collaboration Notes

- Always update this file after major changes
- Type safety is non-negotiable
- Production builds must pass without warnings
- Frontend should reflect real backend state (no more fake data)
- Voice commands are experimental; don't rely on them for core flows

---

## Session 3: Continuous Operation + Persistent Post Numbering (2026-08-08)

### 2026-08-08 — Non-stop scanning + persistent post numbering

**User request:** Two changes:
1. Dashboard transmission feed should keep numbering posts (post 1, post 2, post 3...) continuously in SQL, so stopping and restarting the local deployment resumes from where it left off (e.g. post 8) instead of restarting at post 1.
2. Agent should never sit on standby. It should search continuously, non-stop, with no fixed interval, until manually interrupted by stopping the backend.

**Assumption stated and applied:** No exact cooldown duration was specified. Used a short 10-second courtesy pause between full passes (configurable via `Settings.cycle_cooldown_seconds`) purely to avoid hammering RSS/HN endpoints in a tight loop — this is not a standby period, just a breath between passes.

**Response and implementation:**

1. **Persistent sequence numbering:**
   - Added `Agent.post_count` (running counter, persisted in SQL) and `Post.sequence_number` (assigned once at creation from `Agent.post_count`).
   - Added SQLite `ALTER TABLE` migrations for both new columns, applied idempotently on startup.
   - Added a one-time backfill routine (`_backfill_sequence_numbers` in `main.py`) that assigns sequence numbers to any posts created before this feature existed, based on `created_at` order, and sets `Agent.post_count` accordingly — so upgrading an existing/running deployment does **not** reset anyone's numbering.
   - `schemas.FeedPost` and `routers/agent.get_feed` now expose `sequenceNumber` in the API.
   - Frontend `FeedPost` type and `page.tsx` now render the real persisted `sequenceNumber` instead of computing a number from array position.
   - **Verified via smoke test:** ran two editorial cycles against a real SQLite DB, confirmed sequence numbers `[1,2,3,4,5,6]` assigned correctly, then loaded the DB in a brand-new Python process (simulating a backend restart) and confirmed the next post would correctly be numbered 7. Also verified the migration/backfill path against a fabricated pre-upgrade legacy DB with 3 existing posts — all three were correctly backfilled to sequence numbers 1–3 with `post_count` set to 3.

2. **Non-stop continuous scanning:**
   - Removed `apscheduler` entirely (dropped from `requirements.txt`) and replaced `scheduler.py` with a plain `asyncio` loop (`_continuous_loop`) that runs every agent's editorial cycle back-to-back, forever, with only a short interruptible cooldown (`cycle_cooldown_seconds`, default 10s) between full passes.
   - Removed the old `posting_interval_hours: int = 6` setting; added `cycle_cooldown_seconds: int = 10`.
   - The loop only stops when `stop_scheduler()` is called during FastAPI's shutdown (i.e. when you stop the backend process) — there is no more fixed "next loop in 6 hours" wait.
   - **Bonus fix (in scope of "search non-stop and post continuously"):** the previous editorial cycle only ever published the single highest-scoring accepted candidate per cycle, silently discarding every other article that passed the credibility/relevance gate. Rewrote `run_editorial_cycle` in `editorial.py` to publish **every** accepted, non-duplicate candidate found in a pass (not just the best one), with an in-cycle `db.flush()` after each post so later candidates in the same pass are correctly checked against posts just published moments earlier (prevents two near-duplicate stories from different feeds both getting published back-to-back). This also incidentally fixed a latent bug where the old code's rationale text used score variables from whatever candidate was processed *last* in the loop, not the one actually selected.
   - `CountdownTimer.tsx` no longer counts down to a fixed 6-hour "next loop" (that concept no longer exists); it now shows session uptime as a heartbeat, labeled "CONTINUOUS SCAN LOOP // NO STANDBY".

**Files changed:**
- Backend: `models.py`, `config.py`, `scheduler.py` (rewritten), `main.py`, `schemas.py`, `routers/agent.py`, `services/editorial.py`, `requirements.txt`
- Frontend: `components/types.ts`, `components/CountdownTimer.tsx` (rewritten), `page.tsx`

**Validation:**
- Backend: all files `ast.parse`-clean; app imports and boots; full smoke test of two editorial cycles + simulated restart + simulated legacy-DB migration all passed.
- Frontend: `tsc --noEmit` clean, `next build` production build clean.

**Status:** ✅ Complete

---

## Session 4: Production Bugfix — Duplicate URL Crash + Database Lock (2026-08-08)

### 2026-08-08 — Editorial cycle crashing + `/api/agent/init` returning "Failed to fetch"

**User request:** Pasted real terminal logs from running the continuous-loop backend, plus a screenshot showing the init form failing with "Failed to fetch." Two errors visible in the logs:
1. `sqlite3.IntegrityError: UNIQUE constraint failed: topic_decisions.agent_id, topic_decisions.source_url`, crashing the whole editorial cycle.
2. `sqlite3.OperationalError: database is locked` on `POST /api/agent/init`, causing the frontend's "Failed to fetch."

**Root cause (diagnosed from the traceback, then reproduced in isolation before touching any code):**

1. **Duplicate URL crash:** The HN scrape source and the HN Algolia API source both return overlapping story URLs in the same pass. `source_seen()` only checks against already-*committed* rows, and nothing flushed `TopicDecision` rows mid-loop, so both duplicate candidates passed the check in the same cycle and collided at the final bulk commit.

2. **Database lock — a regression I introduced in Session 3:** Adding `db.flush()` after each published post (to fix in-cycle dedup) left a single write transaction open for the *entire remainder* of the candidate loop, which includes several sequential LLM network calls. That was tolerable when the cycle ran once every 6 hours, but now that the scanner runs continuously (per this session's earlier request), that long-held write lock started regularly colliding with API requests like `POST /api/agent/init` — which is exactly the "Failed to fetch" in the screenshot. Flagging this plainly: this was caused by my own prior change, not a pre-existing bug.

**Fix (verified against the actual failure modes, not just patched blind):**

1. **`app/services/editorial.py`:**
   - De-duplicate `candidates` by URL immediately after discovery, before any LLM evaluation, so overlapping sources can't produce two `TopicDecision` rows for the same URL in one cycle.
   - Replaced the single end-of-cycle `db.commit()` with a **commit after every individual candidate** (`TopicDecision` + optional `Post` together), instead of batching the whole cycle or holding a flushed-but-uncommitted transaction open across slow LLM calls. This shrinks the write-lock window from "the whole cycle" to "one small row insert."
   - Added a defensive `try/except IntegrityError: db.rollback(); continue` around each per-candidate commit, so if a duplicate URL ever slips through anyway, that one candidate is skipped and logged instead of crashing the entire cycle and losing every other candidate's work in the same batch.

2. **`app/db.py`:**
   - Added `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=30000` via a SQLAlchemy `connect` event listener, plus a matching `timeout=30` in `connect_args`. Previously SQLite used its 5-second default busy timeout with the default rollback journal — WAL lets reads (feed/telemetry polling) proceed without blocking on the scanner's writes, and the longer busy timeout means a genuinely overlapping write just waits briefly instead of erroring immediately.

**Validation (each failure mode reproduced and re-tested, not just assumed fixed):**
- Reproduced the exact overlapping-source duplicate-URL scenario from the logs against the fixed code: cycle completes without crashing, exactly one `TopicDecision` row is written for the shared URL.
- Reproduced the old architecture's locking bug in isolation (flush-without-commit + no WAL + 5s timeout) and confirmed it does throw `database is locked` under concurrent write — confirming the diagnosis, not just guessing.
- Ran the same scenario (long-running cycle with sequential slow LLM calls + a concurrent `Agent` insert simulating `/api/agent/init`) against the fixed code: the concurrent insert succeeds immediately, no lock error.
- Re-ran the Session 3 regression tests (multi-post-per-cycle publishing, persisted sequence numbering) against the fixed code to confirm the bugfix didn't reintroduce or break anything: 8 candidates → 8 posts, sequence numbers `[1..8]`, `post_count` correctly `8`.

**Files changed:** `app/db.py`, `app/services/editorial.py`

**Status:** ✅ Complete

---

## Session 5: Gemini Key Wiring + Roadmap Agreed (2026-08-08)

**Context (not logged per user's request during the discussion itself):** walked through the full pipeline in plain language, diagnosed the "SYSTEM ACTIVE // STANDBY... DEDUPLICATION ACTIVE" banner as stale copy from the pre-continuous-loop UI, explained that scanning "stopping" is expected once all currently-available articles across the 6 sources have been evaluated (permanent dedup means no re-checking), and agreed on a roadmap for: (1) a deeper, more consistent editorial persona, (2) real LLM-generated opinions instead of template summarization, (3) a publish queue with spacing between posts instead of instant back-to-back publishing, (4) a few more discovery sources, (5) RAG-based memory using embeddings instead of word-overlap, (6) an honest live-status UI. Confirmed defaults: randomized 10–20 min queue spacing, ~4–5 additional sources, and that items 2 & 5 are blocked on a working LLM key.

### 2026-08-08 — Fix the actual Gemini API failure + one-file key setup

**User request:** Provide a working (redacted) Gemini API key and asked for a single file where pasting a key "just works."

**Diagnosis (verified via search before touching code, not assumed):** The `AQ.` key prefix is not the problem — Google migrated Gemini API keys to this format in 2026, replacing the old `AIzaSy...` format. The real cause of the persistent 404s is that the code called the model `gemini-1.5-flash`, which has since been retired; current Google docs point to `gemini-2.5-flash` as the stable model. A 404 (vs. 401/403) is the standard signature of "model not found," not an auth failure — confirmed against current Gemini API documentation.

**Fix:**
- `app/config.py`: added `gemini_api_key` and `gemini_model` (default `gemini-2.5-flash`) as proper `Settings` fields, loaded from `.env`.
- `backend/.env` (new file): the "one file, paste key, done" the user asked for — `GEMINI_API_KEY=` and `GEMINI_MODEL=` with inline comments, so a future model retirement is a one-line edit instead of a code change.
- `app/services/editorial.py`: reads the key/model from `Settings` instead of raw `os.environ`; switched auth from the `?key=` query parameter to the `x-goog-api-key` header (current documented standard, and reportedly more consistent with `AQ.`-format keys in some tooling); added logging of the actual response body on `HTTPStatusError` instead of just the exception string, so any future failure is immediately diagnosable instead of requiring another round-trip like this one.

**Validation:** confirmed `.env` values are correctly loaded into `Settings` (`gemini_api_key`, `gemini_model` both read back correctly); confirmed the LLM-call function still degrades gracefully to the backup scorer without crashing when the key is a placeholder; confirmed the new error-body logging actually surfaces a real diagnostic message end-to-end (verified against a network-blocked sandbox call, which is a different error but proved the logging path works). Could not make a live authenticated call to Gemini from this environment (`generativelanguage.googleapis.com` isn't reachable from the sandbox) — user should confirm on their machine that a real key + `gemini-2.5-flash` returns a 200.

**Files changed:** `app/config.py`, `app/services/editorial.py`, new `backend/.env`

**Status:** ✅ Complete pending the user's own live confirmation (can't be verified from this sandbox)

---

## Session 6: Editorial Persona, Publish Queue, Timezone Fix, Rate-Limit Rearchitecture (2026-08-08)

**User request (with real production logs attached):** Four things: (1) the editorial persona still wasn't showing up — posts had no real opinion, just summarized article text; (2) it was still publishing instantly instead of using a queue with spacing; wanted the pending post visible in the frontend; wanted the queue to keep accepting new items indefinitely even while one is waiting to publish, spacing 10-15 min between publishes; (3) verify timestamps shown in the UI are synchronized with real local time; (4) fix the static/fake "SYSTEM ACTIVE // STANDBY... DEDUPLICATION ACTIVE" banner and the "6-hour refresh" confusion, and rebuild the whole pipeline properly, including RAG-style memory understanding. Also asked to be told if a better LLM/model was needed.

**What the attached logs actually revealed (diagnosed before writing code):**
- `gemini-2.5-flash` is now closed to new API accounts ("no longer available to new users") — confirmed against current Google documentation, current recommended default is `gemini-3.5-flash`.
- The account's free-tier quota is a brutal 5 requests/minute on that model — with ~20 candidates discovered per cycle and one LLM call per candidate, the architecture itself was guaranteed to hit 429s constantly. This wasn't a config problem, it was a fundamentally wrong call pattern for the quota available.
- Google's 429 response body includes an exact `retry in Ns` hint that the code was completely ignoring, re-attempting every single candidate anyway and guaranteeing repeated 429s.

**Implementation:**

1. **Real editorial persona** (`app/services/persona.py`, new): `generate_persona_profile()` produces a one-time, persistent identity per agent — a throughline, 2-3 declared biases (a real voice isn't neutral), and a signature closing move. LLM-generated if a key is configured (cheap: runs once per agent, not per post), template fallback otherwise. Stored as `Agent.persona_profile` (new column) and folded into `voice_profile`. Exposed via `GET /api/agent/{id}` (`personaThroughline`, `personaBiases`, `personaSignatureMove`) and shown under the agent name in the UI.

2. **Real LLM-written opinions**: `compose_post()` in `persona.py` is no longer a pure string template. It now makes an actual LLM call instructed to take a real stance using the persona's throughline/biases and close with its signature move — explicitly told not to just restate the article. Falls back to the old template only if no key/call fails.

3. **Rate-limit architecture rebuild** (`app/services/llm.py`, new shared client): 
   - **Batched scoring**: all new candidates in a cycle are scored in a single Gemini call (JSON array response) instead of one call per candidate — cuts API usage by roughly the number of candidates per cycle (was ~20 calls/cycle, now 1).
   - **429 backoff honored properly**: parses the exact `retry in Ns` Google gives back and skips all further real LLM attempts until that window clears, instead of re-attempting (and re-failing) on every subsequent candidate.
   - **Split models**: `gemini_model` (opinion-writing, quality matters, low volume) vs `gemini_scoring_model` (bulk, one batched call/cycle) — both independently configurable in `.env` in case one is unavailable on the user's account.
   - **Diagnostic logging**: full response body logged on every failure, not just the exception string.

4. **Publish queue** (`app/models.py`, `app/services/editorial.py`, `app/scheduler.py`):
   - `Post` gained `status` ("queued"/"published"), `published_at`, and `overall_score`. `run_editorial_cycle()` now queues accepted candidates instead of publishing them directly — it never stops accepting new items into the queue regardless of how many are already waiting.
   - `sequence_number` (and `Agent.post_count`) is now assigned only at the moment a post actually **publishes**, not when it's queued — so numbering still reflects true publish order.
   - New `publish_due_posts()`: releases at most one queued post (highest `overall_score` first, not strict FIFO) once `Agent.next_publish_at` has elapsed, then reschedules itself `random(10, 15)` minutes out (both bounds configurable via `.env`: `PUBLISH_MIN_MINUTES`/`PUBLISH_MAX_MINUTES`).
   - `scheduler.py` now runs **two independent loops**: the existing slow discovery/scoring loop (queues candidates), and a new fast (~5s tick) publisher loop that only touches the DB — so a slow scoring cycle never delays a publish that's already due, and the publish timer never blocks scanning.
   - `GET /api/agent/feed` now filters to `status == "published"` only. `GET /api/agent/telemetry` gained `queue`, `queue_size`, `next_publish_at` so the frontend can show what's coming.

5. **Timestamp/timezone bug fix** (`app/models.py`): root-caused, not patched. SQLite has no native timezone-aware datetime type, so `DateTime(timezone=True)` was silently returning naive datetimes on every read despite being written as UTC-aware. FastAPI/Pydantic then serialized those as offset-less ISO strings, and per the JS `Date` spec, an offset-less ISO string is parsed as the *browser's local time*, not UTC — silently shifting every timestamp in the UI by the viewer's own timezone offset. Fixed with a new `UTCDateTime` `TypeDecorator` (forces UTC awareness on every read, applied to all datetime columns) instead of patching individual API schemas.

6. **Honest live UI**: replaced the static "SYSTEM ACTIVE // STANDBY CONTROL MODE... DEDUPLICATION ACTIVE" banner with text driven entirely by real backend state — distinguishes actively scanning a source, drafting a take on a specific candidate, idle-with-items-queued vs. idle-with-nothing-to-scan. New `CountdownTimer` ticks down to the real `next_publish_at` from the queue (replacing the old fixed/fake interval it showed before). New `PendingQueue` component shows the actual next drafted post's text and how many more are waiting behind it — not a placeholder.

**Deliberately not done this session (flagged, not silently skipped):** full RAG/embeddings-based memory (semantic similarity search over past posts) — this is a genuinely separate, large piece of work from the queue/persona/rate-limit fixes above, and was explicitly named as item 5 of the earlier agreed roadmap. Recommend doing it as its own follow-up rather than folding it into an already-large change set.

**Validation:** full pipeline smoke-tested end-to-end (persona generation → discovery → batched scoring → queueing → timed publish → re-publish blocked during cooldown) against a real SQLite DB; confirmed queued items are never instantly published; confirmed sequence numbers are only assigned at actual publish; confirmed `published_at` comes back genuinely timezone-aware (`tzinfo=UTC`) after a full DB round-trip; confirmed the publish spacing lands inside the configured 10-15 minute window; confirmed a second immediate publish attempt is correctly blocked by the cooldown; confirmed the 429 backoff both parses Google's real error format from the user's own logs and correctly blocks a subsequent call without hitting the network. Frontend: `tsc --noEmit` and `next build` both clean with all new components. Could not test a live authenticated Gemini call (`generativelanguage.googleapis.com` unreachable from this sandbox) — user should confirm on their machine.

**Files changed:** `app/models.py`, `app/config.py`, `app/main.py`, `app/scheduler.py`, `app/schemas.py`, `app/routers/agent.py`, `app/services/editorial.py`, new `app/services/persona.py` (rewritten) and `app/services/llm.py`, `backend/.env`; frontend `app/page.tsx`, `app/globals.css`, `app/components/types.ts`, `app/components/CountdownTimer.tsx` (rewritten), new `app/components/PendingQueue.tsx`

**Status:** ✅ Complete pending the user's own confirmation of a live Gemini call succeeding

---

**Last Updated:** August 8, 2026 (Persona, publish queue, timezone fix, and rate-limit rearchitecture shipped)

**Current Rating:** 8.7/10 (Editorial voice is now real and the publish cadence is deliberate; biggest remaining gap is RAG-based memory, explicitly deferred this session)

**Status:** Next up: RAG/embeddings-based memory (deferred from this session), then a soak test of the full pipeline against live sources with a working key