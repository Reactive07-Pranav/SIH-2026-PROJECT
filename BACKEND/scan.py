from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Operator, ScanHistory
from app.predict import predict_image
from app.security import get_current_operator

router = APIRouter()


@router.post("/api/scan")
async def scan(
    file: UploadFile = File(...),
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    try:
        result = predict_image(data)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read image: {exc}") from exc

    row = ScanHistory(
        operator_id=operator.id,
        label=result["label"],
        classification=result["classification"],
        confidence=result["confidence"],
        mean_rgb=",".join(str(c) for c in result["mean_rgb"]),
        notes=result["notes"],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "label": row.label,
        "classification": row.classification,
        "confidence": row.confidence,
        "mean_rgb": result["mean_rgb"],
        "delta_e": result["delta_e"],
        "notes": row.notes,
        "created_at": row.created_at.isoformat() + "Z",
    }
