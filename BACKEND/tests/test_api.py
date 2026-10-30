import base64
import io
import uuid

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from PIL import Image

from app.signatures import canonical_json
from conftest import login


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_device(client, headers) -> tuple[ec.EllipticCurvePrivateKey, str]:
    key = ec.generate_private_key(ec.SECP256R1())
    spki = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    device_id = uuid.uuid4().hex
    res = client.post(
        "/api/operators/register-device",
        json={"deviceId": device_id, "publicKeySpki": b64url(spki)},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return key, device_id


def sign_p1363(key: ec.EllipticCurvePrivateKey, message: str) -> str:
    """Same wire format as WebCrypto: raw r||s, base64url."""
    r, s = decode_dss_signature(key.sign(message.encode(), ec.ECDSA(hashes.SHA256())))
    return b64url(r.to_bytes(32, "big") + s.to_bytes(32, "big"))


def payload(operator_id: str, device_id: str, **extra) -> dict:
    base = {
        "id": str(uuid.uuid4()),
        "timestamp": "2026-10-30T10:15:00.000Z",
        "appVersion": "1.0.0",
        "operatorId": operator_id,
        "deviceId": device_id,
        "gps": {"lat": 28.6139, "lon": 77.209, "accuracy": 12.5},
        "imageHash": "ab" * 32,
        "classification": "positive",
        "deltaE": 3.27,
        "correctedRgb": [106, 44, 112],
    }
    return base | extra


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_login_rejects_bad_password(client):
    res = client.post("/api/auth/login", json={"operatorId": "OP001", "password": "wrong"})
    assert res.status_code == 401


def test_register_cannot_self_promote_to_supervisor(client):
    res = client.post(
        "/api/auth/register",
        json={"operatorId": f"OP-{uuid.uuid4().hex[:6]}", "password": "secret1", "role": "SUPERVISOR"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["role"] == "OFFICER"


def test_register_rejects_password_over_bcrypt_limit(client):
    res = client.post("/api/auth/register", json={"operatorId": "longpw", "password": "x" * 73})
    assert res.status_code == 400


def test_signed_record_verifies_and_tamper_is_caught(client):
    headers = login(client, "OP001", "test123")
    key, device_id = make_device(client, headers)

    good = payload("OP001", device_id)
    canonical = canonical_json(good)
    res = client.post(
        "/api/records",
        json={"record": good, "payloadCanonical": canonical, "signature": sign_p1363(key, canonical)},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["signatureStatus"] == "verified"
    verdict = client.get("/api/records/verify", params={"recordId": good["id"]}, headers=headers).json()
    assert verdict["valid"] is True

    # Flip the result but reuse the old signature: must be flagged, not trusted.
    tampered = payload("OP001", device_id, classification="negative")
    signature = sign_p1363(key, canonical_json(payload("OP001", device_id)))
    res = client.post(
        "/api/records",
        json={"record": tampered, "payloadCanonical": canonical_json(tampered), "signature": signature},
        headers=headers,
    )
    assert res.json()["signatureStatus"] == "invalid"


def test_flat_der_signed_record_from_mobile_client(client):
    headers = login(client, "OP001", "test123")
    key, device_id = make_device(client, headers)
    rec = payload("OP001", device_id)
    der = key.sign(canonical_json(rec).encode(), ec.ECDSA(hashes.SHA256()))
    res = client.post("/api/records", json=rec | {"signature": base64.b64encode(der).decode()}, headers=headers)
    assert res.json()["signatureStatus"] == "verified"


def test_register_device_rejects_garbage_key(client):
    headers = login(client, "OP001", "test123")
    res = client.post(
        "/api/operators/register-device", json={"deviceId": "d1", "publicKey": "bm90LWEta2V5"}, headers=headers
    )
    assert res.status_code == 400


def test_officer_cannot_submit_as_someone_else(client):
    headers = login(client, "OP002", "test123")
    res = client.post("/api/records", json={"record": payload("OP001", "x")}, headers=headers)
    assert res.status_code == 403


def test_scoping_date_filter_and_stats(client):
    op2 = login(client, "OP002", "test123")
    rec = payload("OP002", "dev-x", timestamp="2026-01-05T08:00:00.000Z", classification="negative")
    assert client.post("/api/records", json={"record": rec}, headers=op2).status_code == 200

    mine = client.get("/api/records", headers=op2).json()
    assert {r["operatorId"] for r in mine["content"]} == {"OP002"}

    admin = login(client, "admin", "admin123")
    jan = client.get("/api/records", params={"from": "2026-01-05", "to": "2026-01-05"}, headers=admin).json()
    assert [r["id"] for r in jan["content"]] == [rec["id"]]

    stats = client.get("/api/records/stats", headers=admin).json()
    assert stats["total"] >= 3 and stats["operators"] >= 2
    assert stats["bySignature"]["unverified"] >= 1


def test_scan_classifies_uploaded_image(client):
    headers = login(client, "OP001", "test123")
    buf = io.BytesIO()
    Image.new("RGB", (200, 200), (70, 90, 200)).save(buf, "PNG")
    res = client.post("/api/scan", files={"file": ("strip.png", buf.getvalue(), "image/png")}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["classification"] in ("positive", "negative", "inconclusive")
    assert client.get("/api/history", headers=headers).json()["items"]


def test_scan_rejects_decompression_bomb(client):
    headers = login(client, "OP001", "test123")
    buf = io.BytesIO()
    Image.new("1", (9000, 9000)).save(buf, "PNG")  # tiny file, 81M pixels
    res = client.post("/api/scan", files={"file": ("bomb.png", buf.getvalue(), "image/png")}, headers=headers)
    assert res.status_code == 400


def test_spa_fallback_blocks_path_traversal(client):
    res = client.get("/..%2Fsecret.txt")
    assert "TOP-SECRET" not in res.text
    assert client.get("/dashboard").text.startswith("<!doctype html>")
