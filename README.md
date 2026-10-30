# Field Evidence Logger — full stack

React (Vite) UI on **http://localhost:5173** talks to FastAPI on **http://localhost:8000**. Those URLs live in the root `.env.example` so they do not drift.

## Run locally (two terminals)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Uses SQLite (`./drugdb.sqlite`) unless you set `DATABASE_URL`. Seeds `OP001` / `test123` and `admin` / `admin123` on first boot.

Confirm: `curl http://localhost:8000/api/health` → `{"status":"ok",...}`

CORS preflight:  
`curl -i -X OPTIONS http://localhost:8000/api/health -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET"`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local` must contain `VITE_API_URL=http://localhost:8000`. **Restart Vite after changing it** — env vars are read at process start, not on HMR.

Open http://localhost:5173 → register or sign in → **Scan** → upload an image.

## Docker (Postgres + both apps)

From the repo root (no extra setup):

```bash
docker compose up --build
```

- UI: http://localhost:5173  
- API: http://localhost:8000/api/health  
- Postgres: localhost:5432 (`user` / `pass` / `drugdb`)

The **browser** still calls `http://localhost:8000` (host port map). Containers reach Postgres as host `db`, not `localhost`. Vite’s proxy target inside Compose is `http://backend:8000` via `VITE_PROXY_TARGET`.

## Production: one origin (no CORS)

```bash
cd frontend && npm run build
cd ../backend
set FRONTEND_DIST=../FRONTEND/dist   # PowerShell: $env:FRONTEND_DIST="..\FRONTEND\dist"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI serves `dist/` so the UI and `/api/*` share `http://localhost:8000`.

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
