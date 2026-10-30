import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, type EvidenceRecord } from '../db/db'
import { runPipeline, type PipelineOutcome } from '../pipeline'
import { buildEvidenceRecord } from '../records/build'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { CustodyChain, DeltaEScale, Notice, Swatch } from '../components/ui'
import { DELTA_E_MAX } from '../pipeline/reference'

export default function ResultPage() {
  const { session } = useAuth()
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const [outcome, setOutcome] = useState<PipelineOutcome | null>(null)
  const [record, setRecord] = useState<EvidenceRecord | null>(null)
  const [stage, setStage] = useState<'processing' | 'signing'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const draft = await db.drafts.get('latest')
        if (!draft) { setError(t('result.noFrame')); return }

        const bitmap = await createImageBitmap(draft.blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width; canvas.height = bitmap.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(bitmap, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const oc = runPipeline(imageData, draft.corners)
        if (cancelled) return
        setOutcome(oc)
        setStage('signing')

        const rec = await buildEvidenceRecord(oc, draft.blob, session!.operatorId)
        if (cancelled) return
        await db.drafts.delete('latest')
        setRecord(rec)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Pipeline failed')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return (
    <div className="stack">
      <Notice tone="error">{error}</Notice>
      <div><button className="btn btn-primary" onClick={() => nav('/capture')}><Icon name="camera" />{t('capture.retake')}</button></div>
    </div>
  )

  if (!outcome || !record) return (
    <div className="working" aria-busy="true">
      <span className="working-ruler" />
      <p>{stage === 'processing' ? t('result.processing') : t('result.signing')}</p>
    </div>
  )

  const c = outcome.classification
  const rgb = outcome.correctedRgb.map(Math.round)

  return (
    <div className="result">
      <section className={`verdict-panel verdict-${c}`}>
        <div className="verdict">
          <Icon name={c} size={44} />
          <div>
            <div className="verdict-word">{t(`cls.${c}`)}</div>
            <p className="verdict-sub">
              {t('result.nearest', { d: outcome.deltaE.toFixed(1), max: DELTA_E_MAX })}
            </p>
          </div>
        </div>
        <DeltaEScale deltaEs={outcome.deltaEs} sampleRgb={outcome.correctedRgb} />
      </section>

      {c === 'inconclusive' && <Notice tone="warn">{t('result.inconclusive')}</Notice>}
      {!outcome.calibrated && <Notice tone="warn">{t('result.uncalibrated')}</Notice>}

      <div className="result-grid">
        <section className="panel">
          <div className="panel-head"><h2>{t('custody.title')}</h2></div>
          <div className="panel-body">
            <CustodyChain signed={!!record.signatureB64} synced={record.synced === 1} sig={record.verification ?? null}
                          capturedAt={record.timestamp} syncedAt={record.syncedAt} />
            <p className="hint ok-line"><Icon name="key" size={15} />{t('result.signedSaved')}</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-body">
            <dl className="facts">
              <dt>{t('f.recordId')}</dt><dd className="mono">{record.id}</dd>
              <dt>{t('f.time')}</dt><dd>{fmtDate(record.timestamp)}</dd>
              <dt>{t('f.gps')}</dt>
              <dd className={record.gps ? 'mono' : undefined}>{record.gps
                ? `${record.gps.lat.toFixed(5)}, ${record.gps.lon.toFixed(5)} ±${Math.round(record.gps.accuracy)} m`
                : t('f.gpsNone')}</dd>
              <dt>{t('f.rgb')}</dt><dd className="mono swatch-line"><Swatch rgb={rgb} />{rgb.join(', ')}</dd>
              <dt>{t('f.signature')}</dt><dd className="mono truncate">{record.signatureB64}</dd>
              {outcome.cardPatchDeltas && (<>
                <dt>{t('f.calib')}</dt>
                <dd className="mono">{outcome.cardPatchDeltas.map(d => d.toFixed(1)).join(' · ')}</dd>
              </>)}
            </dl>
          </div>
        </section>
      </div>

      <div className="btn-row">
        <button className={c === 'inconclusive' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => nav('/capture')}>
          <Icon name="camera" />{c === 'inconclusive' ? t('capture.retake') : t('result.again')}
        </button>
        <Link className="btn btn-ghost" to={`/records/${record.id}`}>{t('result.detail')}<Icon name="arrowRight" /></Link>
      </div>
    </div>
  )
}
