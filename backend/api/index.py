import sys
from pathlib import Path

# Add backend directory to sys.path so that `app.*` package imports resolve.
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import the serverless-aware FastAPI app (see backend/app/main.py). That
# module checks `VERCEL` env and skips the infinite background scheduler
# loop, which cannot run on Vercel's short-lived ephemeral functions.
# Using `app.main` here (instead of the old `main`) is what makes the
# serverless guard actually take effect.
from app.main import app  # noqa: F401
