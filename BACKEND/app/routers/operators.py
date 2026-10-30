from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device, Operator
from app.security import get_current_operator
from app.signatures import load_public_key

router = APIRouter()


class DeviceBody(BaseModel):
    deviceId: str
    publicKey: str | None = None
    publicKeySpki: str | None = None
    deviceName: str | None = None
    algorithm: str | None = None


@router.post("/api/operators/register-device", status_code=201)
def register_device(
    body: DeviceBody,
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    public_key = body.publicKey or body.publicKeySpki
    if not public_key:
        raise HTTPException(status_code=400, detail="publicKey is required")
    try:
        load_public_key(public_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not body.deviceId or len(body.deviceId) > 128:
        raise HTTPException(status_code=400, detail="deviceId is required (max 128 chars)")
    existing = db.get(Device, body.deviceId)
    if existing and existing.operator_id != operator.id:
        raise HTTPException(status_code=409, detail="Device ID is already registered to another operator")
    if existing:
        existing.public_key = public_key
        existing.device_name = body.deviceName
        existing.active = True
    else:
        db.add(
            Device(
                id=body.deviceId,
                operator_id=operator.id,
                public_key=public_key,
                device_name=body.deviceName,
            )
        )
    db.commit()
    return {"message": "Device registered successfully", "deviceId": body.deviceId}
