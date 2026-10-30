import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Classification, Role } from '../config'

export interface Point { x: number; y: number }

export interface EvidenceRecord {
  id: string                    // uuid, part of signed payload
  timestamp: string             // ISO
  appVersion?: string
  operatorId: string
  deviceId: string
  gps: { lat: number; lon: number; accuracy: number } | null
  imageHash: string             // hex SHA-256 of JPEG bytes
  classification: Classification
  deltaE: number
  correctedRgb: [number, number, number]
  payloadCanonical: string      // exact bytes that were signed
  signatureB64: string          // base64url ECDSA-P256 signature
  synced: 0 | 1
  syncedAt?: string
  syncError?: string            // server rejected the record (4xx); kept out of the retry loop
  verification?: 'verified' | 'invalid' | 'unverified'   // last server verdict
  verifiedAt?: string
  image?: Blob                  // local-only JPEG (not sent on sync)
}

export interface SessionRow {
  operatorId: string
  displayName: string
  role: Role
  token: string
  credHash: string              // SHA-256("id:password") — offline login cache
  savedAt: string
}

export interface KeyRow {
  id: string                    // 'device-signing'
  deviceId: string
  privateKey: CryptoKey         // non-extractable; structured-cloneable into IDB
  publicKey: CryptoKey
  publicKeySpkiB64: string
  registered: 0 | 1
}

export interface MetaRow { key: string; value: string }

export interface DraftRow {
  id: string                    // 'latest'
  blob: Blob
  corners: Point[] | null       // 4 card corners + strip pad center (5 taps)
  width: number
  height: number
  savedAt: string
}

class EvidenceDB extends Dexie {
  declare records: Table<EvidenceRecord, string>
  declare sessions: Table<SessionRow, string>
  declare keys: Table<KeyRow, string>
  declare meta: Table<MetaRow, string>
  declare drafts: Table<DraftRow, string>

  constructor() {
    super('evidence-logger')
    this.version(1).stores({
      records: 'id, timestamp, classification, synced, operatorId',
      sessions: 'operatorId',
      keys: 'id',
      meta: 'key',
      drafts: 'id'
    })
  }
}

export const db = new EvidenceDB()
