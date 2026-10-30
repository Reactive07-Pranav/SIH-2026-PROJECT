import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAuth } from '../auth/AuthContext'
import { syncPendingRecords, type SyncReport } from '../records/sync'
import { useI18n } from '../i18n'
import { BrandMark, Icon, type IconName } from './Icon'
import { LangToggle, Notice, useOnline } from './ui'

export default function AppShell() {
  const { session, logout } = useAuth()
  const { t } = useI18n()
  const nav = useNavigate()
  const online = useOnline()
  const pending = useLiveQuery(
    () => db.records.where('synced').equals(0).filter(r => !r.syncError && r.operatorId === session?.operatorId).count(),
    [session?.operatorId], 0)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const inFlight = useRef(false)

  function describe(r: SyncReport): { tone: 'ok' | 'warn'; text: string } {
    if (r.offline) return { tone: 'warn', text: t('sync.offline') }
    const parts = [
      r.attempted === 0 ? t('sync.all')
        : r.succeeded === r.attempted - r.rejected ? t('sync.done', { n: r.succeeded })
        : t('sync.partial', { n: r.succeeded, m: r.attempted })
    ]
    if (r.rejected) parts.push(t('sync.rejected', { n: r.rejected }))
    return { tone: r.rejected || r.succeeded < r.attempted - r.rejected ? 'warn' : 'ok', text: parts.join(' ') }
  }

  async function doSync(quiet = false) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      if (!session) return
      const report = await syncPendingRecords(session.operatorId)
      if (!quiet || report.succeeded || report.rejected) setToast(describe(report))
    } catch (e) {
      setToast({ tone: 'error', text: `${t('sync.failed')}: ${e instanceof Error ? e.message : ''}` })
    } finally {
      setBusy(false); inFlight.current = false
    }
  }

  // Ref keeps timers calling the latest doSync (current session and language).
  const syncRef = useRef(doSync)
  syncRef.current = doSync

  // Auto-retry on reconnect + gentle polling while online.
  useEffect(() => {
    const onOnline = () => { void syncRef.current(true) }
    window.addEventListener('online', onOnline)
    const timer = setInterval(() => { if (navigator.onLine) void syncRef.current(true) }, 60_000)
    return () => { window.removeEventListener('online', onOnline); clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!toast || toast.tone === 'error') return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast])

  const items: { to: string; icon: IconName; label: string }[] = [
    { to: '/capture', icon: 'camera', label: t('nav.capture') },
    { to: '/scan', icon: 'scan', label: t('nav.scan') },
    { to: '/log', icon: 'log', label: t('nav.log') },
    ...(session?.role === 'SUPERVISOR' ? [{ to: '/dashboard', icon: 'map' as const, label: t('nav.dashboard') }] : []),
  ]

  async function signOut() { await logout(); nav('/login') }

  const syncButton = (
    <button onClick={() => void doSync()} disabled={busy || !online || pending === 0}
            className="btn btn-secondary btn-sm sync-btn" aria-live="polite">
      <Icon name="sync" size={15} className={busy ? 'spin' : undefined} />
      {busy ? t('shell.syncing') : t('shell.sync')}
    </button>
  )

  return (
    <div className="shell">
      <aside className="rail" aria-label="Primary">
        <Link to="/" className="brand">
          <BrandMark />
          <span>Field Evidence Logger<small>SIH 2026</small></span>
        </Link>
        <nav className="nav">
          {items.map(i => (
            <NavLink key={i.to} to={i.to}><Icon name={i.icon} />{i.label}</NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <section className="syncbox" aria-label="Sync">
            <div className="syncbox-row">
              <span className={`net ${online ? 'net-on' : 'net-off'}`}>{online ? t('shell.online') : t('shell.offline')}</span>
              <span className="syncbox-count">{pending ? t('shell.pending', { n: pending }) : t('shell.allSynced')}</span>
            </div>
            {syncButton}
          </section>
          <LangToggle />
          <div className="who">
            <span className="who-avatar" aria-hidden="true">{(session?.displayName ?? '?').slice(0, 1)}</span>
            <span className="who-text">
              <b>{session?.displayName}</b>
              <small><span className="mono">{session?.operatorId}</span> · {session && t(`role.${session.role}`)}</small>
            </span>
            <button className="btn btn-ghost btn-icon" onClick={signOut} aria-label={t('shell.logout')} title={t('shell.logout')}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <header className="mtop">
        <Link to="/" className="brand"><BrandMark size={26} /><span>EvidenceLog</span></Link>
        <span className={`net net-dot ${online ? 'net-on' : 'net-off'}`} title={online ? t('shell.online') : t('shell.offline')}>
          <span className="sr-only">{online ? t('shell.online') : t('shell.offline')}</span>
        </span>
        <div className="mtop-actions">
          <button onClick={() => void doSync()} disabled={busy || !online || pending === 0}
                  className="btn btn-secondary btn-sm" aria-label={t('shell.sync')}>
            <Icon name="sync" size={15} className={busy ? 'spin' : undefined} />
            {pending > 0 && <span className="mono">{pending}</span>}
          </button>
          <LangToggle className="btn btn-ghost btn-sm" />
          <button className="btn btn-ghost btn-icon" onClick={signOut} aria-label={t('shell.logout')}>
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main className="main">
        {session?.offline &&
          <div className="shell-notice"><Notice tone="warn" icon="cloudOff">{t('shell.offlineSession')}</Notice></div>}
        <div className="content"><Outlet /></div>
      </main>

      <nav className="tabbar" aria-label="Primary" style={{ ['--tabs' as string]: items.length }}>
        {items.map(i => (
          <NavLink key={i.to} to={i.to}><Icon name={i.icon} size={22} /><span>{i.label}</span></NavLink>
        ))}
      </nav>

      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status">
          <Icon name={toast.tone === 'ok' ? 'check' : 'alert'} />
          <span>{toast.text}</span>
          <button className="btn btn-ghost btn-icon" onClick={() => setToast(null)} aria-label={t('shell.dismiss')}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
