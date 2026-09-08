from contextlib import asynccontextmanager
import hashlib
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIST, cors_origin_list
from app.database import Base, SessionLocal, engine, wait_for_database
from app.models import Operator, TestRecord
from app.routers import api_router


def seed_operators() -> None:
    """Create no built-in operator credentials.

    Operators are meant to be created through the registration flow so no demo
    ID/password pair is embedded in the application.
    """
    return None


def seed_records() -> None:
    db = SessionLocal()
    try:
        if db.query(TestRecord).count():
            return
        previous = None
        for index, classification in enumerate(("negative", "negative", "inconclusive", "positive", "negative")):
            payload = {
                "id": f"demo-record-{index + 1}",
                "timestamp": (datetime.now(timezone.utc) - timedelta(days=4 - index)).isoformat(),
                "appVersion": "demo-seed",
                "operatorId": "OP001",
                "deviceId": "demo-device",
                "gps": {"lat": 28.6139 + index * 0.002, "lon": 77.2090 + index * 0.002, "accuracy": 12},
                "imageHash": hashlib.sha256(f"demo-image-{index}".encode()).hexdigest(),
                "classification": classification,
                "deltaE": 3.2 + index,
                "correctedRgb": [90 + index * 10, 120, 80],
            }
            canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
            record_hash = hashlib.sha256((canonical + (previous or "")).encode()).hexdigest()
            db.add(TestRecord(
                id=payload["id"], timestamp=payload["timestamp"], latitude=payload["gps"]["lat"],
                longitude=payload["gps"]["lon"], operator_id="OP001", device_id="demo-device",
                image_hash=payload["imageHash"], classification=classification, delta_e=payload["deltaE"],
                corrected_rgb=",".join(str(value) for value in payload["correctedRgb"]), signature="",
                payload_canonical=canonical, previous_record_hash=previous, record_hash=record_hash,
                signature_valid=1,
            ))
            previous = record_hash
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    wait_for_database()
    Base.metadata.create_all(bind=engine)
    seed_operators()
    seed_records()
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
