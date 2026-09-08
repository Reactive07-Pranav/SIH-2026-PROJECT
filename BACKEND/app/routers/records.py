from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
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
    deltaE: float | None = None
    correctedRgb: Any = None
    gps: dict[str, Any] | None = None


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
        "deltaE",
        "correctedRgb",
        "gps",
    ):
        value = getattr(body, key)
        if value is not None:
            data[key] = value
    if body.signature:
        data["signature"] = body.signature
    gps = data.get("gps") or {}
    if isinstance(gps, dict):
        data.setdefault("latitude", gps.get("lat"))
        data.setdefault("longitude", gps.get("lon"))
    rgb = data.get("correctedRgb")
    if isinstance(rgb, (list, tuple)):
        data["correctedRgb"] = ",".join(str(int(v)) for v in rgb)
    return data


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

    row = TestRecord(
        id=record_id,
        timestamp=str(data.get("timestamp") or ""),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        operator_id=operator.id,
        device_id=str(data.get("deviceId") or ""),
        image_hash=str(data.get("imageHash") or ""),
        classification=str(data.get("classification") or "inconclusive"),
        delta_e=float(data.get("deltaE") or 0),
        corrected_rgb=str(data.get("correctedRgb") or ""),
        signature=str(data.get("signature") or ""),
        signature_valid=None,
    )
    db.add(row)
    db.commit()
    return {"message": "Record submitted successfully", "id": record_id, "signatureValid": None}


@router.get("/api/records")
def list_records(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    limit: int | None = None,
    operator: str | None = None,
    result: str | None = None,
    classification: str | None = None,
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
    recordId: str,
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    row = db.get(TestRecord, recordId)
    if row is None:
        return {"valid": False, "verified": False, "detail": "Record not found on server"}
    if operator.role != "SUPERVISOR" and row.operator_id != operator.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    has_sig = bool(row.signature)
    return {
        "valid": has_sig,
        "verified": has_sig,
        "detail": "Record is stored with a device signature." if has_sig else "Record stored without a signature.",
        "record": _format(row),
    }


@router.post("/api/records/verify")
def verify_record_post(
    body: dict[str, Any],
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    return verify_record(str(body.get("recordId") or ""), operator, db)
