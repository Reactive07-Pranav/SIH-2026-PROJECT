from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIST, cors_origin_list
from app.database import Base, SessionLocal, engine, wait_for_database
from app.models import Operator
from app.routers import api_router
from app.security import hash_password


def seed_operators() -> None:
    defaults = [
        ("OP001", "test123", "Officer John Smith", "OFFICER"),
        ("OP002", "test123", "Officer Jane Doe", "OFFICER"),
        ("admin", "admin123", "Admin User", "SUPERVISOR"),
    ]
    db = SessionLocal()
    try:
        for op_id, password, name, role in defaults:
            if db.get(Operator, op_id) is None:
                db.add(Operator(id=op_id, password_hash=hash_password(password), name=name, role=role))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    wait_for_database()
    Base.metadata.create_all(bind=engine)
    seed_operators()
    yield


app = FastAPI(title="Drug Evidence API", lifespan=lifespan)

# Dev UI is :5173. CORS_ORIGINS may add more (never "*" with credentials).
_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
for _origin in cors_origin_list():
    if _origin not in _origins:
        _origins.append(_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

dist = FRONTEND_DIST if FRONTEND_DIST and FRONTEND_DIST.is_dir() else None
if dist is None:
    candidate = Path(__file__).resolve().parents[2] / "FRONTEND" / "dist"
    if candidate.is_dir():
        dist = candidate

if dist is not None:
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        file_path = dist / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist / "index.html")
