# Backend Vercel Fix - Progress

## Root Cause
The deployed frontend had `NEXT_PUBLIC_API_BASE` unset, so it fell back to
`http://localhost:8000` (the visitor's own machine). Also, the Vercel
serverless entry imported the scheduler-running `main` instead of the
serverless-aware `app.main`.

## Architecture Conclusion
NOVA's core autonomous continuous scanning/publishing scheduler cannot run
on Vercel serverless (short-lived, ephemeral). The correct production
architecture is **hybrid**:
- **Backend on Render** (long-running, runs `backend/main.py` with
  `start_scheduler()`)
- **Frontend on Vercel** (with `NEXT_PUBLIC_API_BASE` pointing to the Render
  backend URL)

## Steps Completed
- [x] Investigate backend/frontend deployment files (root cause identified)
- [x] Fix `backend/api/index.py` to import serverless-aware `app.main`
- [x] Add `psycopg2-binary` (Postgres for Vercel serverless) and `gunicorn`
      (Render Docker path) to `backend/requirements.txt`
- [x] Add `__init__.py` to `backend/app`, `routers`, `services` for robust
      package resolution
- [x] Create `frontend/app/lib/api.ts` shared API base resolver with production
      fallback to the Render backend URL
- [x] Update `frontend/app/page.tsx` and `frontend/app/console/page.tsx` to use
      `getApiBase()` (removed all hardcoded localhost fallbacks)
- [x] Update `frontend/.env.local.example` to document `NEXT_PUBLIC_API_BASE`
- [x] Verify frontend production build succeeds (Compiled successfully)
- [x] Verify both backend entrypoints import correctly

## Remaining Blocker (Action Required by User)
To make the deployed site functional, the user must:
1. Deploy the backend to Render (long-running, supports scheduler).
2. Set `NEXT_PUBLIC_API_BASE=https://nova-backend.onrender.com` in the Vercel
   frontend project's environment variables (or rely on the new production
   fallback in `getApiBase()`).
3. Set `GEMINI_API_KEY` (and optionally `DATABASE_URL` for Postgres) on Render.
