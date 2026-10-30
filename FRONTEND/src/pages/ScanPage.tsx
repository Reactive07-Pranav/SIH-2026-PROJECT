import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import api from '../api/client'
import type { Classification } from '../config'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { ClassBadge, EmptyState, Notice, Swatch } from '../components/ui'

interface ScanResult {
  id: string
  label: string
  classification: Classification
  confidence: number
  mean_rgb: number[]
  delta_e: number
  notes: string
  created_at: string
}

interface HistoryItem {
  id: string
  label: string
  classification: Classification
  confidence: number
  mean_rgb: string
  created_at: string
}

export default function ScanPage() {
  const { t, fmtDate } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[] | null>(null)

  async function loadHistory() {
    const { data } = await api.get<{ items: HistoryItem[] }>('/api/history')
    setHistory(data.items)
  }

  useEffect(() => { void loadHistory().catch(() => setHistory([])) }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function pick(next: File | null) {
    setFile(next); setResult(null); setError(null)
    setPreview(next ? URL.createObjectURL(next) : null)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f?.type.startsWith('image/')) pick(f)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<ScanResult>('/api/scan', form)
      setResult(data)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scan.failed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>{t('scan.title')}</h1>
        </div>
      </header>

      <Notice tone="warn" icon="scan">{t('scan.loud')}</Notice>

      <div className={result ? 'scan-grid' : 'scan-grid scan-grid-single'}>
        <form onSubmit={submit} className="panel panel-body stack">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0] ?? null)} />
          {preview ? (
            <div className="scan-preview">
              <img src={preview} alt="" />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
                <Icon name="image" size={15} />{t('scan.change')}
              </button>
            </div>
          ) : (
            <div className={`drop ${drag ? 'drop-over' : ''}`} role="button" tabIndex={0}
                 onClick={() => inputRef.current?.click()}
                 onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
                 onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <span className="empty-icon"><Icon name="upload" size={24} /></span>
              <b>{t('scan.choose')}</b>
              <span className="hint">{t('scan.drop')}</span>
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <div>
            <button className="btn btn-primary" disabled={!file || busy}>
              <Icon name="scan" />{busy ? t('scan.running') : t('scan.run')}
            </button>
          </div>
        </form>

        {result && (
        <section className="panel" aria-live="polite">
          {(
            <div className={`panel-body scan-result verdict-${result.classification}`}>
              <div className="verdict">
                <Icon name={result.classification} size={36} />
                <div>
                  <div className="verdict-word verdict-word-sm">{t(`cls.${result.classification}`)}</div>
                  <p className="verdict-sub">{t('scan.match', { label: result.label })} · {t('scan.confidence', { p: (result.confidence * 100).toFixed(0) })}</p>
                </div>
              </div>
              <dl className="facts">
                <dt>{t('scan.meanRgb')}</dt>
                <dd className="mono swatch-line"><Swatch rgb={result.mean_rgb} />{result.mean_rgb.join(', ')}</dd>
                <dt>ΔE</dt><dd className="mono">{result.delta_e.toFixed(2)}</dd>
              </dl>
              <p className="hint">{result.notes}</p>
            </div>
          )}
        </section>
        )}
      </div>

      <section className="panel">
        <div className="panel-head"><h2>{t('scan.history')}</h2></div>
        {history === null && <div className="panel-body"><div className="skel" style={{ height: 120 }} /></div>}
        {history?.length === 0 && <EmptyState icon="image">{t('scan.empty')}</EmptyState>}
        {!!history?.length && (
          <ul className="rec-list">
            {history.map(item => (
              <li key={item.id} className="rec rec-static">
                <Swatch rgb={item.mean_rgb ? item.mean_rgb.split(',').map(Number) : [0, 0, 0]} size={22} />
                <span className="rec-main">
                  <span>{item.label}</span>
                  <span className="rec-meta">{fmtDate(item.created_at)}</span>
                </span>
                <span className="mono rec-meta">{(item.confidence * 100).toFixed(0)}%</span>
                <ClassBadge c={item.classification} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
