import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'
import { ClassBadge } from '../components/ui'
import type { Classification } from '../config'

interface ServerRecord {
  id: string
  timestamp: string
  operatorId: string
  classification: Classification
  gps: { lat: number; lon: number } | null
}
interface Page<T> { content: T[]; totalElements: number; totalPages: number; number: number }

const RESULT_COLORS: Record<Classification, string> = {
  positive: '#ef4444', negative: '#22c55e', inconclusive: '#f59e0b'
}

export default function DashboardPage() {
  const [page, setPage] = useState(0)
  const [operator, setOperator] = useState('')
  const [result, setResult] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<Page<ServerRecord> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), size: '20' })
    if (operator) params.set('operator', operator)
    if (result) params.set('result', result)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    api.get<Page<ServerRecord>>(`/api/records?${params}`)
      .then(({ data: d }) => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load records') })
    return () => { cancelled = true }
  }, [page, operator, result, from, to])

  const geoRecords = data?.content.filter(r => r.gps) ?? []
  const center: [number, number] = geoRecords.length
    ? [geoRecords[0].gps!.lat, geoRecords[0].gps!.lon]
    : [39.5, -98.35]

  return (
    <div>
      <h2>Supervisor dashboard</h2>
      <div className="filters">
        <input placeholder="Operator ID…" value={operator}
               onChange={e => { setOperator(e.target.value); setPage(0) }} />
        <select value={result} onChange={e => { setResult(e.target.value); setPage(0) }}>
          <option value="">All results</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="inconclusive">Inconclusive</option>
        </select>
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0) }} />
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0) }} />
      </div>

      {error && <div className="banner banner-warn">{error} — supervisor view requires network.</div>}

      <div className="card">
        <MapContainer center={center} zoom={geoRecords.length ? 10 : 4} style={{ height: 340 }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors'
                     url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geoRecords.map(r => (
            <CircleMarker key={r.id} center={[r.gps!.lat, r.gps!.lon]} radius={9}
                          pathOptions={{ color: RESULT_COLORS[r.classification], fillOpacity: 0.8 }}>
              <Popup>
                {r.id.slice(0, 8)}…<br />
                {r.operatorId} · {new Date(r.timestamp).toLocaleString()}<br />
                {r.classification}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Time</th><th>Operator</th><th>Result</th><th>ID</th></tr></thead>
          <tbody>
            {data?.content.map(r => (
              <tr key={r.id}>
                <td>{new Date(r.timestamp).toLocaleString()}</td>
                <td>{r.operatorId}</td>
                <td><ClassBadge c={r.classification} /></td>
                <td className="hint">{r.id.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button className="btn btn-small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {(data?.number ?? 0) + 1} / {Math.max(1, data?.totalPages ?? 1)} ({data?.totalElements ?? 0} records)</span>
          <button className="btn btn-small" disabled={!data || page >= data.totalPages - 1}
                  onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>
    </div>
  )
}
