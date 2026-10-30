import { useEffect, useState, type FormEvent } from 'react'
import api from '../api/client'
import { ClassBadge } from '../components/ui'
import type { Classification } from '../config'

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
  created_at: string
}

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])

  async function loadHistory() {
    const { data } = await api.get<{ items: HistoryItem[] }>('/api/history')
    setHistory(data.items)
  }

  useEffect(() => { void loadHistory().catch(() => { /* shown on next scan */ }) }, [])

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
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <h2>Scan</h2>
      <form onSubmit={submit} className="card">
        <p className="hint">Upload a strip or evidence photo. The API classifies from measured pixel color (LAB nearest-neighbor), not a stub.</p>
        <input
          type="file"
          accept="image/*"
          onChange={e => {
            const next = e.target.files?.[0] ?? null
            setFile(next)
            setResult(null)
            setPreview(next ? URL.createObjectURL(next) : null)
          }}
        />
        {preview && <img src={preview} alt="preview" style={{ maxWidth: '100%', marginTop: 12, borderRadius: 8 }} />}
        {error && <div className="banner banner-warn" style={{ margin: '12px 0 0' }}>{error}</div>}
        <p>
          <button className="btn" disabled={!file || busy}>{busy ? 'Analyzing…' : 'Run prediction'}</button>
        </p>
      </form>

      {result && (
        <div className="card">
          <div className={`big-result ${result.classification}`}>{result.classification.toUpperCase()}</div>
          <p><ClassBadge c={result.classification} /> <strong>{result.label}</strong> · {(result.confidence * 100).toFixed(1)}% confidence</p>
          <p className="hint">mean RGB [{result.mean_rgb.join(', ')}] · ΔE {result.delta_e}</p>
          <p className="hint">{result.notes}</p>
        </div>
      )}

      <div className="card">
        <h3>Your scan history</h3>
        {history.length === 0 && <p className="hint">No scans yet for this account.</p>}
        {history.map(item => (
          <div key={item.id} className="record-row">
            <ClassBadge c={item.classification} />
            <span>{item.label} · {(item.confidence * 100).toFixed(0)}%</span>
            <span className="hint">{new Date(item.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
