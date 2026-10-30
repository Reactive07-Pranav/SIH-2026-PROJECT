from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIST, cors_origin_list
from app.database import Base, SessionLocal, add_missing_columns, engine, wait_for_database
from app.models import Operator
from app.routers import api_router
from app.security import hash_password


def seed_operators() -> None:
    defaults = [
        ("OP001", "test123", "SI Arjun Mehta", "OFFICER"),
        ("OP002", "test123", "SI Priya Nair", "OFFICER"),
        ("admin", "admin123", "Insp. R. Sharma", "SUPERVISOR"),
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
    add_missing_columns()
    seed_operators()
    yield


app = FastAPI(title="Drug Evidence API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origin_list(),  # from CORS_ORIGINS; never "*" with credentials=True
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

    dist_root = dist.resolve()

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        file_path = (dist_root / full_path).resolve()
        # resolve() + containment check blocks "../" traversal out of dist/.
        if full_path and file_path.is_relative_to(dist_root) and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_root / "index.html")
