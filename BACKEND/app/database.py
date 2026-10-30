import time

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns() -> None:
    """create_all() never alters existing tables; add columns introduced after first deploy."""
    columns = {c["name"] for c in inspect(engine).get_columns("test_records")}
    if "payload_canonical" not in columns:
        with engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE test_records ADD COLUMN payload_canonical TEXT DEFAULT ''")


def wait_for_database(attempts: int = 30, delay: float = 1.0) -> None:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            with engine.connect() as conn:
                conn.exec_driver_sql("SELECT 1")
            return
        except Exception as exc:  # noqa: BLE001 — startup retry against Postgres
            last_error = exc
            time.sleep(delay)
    raise RuntimeError(f"Database not reachable: {last_error}") from last_error
