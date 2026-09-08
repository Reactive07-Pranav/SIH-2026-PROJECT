# Drug Test Evidence Logging System — Hackathon Build Report

## Project Structure
Full Flutter app (lib/) + Node.js backend (backend/). See individual files for full implementations.

## Pipeline (Pure Dart)
- `pipeline/`: perspective warp (homography + bilinear), 6-patch sampling, least-squares affine CCM, RGB-to-LAB, Delta E, nearest-match classification with inconclusive threshold.

## Security
- ECDSA P-256 keypair (pointycastle), private key in Android Keystore-backed secure storage.
- Records signed with DER-encoded ECDSA signatures; backend verifies with Node crypto module.
- SQLite local storage + JWT auth + sync queue.

## OpenCV vs Pure Dart Decision
- Manual 4-corner-tap fallback chosen (no native OpenCV dependency, faster for hackathon).
- Pipeline is pure Dart (`image` package) — adequate for demo.

## Screens
1. Login — operator ID + password, cached offline mode
2. Capture — camera preview + overlay guide rectangles + flash toggle
3. Corner Selection — tap 4 corners manually (ArUco fallback)
4. Result — classification banner + Delta E + corrected RGB + inconclusive warning + retake button
5. Log — list with filter/search + sync button + FAB
6. Record Detail — full JSON + verify server button

## Backend (Express + SQLite)
- `/auth/login`, `/auth/register`
- `/api/records` (submit/list/get/verify)
- `/api/operators/register-device`
- `seed.js` does not create any default operator credentials

## How to Run
### Backend
```bash
cd backend
npm install
npm run seed
npm start
```

### Flutter (Android first)
```bash
flutter pub get
flutter run
```

### For Android emulator
Backend URL configured as `http://10.0.2.2:3000` in `lib/config/app_config.dart`.
For physical device: change to host's LAN IP.

## Notes / Limitations (Hackathon Scope)
- Image processing runs on CPU (pure Dart) — faster phones will process in ~200-500ms
- No real-time ArUco detection — manual corner selection used instead
- Offline login uses SHA-256 hash comparison (production should use bcrypt/argon2 server-side)
- GPS falls back to (0,0) if unavailable
- Sync is manual button-based (background sync can be added with `workmanager` package)
- Signature verification is server-side only; the Flutter app does not verify server responses locally
