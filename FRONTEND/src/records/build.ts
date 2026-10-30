import { db, type EvidenceRecord } from '../db/db'
import { getDeviceIdentity, signPayload } from '../crypto/identity'
import { canonicalize, sha256HexBytes } from '../crypto/sign'
import type { PipelineOutcome } from '../pipeline'
import { APP_VERSION } from '../config'

function getGps(): Promise<EvidenceRecord['gps']> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 }
    )
  })
}

export async function buildEvidenceRecord(
  outcome: PipelineOutcome, imageBlob: Blob, operatorId: string
): Promise<EvidenceRecord> {
  const [identity, gps] = await Promise.all([getDeviceIdentity(), getGps()])
  const imageHash = await sha256HexBytes(await imageBlob.arrayBuffer())

  // This exact object (canonicalized) is what gets signed — keep it stable.
  const payload = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    operatorId,
    deviceId: identity.deviceId,
    gps,
    imageHash,
    classification: outcome.classification,
    deltaE: outcome.deltaE,
    correctedRgb: outcome.correctedRgb.map(v => Math.round(v))
  }

  const payloadCanonical = canonicalize(payload)
  const signatureB64 = await signPayload(identity.privateKey, payloadCanonical)

  const record: EvidenceRecord = {
    ...payload,
    correctedRgb: payload.correctedRgb as [number, number, number],
    payloadCanonical,
    signatureB64,
    synced: 0,
    image: imageBlob
  }
  await db.records.add(record)
  return record
}
