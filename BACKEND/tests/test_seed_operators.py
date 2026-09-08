from app.main import seed_operators
from app.database import SessionLocal
from app.models import Operator


def test_seed_operators_has_no_default_credentials():
    db = SessionLocal()
    try:
        db.query(Operator).delete()
        db.commit()

        seed_operators()

        stored_ids = {operator.id for operator in db.query(Operator).all()}
        assert stored_ids == set()
        assert "OP001" not in stored_ids
        assert "OP002" not in stored_ids
        assert "admin" not in stored_ids
    finally:
        db.close()
