import json
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query as OrmQuery
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device, Operator, TestRecord
from app.security import get_current_operator
from app.signatures import canonical_json, verify_signature

router = APIRouter()

CLASSIFICATIONS = ("positive", "negative", "inconclusive")
ENVELOPE_KEYS = {"record", "payloadCanonical", "signature", "algorithm"}


class RecordEnvelope(BaseModel):
    """Web client: {record, payloadCanonical, signature}. Flutter client: flat record fields + signature."""

    model_config = ConfigDict(extra="allow")

    record: dict[str, Any] | None = None
    payloadCanonical: str | None = None
    signature: str | None = None
    algorithm: str | None = None


def _signed_payload(body: RecordEnvelope) -> tuple[dict[str, Any], str]:
    """Return (record fields, exact string the device signed)."""
    if body.payloadCanonical:
        try:
            data = json.loads(body.payloadCanonical)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="payloadCanonical is not valid JSON") from exc
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="payloadCanonical must be a JSON object")
        return data, body.payloadCanonical
    if body.record is not None:
        data = dict(body.record)
    else:
        data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if k not in ENVELOPE_KEYS}
    data.pop("signature", None)  # the signature is never part of what was signed
    return data, canonical_json(data)


def _signature_status(row: TestRecord) -> str:
    return {1: "verified", 0: "invalid"}.get(row.signature_valid, "unverified")


def _format(row: TestRecord) -> dict:
    return {
        "id": row.id,
        "timestamp": row.timestamp,
        "operatorId": row.operator_id,
        "deviceId": row.device_id,
        "imageHash": row.image_hash,
        "classification": row.classification,
        "deltaE": row.delta_e,
        "correctedRgb": row.corrected_rgb,
        "signature": row.signature,
        "signatureValid": row.signature_valid == 1,
        "signatureStatus": _signature_status(row),
        "gps": {"lat": row.latitude, "lon": row.longitude} if row.latitude is not None and row.longitude is not None else None,
        "receivedAt": row.received_at.isoformat() + "Z",
    }


def _check_signature(db: Session, row: TestRecord) -> int | None:
    """1 valid, 0 invalid, None when no active device key for this operator is on file."""
    device = db.get(Device, row.device_id)
    if device is None or not device.active or device.operator_id != row.operator_id:
        return None
    if not row.signature or not row.payload_canonical:
        return 0
    return 1 if verify_signature(row.payload_canonical, row.signature, device.public_key) else 0


def _scoped(query: OrmQuery, user: Operator, operator: str | None) -> OrmQuery:
    if user.role != "SUPERVISOR":
        return query.filter(TestRecord.operator_id == user.id)
    if operator:
        return query.filter(TestRecord.operator_id == operator)
    return query


@router.post("/api/records")
def submit_record(
    body: RecordEnvelope,
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    data, canonical = _signed_payload(body)
    signature = body.signature or str((body.record or {}).get("signature") or "")
    record_id = str(data.get("id") or "")
    if not record_id or len(record_id) > 128:
        raise HTTPException(status_code=400, detail="Record id is required (max 128 chars)")
    if db.get(TestRecord, record_id):
        return {"message": "Record already exists", "id": record_id}

    owner = str(data.get("operatorId") or operator.id)
    if owner != operator.id:
        raise HTTPException(status_code=403, detail="Operator ID in record does not match authenticated operator")

    # Postgres enforces VARCHAR lengths (SQLite does not): reject instead of failing the insert with a 500.
    for field, limit in (("deviceId", 128), ("imageHash", 128), ("timestamp", 64)):
        if len(str(data.get(field) or "")) > limit:
            raise HTTPException(status_code=400, detail=f"{field} must be at most {limit} characters")

    classification = str(data.get("classification") or "inconclusive").lower()
    if classification not in CLASSIFICATIONS:
        raise HTTPException(status_code=400, detail=f"classification must be one of {', '.join(CLASSIFICATIONS)}")

    gps = data.get("gps") if isinstance(data.get("gps"), dict) else {}
    rgb = data.get("correctedRgb")
    try:
        delta_e = float(data.get("deltaE") or 0)
        latitude = data.get("latitude", gps.get("lat"))
        longitude = data.get("longitude", gps.get("lon"))
        latitude = float(latitude) if latitude is not None else None
        longitude = float(longitude) if longitude is not None else None
        if isinstance(rgb, (list, tuple)):
            rgb = ",".join(str(int(v)) for v in rgb)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="deltaE, gps and correctedRgb must be numeric") from exc

    row = TestRecord(
        id=record_id,
        timestamp=str(data.get("timestamp") or ""),
        latitude=latitude,
        longitude=longitude,
        operator_id=operator.id,
        device_id=str(data.get("deviceId") or ""),
        image_hash=str(data.get("imageHash") or ""),
        classification=classification,
        delta_e=delta_e,
        corrected_rgb=str(rgb or ""),
        signature=signature,
        payload_canonical=canonical,
    )
    row.signature_valid = _check_signature(db, row)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:  # concurrent sync of the same record
        db.rollback()
        return {"message": "Record already exists", "id": record_id}
    return {
        "message": "Record submitted successfully",
        "id": record_id,
        "signatureValid": row.signature_valid == 1,
        "signatureStatus": _signature_status(row),
    }


@router.get("/api/records")
def list_records(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    limit: int | None = Query(None, ge=1, le=100),
    operator: str | None = None,
    result: str | None = None,
    classification: str | None = None,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    operator_user: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    page_size = limit or size
    query = _scoped(db.query(TestRecord), operator_user, operator)
    cls = result or classification
    if cls:
        query = query.filter(TestRecord.classification == cls)
    # Timestamps are ISO-8601 strings, so lexical comparison is chronological.
    if date_from:
        query = query.filter(TestRecord.timestamp >= date_from.isoformat())
    if date_to:
        query = query.filter(TestRecord.timestamp < (date_to + timedelta(days=1)).isoformat())
    total = query.count()
    rows = query.order_by(TestRecord.timestamp.desc()).offset(page * page_size).limit(page_size).all()
    content = [_format(r) for r in rows]
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "content": content,
        "records": content,
        "totalElements": total,
        "totalPages": total_pages,
        "number": page,
        "pagination": {"page": page + 1, "limit": page_size, "total": total, "totalPages": total_pages},
    }


@router.get("/api/records/stats")
def record_stats(
    operator: str | None = None,
    operator_user: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    base = _scoped(db.query(TestRecord), operator_user, operator)
    by_class = dict.fromkeys(CLASSIFICATIONS, 0)
    for cls, n in base.with_entities(TestRecord.classification, func.count()).group_by(TestRecord.classification):
        by_class[cls] = n
    by_sig = {"verified": 0, "invalid": 0, "unverified": 0}
    for valid, n in base.with_entities(TestRecord.signature_valid, func.count()).group_by(TestRecord.signature_valid):
        by_sig[{1: "verified", 0: "invalid"}.get(valid, "unverified")] += n
    return {
        "total": sum(by_class.values()),
        "byClassification": by_class,
        "bySignature": by_sig,
        "operators": base.with_entities(func.count(func.distinct(TestRecord.operator_id))).scalar() or 0,
    }


@router.get("/api/records/verify")
def verify_record(
    recordId: str,
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    row = db.get(TestRecord, recordId)
    if row is None:
        return {"valid": False, "verified": False, "status": "missing", "detail": "Record not found on server (not synced yet?)"}
    if operator.role != "SUPERVISOR" and row.operator_id != operator.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    # Re-verify live: the device key may have been registered after the record arrived.
    result = _check_signature(db, row)
    if result != row.signature_valid:
        row.signature_valid = result
        db.commit()
    detail = {
        1: "ECDSA P-256 signature matches the registered device key. Payload is untampered.",
        0: "Signature does NOT match the registered device key. Record may have been altered.",
        None: "No registered key for this device, so the signature cannot be checked yet.",
    }[result]
    return {
        "valid": result == 1,
        "verified": result == 1,
        "status": _signature_status(row),
        "detail": detail,
        "record": _format(row),
    }


@router.post("/api/records/verify")
def verify_record_post(
    body: dict[str, Any],
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    return verify_record(str(body.get("recordId") or body.get("record_id") or ""), operator, db)
