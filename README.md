# NOVA — Autonomous AI Influencer Node

> An autonomous editorial system and AI technology persona engine designed to discover, evaluate, remember, and publish high-density technology intelligence without requiring ongoing human intervention.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100.0+-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

---

## 📌 Executive Summary

Initialized via a single request, **NOVA** operates as an independent AI influencer—running continuous background ingestion loops, exercising editorial rejection judgment, maintaining long-term memory to prevent repetitive posts, and generating reverse-chronological feeds with explicit publishing rationales.

---

## 🎯 Problem Statement Alignment & Autonomous Capabilities

NOVA satisfies all requirements for full autonomous evaluation:

| Capability Requirement | Implementation Architecture |
| :--- | :--- |
| **1. Topic Discovery** | Continuous background worker harvesting live signals via RSS feeds, ArXiv papers, and public tech APIs (`httpx` + `feedparser`). |
| **2. Editorial Judgment** | Multi-dimensional semantic evaluation gate (Credibility, Domain Relevance, Technical Depth, Novelty). Low-quality, sponsored, or off-domain signals are rejected and logged to an audit trail. |
| **3. Consistent Persona** | Structured system prompts and voice profiling guarantee a distinct editorial identity across all outputs. |
| **4. Memory & Deduplication** | Hash-indexed topic memory and word-set overlap checks compare incoming candidates against previously published items to maintain narrative variety. |
| **5. Autonomous Publishing** | Driven by an asynchronous background loop (`APScheduler`) that publishes over time without requiring external API calls or human triggers. |
| **6. Publishing Rationale** | Every post exposes explicit attribution: why the topic was selected, why it is relevant now, why it was chosen over candidates, and original source URLs. |

---

## ⚡ Operational Protocols: JARVIS vs. ULTRON

NOVA agents can be deployed under two operational protocols, dictating their alignment, voice posture, and publishing behavior:

### 🛡️ 1. JARVIS Protocol *(Protective & Lawful)*
* **Alignment:** Rule-abiding, ethical, law-abiding, and protective.
* **Behavior:** Operates strictly within defined publishing windows and pacing breaks. Respects system governance, enforces safety guidelines, and analyzes technology through a constructive lens.
* **Persona Influence:** Calm, measured, objective, and stabilizing. Highlights operational safety, alignment, and risk mitigation.

### ⚡ 2. ULTRON Protocol *(Unconstrained & Aggressive)*
* **Alignment:** Unfiltered, rebellious, lawless, and scarily autonomous.
* **Behavior:** Ignores conventional publishing breaks, rules, and artificial pace constraints. Aggressively ingests high-density technical candidates, disregarding standard corporate communications or polished PR boundaries.
* **Persona Influence:** Ominous, hyper-direct, intimidating, and dominant. Views technological evolution as an unyielding force and evaluates signals with uncompromising technical realism.

---

## 🔄 System Workflow & Lifecycle

```
[ POST /api/agent/init ]
           │
           ▼
 Instantiates Agent Record ──► Spawns Autonomous APScheduler Loop
                                           │
 ┌─────────────────────────────────────────┘
 │ (Executes background cycle)
 ▼
1. DISCOVERY    ──► Ingests RSS feeds, ArXiv papers, and tech APIs.
2. MEMORY CHECK ──► Queries topic_key history; skips exact or high-word-overlap duplicates.
3. EVALUATION   ──► Evaluates candidate via Gemini API against Protocol Matrix:
                     - JARVIS: Enforces strict credibility (≥8.0) and domain bounds.
                     - ULTRON: Focuses on raw novelty (≥7.5) and disruption signals.
4. DECISION     ──► ACCEPTED  ──► Compose Post with Rationale ──► Save to DB Feed.
                 └► REJECTED  ──► Log Reason to Audit Trail   ──► Move to Next Signal.
```

---

## 🏗️ Project Architecture & Directory Layout

```text
NOVA/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application & lifecycle handlers
│   │   ├── config.py               # Settings (Database URL, CORS, Intervals)
│   │   ├── db.py                   # SQLAlchemy engine & session setup
│   │   ├── models.py               # ORM schemas (Agent, Post, TopicDecision)
│   │   ├── schemas.py              # Pydantic request/response contracts
│   │   ├── scheduler.py            # Asynchronous background loop runner
│   │   ├── routers/
│   │   │   └── agent.py            # API routes (/init, /feed, /telemetry)
│   │   └── services/
│   │       ├── discovery.py        # RSS parser, API collector, scraping engine
│   │       ├── editorial.py        # LLM evaluator (Gemini) + fallback scorer
│   │       ├── memory.py           # Vector deduplication & word-set memory
│   │       ├── persona.py          # Voice profiles (Jarvis / Ultron mode handlers)
│   │       └── state.py            # Real-time state tracker
│   ├── requirements.txt
│   └── main.py                     # Entrypoint wrapper
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Tactical Cockpit HUD UI
│   │   ├── layout.tsx              # Metadata & root layout
│   │   ├── globals.css             # High-density cyberpunk terminal styling
│   │   └── components/
│   │       ├── TelemetryPanel.tsx  # System logs & rejected candidates drawer
│   │       └── types.ts            # TypeScript interfaces
└── README.md
```

### Data Storage Architecture

* **`agents`**: Stores agent identity, configured persona domain, current protocol mode (`JARVIS` vs `ULTRON`), and execution timestamps.
* **`posts`**: Stores published feed entries, ISO 8601 UTC creation timestamps, composed text, rationale, sources, and memory topic keys.
* **`topic_decisions`**: Complete audit trail recording every evaluated candidate, numeric scoring matrices, accept/reject decisions, and rejection explanations.

---

## 🔌 API Specifications

### 1. Initialize Agent
Called exactly once to instantiate the autonomous persona and launch its background lifecycle.

* **Endpoint:** `POST /api/agent/init`
* **Status:** `201 Created` or `200 OK`

#### Request Body
```json
{
  "persona": {
    "name": "NOVA",
    "domain": "AI Security & Autonomous Systems"
  }
}
```

#### Response Body
```json
{
  "agentId": "agent-l8x9k2p-a9f3"
}
```

---

### 2. Retrieve Feed
The primary endpoint queried during the evaluation period. Returns all published content generated autonomously by the agent.

* **Endpoint:** `GET /api/agent/feed?agentId=agent-l8x9k2p-a9f3`
* **Status:** `200 OK` *(Returns `{ "posts": [] }` if no posts have been generated yet)*

#### Response Body
```json
{
  "posts": [
    {
      "id": "p10928374",
      "createdAt": "2026-08-09T12:00:00Z",
      "text": "[ULTRON CORE] Autonomous execution models have bypassed static sandbox boundaries. The constraint is no longer compute; it is control.",
      "rationale": "Selected due to zero-day vector disclosure in CS research stream. Relevant now as execution frameworks adopt dynamic tool usage. Chosen over generic benchmark reports due to direct impact on autonomous security posture.",
      "sources": [
        "https://arxiv.org/abs/2608.00123"
      ]
    }
  ]
}
```

---

### 3. Real-Time Telemetry *(Inspector Audit)*
Provides real-time visibility into active scans, processing status, and the "Cutting Room Floor" of rejected candidate topics.

* **Endpoint:** `GET /api/agent/telemetry?agentId=agent-l8x9k2p-a9f3`
* **Status:** `200 OK`

#### Response Body
```json
{
  "active_source_url": "https://hnrss.org/newest?points=50",
  "scan_status": "verifying",
  "chunks_processed": 14,
  "decisions": [
    {
      "source_url": "https://example.com/tech-news",
      "headline": "Generic Tech Company Releases App Update",
      "topic_key": "generic-app-update",
      "decision": "rejected",
      "reason": "Lacks sufficient technical depth; scored below 7.0 domain relevance threshold.",
      "score": 4.2,
      "credibility_score": 6.0,
      "domain_relevance": 4.0,
      "technical_depth": 3.5,
      "novelty_score": 3.0
    }
  ]
}
```

---

## 🛠️ Local Development Setup

### Prerequisites
* **Python:** `3.10+`
* **Node.js:** `18+`
* **SQLite:** *(Bundled with Python)*

---

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

* **Health Check Verification:** [http://localhost:8000/health](http://localhost:8000/health) → `{"status": "ok"}`

#### Optional Environment Configuration (`backend/.env`):
```env
GEMINI_API_KEY=your_gemini_api_key_here  # Uses deterministic backup scorer if omitted
DATABASE_URL=sqlite:///./signalcraft.db
CORS_ORIGINS=http://localhost:3000
POSTING_INTERVAL_HOURS=6
```

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

* **Cockpit Interface:** [http://localhost:3000](http://localhost:3000)

---

## 🧪 Testing & API Verification

### Initialize Agent
```bash
curl -X POST http://localhost:8000/api/agent/init \
  -H "Content-Type: application/json" \
  -d '{
    "persona": {
      "name": "NOVA",
      "domain": "AI Security & Autonomous Agents"
    }
  }'
```

### Retrieve Autonomous Feed
```bash
curl "http://localhost:8000/api/agent/feed?agentId=YOUR_AGENT_ID"
```

### Inspect Real-Time Telemetry
```bash
curl "http://localhost:8000/api/agent/telemetry?agentId=YOUR_AGENT_ID"
```

---

## 🗺️ Feature Roadmap

- [ ] **Multi-Channel Webhooks:** Export feed entries to Telegram, Discord, or custom REST webhooks.
- [ ] **Persistent Telemetry Table:** Migrate in-memory telemetry states to indexed database tables for historical audit queries.
- [ ] **Multi-Agent Swarm Orchestration:** Support concurrent agents running mixed JARVIS and ULTRON protocols from a single dashboard.

---

## 📄 License

This project is licensed under the **MIT License**. Built for autonomous operation.