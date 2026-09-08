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


def ensure_sqlite_legacy_columns() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as conn:
        inspector = inspect(conn)
        if not inspector.has_table("test_records"):
            return

        existing_columns = {col["name"] for col in inspector.get_columns("test_records")}
        column_defs = {
            "payload_canonical": "TEXT",
            "previous_record_hash": "VARCHAR(128)",
            "record_hash": "VARCHAR(128)",
            "signature_valid": "INTEGER",
            "received_at": "DATETIME",
        }

        for column_name, column_type in column_defs.items():
            if column_name not in existing_columns:
                conn.exec_driver_sql(f"ALTER TABLE test_records ADD COLUMN {column_name} {column_type}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
