import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, type EvidenceRecord } from '../db/db'
import { runPipeline, type PipelineOutcome } from '../pipeline'
import { buildEvidenceRecord } from '../records/build'
import { useAuth } from '../auth/AuthContext'
import { WarningBanner } from '../components/ui'

export default function ResultPage() {
  const { session } = useAuth()
  const nav = useNavigate()
  const [outcome, setOutcome] = useState<PipelineOutcome | null>(null)
  const [record, setRecord] = useState<EvidenceRecord | null>(null)
  const [stage, setStage] = useState('Processing frame…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const draft = await db.drafts.get('latest')
        if (!draft) { setError('No captured frame found.'); return }

        const bitmap = await createImageBitmap(draft.blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width; canvas.height = bitmap.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(bitmap, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const oc = runPipeline(imageData, draft.corners)
        if (cancelled) return
        setOutcome(oc)
        setStage('Acquiring GPS & signing record…')

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
    <div className="card">
      <WarningBanner>{error}</WarningBanner>
      <button className="btn" onClick={() => nav('/capture')}>Retake</button>
    </div>
  )

  if (!outcome || !record) return <div className="center-page">{stage}</div>

  const inc = outcome.classification === 'inconclusive'
  const rgb = outcome.correctedRgb.map(Math.round)

  return (
    <div>
      <h2>Result</h2>
      {inc && (
        <WarningBanner>
          INCONCLUSIVE — ΔE {outcome.deltaE.toFixed(1)} is outside the confidence band or the
          classes are ambiguous. Retake under better lighting, keeping the card flat and unshadowed.
        </WarningBanner>
      )}
      {!outcome.calibrated && (
        <WarningBanner>Uncalibrated capture (no card corners) — treat as reference only.</WarningBanner>
      )}

      <div className="card">
        <div className={`big-result ${outcome.classification}`}>
          {outcome.classification.toUpperCase()}
        </div>
        <dl className="kv">
          <dt>ΔE (nearest class)</dt><dd>{outcome.deltaE.toFixed(2)}</dd>
          <dt>ΔE by class</dt>
          <dd>{Object.entries(outcome.deltaEs).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join(' · ')}</dd>
          <dt>Corrected RGB</dt>
          <dd>
            <span style={{ display: 'inline-block', width: 14, height: 14, marginRight: 6,
              verticalAlign: -2, background: `rgb(${rgb.join(',')})`, border: '1px solid #555' }} />
            {rgb.join(', ')}
          </dd>
          <dt>Record ID</dt><dd><Link to={`/records/${record.id}`}>{record.id}</Link></dd>
          <dt>GPS</dt>
          <dd>{record.gps
            ? `${record.gps.lat.toFixed(5)}, ${record.gps.lon.toFixed(5)} (±${Math.round(record.gps.accuracy)}m)`
            : 'unavailable'}</dd>
          <dt>Signature</dt><dd style={{ fontSize: 11 }}>{record.signatureB64.slice(0, 40)}…</dd>
        </dl>
        {outcome.cardPatchDeltas && (
          <p className="hint">
            Calibration residual per card patch (RGB units):{' '}
            {outcome.cardPatchDeltas.map(d => d.toFixed(1)).join(', ')}
          </p>
        )}
      </div>

      <div className="row">
        <button className={inc ? 'btn' : 'btn btn-ghost'} onClick={() => nav('/capture')}>Retake</button>
        <Link className="btn btn-ghost" to="/log">Open log</Link>
        <Link className="btn btn-ghost" to={`/records/${record.id}`}>Record detail</Link>
      </div>
    </div>
  )
}
