# Field Evidence Logger: web app (PWA)

React 18 + Vite + TypeScript, offline-first. See the root [README](../README.md) for the full stack.

```bash
npm ci
npm run dev          # http://localhost:5173
npm run dev:lan      # expose on the LAN (phone testing; needs HTTPS for camera)
npm run build        # typecheck + production build into dist/
```

`.env.local`: `VITE_API_URL=http://localhost:8000`. Vite reads it at start-up, so restart after changing it.

## Where things live

- `src/pipeline/`: perspective warp, colour-matrix calibration, LAB / ΔE classification. `reference.ts` holds the card patch layout and strip reference colours (placeholders: replace with measured kit values).
- `src/crypto/`: device ECDSA P-256 key (non-extractable, IndexedDB), canonical JSON, signing.
- `src/records/`: record builder (GPS, image hash, signature) and the sync queue.
- `src/i18n.tsx`: English and Hindi strings.
- `src/components/ui.tsx`: badges, chain of custody, and the ΔE scale.
