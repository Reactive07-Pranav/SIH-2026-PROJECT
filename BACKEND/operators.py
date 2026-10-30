from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device, Operator
from app.security import get_current_operator

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
