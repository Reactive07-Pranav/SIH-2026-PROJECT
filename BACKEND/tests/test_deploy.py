import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_plain_boot_creates_no_accounts():
    db = Path(tempfile.mkdtemp()) / "boot.sqlite"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db.as_posix()}", "SEED_DEMO": ""}
    code = ("from app.main import init_db; from app.database import SessionLocal; from app.models import Operator;"
            "init_db(); print(SessionLocal().query(Operator).count())")
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT / "BACKEND", env=env, capture_output=True, text=True, check=True)
    assert out.stdout.strip() == "0"


def test_cors_allows_vercel_deployments_only(client):
    def preflight(origin):
        return client.options("/api/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})

    assert preflight("https://sih-2026-project-git-main-abc.vercel.app").headers.get("access-control-allow-origin")
    assert "access-control-allow-origin" not in preflight("https://evil.example.com").headers
