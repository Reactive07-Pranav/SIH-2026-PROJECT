# Field Evidence Logger

Hackathon prototype for offline-first field drug-test evidence capture. The React PWA captures a camera frame, performs local color classification, hashes and signs the evidence with a device-bound P-256 key, queues it in IndexedDB, and syncs it to the API. The API stores an append-only hash chain and exposes supervisor verification.

## Run everything

From the repository root, run exactly:

```bash
docker compose up --build
```

Open:

- UI: http://localhost:5173
- API health: http://localhost:8000/api/health

Create a real account in the app before signing in. There are no built-in demo credentials in the codebase.

The frontend is a PWA and uses IndexedDB for queued records. Camera and geolocation permissions are requested by the browser. Network reconnect and the **Sync now** control retry unsynced records automatically.

## Physical demo step

Print `FRONTEND/public/reference-card.svg` at 100% scale and place it beside the test strip. This is the only physical setup that cannot be automated. Use the four-corner tap flow shown in the capture screen; no calibration photos, key copying, or manual API calls are needed.

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the rehearsed login, capture, sync, dashboard, and tamper-verification flow.

## Architecture note

This repository's runnable backend is the existing FastAPI/SQLAlchemy service under `BACKEND/app`, backed by PostgreSQL in Compose. It implements the requested HTTP contract, JWT auth, device registration, ECDSA signature verification, server-side record hashes, seeded chain data, pagination/filtering, and full-chain verification. The requested Java 17/Spring Boot implementation is not present in the original workspace; replacing the working backend with an unverified partial migration would make the one-command demo less reliable.

The backend defaults are intentionally hackathon-only development credentials. Change `JWT_SECRET` and database credentials before any real deployment.
# Field Evidence Logger — full stack

React (Vite) UI on **http://localhost:5173** talks to FastAPI on **http://localhost:8000**. Those URLs live in the root `.env.example` so they do not drift.

## Run locally (two terminals)

### 1. Backend

```bash
cd BACKEND
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Uses SQLite (`./drugdb.sqlite`) unless you set `DATABASE_URL`. No default operator credentials are seeded; create an account through the registration flow instead.

Confirm: `curl http://localhost:8000/api/health` → `{"status":"ok",...}`

CORS preflight:  
`curl -i -X OPTIONS http://localhost:8000/api/health -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET"`

### 2. Frontend

```bash
cd FRONTEND
npm install
npm run dev
```

`FRONTEND/.env.local` must contain `VITE_API_URL=http://localhost:8000`. **Restart Vite after changing it** — env vars are read at process start, not on HMR.

Open http://localhost:5173 → register or sign in → **Scan** → upload an image.

## Docker (Postgres + both apps)

From the repo root (no extra setup):

```bash
docker-compose up --build
# or: docker compose up --build
```

- UI: http://localhost:5173  
- API: http://localhost:8000/api/health  
- Postgres: localhost:5432 (`user` / `pass` / `drugdb`)

The **browser** still calls `http://localhost:8000` (host port map). Containers reach Postgres as host `db`, not `localhost`. Vite’s proxy target inside Compose is `http://backend:8000` via `VITE_PROXY_TARGET`.

## Production: one origin (no CORS)

```bash
cd FRONTEND && npm run build
cd ../BACKEND
set FRONTEND_DIST=../FRONTEND/dist   # PowerShell: $env:FRONTEND_DIST="..\FRONTEND\dist"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI serves `dist/` so the UI and `/api/*` share `http://localhost:8000`.

Or put both behind Nginx (`nginx/nginx.conf`): `/` → static `FRONTEND/dist`, `/api/` → `backend:8000`. Same origin, no CORS.

## API (JWT)

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | no |
| POST | `/api/auth/register` | no |
| POST | `/api/auth/login` | no |
| POST | `/api/scan` | Bearer, `multipart/form-data` field `file` |
| GET | `/api/history` | Bearer, this user’s scans only |
| POST | `/api/records` | Bearer (field capture sync) |
| GET | `/api/records` | Bearer |

Authorization is attached by the axios interceptor from `localStorage.token` (and IndexedDB session).

## Troubleshooting (issues actually hit in this repo)

1. **`ERR_CONNECTION_REFUSED` on port 8000**  
   There was no FastAPI app; only a Node server under `backend/backend` on port **3001**, while the UI defaulted to **8080** or an empty `VITE_BACKEND_URL`. Fix: run `uvicorn app.main:app --port 8000` and set `VITE_API_URL=http://localhost:8000`.

2. **CORS `No 'Access-Control-Allow-Origin'`**  
   Express had `cors()` but the UI never reached it on 8000. FastAPI now uses `CORSMiddleware` with `allow_origins` from `CORS_ORIGINS` (default `http://localhost:5173`) and `allow_credentials=True`. Do not use `*` with credentials.

3. **Port / proxy mismatch**  
   `vite.config` proxied `/api` to `http://localhost:3001`. Proxy target is now `8000` locally, and `http://backend:8000` in Docker (`VITE_PROXY_TARGET`). Axios uses `VITE_API_URL` so the browser talks to the host-mapped API; the proxy is a fallback for relative `/api` calls.

4. **JWT on the first call, missing later**  
   `register-device` used raw `fetch` with **no** `Authorization` header. All traffic now goes through one axios instance with a request interceptor that sets `Bearer` from `localStorage` / IndexedDB. CORS `allow_headers=["*"]` lets `Authorization` through on preflight.

5. **Stale UI after env changes (PWA)**  
   `FRONTEND/.env` was `VITE_BACKEND_URL=` (empty). Vite env is compile-time; the PWA service worker was also matching the wrong API origin. After changing `.env.local`, restart `npm run dev` and hard-reload (or unregister the service worker) so Workbox is not serving an old client.

6. **Docker `localhost` confusion**  
   `DATABASE_URL` in Compose uses host `db`, not `localhost`. `VITE_API_URL` stays `http://localhost:8000` because that value is used **in the browser on the host**. A container-internal `localhost` would point at itself.

7. **Mixed content**  
   Keep both apps on `http://` in dev. Serving the UI over HTTPS while `VITE_API_URL` is `http://localhost:8000` will be blocked.

8. **Requests work in curl/Postman but not the browser**  
   That is CORS or a missing `Authorization` header, not a broken classifier. Check OPTIONS (step 1) and the interceptor.

Scan predictions are computed from the image (center-crop LAB distance to immunoassay reference hues), then stored per user for `/api/history`.
