import { db } from '../db/db'
import { api, ApiError } from '../api/client'
import { registerDeviceIfPending } from '../crypto/identity'

export interface SyncReport { attempted: number; succeeded: number; rejected: number; offline: boolean }

/** POST every unsynced record; flip synced on 2xx. Network/5xx failures stay queued. */
export async function syncPendingRecords(operatorId: string): Promise<SyncReport> {
  if (!navigator.onLine) return { attempted: 0, succeeded: 0, rejected: 0, offline: true }

  // Server needs the device public key before it can verify signatures.
  try { await registerDeviceIfPending() } catch { /* retried on next sync */ }

  const pending = (await db.records.where('synced').equals(0).toArray()).filter(r => !r.syncError && r.operatorId === operatorId)  // server rejects other operators' records
  let succeeded = 0, rejected = 0
  for (const rec of pending) {
    try {
      const { data } = await api.post<{ signatureStatus?: 'verified' | 'invalid' | 'unverified' }>('/api/records', {
        record: JSON.parse(rec.payloadCanonical),
        payloadCanonical: rec.payloadCanonical, // server verifies these exact bytes
        signature: rec.signatureB64,
        algorithm: 'ECDSA-P256-SHA256'
      })
      const now = new Date().toISOString()
      await db.records.update(rec.id, {
        synced: 1, syncedAt: now,
        ...(data.signatureStatus ? { verification: data.signatureStatus, verifiedAt: now } : {})
      })
      succeeded++
    } catch (e) {
      // A 4xx will fail the same way forever: park it so it cannot block the queue.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403) {
        await db.records.update(rec.id, { syncError: e.message })
        rejected++
        continue
      }
      break // offline / server down / expired token: retry on reconnect
    }
  }
  return { attempted: pending.length, succeeded, rejected, offline: false }
}
