import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, type Point } from '../db/db'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { Notice } from '../components/ui'

type Mode = 'live' | 'annotate'

const TAP_KEYS = ['capture.tap0', 'capture.tap1', 'capture.tap2', 'capture.tap3', 'capture.tap4'] as const

export default function CapturePage() {
  const { session } = useAuth()
  const { t } = useI18n()
  const nav = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('live')
  const modeRef = useRef<Mode | 'gone'>('live')
  const [err, setErr] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [still, setStill] = useState<string | null>(null)     // data URL for annotator
  const [stillSize, setStillSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [taps, setTaps] = useState<Point[]>([])               // natural-pixel coords

  async function startCamera() {
    setReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false
      })
      if (modeRef.current !== 'live') { stream.getTracks().forEach(tr => tr.stop()); return } // left the page meanwhile
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setReady(true)
      }
      setErr(null)
    } catch {
      setErr(t('capture.camErr'))
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(tr => tr.stop())
    streamRef.current = null
  }

  useEffect(() => {
    modeRef.current = mode
    if (mode === 'live') void startCamera()
    return () => { modeRef.current = 'gone'; stopCamera() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function toAnnotate(dataUrl: string, w: number, h: number) {
    setStill(dataUrl); setStillSize({ w, h }); setTaps([]); setMode('annotate'); stopCamera()
  }

  function shutter() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    toAnnotate(canvas.toDataURL('image/jpeg', 0.92), canvas.width, canvas.height)
  }

  function loadFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      const img = new Image()
      img.onload = () => toAnnotate(url, img.naturalWidth, img.naturalHeight)
      img.src = url
    }
    reader.readAsDataURL(file)
  }

  function onStageTap(e: ReactMouseEvent<HTMLImageElement>) {
    if (taps.length >= 5) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Map display coords → natural image pixels (letterboxing accounted for).
    const scale = Math.min(rect.width / stillSize.w, rect.height / stillSize.h)
    const offX = (rect.width - stillSize.w * scale) / 2
    const offY = (rect.height - stillSize.h * scale) / 2
    const x = (e.clientX - rect.left - offX) / scale
    const y = (e.clientY - rect.top - offY) / scale
    if (x < 0 || y < 0 || x > stillSize.w || y > stillSize.h) return
    setTaps(tp => [...tp, { x: Math.round(x), y: Math.round(y) }])
  }

  async function confirmAndAnalyze() {
    if (!still || taps.length !== 5) return
    const blob = await (await fetch(still)).blob()
    await db.drafts.put({
      id: 'latest', blob, corners: taps,
      width: stillSize.w, height: stillSize.h,
      savedAt: new Date().toISOString()
    })
    nav('/result')
  }

  const fileInput = (
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { loadFile(e.target.files?.[0]); e.target.value = '' }} />
  )

  return (
    <div className="capture">
      <header className="page-head">
        <div>
          <h1>{mode === 'live' ? t('capture.title') : t('capture.tapTitle')}</h1>
          <p className="page-sub">{t('f.operator')}: <span className="mono">{session?.operatorId}</span></p>
        </div>
      </header>

      <div className="capture-grid">
        {mode === 'live' && (
          <>
            <div className="viewport">
              <video ref={videoRef} playsInline muted />
              <svg className="guides" viewBox="0 0 100 133" preserveAspectRatio="none" aria-hidden="true">
                <rect x="14" y="10" width="72" height="46" rx="1.5" className="guide-card" />
                <text x="50" y="7" textAnchor="middle" className="guide-text guide-text-card">{t('capture.card')}</text>
                <rect x="34" y="78" width="32" height="34" rx="1.5" className="guide-pad" />
                <text x="50" y="119" textAnchor="middle" className="guide-text guide-text-pad">{t('capture.pad')}</text>
              </svg>
            </div>
            <aside className="capture-side">
              <p className="capture-hint">{t('capture.hint')}</p>
              <a className="print-card" href="/reference-card.svg" target="_blank" rel="noreferrer">
                <Icon name="image" size={16} />{t('capture.printCard')}
              </a>
              {err && <Notice tone="warn" icon="camera">{err}</Notice>}
              <div className="shutter-row">
                <button className="shutter" onClick={shutter} disabled={!ready} aria-label={t('capture.shutter')}>
                  <span />
                </button>
                <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                  <Icon name="image" />{t('capture.useFile')}
                </button>
                {fileInput}
              </div>
            </aside>
          </>
        )}

        {mode === 'annotate' && still && (
          <>
            <div className="viewport viewport-tap" style={{ aspectRatio: `${stillSize.w} / ${stillSize.h}` }}>
              <img src={still} onClick={onStageTap} alt="" draggable={false} />
              <svg className="guides" viewBox={`0 0 ${stillSize.w} ${stillSize.h}`} preserveAspectRatio="none" aria-hidden="true">
                {taps.length >= 2 && (
                  <polygon points={taps.slice(0, Math.min(taps.length, 4)).map(p => `${p.x},${p.y}`).join(' ')}
                           className="tap-quad" strokeWidth={Math.max(2, stillSize.w / 380)} />
                )}
              </svg>
              {taps.map((p, i) => (
                <span key={i} className={`tap-dot ${i === 4 ? 'tap-dot-pad' : ''}`}
                      style={{ left: `${(p.x / stillSize.w) * 100}%`, top: `${(p.y / stillSize.h) * 100}%` }}>
                  {i + 1}
                </span>
              ))}
            </div>
            <aside className="capture-side">
              <ol className="steps">
                {TAP_KEYS.map((k, i) => (
                  <li key={k} className={i < taps.length ? 'step-done' : i === taps.length ? 'step-now' : 'step-todo'}
                      aria-current={i === taps.length ? 'step' : undefined}>
                    <span className="step-num">{i < taps.length ? <Icon name="check" size={14} /> : i + 1}</span>
                    {t(k)}
                  </li>
                ))}
              </ol>
              <p className="hint" aria-live="polite">{taps.length === 5 ? t('capture.done') : `${taps.length}/5`}</p>
              <div className="btn-row">
                <button className="btn btn-primary btn-lg" onClick={confirmAndAnalyze} disabled={taps.length !== 5}>
                  {t('capture.analyze')}<Icon name="arrowRight" />
                </button>
                <button className="btn btn-secondary" onClick={() => setTaps(tp => tp.slice(0, -1))} disabled={!taps.length}>
                  <Icon name="undo" />{t('capture.undo')}
                </button>
                <button className="btn btn-ghost" onClick={() => { setTaps([]); setStill(null); setMode('live') }}>
                  <Icon name="camera" />{t('capture.retake')}
                </button>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
