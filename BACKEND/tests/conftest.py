import os
import sys
import tempfile
from pathlib import Path

import pytest

# Config is read at import time, so point it at throwaway paths before importing the app.
_tmp = Path(tempfile.mkdtemp(prefix="evidence-test-"))
(_tmp / "dist").mkdir()
(_tmp / "dist" / "index.html").write_text("<!doctype html><title>spa</title>")
(_tmp / "secret.txt").write_text("TOP-SECRET")
os.environ["DATABASE_URL"] = f"sqlite:///{(_tmp / 'test.sqlite').as_posix()}"
os.environ["FRONTEND_DIST"] = str(_tmp / "dist")
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 32
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, operator_id: str, password: str) -> dict:
    res = client.post("/api/auth/login", json={"operatorId": operator_id, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}
