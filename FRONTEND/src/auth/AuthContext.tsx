import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Role } from '../config'
import { db } from '../db/db'
import api, { ApiError } from '../api/client'
import { sha256HexText } from '../crypto/sign'

export interface Session {
  operatorId: string
  displayName: string
  role: Role
  token: string
  offline: boolean
}

interface AuthCtx {
  session: Session | null
  loading: boolean
  login: (operatorId: string, password: string) => Promise<{ offline: boolean }>
  register: (operatorId: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

function persistToken(token: string) {
  localStorage.setItem('token', token)
}

/** Slow salted hash for the offline-login cache, so a stolen device does not leak passwords cheaply. */
async function credentialHash(operatorId: string, password: string): Promise<string> {
  const te = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(`evidence-logger:${operatorId}`), iterations: 210_000 },
    key, 256
  )
  return 'pbkdf2$' + [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function storeSession(operatorId: string, password: string, data: {
  token: string
  role?: string
  displayName?: string
  name?: string
}) {
  const credHash = await credentialHash(operatorId, password)
  const role: Role = data.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'OFFICER'
  const displayName: string = data.displayName ?? data.name ?? operatorId
  persistToken(data.token)
  await db.sessions.put({ operatorId, token: data.token, role, displayName, credHash, savedAt: new Date().toISOString() })
  await db.meta.put({ key: 'activeOperator', value: operatorId })
  return { operatorId, displayName, role, token: data.token, offline: false as const }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const active = await db.meta.get('activeOperator')
        if (active) {
          const row = await db.sessions.get(active.value)
          if (row) {
            persistToken(row.token)
            setSession({
              operatorId: row.operatorId, displayName: row.displayName,
              role: row.role, token: row.token, offline: false
            })
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function login(operatorId: string, password: string) {
    try {
      const { data } = await api.post('/api/auth/login', { operatorId, password, username: operatorId })
      const next = await storeSession(operatorId, password, data)
      setSession(next)
      return { offline: false }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw new AuthFail('Invalid operator ID or password')
      if (navigator.onLine) throw err

      const credHash = await credentialHash(operatorId, password)
      const cached = await db.sessions.get(operatorId)
      // Caches written before the PBKDF2 switch hold plain SHA-256; accept them once (re-hashed on next online login).
      const legacy = cached && !cached.credHash.startsWith('pbkdf2$') && cached.credHash === await sha256HexText(`${operatorId}:${password}`)
      if (cached && (cached.credHash === credHash || legacy)) {
        persistToken(cached.token)
        setSession({
          operatorId: cached.operatorId, displayName: cached.displayName,
          role: cached.role, token: cached.token, offline: true
        })
        return { offline: true }
      }
      throw new AuthFail('Offline — no cached session for this operator. Sign in once while online first.')
    }
  }

  async function register(operatorId: string, password: string, displayName?: string) {
    const { data } = await api.post('/api/auth/register', {
      operatorId, username: operatorId, password, displayName
    })
    setSession(await storeSession(operatorId, password, data))
  }

  async function logout() {
    await db.meta.delete('activeOperator')
    localStorage.removeItem('token')
    setSession(null)
  }

  return <Ctx.Provider value={{ session, loading, login, register, logout }}>{children}</Ctx.Provider>
}

class AuthFail extends Error {}
