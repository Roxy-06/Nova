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
