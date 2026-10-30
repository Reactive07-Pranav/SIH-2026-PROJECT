import { db, type KeyRow } from '../db/db'
import api from '../api/client'
import { b64urlToBytes, bytesToB64url, sha256HexText } from './sign'

const KEY_ID = 'device-signing'

/**
 * Keypair is generated once per device profile. Private key is NON-extractable:
 * it never leaves the platform keystore; only the CryptoKey *handle* is stored
 * in IndexedDB. Consequence: clearing site data destroys the key — acceptable
 * for a hackathon; mention it in the demo.
 */
export async function getDeviceIdentity(): Promise<KeyRow> {
  const existing = await db.keys.get(KEY_ID)
  if (existing) return existing

  const alg: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' }
  const pair = await crypto.subtle.generateKey(alg, false, ['sign', 'verify'])
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  const deviceId = (await sha256HexText(crypto.randomUUID())).slice(0, 32)

  const row: KeyRow = {
    id: KEY_ID,
    deviceId,
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeySpkiB64: bytesToB64url(spki),
    registered: 0
  }
  await db.keys.put(row)
  return row
}

export async function signPayload(privateKey: CryptoKey, canonical: string): Promise<string> {
  const params: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' }
  const sig = await crypto.subtle.sign(params, privateKey, new TextEncoder().encode(canonical))
  return bytesToB64url(sig)
}

/** Local signature self-check (detail page + your own QA). */
export async function verifyPayload(
  publicKey: CryptoKey, canonical: string, signatureB64url: string
): Promise<boolean> {
  const params: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' }
  return crypto.subtle.verify(
    params, publicKey, b64urlToBytes(signatureB64url), new TextEncoder().encode(canonical)
  )
}

/** Upload SPKI public key once. Safe to re-call; no-ops once registered. */
export async function registerDeviceIfPending(): Promise<void> {
  const id = await getDeviceIdentity()
  if (id.registered) return
  await api.post('/api/operators/register-device', {
    deviceId: id.deviceId,
    algorithm: 'ECDSA-P256',
    publicKeySpki: id.publicKeySpkiB64
  })
  await db.keys.update(KEY_ID, { registered: 1 })
}
