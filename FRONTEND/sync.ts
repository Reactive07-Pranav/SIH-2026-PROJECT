import { db } from '../db/db'
import { api } from '../api/client'
import { registerDeviceIfPending } from '../crypto/identity'

export interface SyncReport { attempted: number; succeeded: number; message: string }

/** POST every unsynced record; flip synced on 2xx. Failures stay queued. */
export async function syncPendingRecords(): Promise<SyncReport> {
  if (!navigator.onLine) return { attempted: 0, succeeded: 0, message: 'Offline — nothing synced.' }

  // Server needs the device public key before it can verify signatures.
  try { await registerDeviceIfPending() } catch { /* retried on next sync */ }

  const pending = await db.records.where('synced').equals(0).toArray()
  if (!pending.length) return { attempted: 0, succeeded: 0, message: 'All records synced.' }

  let succeeded = 0
  for (const rec of pending) {
    try {
      await api.post('/api/records', {
        record: JSON.parse(rec.payloadCanonical),
        signature: rec.signatureB64,
        algorithm: 'ECDSA-P256-SHA256'
      })
      await db.records.update(rec.id, { synced: 1, syncedAt: new Date().toISOString() })
      succeeded++
    } catch {
      break // stay pending; auto-retry on reconnect handles it
    }
  }
  return {
    attempted: pending.length,
    succeeded,
    message: succeeded === pending.length
      ? `Synced ${succeeded} record(s).`
      : `Synced ${succeeded}/${pending.length} — remainder will retry.`
  }
}
