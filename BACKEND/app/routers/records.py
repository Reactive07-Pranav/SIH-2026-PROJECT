import base64
import binascii
import hashlib
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.exceptions import InvalidSignature
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Operator, TestRecord
from app.security import get_current_operator

router = APIRouter()


class RecordEnvelope(BaseModel):
    record: dict[str, Any] | None = None
    signature: str | None = None
    algorithm: str | None = None
    id: str | None = None
    timestamp: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    operatorId: str | None = None
    deviceId: str | None = None
    imageHash: str | None = None
    classification: str | None = None
    classificationResult: str | None = None
    deltaE: float | None = None
    correctedRgb: Any = None
    gps: dict[str, Any] | None = None
    previousRecordHash: str | None = None
    recordHash: str | None = None


def _flatten(body: RecordEnvelope) -> dict[str, Any]:
    data = dict(body.record) if body.record else {}
    for key in (
        "id",
        "timestamp",
        "latitude",
        "longitude",
        "operatorId",
        "deviceId",
        "imageHash",
        "classification",
        "classificationResult",
        "deltaE",
        "correctedRgb",
        "gps",
        "previousRecordHash",
        "recordHash",
    ):
        value = getattr(body, key)
        if value is not None:
            data[key] = value
    if body.signature:
        data["signature"] = body.signature
    if data.get("classificationResult") and not data.get("classification"):
        data["classification"] = data["classificationResult"]
    gps = data.get("gps") or {}
    if isinstance(gps, dict):
        data.setdefault("latitude", gps.get("lat"))
        data.setdefault("longitude", gps.get("lon"))
    rgb = data.get("correctedRgb")
    if isinstance(rgb, (list, tuple)):
        data["correctedRgb"] = ",".join(str(int(v)) for v in rgb)
    return data


def _b64_bytes(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _raw_ecdsa_to_der(signature: bytes) -> bytes:
    if len(signature) != 64:
        return signature
    r = int.from_bytes(signature[:32], "big").to_bytes(32, "big").lstrip(b"\x00") or b"\x00"
    s = int.from_bytes(signature[32:], "big").to_bytes(32, "big").lstrip(b"\x00") or b"\x00"
    if r[0] & 0x80: r = b"\x00" + r
    if s[0] & 0x80: s = b"\x00" + s
    body = b"\x02" + bytes([len(r)]) + r + b"\x02" + bytes([len(s)]) + s
    return b"\x30" + bytes([len(body)]) + body


def _payload_without_signature(data: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items()
            if key not in {"signature", "recordHash", "previousRecordHash"}}


def _chain_hash(canonical: str, previous: str | None) -> str:
    return hashlib.sha256((canonical + (previous or "")).encode()).hexdigest()


def _format(row: TestRecord) -> dict:
    return {
        "id": row.id,
        "timestamp": row.timestamp,
        "operatorId": row.operator_id,
        "deviceId": row.device_id,
        "imageHash": row.image_hash,
        "classification": row.classification,
        "classificationResult": row.classification,
        "deltaE": row.delta_e,
        "correctedRgb": row.corrected_rgb,
        "signature": row.signature,
        "previousRecordHash": row.previous_record_hash,
        "recordHash": row.record_hash,
        "signatureValid": row.signature_valid == 1,
        "gps": {"lat": row.latitude, "lon": row.longitude} if row.latitude is not None and row.longitude is not None else None,
        "receivedAt": row.received_at.isoformat() + "Z",
    }


@router.post("/api/records")
def submit_record(
    body: RecordEnvelope,
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    data = _flatten(body)
    record_id = str(data.get("id") or "")
    if not record_id:
        raise HTTPException(status_code=400, detail="Record id is required")
    existing = db.get(TestRecord, record_id)
    if existing:
        return {"message": "Record already exists", "id": record_id}

    owner = str(data.get("operatorId") or operator.id)
    if owner != operator.id:
        raise HTTPException(status_code=403, detail="Operator ID in record does not match authenticated operator")

    device_id = str(data.get("deviceId") or "")
    device = next((item for item in operator.devices if item.id == device_id), None) if hasattr(operator, "devices") else None
    if device is None:
        from app.models import Device
        device = db.get(Device, device_id)
    signature = str(data.get("signature") or "")
    if device is None or not signature:
        raise HTTPException(status_code=400, detail="Registered device and signature are required")
    signed_payload = dict(data)
    signed_payload.pop("signature", None)
    canonical_payload = json.dumps(signed_payload, sort_keys=True, separators=(",", ":"))
    try:
        public_key = serialization.load_der_public_key(_b64_bytes(device.public_key))
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise ValueError("Device key is not ECDSA")
        public_key.verify(_raw_ecdsa_to_der(_b64_bytes(signature)), canonical_payload.encode(), ec.ECDSA(hashes.SHA256()))
    except (ValueError, TypeError, binascii.Error, InvalidSignature) as exc:
        raise HTTPException(status_code=400, detail="Invalid device signature") from exc

    previous_row = db.query(TestRecord).order_by(TestRecord.received_at.desc()).first()
    previous_hash = previous_row.record_hash if previous_row else None
    record_hash = _chain_hash(canonical_payload, previous_hash)
    row = TestRecord(
        id=record_id,
        timestamp=str(data.get("timestamp") or ""),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        operator_id=operator.id,
        device_id=device_id,
        image_hash=str(data.get("imageHash") or ""),
        classification=str(data.get("classification") or "inconclusive"),
        delta_e=float(data.get("deltaE") or 0),
        corrected_rgb=str(data.get("correctedRgb") or ""),
        signature=signature,
        payload_canonical=canonical_payload,
        previous_record_hash=previous_hash,
        record_hash=record_hash,
        signature_valid=1,
    )
    db.add(row)
    db.commit()
    return {"message": "Record submitted successfully", "id": record_id, "signatureValid": True, "record": _format(row)}


@router.get("/api/records")
def list_records(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    limit: int | None = None,
    operator: str | None = None,
    result: str | None = None,
    classification: str | None = None,
    fromDate: str | None = Query(None, alias="from"),
    toDate: str | None = Query(None, alias="to"),
    operator_user: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    page_size = limit or size
    query = db.query(TestRecord)
    if operator_user.role != "SUPERVISOR":
        query = query.filter(TestRecord.operator_id == operator_user.id)
    elif operator:
        query = query.filter(TestRecord.operator_id == operator)
    cls = result or classification
    if cls:
        query = query.filter(TestRecord.classification == cls)
    if fromDate:
        query = query.filter(TestRecord.timestamp >= fromDate)
    if toDate:
        query = query.filter(TestRecord.timestamp <= toDate)
    total = query.count()
    rows = query.order_by(TestRecord.timestamp.desc()).offset(page * page_size).limit(page_size).all()
    content = [_format(r) for r in rows]
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    return {
        "content": content,
        "records": content,
        "totalElements": total,
        "totalPages": total_pages,
        "number": page,
        "pagination": {"page": page + 1, "limit": page_size, "total": total, "totalPages": total_pages},
    }


@router.get("/api/records/verify")
def verify_record(
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    rows = db.query(TestRecord).order_by(TestRecord.received_at.asc()).all()
    if operator.role != "SUPERVISOR":
        rows = [row for row in rows if row.operator_id == operator.id]
    previous = None
    for row in rows:
        data = {
            "id": row.id, "timestamp": row.timestamp, "operatorId": row.operator_id,
            "deviceId": row.device_id, "imageHash": row.image_hash,
            "classification": row.classification, "deltaE": row.delta_e,
            "correctedRgb": row.corrected_rgb,
        }
        expected = _chain_hash(row.payload_canonical, previous)
        if row.previous_record_hash != previous or row.record_hash != expected:
            return {"valid": False, "brokenAtRecordId": row.id, "detail": "Hash chain is broken."}
        previous = row.record_hash
    return {"valid": True, "brokenAtRecordId": None, "detail": "Hash chain is intact."}


@router.post("/api/records/verify")
def verify_record_post(
    body: dict[str, Any],
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    return verify_record(operator, db)
