import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
ON_VERCEL = bool(os.getenv("VERCEL"))
SEED_DEMO = os.getenv("SEED_DEMO", "").lower() in ("1", "true", "yes")
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_SECRET_GENERATED = not JWT_SECRET
if not JWT_SECRET:
    # Never fall back to a known string: anyone could mint supervisor tokens.
    JWT_SECRET = secrets.token_urlsafe(48)
    logging.getLogger("uvicorn.error").warning(
        "JWT_SECRET not set; using a random per-process secret (tokens reset on restart)."
    )
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))
# Vercel's filesystem is read-only except /tmp (ephemeral): set DATABASE_URL to Postgres to keep data.
DATABASE_URL = os.getenv("DATABASE_URL") or ("sqlite:////tmp/drugdb.sqlite" if ON_VERCEL else "sqlite:///./drugdb.sqlite")
if DATABASE_URL.startswith("postgres://"):  # Neon/Heroku style; SQLAlchemy 2 needs postgresql://
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", "")).expanduser() if os.getenv("FRONTEND_DIST") else None
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))


def cors_origin_list() -> list[str]:
    return CORS_ORIGINS or ["http://localhost:5173"]
