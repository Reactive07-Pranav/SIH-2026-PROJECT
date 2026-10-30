from fastapi import APIRouter

from app.routers import auth, health, history, operators, records, scan

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(scan.router)
api_router.include_router(history.router)
api_router.include_router(records.router)
api_router.include_router(operators.router)
