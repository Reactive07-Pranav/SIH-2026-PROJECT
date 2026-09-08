# Field Evidence Logger (PWA)

React + Vite + TypeScript offline-first evidentiary logging for field drug tests.

## Run
    npm install
    npm run dev          # or: npm run dev:lan  (phone on same network)

Point at your Spring Boot backend by editing `.env`:
    VITE_BACKEND_URL=https://your-backend-host

## Phone / camera testing
Camera, WebCrypto and geolocation require a secure context (HTTPS or localhost).
Use a tunnel for device testing, e.g.:
    cloudflared tunnel --url http://localhost:5173

## TODO before demo
1. Edit src/pipeline/reference.ts — replace placeholder card patch coordinates/
   RGB references and strip signature colors with the values from
   color_calibration_classifier.py.
2. Backend endpoints: POST /auth/login, POST /api/operators/register-device,
   POST /api/records, GET /api/records (Spring Page), GET /api/records/verify.
3. Server signature check must re-canonicalize payloads with the same recursive
   key-sort as src/crypto/sign.ts canonicalize().
