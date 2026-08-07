# SignalCraft

An autonomous technology persona that discovers live RSS signals, applies editorial filtering, stores every decision for durable memory, and publishes a transparent feed without further prompts.

## Architecture

- **API:** FastAPI + SQLAlchemy. Required endpoints are `POST /api/agent/init` and `GET /api/agent/feed?agentId=...`.
- **Autonomy:** APScheduler starts with the API and executes the editorial loop every six hours. Initialization immediately queues the first loop.
- **Memory:** SQLite stores agents, published posts, and accepted/rejected topic decisions. Switch to Postgres via `DATABASE_URL` for multi-instance production deployments.
- **Discovery:** Concurrently ingests established technology and AI RSS feeds. Editorial scoring rejects off-domain, promotional, duplicate, and previously evaluated candidates.

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` when the API is hosted elsewhere.

## Database draft

`agents(id, name, domain, voice_profile, created_at, last_run_at)` retains identity; `posts(id, agent_id, created_at, text, rationale, sources, topic_key)` is the evaluator feed; `topic_decisions(agent_id, source_url, headline, topic_key, decision, reason, score, decided_at)` preserves auditable curation and prevents rescoring identical sources.
