"""Vercel Python function: serves the FastAPI app for /api/*. The UI is the static Vite build in FRONTEND/dist."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "BACKEND"))

from app.main import app, init_db  # noqa: E402,F401  (Vercel serves the module-level `app`)

init_db()  # serverless runtimes may not send ASGI lifespan events; init_db is idempotent
