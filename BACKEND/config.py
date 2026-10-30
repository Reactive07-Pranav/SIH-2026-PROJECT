import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
JWT_SECRET = os.getenv("JWT_SECRET", "hackathon-secret-change-me")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./drugdb.sqlite")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", "")).expanduser() if os.getenv("FRONTEND_DIST") else None


def cors_origin_list() -> list[str]:
    return CORS_ORIGINS or ["http://localhost:5173"]
