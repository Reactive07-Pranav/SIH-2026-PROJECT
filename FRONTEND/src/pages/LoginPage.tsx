import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import api from '../api/client'
import { useI18n } from '../i18n'
import { BrandMark, Icon } from '../components/Icon'
import { LangToggle, Notice, useOnline } from '../components/ui'

const DEMO = [
  { id: 'OP001', pw: 'test123', role: 'OFFICER' as const },
  { id: 'admin', pw: 'admin123', role: 'SUPERVISOR' as const },
]

export default function LoginPage() {
  const { session, login, register } = useAuth()
  const { t } = useI18n()
  const nav = useNavigate()
  const online = useOnline()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [operatorId, setOperatorId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState(false)  // demo accounts exist only when the server was seeded

  useEffect(() => {
    api.get<{ demo?: boolean }>('/api/health').then(r => setDemo(!!r.data.demo)).catch(() => setDemo(false))
  }, [])

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setBusy(true)
    try {
      if (mode === 'register') await register(operatorId.trim(), password, displayName.trim() || undefined)
      else await login(operatorId.trim(), password)
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <section className="login-story">
        <div className="brand brand-lg"><BrandMark size={40} /><span>Field Evidence Logger<small>SIH 2026</small></span></div>
        <div className="login-pitch">
          <h1>{t('login.tagline')}</h1>
          <ul className="login-facts">
            <li><Icon name="key" />{t('login.fact1')}</li>
            <li><Icon name="cloudOff" />{t('login.fact2')}</li>
            <li><Icon name="scan" />{t('login.fact3')}</li>
          </ul>
        </div>
        <div className="login-scale" aria-hidden="true">
          <div className="dscale-ruler" />
          <div className="dscale-ticks" />
        </div>
      </section>

      <section className="login-form-wrap">
        <div className="login-lang"><LangToggle /></div>
        <form onSubmit={submit} className="login-form">
          <h2>{mode === 'register' ? t('login.register') : t('login.signIn')}</h2>
          {!online && <Notice tone="warn" icon="cloudOff">{t('login.offline')}</Notice>}
          <label className="field">
            <span>{t('login.operatorId')}</span>
            <input value={operatorId} onChange={e => setOperatorId(e.target.value)}
                   autoComplete="username" autoCapitalize="characters" spellCheck={false} required />
          </label>
          {mode === 'register' && (
            <label className="field">
              <span>{t('login.displayName')} <em>{t('login.optional')}</em></span>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>{t('login.password')}</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                   minLength={mode === 'register' ? 6 : undefined}
                   autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? t('login.working') : mode === 'register' ? t('login.register') : t('login.signIn')}
            {!busy && <Icon name="arrowRight" />}
          </button>
          <p className="login-switch">
            {mode === 'login' ? t('login.needAccount') : t('login.haveAccount')}{' '}
            <button type="button" className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
              {mode === 'login' ? t('login.toRegister') : t('login.toSignIn')}
            </button>
          </p>
          {mode === 'login' && demo && (
            <div className="demo">
              <span className="demo-title">{t('login.demo')}</span>
              {DEMO.map(d => (
                <button type="button" key={d.id} className="demo-row" onClick={() => { setOperatorId(d.id); setPassword(d.pw) }}>
                  <span className="mono">{d.id} / {d.pw}</span><span>{t(`role.${d.role}`)}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
