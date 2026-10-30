# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Field officers (primary):** state police / NDPS officers testing a seized substance at the roadside or a checkpoint with a presumptive colour test kit. They work one-handed on a phone, often outdoors, at night or in harsh light, sometimes with no network. Their job: photograph the strip beside the colour card, get a defensible result, and log it so it holds up later.
- **Supervisors:** station or district officers on a desktop browser. Their job: review every synced test, see where and when they happened, and check that a record has not been altered since capture.

## Product Purpose

Field Evidence Logger turns a cheap presumptive drug test into a tamper-evident digital record. It colour-corrects the photo against a reference card, classifies the strip pad (positive / negative / inconclusive), and signs the record on the device before it ever leaves the phone. Success means a supervisor (or a court) can trust that the result, time, place and image hash are exactly what the officer captured.

## Positioning

Evidence integrity at the moment of capture: each record is signed with a non-extractable ECDSA P-256 device key and verified by the server against the registered public key. Classification is calibrated against a physical colour card, not judged by eye. It works fully offline and syncs later.

## Operating Context

- Smart India Hackathon 2026 demo: supervisor dashboard projected from a laptop; live capture shown on a phone. Both surfaces must read well from a distance.
- Field flow: Capture (camera, framing guides) → tap 4 card corners + strip pad → Result (signed, GPS-stamped) → local Log → Sync when online.
- Quick Scan: upload a photo for an uncalibrated server-side check (not evidentiary).
- Supervisor flow: Dashboard with map, filters (operator, result, date) and record table; per-record signature verification.

## Capabilities and Constraints

- React 18 + Vite PWA, Dexie (IndexedDB) offline store, WebCrypto signing, Leaflet map; FastAPI + SQLAlchemy backend (SQLite locally, Postgres in Docker).
- Roles: OFFICER (self-registration) and SUPERVISOR (provisioned server-side only).
- Camera, WebCrypto and geolocation need a secure context (HTTPS or localhost).
- Colour-card patch coordinates and strip reference colours in `FRONTEND/src/pipeline/reference.ts` are placeholders until real kit values are supplied.
- Auto card detection is not implemented; the 5-tap annotation is the reliable path.

## Brand Commitments

- Name: **Field Evidence Logger** (short: EvidenceLog).
- Terminology: operator, record, capture, sync, ΔE, signature verified / invalid / unverified.

## Evidence on Hand

- Demo accounts: `OP001` / `test123`, `OP002` / `test123` (officers), `admin` / `admin123` (supervisor).
- No real field data, testimonials, agency endorsements or accuracy benchmarks exist. Do not invent them.

## Product Principles

1. The result must never look more certain than it is. Inconclusive and uncalibrated states are loud.
2. Integrity is visible: signature and sync state are on every record, not hidden in a detail view.
3. Field screens work one-handed, offline and in bad light; desktop screens favour scanning many records fast.
4. Plain language for officers; precise numbers (ΔE, RGB, hashes) available but secondary.

## Accessibility & Inclusion

- English and Hindi UI, switchable at any time, for officer-facing screens.
- Result states must not rely on colour alone (always paired with a word and an icon).
- Large touch targets on capture and annotation screens.
