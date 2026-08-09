Deploy & CI
=========

This file summarizes how to deploy the NOVA backend and run CI checks.

Render (recommended)
- Connect your GitHub repository to Render and import the `render.yaml` manifest.
- Set the Render service environment variables/secrets: `DATABASE_URL` (Postgres connection string), `GEMINI_API_KEY` (optional).
- Render will build the Docker image using `backend/Dockerfile` and expose the app.

GitHub Actions CI
- A workflow is provided at `.github/workflows/ci.yml`. It installs Python, installs `backend/requirements.txt`, and runs `pytest`.

Local sanity

```powershell
cd backend
pip install -r requirements.txt
pytest -q
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

If you'd like, I can also prepare a small render service with a prefilled environment manifest for Render's dashboard or produce Terraform/Bicep for other providers.
