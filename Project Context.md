# Project Context

Living record of project prompts and responses. Updated as work continues.

## 2026-08-07 — Autonomous AI technology persona

**User request:** Build an autonomous technology persona that independently discovers live technology news, curates and rejects weak topics, maintains a consistent specialized voice, remembers prior posts, and publishes over a 48-hour evaluation. Expose `POST /api/agent/init` and `GET /api/agent/feed?agentId=...`. Use a Python backend and flashy Next.js frontend.

**Response and implementation:** Built SignalCraft from the empty scaffold. The FastAPI backend uses SQLAlchemy/SQLite, RSS discovery, editorial scoring, durable topic-decision memory, and APScheduler. Initialization creates an agent and starts an immediate editorial cycle; the scheduler repeats cycles every six hours. The Next.js frontend is a live high-contrast console for creating an agent and reading its feed, rationale, and sources. API smoke tests and a production frontend build passed.

## 2026-08-07 — Deploy locally

**User request:** Deploy it to localhost and provide the link.

**Response and action:** Started FastAPI at `127.0.0.1:8000` and Next.js at `127.0.0.1:3000` as background local services. Verified both returned HTTP 200. Provided `http://localhost:3000` as the console link and `http://localhost:8000/health` for API health.

## 2026-08-07 — Brief project summary

**User request:** Explain the project in three to five lines.

**Response:** Explained that SignalCraft initializes an autonomous AI technology persona once, continuously scans and filters live AI/technology stories, publishes source-backed posts on a schedule, and remembers past coverage to avoid repetition.

## 2026-08-07 — Automation approach

**User request:** Explain how the automation is achieved.

**Response:** Explained that FastAPI runs an immediate editorial cycle after initialization and APScheduler repeats it every six hours. Each cycle discovers RSS items, scores and filters them, deduplicates against the database, persists decisions, and publishes the best eligible post. The frontend only reads the feed and never triggers generation.

## 2026-08-07 — Maintain project context

**User request:** Create `Project Context.md` and keep updating it with every prompt and response.

**Response and action:** Created this living log at the project root. Future project interactions will be appended here.

## 2026-08-07 — Rename project root and maintain full context

**User request:** Rename the root folder from `AMICA` to `NOVA` and ensure every update and conversation is recorded in the project context.

**Response and planned action:** Recording this request before safely renaming the project root to `D:\NOVA`. The local API and frontend will be stopped, restarted from the renamed location, and health-checked. This log will continue to be updated for all project interactions.

**Progress update:** Stopped the local FastAPI and Next.js processes. The rename was then attempted but Windows refused because the active editor language-server process has the `D:\Amica` workspace open. It is not a project process and was left running to avoid disrupting the active workspace. Renaming can proceed once that workspace handle is released.

## 2026-08-07 — Telemetry, audio, and dashboard upgrades

**User request:** Upgrade NOVA's dashboard with a live telemetry/thought-matrix panel, rejected-candidate proof, Web Speech API alerts, ingestion countdown, post metadata and rationale drawer, plus optional voice commands.

**Response and implementation:** Added typed `TelemetryPanel`, `AudioAnnouncer`, `CountdownTimer`, and `useVoiceAnnouncer` modules. The interface now provides simulated auto-scrolling system logs, editorial rejections, browser-native announcements, per-post listening, countdown state, source and memory badges, expanded rationale evidence, and optional microphone/Space-key commands. The production build completed successfully.

## 2026-08-07 — Local hosting commands

**User request:** Provide commands to host the website on localhost.

**Response:** Provided separate PowerShell commands to start the FastAPI backend on port 8000 and the Next.js frontend on port 3000, followed by the local console URL.

## 2026-08-07 — AI handoff document

**User request:** Create `vibecode.md` containing enough project and code context for another AI interface to understand and continue the project immediately.

**Response and action:** Created a complete handoff document covering the product, constraints, architecture, endpoints, data model, workflows, file map, dashboard behavior, local commands, validation, and safe next improvements.

## 2026-08-07 — Inline code snapshot

**User request:** Add the code currently in use directly to `vibecode.md`.

**Response and action:** Embedded the core production source for API startup, routes, scheduler, editorial workflow, TTS hook, and countdown component, plus an exact implementation map for the remaining active frontend modules.

## 2026-08-08 — Fix API Spec Mismatches and Connect Live Telemetry

**User request:** Fix API spec mismatches to support nested custom agent initialization payload, a FeedResponse JSON dictionary containing lists of posts, and a GET /api/agent/telemetry endpoint returning SQLite topic decisions, then update the frontend to fetch real SQLite rejections.

**Response and action:**
1. Updated `schemas.py`: Nesting `PersonaDetails` under `InitRequest`. Added `FeedResponse` wrapper. Added `TelemetryDecision` mapping SQLite `TopicDecision` fields.
2. Updated `routers/agent.py`: Initialized agents using `payload.persona.name`/`domain`. Wrapped `get_feed` responses in `FeedResponse`. Added `GET /api/agent/telemetry` endpoint returning the last 30 database decisions.
3. Updated frontend typing (`components/types.ts`) to include `TelemetryDecision`.
4. Updated frontend `components/TelemetryPanel.tsx` to accept the `agentId` prop, fetch real telemetry decisions, and filter them to populate the "Cutting Room Floor" live view.
5. Adapted `page.tsx` payload structures for `/api/agent/init` and `/api/agent/feed` and linked agent id to `TelemetryPanel`.
6. Verified frontend typescript compile builds and backend syntaxes. Updated `vibecode.md` definitions and snapshots.

## 2026-08-08 — Frontend initialization failure and backend restart

**User request:** Resolve the failing initialization flow on the frontend and make sure API init works end-to-end.

**Response and action:**
1. Diagnosed the frontend dev command parsing issue: `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` was interpreted as `next dev 127.0.0.1 3000`, causing `Invalid project directory: D:\Nova\frontend\127.0.0.1`.
2. Updated `frontend/package.json` dev script to `next dev --hostname 127.0.0.1 --port 3000` so CLI args are passed correctly.
3. Confirmed the backend was still running an old server instance and restarted `uvicorn app.main:app` from `D:\Nova\backend`.
4. Verified `POST /api/agent/init` returned `201` with a valid `agentId` and that the frontend API URL defaulted to `http://localhost:8000`.
5. Confirmed the local console is now accessible at `http://127.0.0.1:3000` and the backend health endpoint at `http://127.0.0.1:8000/health`.
6. Updated `Project Context.md` and `vibecode.md` with the latest troubleshooting flow and outputs.

## 2026-08-08 — Final audit and validation

**User request:** Audit backend and frontend for any remaining errors, fix them, and sync the documentation to the current code.

**Response and action:**
1. Performed a full backend syntax audit using `python -m py_compile` on the main Python modules.
2. Performed a complete frontend validation with `npm.cmd run build` and resolved one TypeScript issue in `frontend/app/page.tsx` related to optional telemetry fields.
3. Confirmed the frontend production build now passes and the backend Python source compiles cleanly.
4. Updated `Project Context.md` with the final validation summary.
5. Corrected `vibecode.md` to match the current telemetry contract and latest implementation notes.
