# Setup Guide — Drug Test Evidence System

## Prerequisites
- Flutter SDK (3.1+)
- Node.js 16+ and npm
- Android Studio + Android SDK (for emulator or physical device)

---

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Seed Test Operators
```bash
npm run seed
```
This creates:
- No built-in demo operator IDs or passwords are shipped with the app.

### 3. Start Server
```bash
npm start
```
Server runs on `http://localhost:3001`

---

## Flutter App Setup

### 1. Install Dependencies
```bash
cd ..
flutter pub get
```

### 2. Configure Backend URL

**For Android Emulator:**
- Already configured in `lib/config/app_config.dart` as `http://10.0.2.2:3000`
- This routes to the host machine's localhost

**For Physical Device:**
- Find your computer's LAN IP:
  - Windows: `ipconfig` → look for IPv4 Address (e.g., 192.168.1.100)
  - Mac/Linux: `ifconfig` → look for inet (e.g., 192.168.1.100)
- Edit `lib/config/app_config.dart`:
  ```dart
  static const String backendUrl = 'http://192.168.1.100:3000';
  ```

### 3. Run the App
```bash
flutter run
```

---

## First Run Workflow

### 1. Login
- Launch app → Login screen
- Register a new operator account first, then sign in with that operator ID and password.
- App will:
  - Generate ECDSA P-256 keypair (stored in Android Keystore)
  - Authenticate with backend
  - Cache credentials for offline use
  - Navigate to Log screen

### 2. Capture a Test
- Tap the FAB (camera icon)
- Allow camera + location permissions
- Point camera at a reference color card (or any flat surface with distinct colors)
- Tap the capture button (large white circle)

### 3. Select Corners
- Tap 4 corners of the color reference region:
  1. Top-left
  2. Top-right
  3. Bottom-right
  4. Bottom-left
- Green numbered markers appear with connecting lines
- Tap "Process Image" button

### 4. View Result
- Classification appears: **POSITIVE**, **NEGATIVE**, or **INCONCLUSIVE**
- Shows Delta E metric, corrected RGB color swatch, and LAB values
- If inconclusive (Delta E > 15), amber warning banner appears
- Options:
  - **Retake** → back to camera
  - **Save & Continue** → saves record to local SQLite + navigates to log

### 5. View Log
- All records appear in the list
- Filter by classification (All/Positive/Negative/Inconclusive)
- Search by record ID
- Sync status icons:
  - ☁️✓ (green) = synced to server
  - ☁️↑ (orange) = pending sync

### 6. Sync to Backend
- Tap sync icon in app bar
- All unsynced records POST to `/api/records`
- Records marked as synced on success

### 7. View Record Detail
- Tap any record in the log
- Shows full details: timestamp, GPS, operator, device, hash, classification
- Expandable sections for signature and raw JSON
- **Verify on Server** button → calls `/api/records/verify` and shows signature validation result

### 8. Offline Mode
- Disconnect from network
- Try to login with same credentials → **cached login succeeds**
- Capture tests normally → saved locally
- Sync button shows error → records remain in "pending" state
- Reconnect network → tap sync → all pending records upload

---

## Testing the Pipeline

### Manual Test (No Color Card)
For demo purposes without a physical color reference card:
1. Point camera at any scene with distinct colors
2. Tap 4 corners of a rectangular object (book cover, paper, screen)
3. The pipeline will:
   - Warp the region into a flat rectangle
   - Sample 6 patch positions (will get whatever colors happen to be there)
   - Fit an affine correction matrix (even if patches don't match references)
   - Sample the test strip position
   - Classify the color

**Expected behavior**: Classification will be somewhat arbitrary without a real reference card, but the full workflow demonstrates the pipeline works end-to-end.

### Proper Test (With Color Card)
Print or display a reference card with known colors:
- White, Red, Blue (top row)
- Black, Green, Gray (bottom row)
- Test strip area below

The pipeline expects these at fixed normalized positions defined in `lib/pipeline/color_calibration.dart`.

---

## Architecture Highlights

### Pure Dart Pipeline
- No OpenCV dependency
- Runs on CPU (200-500ms on mid-range phones)
- `image` package for pixel manipulation
- Manual corner selection (4-tap fallback)

### Cryptographic Chain of Custody
1. Image captured → SHA-256 hash computed
2. Record assembled (timestamp, GPS, operator, device, hash, classification)
3. Record JSON signed with device's ECDSA private key (P-256, DER-encoded)
4. Signature + record stored locally
5. On sync → backend verifies signature against device's registered public key
6. Audit log records all verification attempts

### Offline-First Design
- SQLite local storage
- Cached login (SHA-256 password hash comparison)
- Sync queue with pending/synced flag
- Background sync can be added with `workmanager` package

---

## Troubleshooting

### Camera not working
- Check `AndroidManifest.xml` has `<uses-permission android:name="android.permission.CAMERA" />`
- Grant camera permission when prompted

### Network error on login
- Verify backend is running: `curl http://10.0.2.2:3000/health` (from emulator)
- Check firewall allows connections on port 3000
- For physical device: ensure phone and computer on same WiFi, use host's LAN IP

### "No cameras found"
- Emulator may not have camera support enabled
- In Android Studio → AVD Manager → Edit device → Show Advanced Settings → Camera: Webcam0

### Processing failed
- Image too small or corners too close together → try different object
- Lighting too dark → use flash toggle
- Corners selected in wrong order → use undo button and retry

### Signature verification fails
- Device public key must be registered first
- Call device registration endpoint manually or add automatic registration on first sync
- Check `backend/src/utils/crypto.js` DER decoding logic matches `CryptoService` encoding

---

## Next Steps (Post-Hackathon)

- [ ] Add ArUco marker detection for automatic corner finding
- [ ] GPU-accelerated processing (`compute` isolates or platform channels)
- [ ] Background sync with `workmanager`
- [ ] Batch upload (multiple records in one request)
- [ ] Server-side image storage (S3/CloudFront)
- [ ] Multi-substance panel support (expand reference colors)
- [ ] Real-time validation during capture (show guide overlay alignment)
- [ ] Admin dashboard (web UI for backend)
- [ ] Export records as PDF reports
- [ ] Bluetooth printer integration for field receipts

---

## License
Hackathon prototype — MIT License
