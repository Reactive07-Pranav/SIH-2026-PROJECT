import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, type Point } from '../db/db'
import { useAuth } from '../auth/AuthContext'

type Mode = 'live' | 'annotate'

const TAP_LABELS = ['Card TL', 'Card TR', 'Card BR', 'Card BL', 'Strip pad center']

export default function CapturePage() {
  const { session } = useAuth()
  const nav = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [mode, setMode] = useState<Mode>('live')
  const [err, setErr] = useState<string | null>(null)
  const [still, setStill] = useState<string | null>(null)     // data URL for annotator
  const [stillSize, setStillSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [taps, setTaps] = useState<Point[]>([])               // natural-pixel coords

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setErr(null)
    } catch {
      setErr('Camera unavailable or permission denied. Field capture requires camera access (HTTPS).')
    }
  }

  useEffect(() => {
    if (mode === 'live') void startCamera()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [mode])

  function shutter() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    setStill(canvas.toDataURL('image/jpeg', 0.92))
    setStillSize({ w: canvas.width, h: canvas.height })
    setTaps([])
    setMode('annotate')
    streamRef.current?.getTracks().forEach(t => t.stop())
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
    setTaps(t => [...t, { x: Math.round(x), y: Math.round(y) }])
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

  return (
    <div>
      <h2>Capture</h2>
      <p className="hint">Operator: <b>{session?.operatorId}</b></p>
      {err && <div className="banner banner-warn">{err}</div>}

      {mode === 'live' && (
        <>
          <div className="camera-wrap">
            <video ref={videoRef} playsInline muted />
            {/* Framing guides: color card (top) + test strip pad (bottom) */}
            <svg className="overlay-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="20" y="8" width="60" height="34" rx="2" fill="none"
                    stroke="#38bdf8" strokeWidth="0.7" strokeDasharray="3 2" />
              <text x="50" y="6" textAnchor="middle" fill="#38bdf8" fontSize="4">COLOR CARD</text>
              <rect x="35" y="62" width="30" height="24" rx="2" fill="none"
                    stroke="#f59e0b" strokeWidth="0.7" strokeDasharray="3 2" />
              <text x="50" y="92" textAnchor="middle" fill="#f59e0b" fontSize="4">TEST STRIP PAD</text>
            </svg>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button className="btn" onClick={shutter}
                    style={{ width: 84, height: 84, borderRadius: '50%' }}
                    aria-label="Capture frame">⬤</button>
          </div>
        </>
      )}

      {mode === 'annotate' && still && (
        <>
          <p className="hint">
            Tap in order:{' '}
            {TAP_LABELS.map((l, i) => (
              <b key={l} style={{ color: taps.length === i ? '#38bdf8' : undefined }}>
                {i + 1}. {l}{' '}
              </b>
            ))}
            — progress: {taps.length}/5
          </p>
          <div className="camera-wrap tap-stage"
               style={{ aspectRatio: `${stillSize.w} / ${stillSize.h}` }}>
            <img src={still} onClick={onStageTap} alt="captured frame" />
            <svg className="overlay-svg" viewBox={`0 0 ${stillSize.w} ${stillSize.h}`}
                 preserveAspectRatio="none">
              {taps.length >= 3 && (
                <polygon
                  points={taps.slice(0, Math.min(taps.length, 4)).map(p => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(56,189,248,0.08)" stroke="#38bdf8"
                  strokeWidth={Math.max(2, stillSize.w / 400)} />
              )}
            </svg>
            {taps.map((p, i) => (
              <div key={i} className="tap-dot"
                   style={{ left: `${(p.x / stillSize.w) * 100}%`, top: `${(p.y / stillSize.h) * 100}%` }}>
                {i + 1}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setTaps(t => t.slice(0, -1))}
                    disabled={!taps.length}>Undo tap</button>
            <button className="btn btn-ghost"
                    onClick={() => { setTaps([]); setStill(null); setMode('live') }}>
              Discard / retake
            </button>
            <button className="btn" onClick={confirmAndAnalyze} disabled={taps.length !== 5}>
              Analyze →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
