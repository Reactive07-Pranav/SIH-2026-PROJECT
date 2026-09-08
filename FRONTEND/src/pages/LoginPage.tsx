import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { WarningBanner } from '../components/ui'

export default function LoginPage() {
  const { session, login, register } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [operatorId, setOperatorId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/capture" replace />

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setBusy(true)
    try {
      if (mode === 'register') {
        await register(operatorId.trim(), password, displayName.trim() || undefined)
      } else {
        await login(operatorId.trim(), password)
      }
      nav('/capture', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="center-page">
      <form onSubmit={submit} className="card" style={{ width: 'min(400px, 92vw)' }}>
        <h1 style={{ marginTop: 0 }}>⛨ Field Evidence Logger</h1>
        {!navigator.onLine &&
          <WarningBanner>Device offline — cached-session login only.</WarningBanner>}
        <p>
          <label>Operator ID
            <input value={operatorId} onChange={e => setOperatorId(e.target.value)}
                   autoComplete="username" required />
          </label>
        </p>
        {mode === 'register' && (
          <p>
            <label>Display name
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                     autoComplete="name" placeholder="Optional" />
            </label>
          </p>
        )}
        <p>
          <label>Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                   autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required />
          </label>
        </p>
        {error && <div className="banner banner-warn">{error}</div>}
        <button className="btn" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Working…' : mode === 'register' ? 'Register' : 'Sign in'}
        </button>
        <p className="hint" style={{ marginBottom: 0 }}>
          {mode === 'login' ? (
            <>Need an account? <button type="button" className="btn btn-small btn-ghost" onClick={() => setMode('register')}>Register</button></>
          ) : (
            <>Already registered? <button type="button" className="btn btn-small btn-ghost" onClick={() => setMode('login')}>Sign in</button></>
          )}
        </p>
        <p className="hint">Create a new account to sign in, or use your registered operator ID and password.</p>
      </form>
    </div>
  )
}
