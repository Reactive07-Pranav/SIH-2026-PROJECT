# Hackathon Demo Script

## Start

Run the single command from the repository root:

```bash
docker compose up --build
```

Open `http://localhost:5173` and create a new operator account before signing in.

## Live flow

1. Register a new operator account and sign in.
2. Open **Capture**, allow camera and location access, and place the printed `FRONTEND/public/reference-card.svg` beside the test strip.
3. Freeze a frame, tap the card corners clockwise starting at top-left, then tap the strip pad center.
4. Confirm the classification, record ID, GPS status, image hash, and signature.
5. Open **Log** and show the record queued or synced. Disconnecting the network before capture demonstrates offline queueing; reconnecting triggers automatic sync.
6. Sign in as `admin`, open **Dashboard**, review the seeded table/map, and select **Verify chain integrity**.
7. For the tamper demonstration, update a seeded row in Postgres, then press **Verify chain integrity** again. The response should be `FAIL` and identify the broken record.

## Honest manual step

The only physical setup is printing `FRONTEND/public/reference-card.svg` at 100% scale and having a camera-visible strip. Camera and browser geolocation permissions are also required for their respective evidence fields. No key copying or API calls are required.