"""SYNTHETIC demo data: three demo operators and correctly signed records for the dashboard.

Never runs unless asked: `python scripts/seed_demo.py`, or SEED_DEMO=1 at startup (e.g. on Vercel).
Every record id starts with "demo-" and its device is named "DEMO SEED (synthetic)".
"""

import base64
import random
import uuid
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.database import SessionLocal
from app.models import Device, Operator, TestRecord
from app.security import hash_password
from app.signatures import canonical_json, verify_signature

CITIES = [
    (28.6139, 77.2090), (19.0760, 72.8777), (12.9716, 77.5946), (13.0827, 80.2707),
    (22.5726, 88.3639), (17.3850, 78.4867), (18.5204, 73.8567), (26.9124, 75.7873),
    (26.8467, 80.9462), (31.6340, 74.8723), (26.1445, 91.7362), (23.2599, 77.4126),
]
RESULTS = [("negative", (214, 158, 46)), ("positive", (106, 44, 112)), ("inconclusive", (160, 100, 80))]


DEMO_OPERATORS = [
    ("OP001", "test123", "SI Arjun Mehta", "OFFICER"),
    ("OP002", "test123", "SI Priya Nair", "OFFICER"),
    ("admin", "admin123", "Insp. R. Sharma", "SUPERVISOR"),
]


def seed_demo() -> int:
    """Create the demo operators and signed demo records. Idempotent; returns records inserted."""
    db = SessionLocal()
    try:
        for op_id, password, name, role in DEMO_OPERATORS:
            if db.get(Operator, op_id) is None:
                db.add(Operator(id=op_id, password_hash=hash_password(password), name=name, role=role))
        db.commit()
        if db.query(TestRecord).filter(TestRecord.id.like("demo-%")).first():
            return 0
        rng = random.Random(2026)
        now = datetime.now(timezone.utc)
        rows = 0
        for operator_id in ("OP001", "OP002"):
            key = ec.generate_private_key(ec.SECP256R1())
            spki = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
            device_id = f"demo-device-{operator_id}"
            public_key = base64.b64encode(spki).decode()
            db.merge(Device(id=device_id, operator_id=operator_id, public_key=public_key,
                            device_name="DEMO SEED (synthetic)", active=True))
            for i in range(14):
                lat, lon = rng.choice(CITIES)
                cls, rgb = rng.choices(RESULTS, weights=(6, 3, 1))[0]
                payload = {
                    "id": f"demo-{uuid.UUID(int=rng.getrandbits(128))}",
                    "timestamp": (now - timedelta(hours=rng.randint(1, 24 * 21))).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                    "appVersion": "0.1.0",
                    "operatorId": operator_id,
                    "deviceId": device_id,
                    "gps": {"lat": round(lat + rng.uniform(-.08, .08), 5), "lon": round(lon + rng.uniform(-.08, .08), 5),
                            "accuracy": round(rng.uniform(4, 30), 1)},
                    "imageHash": uuid.UUID(int=rng.getrandbits(128)).hex * 2,
                    "classification": cls,
                    "deltaE": round(rng.uniform(2, 9) if cls != "inconclusive" else rng.uniform(10, 16), 2),
                    "correctedRgb": [max(0, min(255, c + rng.randint(-12, 12))) for c in rgb],
                }
                canonical = canonical_json(payload)
                signature = base64.b64encode(key.sign(canonical.encode(), ec.ECDSA(hashes.SHA256()))).decode()
                if operator_id == "OP002" and i == 0:
                    # One deliberately altered record so the dashboard can show a failed signature.
                    payload["classification"] = "negative" if cls != "negative" else "positive"
                    canonical = canonical_json(payload)
                db.add(TestRecord(
                    id=payload["id"], timestamp=payload["timestamp"], latitude=payload["gps"]["lat"],
                    longitude=payload["gps"]["lon"], operator_id=operator_id, device_id=device_id,
                    image_hash=payload["imageHash"], classification=payload["classification"],
                    delta_e=payload["deltaE"], corrected_rgb=",".join(map(str, payload["correctedRgb"])),
                    signature=signature, payload_canonical=canonical,
                    signature_valid=1 if verify_signature(canonical, signature, public_key) else 0,
                ))
                rows += 1
        db.commit()
        return rows
    finally:
        db.close()

