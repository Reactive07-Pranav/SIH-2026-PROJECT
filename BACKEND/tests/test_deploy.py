import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _pins(path: Path) -> dict[str, str]:
    pins = {}
    for line in path.read_text().splitlines():
        m = re.match(r"^([A-Za-z0-9_.-]+)(\[[^\]]+\])?==(\S+)", line.strip())
        if m:
            pins[m.group(1).lower()] = m.group(3)
    return pins


def test_vercel_requirements_match_backend():
    backend, vercel = _pins(ROOT / "BACKEND/requirements.txt"), _pins(ROOT / "requirements.txt")
    backend.pop("uvicorn")  # not used by the Vercel function
    assert {k: vercel.get(k) for k in backend} == backend


def test_vercel_entry_exposes_app():
    sys.path.insert(0, str(ROOT / "api"))
    import index  # noqa: PLC0415
    from fastapi.testclient import TestClient  # noqa: PLC0415

    res = TestClient(index.app).get("/api/health")
    assert res.status_code == 200 and res.json()["demo"] is True


def test_plain_boot_creates_no_accounts():
    db = Path(tempfile.mkdtemp()) / "boot.sqlite"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db.as_posix()}", "SEED_DEMO": ""}
    code = ("from app.main import init_db; from app.database import SessionLocal; from app.models import Operator;"
            "init_db(); print(SessionLocal().query(Operator).count())")
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT / "BACKEND", env=env, capture_output=True, text=True, check=True)
    assert out.stdout.strip() == "0"
