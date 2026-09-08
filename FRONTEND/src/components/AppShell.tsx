import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAuth } from '../auth/AuthContext'
import { syncPendingRecords } from '../records/sync'

export default function AppShell() {
  const { session, logout } = useAuth()
  const nav = useNavigate()
  const pending = useLiveQuery(() => db.records.where('synced').equals(0).count(), [], 0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function doSync() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setMsg(null)
    try {
      const report = await syncPendingRecords()
      setMsg(report.message)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setBusy(false); inFlight.current = false
    }
  }

  // Auto-retry on reconnect + gentle polling while online.
  useEffect(() => {
    const onOnline = () => { void doSync() }
    window.addEventListener('online', onOnline)
    const t = setInterval(() => { if (navigator.onLine) void doSync() }, 60_000)
    return () => { window.removeEventListener('online', onOnline); clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">Home</Link>
        <nav>
          <NavLink to="/scan">Scan</NavLink>
          <NavLink to="/capture">Capture</NavLink>
          <NavLink to="/log">Log</NavLink>
          {session?.role === 'SUPERVISOR' && <NavLink to="/dashboard">Dashboard</NavLink>}
        </nav>
        <div className="topbar-right">
          <span className={`net-dot ${navigator.onLine ? 'on' : 'off'}`}
                title={navigator.onLine ? 'Online' : 'Offline'} />
          {session && <>
            <button onClick={doSync} disabled={busy || pending === 0} className="btn btn-small">
              {busy ? 'Syncing…' : `Sync now${pending ? ` (${pending})` : ''}`}
            </button>
            <span className="who">{session.displayName}</span>
            <button className="btn btn-small btn-ghost"
                    onClick={async () => { await logout(); nav('/login') }}>
              Logout
            </button>
          </>}
        </div>
      </header>
      {session?.offline &&
        <div className="banner banner-warn">Offline — using cached session. Records queue locally.</div>}
      {msg && <div className="banner">{msg}</div>}
      <main className="content"><Outlet /></main>
    </div>
  )
}
