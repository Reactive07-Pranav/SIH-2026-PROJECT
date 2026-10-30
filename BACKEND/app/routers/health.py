from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import JWT_SECRET_GENERATED
from app.database import get_db
from app.models import Operator

router = APIRouter()


@router.get("/api/health")
def health(db: Session = Depends(get_db)):
    warnings = []
    if JWT_SECRET_GENERATED:
        warnings.append("JWT_SECRET is not set: sign-ins reset whenever the server restarts.")
    return {
        "status": "ok",
        "service": "drug-evidence-api",
        "demo": db.get(Operator, "admin") is not None and db.get(Operator, "OP001") is not None,
        "warnings": warnings,
    }
