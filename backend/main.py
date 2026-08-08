# Compatibility entrypoint so `uvicorn main:app` works from backend/
from app.main import app
