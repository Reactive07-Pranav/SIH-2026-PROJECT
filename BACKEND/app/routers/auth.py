from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Operator
from app.security import create_token, hash_password, verify_password

router = APIRouter()


class LoginBody(BaseModel):
    operatorId: str | None = None
    username: str | None = None
    password: str


class RegisterBody(BaseModel):
    operatorId: str | None = None
    username: str | None = None
    password: str = Field(min_length=4)
    displayName: str | None = None
    name: str | None = None
    role: str | None = None


def _operator_id(body) -> str:
    value = (body.operatorId or body.username or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="operatorId or username is required")
    return value


def _token_payload(operator: Operator) -> dict:
    return {
        "token": create_token(operator),
        "operatorId": operator.id,
        "displayName": operator.name,
        "name": operator.name,
        "role": operator.role,
    }


@router.post("/auth/login")
@router.post("/api/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    operator_id = _operator_id(body)
    operator = db.get(Operator, operator_id)
    if operator is None or not operator.active or not verify_password(body.password, operator.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid operator ID or password")
    return _token_payload(operator)


@router.post("/auth/register", status_code=201)
@router.post("/api/auth/register", status_code=201)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    operator_id = _operator_id(body)
    if db.get(Operator, operator_id):
        raise HTTPException(status_code=409, detail="Operator ID already exists")
    name = (body.displayName or body.name or operator_id).strip()
    role = (body.role or "OFFICER").upper()
    if role not in ("OFFICER", "SUPERVISOR"):
        role = "OFFICER"
    operator = Operator(id=operator_id, password_hash=hash_password(body.password), name=name, role=role)
    db.add(operator)
    db.commit()
    db.refresh(operator)
    return _token_payload(operator)
