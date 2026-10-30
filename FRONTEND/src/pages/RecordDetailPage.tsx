import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { api } from '../api/client'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { ClassBadge, CustodyChain, Grouped, Notice, Swatch, type SigState } from '../components/ui'

interface VerifyResponse { valid: boolean; status?: SigState | 'missing'; detail?: string }

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, fmtDate } = useI18n()
  const record = useLiveQuery(() => (id ? db.records.get(id) : undefined), [id], null)
  const [verifying, setVerifying] = useState(false)
  const [verdict, setVerdict] = useState<{ tone: 'ok' | 'error' | 'warn'; detail: string } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!record?.image) return
    const url = URL.createObjectURL(record.image)
    setPhoto(url)
    return () => URL.revokeObjectURL(url)
  }, [record?.image])

  async function verify() {
    if (!record) return
    setVerifying(true); setVerdict(null)
    try {
      const { data: res } = await api.get<VerifyResponse>('/api/records/verify', { params: { recordId: record.id } })
      const tone = res.valid ? 'ok' : res.status === 'invalid' ? 'error' : 'warn'
      setVerdict({ tone, detail: res.detail ?? '' })
      if (res.status && res.status !== 'missing') {
        await db.records.update(record.id, { verification: res.status, verifiedAt: new Date().toISOString() })
      }
    } catch (e) {
      setVerdict({ tone: 'error', detail: e instanceof Error ? `${t('detail.verifyFail')} (${e.message})` : t('detail.verifyFail') })
    } finally { setVerifying(false) }
  }

  if (record === null) return <div className="skel" style={{ height: 240 }} />
  if (!record) return (
    <div className="stack">
      <Notice tone="warn">{t('detail.notFound')}</Notice>
      <div><Link className="btn btn-secondary" to="/log"><Icon name="arrowLeft" />{t('detail.back')}</Link></div>
    </div>
  )

  const payload = (() => { try { return JSON.stringify(JSON.parse(record.payloadCanonical), null, 2) } catch { return record.payloadCanonical } })()

  return (
    <div className="stack">
      <Link to="/log" className="back-link"><Icon name="arrowLeft" size={16} />{t('detail.back')}</Link>
      <header className="page-head">
        <div>
          <h1 className="detail-title">{t('detail.title')} <span className="mono">{record.id.slice(0, 8)}</span></h1>
          <p className="page-sub">{fmtDate(record.timestamp)} · <span className="mono">{record.operatorId}</span></p>
        </div>
        <div className="btn-row">
          <ClassBadge c={record.classification} />
          <button className={record.verification === 'verified' ? 'btn btn-secondary' : 'btn btn-primary'}
                  onClick={verify} disabled={verifying || record.synced !== 1}>
            <Icon name="shieldCheck" />
            {verifying ? t('detail.verifying') : record.verification === 'verified' ? t('detail.verifyAgain') : t('detail.verify')}
          </button>
        </div>
      </header>

      {verdict && <Notice tone={verdict.tone} icon={verdict.tone === 'ok' ? 'shieldCheck' : verdict.tone === 'error' ? 'shieldX' : 'shield'}>{verdict.detail}</Notice>}
      {record.syncError && <Notice tone="error">{record.syncError}</Notice>}

      <section className="panel">
        <div className="panel-head"><h2>{t('custody.title')}</h2></div>
        <div className="panel-body">
          <CustodyChain signed={!!record.signatureB64} synced={record.synced === 1} sig={record.verification ?? null}
                        capturedAt={record.timestamp} syncedAt={record.syncedAt} />
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-body">
            <dl className="facts">
              <dt>{t('f.recordId')}</dt><dd className="mono">{record.id}</dd>
              <dt>{t('f.operator')}</dt><dd className="mono">{record.operatorId}</dd>
              <dt>{t('f.device')}</dt><dd><Grouped value={record.deviceId} /></dd>
              <dt>{t('f.gps')}</dt>
              <dd className={record.gps ? 'mono' : undefined}>{record.gps
                ? `${record.gps.lat.toFixed(5)}, ${record.gps.lon.toFixed(5)} ±${Math.round(record.gps.accuracy)} m`
                : t('f.gpsNone')}</dd>
              <dt>{t('f.rgb')}</dt><dd className="mono swatch-line"><Swatch rgb={record.correctedRgb} />{record.correctedRgb.join(', ')}</dd>
              <dt>ΔE</dt><dd className="mono">{record.deltaE.toFixed(2)}</dd>
              <dt>{t('f.imageHash')}</dt><dd><Grouped value={record.imageHash} /></dd>
              <dt>{t('f.signature')}</dt><dd><Grouped value={record.signatureB64} /></dd>
            </dl>
          </div>
        </section>
        {photo && (
          <figure className="panel photo">
            <img src={photo} alt="" />
            <div className="photo-scale" aria-hidden="true"><div className="dscale-ruler" /><div className="dscale-ticks" /></div>
            <figcaption className="hint">{t('detail.photo')}</figcaption>
          </figure>
        )}
      </div>

      <details className="panel raw">
        <summary><Icon name="chevronDown" size={16} />{t('detail.raw')}</summary>
        <pre className="json">{payload}</pre>
      </details>
    </div>
  )
}
