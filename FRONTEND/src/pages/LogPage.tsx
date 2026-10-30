import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Classification } from '../config'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { ClassBadge, EmptyState, RecordStatus, Swatch } from '../components/ui'

export default function LogPage() {
  const { t, fmtDate } = useI18n()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cls, setCls] = useState<'' | Classification>('')
  const [q, setQ] = useState('')
  const filtered = Boolean(from || to || cls || q)

  const total = useLiveQuery(() => db.records.count(), [], undefined)
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

  function clear() { setFrom(''); setTo(''); setCls(''); setQ('') }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>{t('log.title')}</h1>
          <p className="page-sub">{t('log.sub')}</p>
        </div>
        {records && <span className="count mono">{t(records.length === 1 ? 'log.count1' : 'log.count', { n: records.length })}</span>}
      </header>

      {total !== 0 && (
        <div className="filters">
          <label className="field"><span>{t('log.from')}</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="field"><span>{t('log.to')}</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <label className="field"><span>{t('log.result')}</span>
            <select value={cls} onChange={e => setCls(e.target.value as '' | Classification)}>
              <option value="">{t('log.all')}</option>
              <option value="positive">{t('cls.positive')}</option>
              <option value="negative">{t('cls.negative')}</option>
              <option value="inconclusive">{t('cls.inconclusive')}</option>
            </select></label>
          <label className="field"><span>{t('log.search')}</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} spellCheck={false} /></label>
        </div>
      )}

      <section className="panel">
        {!records && <div className="panel-body"><div className="skel" style={{ height: 180 }} /></div>}
        {records?.length === 0 && (total === 0
          ? <EmptyState icon="camera" action={<Link to="/capture" className="btn btn-primary"><Icon name="camera" />{t('nav.capture')}</Link>}>{t('log.empty')}</EmptyState>
          : <EmptyState icon="log" action={filtered && <button className="btn btn-secondary" onClick={clear}>{t('log.clear')}</button>}>{t('log.noMatch')}</EmptyState>)}
        {!!records?.length && (
          <ul className="rec-list">
            {records.map(r => (
              <li key={r.id}>
                <Link to={`/records/${r.id}`} className="rec">
                  <Swatch rgb={r.correctedRgb} size={22} />
                  <span className="rec-main">
                    <span>{fmtDate(r.timestamp)}</span>
                    <span className="rec-meta mono">{r.id.slice(0, 8)} · {r.operatorId}</span>
                  </span>
                  <ClassBadge c={r.classification} />
                  <RecordStatus synced={r.synced === 1} sig={r.verification ?? null} rejected={r.syncError} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
