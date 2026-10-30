# Field Evidence Logger

Smart India Hackathon 2026. A field officer photographs a presumptive drug-test strip next to a colour card. The app colour-corrects the photo, classifies the strip (positive / negative / inconclusive), and **signs the record on the device** before it leaves the phone. Supervisors see every synced record on a map and can prove any record is untampered.

- **Calibrated, not eyeballed.** A homography warp of the colour card plus a least-squares colour matrix corrects the strip colour; the verdict is read off a ΔE scale against reference colours.
- **Tamper-evident.** Each record is signed with a non-extractable ECDSA P-256 key (WebCrypto). The server verifies the exact signed bytes against the device's registered public key.
- **Offline-first.** Records queue in IndexedDB and sync when the network returns. Offline sign-in uses a PBKDF2-hashed credential cache.
- **English + हिन्दी**, switchable on every screen.

## Layout

```
render.yaml         Render Blueprint: the API web service + Postgres
vercel.json         Vercel: static build of FRONTEND
BACKEND/            FastAPI + SQLAlchemy API (SQLite locally, Postgres on Render / Docker)
  app/              main, config, models, security (JWT), signatures (ECDSA), predict (quick scan), demo (seed data)
  app/routers/      auth, records, operators, scan, history, health
  scripts/          seed_demo.py: demo accounts + synthetic signed records
  tests/            pytest suite
FRONTEND/           React 18 + Vite PWA
  public/reference-card.svg   printable colour card matching the calibration layout
  src/pipeline/     warp, calibration, LAB / ΔE classification (runs in the browser)
  src/crypto/       device key, signing, canonical JSON
  src/records/      record builder, offline sync queue
  src/pages/        Login, Capture, Result, Quick scan, Evidence log, Record detail, Dashboard
```

## Run locally (two terminals)

Tested with Python 3.14 and Node 24.

### 1. Backend: http://localhost:8000

```bash
cd BACKEND
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python scripts/seed_demo.py       # optional: demo accounts + 28 synthetic signed records
uvicorn app.main:app --reload --port 8000
```

Check: `curl http://localhost:8000/api/health` → `{"status":"ok",...}`

### 2. Frontend: http://localhost:5173

```bash
cd FRONTEND
npm ci
npm run dev
```

`FRONTEND/.env.local` must contain `VITE_API_URL=http://localhost:8000` (see `.env.example`). Restart Vite after changing it.

### Demo accounts

The API ships with **no built-in accounts**. Officers register in the app. The demo accounts below exist only after `python scripts/seed_demo.py` (or `SEED_DEMO=1`), and the login page lists them only when they exist.

| Operator ID | Password | Role |
| --- | --- | --- |
| `OP001` | `test123` | Officer |
| `OP002` | `test123` | Officer |
| `admin` | `admin123` | Supervisor |

Self-registration always creates an **Officer**. Supervisors are provisioned on the server only.

## Demo script (about 3 minutes)

1. **Laptop, sign in as `admin`.** The dashboard shows synced records across India, the result split, and *Signatures verified 96%* with one **Invalid** record: a seeded record whose result was changed after signing.
2. **Phone, sign in as `OP001`.** Print `FRONTEND/public/reference-card.svg` at 100% (105 × 75 mm; also linked on the Capture screen). Open *Capture*, frame the colour card and the strip, take the photo, and tap the 4 card corners and the pad centre. (No camera? Use *Use a saved photo*.)
3. **Result.** The verdict sits on the ΔE scale between the two references. The chain of custody shows *Captured → Signed*.
4. **Sync** (side rail or the phone's top bar). Open the record and press **Verify on server**: *ECDSA P-256 signature matches the registered device key.*
5. Switch to **हिन्दी** at any point.

Camera, WebCrypto and GPS need a secure context: `localhost`, or HTTPS on a phone (for example `cloudflared tunnel --url http://localhost:5173`).

## Tests

```bash
cd BACKEND
.venv\Scripts\python -m pytest -q
```

Covers login, no built-in accounts on a plain boot, CORS for Vercel deployments, the supervisor self-promotion block, signed-record verification (WebCrypto raw r‖s and DER formats), tamper detection, operator scoping, date filters, stats, upload decompression-bomb rejection, and SPA path traversal.

```bash
cd FRONTEND
npm run build                    # tsc --noEmit + vite build
```

## Deploy: backend on Render, frontend on Vercel

### 1. Backend + database on Render

1. Render dashboard → **New → Blueprint** → connect this GitHub repo → **Apply**. `render.yaml` creates:
   - `sih-evidence-api`: a Python web service from `BACKEND/` (`uvicorn app.main:app`);
   - `sih-evidence-db`: a Postgres database, wired in as `DATABASE_URL`.
   Render generates `JWT_SECRET` itself, so it never appears in the repo or in chat.
2. When it is live, open `https://<service>.onrender.com/api/health` → `{"status":"ok","demo":true,...}`. Copy the service URL.

`SEED_DEMO=1` is set, so the demo accounts exist. Set it to `0` in Render for real use.

### 2. Frontend on Vercel

1. Vercel → **Add New → Project** → import this repo. Keep the root directory as the repo root; `vercel.json` builds `FRONTEND`.
2. Add the environment variable `VITE_API_URL` = the Render URL from step 1 (no trailing slash), then **Deploy**.
3. The API accepts any `https://sih-2026-project…vercel.app` origin (`CORS_ORIGIN_REGEX` in `render.yaml`). If your Vercel project has another name, change that value in Render.

`VITE_API_URL` is baked in at build time. After changing it, redeploy on Vercel.

**Free-tier notes.** A free Render service sleeps after about 15 minutes idle, and the first request then takes up to a minute: open the app once before the demo. Render's free Postgres expires after 30 days unless you upgrade.

## Docker (Postgres + both apps)

```bash
docker compose up --build
```

- UI: http://localhost:5173 · API: http://localhost:8000/api/health · Postgres: localhost:5432 (`user` / `pass` / `drugdb`)
- Compose sets `SEED_DEMO=1`, so the demo accounts exist. Remove it for real use.
- Set `JWT_SECRET` in a root `.env` for tokens that survive restarts. If it is empty, the API generates a random secret on each start. **Always set it when running more than one uvicorn worker**, or each worker rejects the others' tokens.

## Production: one origin

```bash
cd FRONTEND && npm run build
cd ../BACKEND
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI serves `FRONTEND/dist` (or `FRONTEND_DIST`) so the UI and `/api/*` share one origin and CORS is not needed.

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | none | |
| POST | `/api/auth/register` | none | always creates `OFFICER` |
| POST | `/api/auth/login` | none | returns JWT |
| POST | `/api/operators/register-device` | Bearer | `deviceId`, base64 SPKI P-256 `publicKey(Spki)` |
| POST | `/api/records` | Bearer | `{record, payloadCanonical, signature}`; verified on arrival |
| GET | `/api/records` | Bearer | `page`, `size`, `operator`, `result`, `from`, `to` (YYYY-MM-DD); officers see only their own |
| GET | `/api/records/stats` | Bearer | totals by result and signature status |
| GET | `/api/records/verify?recordId=` | Bearer | re-verifies the stored signature live |
| POST | `/api/scan` | Bearer | multipart `file` (≤10 MB, ≤40 MP); uncalibrated quick check |
| GET | `/api/history` | Bearer | last 50 quick scans |

### Signature model

The browser builds the record, canonicalises it (recursive key sort, no whitespace) and signs those bytes with ECDSA P-256 / SHA-256. Sync sends the canonical string itself, so the server verifies the exact bytes. Records from a device with no registered key are stored as *unverified* and checked again whenever `/verify` is called.

## Known limits

- Colour-card patch positions and strip reference colours in `FRONTEND/src/pipeline/reference.ts` are placeholders until real kit values are measured.
- Card corners are tapped by hand; auto-detection is not implemented.
- The captured photo stays on the device; only its SHA-256 is synced.
- The dashboard map loads live OpenStreetMap tiles; with no venue internet the map is blank (markers and the table still work).
- Clearing site data deletes the device signing key. A new key is generated and registered on the next sync.
