import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ClassBadge, SyncBadge } from '../components/ui'
import type { Classification } from '../config'

export default function LogPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cls, setCls] = useState<'' | Classification>('')
  const [q, setQ] = useState('')

  const records = useLiveQuery(async () => {
    let rows = await db.records.orderBy('timestamp').reverse().toArray()
    if (from) rows = rows.filter(r => r.timestamp >= new Date(from).toISOString())
    if (to)   rows = rows.filter(r => r.timestamp <= new Date(to + 'T23:59:59').toISOString())
    if (cls)  rows = rows.filter(r => r.classification === cls)
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter(r => r.id.toLowerCase().includes(needle)
                           || r.operatorId.toLowerCase().includes(needle))
    }
    return rows
  }, [from, to, cls, q])

  return (
    <div>
      <h2>Local evidence log</h2>
      <div className="filters">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
        <select value={cls} onChange={e => setCls(e.target.value as '' | Classification)}>
          <option value="">All results</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="inconclusive">Inconclusive</option>
        </select>
        <input placeholder="Search ID / operator…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {!records && <p className="hint">Loading…</p>}
      {records?.length === 0 && <p className="hint">No local records match.</p>}
      {records?.map(r => (
        <div key={r.id} className="record-row">
          <Link to={`/records/${r.id}`}>
            <div>{new Date(r.timestamp).toLocaleString()}</div>
            <div className="hint" style={{ fontSize: 12 }}>{r.id.slice(0, 8)}… · {r.operatorId}</div>
          </Link>
          <ClassBadge c={r.classification} />
          <SyncBadge synced={r.synced} />
        </div>
      ))}
    </div>
  )
}
