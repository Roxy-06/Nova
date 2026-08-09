# Deployment Guide for NOVA

This guide provides step-by-step instructions for deploying NOVA using **Render**, **Vercel**, or a **Hybrid setup (Vercel Frontend + Render Backend)**.

---

## 🌟 Architecture Overview

- **Frontend**: Next.js 15 (React 19, TypeScript) located in `/frontend`
- **Backend**: FastAPI (Python 3.11, SQLAlchemy, Uvicorn/Gunicorn) located in `/backend`
- **Database**: SQLite (default / local) or PostgreSQL (recommended for production)

---

## 🚀 Option 1: Render Full-Stack (Recommended - 1-Click Blueprint)

Render is ideal for NOVA because the backend agent runs a continuous background scanning and publishing loop.

### Steps:
1. Push your code to your GitHub repository.
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically read `render.yaml` and create two services:
   - `nova-backend` (Docker web service)
   - `nova-frontend` (Node.js web service)
6. Configure the Environment Variables:
   - **`nova-backend`**:
     - `GEMINI_API_KEY`: Your Google Gemini API Key
     - `GEMINI_MODEL`: `gemini-2.5-flash` (or `gemini-3.5-flash` / `gemini-1.5-flash`)
     - `DATABASE_URL`: Your PostgreSQL connection string (or leave blank to use local SQLite)
     - `CORS_ORIGINS`: `*` (or your frontend URL, e.g. `https://nova-frontend.onrender.com`)
   - **`nova-frontend`**:
     - `NEXT_PUBLIC_API_BASE`: `https://nova-backend.onrender.com` (use your actual backend Render URL)
7. Click **Apply**. Both services will build and deploy automatically.

---

## ⚡ Option 2: Hybrid Deployment (Vercel Frontend + Render Backend)

This is the most popular cloud architecture: edge-accelerated Next.js frontend on Vercel with a long-running FastAPI backend on Render.

### 1. Deploy Backend on Render:
1. Go to [Render Dashboard](https://dashboard.render.com/) → **New +** → **Web Service**.
2. Select your repository.
3. Configure the service:
   - **Name**: `nova-backend`
   - **Runtime**: `Docker`
   - **Docker Context**: `backend`
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Plan**: Free
4. Add Environment Variables:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `CORS_ORIGINS`: `*` (or your Vercel URL once deployed)
   - `DATABASE_URL`: (Optional) Postgres database URI
5. Click **Create Web Service**. Copy the assigned URL (e.g., `https://nova-backend.onrender.com`).

### 2. Deploy Frontend on Vercel:
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import your GitHub repository.
3. In project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend` (or leave default with root `vercel.json`)
4. In **Environment Variables**:
   - `NEXT_PUBLIC_API_BASE`: `https://nova-backend.onrender.com` (backend URL from Step 1)
5. Click **Deploy**.

---

## ▲ Option 3: Full Vercel Deployment

If you prefer deploying both services to Vercel:

### 1. Frontend Project:
- Root Directory: `frontend`
- Framework: Next.js
- Environment Variable: `NEXT_PUBLIC_API_BASE=https://<your-backend-project>.vercel.app`

### 2. Backend Project (Serverless):
- Root Directory: `backend`
- Entry Point: `api/index.py` (configured in `backend/vercel.json`)
- Environment Variables:
  - `GEMINI_API_KEY`: Your Gemini API key
  - `DATABASE_URL`: Managed Postgres URI (Supabase, Neon, or Neon Postgres). *Note: Vercel serverless has an ephemeral filesystem; SQLite cannot persist state across requests.*
  - `CORS_ORIGINS`: `*`

---

## 🔑 Environment Variables Reference

| Variable | Service | Required | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Backend | **Yes** | Google Gemini API Key for autonomous topic analysis and generation |
| `NEXT_PUBLIC_API_BASE` | Frontend | **Yes** | Full URL of the backend API (e.g. `https://nova-backend.onrender.com`) |
| `DATABASE_URL` | Backend | No | PostgreSQL connection URI (auto-converts `postgres://` to `postgresql://`). Defaults to SQLite if omitted. |
| `GEMINI_MODEL` | Backend | No | Model name (default: `gemini-2.5-flash`) |
| `CORS_ORIGINS` | Backend | No | Allowed frontend origins separated by commas (default: `*`) |
| `FAST_PUBLISH_FOR_EVAL` | Backend | No | Set to `1` to shorten publishing cooldown to 30-60 seconds for live demos/evaluations |

---

## 🧪 Local Testing Before Push

```powershell
# 1. Test frontend build
cd frontend
npm install
npm run build

# 2. Test backend
cd ../backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
