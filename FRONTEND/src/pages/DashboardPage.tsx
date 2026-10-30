import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'
import type { Classification } from '../config'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { ClassBadge, EmptyState, Notice, SigBadge, type SigState } from '../components/ui'

interface ServerRecord {
  id: string
  timestamp: string
  operatorId: string
  classification: Classification
  signatureStatus?: SigState
  gps: { lat: number; lon: number } | null
}
interface Page<T> { content: T[]; totalElements: number; totalPages: number; number: number }
interface Stats {
  total: number
  byClassification: Record<Classification, number>
  bySignature: Record<SigState, number>
  operators: number
}

// Markers carry the result glyph, not only its colour (same shapes as Icon.tsx).
const GLYPH: Record<Classification, string> = {
  positive: '<path d="M12 7v10M7 12h10"/>',
  negative: '<path d="M7 12h10"/>',
  inconclusive: '<path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.3M12 17h.01"/>',
}
const MARKERS = Object.fromEntries((Object.keys(GLYPH) as Classification[]).map(c => [c, L.divIcon({
  className: `mk mk-${c}`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12],
  html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${GLYPH[c]}</svg>`,
})])) as Record<Classification, L.DivIcon>
const INDIA: [number, number] = [22.5, 79]
const CLASSES: Classification[] = ['positive', 'negative', 'inconclusive']

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = JSON.stringify(points)
  // The panel stretches to the table's height after data loads; Leaflet must re-measure.
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [48, 48], maxZoom: 13 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

export default function DashboardPage() {
  const { t, fmtDate } = useI18n()
  const [page, setPage] = useState(0)
  const [operator, setOperator] = useState('')
  const [result, setResult] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<Page<ServerRecord> | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
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

  useEffect(() => {
    let cancelled = false
    api.get<Stats>('/api/records/stats', { params: operator ? { operator } : {} })
      .then(({ data: s }) => { if (!cancelled) setStats(s) })
      .catch(() => { /* error banner comes from the records call */ })
    return () => { cancelled = true }
  }, [operator])

  const geo = useMemo(() => data?.content.filter(r => r.gps) ?? [], [data])
  const points = useMemo(() => geo.map(r => [r.gps!.lat, r.gps!.lon] as [number, number]), [geo])

  function reset<T>(set: (v: T) => void) { return (v: T) => { set(v); setPage(0) } }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>{t('dash.title')}</h1>
        </div>
      </header>

      {error && <Notice tone="error" icon="cloudOff">{t('dash.networkErr', { msg: error })}</Notice>}

      <section className="stats" aria-label={t('dash.total')}>
        <div className="stat stat-wide">
          <span className="stat-label">{t('dash.total')}</span>
          <span className="stat-value">{stats ? stats.total : '—'}</span>
          <div className="sharebar" aria-hidden="true">
            {stats && stats.total > 0 && CLASSES.map(c => (
              <span key={c} className={`share-${c}`} style={{ flexGrow: stats.byClassification[c] }} />
            ))}
          </div>
          <ul className="share-legend">
            {CLASSES.map(c => (
              <li key={c}><i className={`dot dot-${c}`} />{t(`cls.${c}`)} <b className="mono">{stats?.byClassification[c] ?? 0}</b></li>
            ))}
          </ul>
        </div>
        <div className="stat">
          <span className="stat-label">{t('dash.signatures')}</span>
          <ul className="sig-list">
            {(['verified', 'invalid', 'unverified'] as SigState[]).map(s => (
              <li key={s} className={s === 'invalid' && stats?.bySignature.invalid ? 'sig-row-bad' : undefined}>
                <SigBadge s={s} /><b className="mono">{stats?.bySignature[s] ?? '—'}</b>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="filters">
        <label className="field"><span>{t('dash.operatorFilter')}</span>
          <input value={operator} onChange={e => reset(setOperator)(e.target.value)} spellCheck={false} /></label>
        <label className="field"><span>{t('log.result')}</span>
          <select value={result} onChange={e => reset(setResult)(e.target.value)}>
            <option value="">{t('log.all')}</option>
            {CLASSES.map(c => <option key={c} value={c}>{t(`cls.${c}`)}</option>)}
          </select></label>
        <label className="field"><span>{t('log.from')}</span>
          <input type="date" value={from} onChange={e => reset(setFrom)(e.target.value)} /></label>
        <label className="field"><span>{t('log.to')}</span>
          <input type="date" value={to} onChange={e => reset(setTo)(e.target.value)} /></label>
      </div>

      <div className="dash-grid">
        <section className="panel map-panel">
          <MapContainer center={INDIA} zoom={5} scrollWheelZoom={false}>
            <TileLayer attribution='&copy; OpenStreetMap contributors'
                       url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={points} />
            {geo.map(r => (
              <Marker key={r.id} position={[r.gps!.lat, r.gps!.lon]} icon={MARKERS[r.classification]}
                      title={`${t(`cls.${r.classification}`)} · ${r.operatorId}`}>
                <Popup>
                  <b>{t(`cls.${r.classification}`)}</b><br />
                  <span className="mono">{r.operatorId} · {r.id.slice(0, 8)}</span><br />
                  {fmtDate(r.timestamp)}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          {data && geo.length === 0 && <p className="map-empty"><Icon name="pin" size={16} />{t('dash.mapEmpty')}</p>}
        </section>

        <section className="panel table-panel">
          {!data && !error && <div className="panel-body"><div className="skel" style={{ height: 320 }} /></div>}
          {data?.content.length === 0 && <EmptyState icon="log">{t('dash.empty')}</EmptyState>}
          {!!data?.content.length && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th scope="col">{t('th.time')}</th><th scope="col">{t('th.operator')}</th>
                  <th scope="col">{t('th.result')}</th><th scope="col">{t('th.signature')}</th><th scope="col">{t('th.id')}</th>
                </tr></thead>
                <tbody>
                  {data.content.map(r => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.timestamp)}</td>
                      <td className="mono">{r.operatorId}</td>
                      <td><ClassBadge c={r.classification} /></td>
                      <td><SigBadge s={r.signatureStatus ?? 'unverified'} /></td>
                      <td className="mono t-muted">{r.id.slice(0, 8)}{!r.gps && <span className="sr-only"> {t('dash.noGps')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && (
            <div className="pager">
              <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <Icon name="arrowLeft" size={15} />{t('dash.prev')}
              </button>
              <span className="mono">{t('dash.page', { p: data.number + 1, n: Math.max(1, data.totalPages), t: data.totalElements })}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}>
                {t('dash.next')}<Icon name="arrowRight" size={15} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
