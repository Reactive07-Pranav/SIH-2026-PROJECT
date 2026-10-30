"""Seed SYNTHETIC demo operators (OP001, OP002, admin) and signed demo records.

Run from BACKEND/:  python scripts/seed_demo.py   (idempotent)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.demo import seed_demo  # noqa: E402
from app.main import init_db  # noqa: E402

if __name__ == "__main__":
    init_db()
    print(f"Demo operators ready; inserted {seed_demo()} synthetic records (ids start with 'demo-').")
