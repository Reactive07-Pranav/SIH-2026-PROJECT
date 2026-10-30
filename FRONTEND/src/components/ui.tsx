import { useEffect, useState, type ReactNode } from 'react'
import type { Classification } from '../config'
import { useI18n } from '../i18n'
import { STRIP_SIGNATURES, DELTA_E_GAP, DELTA_E_MAX } from '../pipeline/reference'
import { Icon, type IconName } from './Icon'

export function ClassBadge({ c }: { c: Classification }) {
  const { t } = useI18n()
  return (
    <span className={`badge badge-${c}`}>
      <Icon name={c} size={14} />{t(`cls.${c}`)}
    </span>
  )
}

export type SigState = 'verified' | 'invalid' | 'unverified'

const SIG_ICON: Record<SigState, IconName> = { verified: 'shieldCheck', invalid: 'shieldX', unverified: 'shield' }
const SIG_KEY = { verified: 'custody.verified', invalid: 'custody.invalid', unverified: 'custody.unchecked' } as const

export function SigBadge({ s }: { s: SigState }) {
  const { t } = useI18n()
  return <span className={`badge sig-${s}`}><Icon name={SIG_ICON[s]} size={14} />{t(SIG_KEY[s])}</span>
}

export function Notice({ tone = 'info', icon, children, action }: {
  tone?: 'info' | 'warn' | 'error' | 'ok'; icon?: IconName; children: ReactNode; action?: ReactNode
}) {
  const fallback: Record<string, IconName> = { info: 'alert', warn: 'alert', error: 'alert', ok: 'check' }
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' || tone === 'warn' ? 'alert' : 'status'}>
      <Icon name={icon ?? fallback[tone]} size={18} />
      <div className="notice-body">{children}</div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, children, action }: { icon: IconName; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={24} /></span>
      <p>{children}</p>
      {action}
    </div>
  )
}

export function Swatch({ rgb, size = 18, label }: { rgb: number[]; size?: number; label?: string }) {
  return (
    <span className="swatch" style={{ width: size, height: size, background: `rgb(${rgb.map(Math.round).join(',')})` }}
          role={label ? 'img' : undefined} aria-label={label} />
  )
}

export function LangToggle({ className = 'btn btn-ghost btn-sm' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  return (
    <button type="button" className={className} onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            aria-label={t('lang.label')} lang={lang === 'en' ? 'hi' : 'en'}>
      <Icon name="language" size={16} />{t('lang.switch')}
    </button>
  )
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

/* ── Chain of custody ───────────────────────────────────────────────────── */

type StepState = 'done' | 'bad' | 'todo'
export interface CustodyInput { signed: boolean; synced: boolean; sig: SigState | null; capturedAt?: string; syncedAt?: string }

function steps({ signed, synced, sig }: CustodyInput): { key: 'captured' | 'signed' | 'synced' | 'verified'; state: StepState }[] {
  return [
    { key: 'captured', state: 'done' },
    { key: 'signed', state: signed ? 'done' : 'bad' },
    { key: 'synced', state: synced ? 'done' : 'todo' },
    { key: 'verified', state: sig === 'verified' ? 'done' : sig === 'invalid' ? 'bad' : 'todo' },
  ]
}

const STEP_ICON: Record<StepState, IconName> = { done: 'check', bad: 'x', todo: 'clock' }

export function CustodyChain(props: CustodyInput) {
  const { t, fmtDate } = useI18n()
  const list = steps(props)
  const sub = (key: string, state: StepState) => {
    if (key === 'captured' && props.capturedAt) return fmtDate(props.capturedAt)
    if (key === 'synced' && props.syncedAt) return fmtDate(props.syncedAt)
    if (key === 'verified' && state === 'bad') return t('custody.invalid')
    if (key === 'verified' && props.synced && state === 'todo') return t('custody.unchecked')
    return state === 'todo' ? t('custody.waiting') : null
  }
  return (
    <ol className="custody" aria-label={t('custody.title')}>
      {list.map(s => (
        <li key={s.key} className={`c-${s.state}`}>
          <span className="c-node"><Icon name={STEP_ICON[s.state]} size={13} /></span>
          <span className="c-label">{t(`custody.${s.key}`)}</span>
          <span className="c-sub">{sub(s.key, s.state)}</span>
        </li>
      ))}
    </ol>
  )
}

/** One word + icon for where a local record stands: the row-sized form of the custody chain. */
export function RecordStatus({ synced, sig, rejected }: { synced: boolean; sig: SigState | null; rejected?: string }) {
  const { t } = useI18n()
  if (rejected) return <span className="badge sig-invalid" title={rejected}><Icon name="x" size={14} />{t('status.rejected')}</span>
  if (!synced) return <span className="badge st-pending"><Icon name="clock" size={14} />{t('status.pending')}</span>
  if (sig === 'verified' || sig === 'invalid') return <SigBadge s={sig} />
  return <span className="badge sig-unverified"><Icon name="sync" size={14} />{t('custody.synced')}</span>
}

/** Long hex/base64 runs split into 8-char groups for eye comparison; copying still yields one unbroken string. */
export function Grouped({ value }: { value: string }) {
  return <span className="grouped mono">{value.match(/.{1,8}/g)?.map((g, i) => <span key={i}>{g}</span>)}</span>
}

/* ── ΔE forensic scale (signature move) ─────────────────────────────────── */

/**
 * Places the sample between the negative and positive references by relative
 * ΔE distance, t = dNeg / (dNeg + dPos). The hatched band is where
 * |dPos − dNeg| < DELTA_E_GAP, i.e. the classifier's ambiguity zone.
 */
export function DeltaEScale({ deltaEs, sampleRgb }: { deltaEs: Record<string, number>; sampleRgb: number[] }) {
  const { t } = useI18n()
  const dNeg = deltaEs.negative ?? 0, dPos = deltaEs.positive ?? 0
  const sum = dNeg + dPos
  const pos = sum > 0 ? Math.min(0.98, Math.max(0.02, dNeg / sum)) : 0.5
  const half = sum > 0 ? Math.min(0.5, DELTA_E_GAP / (2 * sum)) : 0.5
  const neg = STRIP_SIGNATURES.find(s => s.label === 'negative')!
  const posRef = STRIP_SIGNATURES.find(s => s.label === 'positive')!
  const tooFar = Math.min(dNeg, dPos) > DELTA_E_MAX

  return (
    <figure className="dscale">
      <figcaption className="dscale-cap">{t('result.scale')}</figcaption>
      <div className="dscale-track">
        <div className="dscale-ruler" />
        <div className="dscale-ticks" />
        <div className="dscale-band" style={{ left: `${(0.5 - half) * 100}%`, width: `${half * 200}%` }}
             title={t('result.band')} />
        {/* Placed at the true reading from frame one; only the needle drops in, so no capture shows a false reading. */}
        <div className="dscale-marker" style={{ left: `${pos * 100}%` }}>
          <Swatch rgb={sampleRgb} size={22} label={t('result.sample')} />
          <span className="dscale-needle" />
        </div>
      </div>
      <div className="dscale-ends">
        <span><Swatch rgb={neg.rgb} />{t('result.refNegative')} <b className="mono">ΔE {dNeg.toFixed(1)}</b></span>
        <span className="dscale-band-key"><i />{t('result.band')}</span>
        <span><b className="mono">ΔE {dPos.toFixed(1)}</b> {t('result.refPositive')}<Swatch rgb={posRef.rgb} /></span>
      </div>
      {tooFar && <p className="dscale-far">{t('result.tooFar', { d: Math.min(dNeg, dPos).toFixed(1), max: DELTA_E_MAX })}</p>}
    </figure>
  )
}
