from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIST, SEED_DEMO, cors_origin_list
from app.database import Base, add_missing_columns, engine, wait_for_database
from app.routers import api_router

_initialized = False


def init_db() -> None:
    """Create tables. No accounts are built in; demo data only when SEED_DEMO=1 (or via scripts/seed_demo.py)."""
    global _initialized
    if _initialized:
        return
    wait_for_database()
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
    if SEED_DEMO:
        from app.demo import seed_demo
        seed_demo()
    _initialized = True


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
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
