from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Operator, ScanHistory
from app.security import get_current_operator

router = APIRouter()


@router.get("/api/history")
def history(
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ScanHistory)
        .filter(ScanHistory.operator_id == operator.id)
        .order_by(ScanHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "operatorId": operator.id,
        "items": [
            {
                "id": row.id,
                "label": row.label,
                "classification": row.classification,
                "confidence": row.confidence,
                "mean_rgb": row.mean_rgb,
                "notes": row.notes,
                "created_at": row.created_at.isoformat() + "Z",
            }
            for row in rows
        ],
    }
