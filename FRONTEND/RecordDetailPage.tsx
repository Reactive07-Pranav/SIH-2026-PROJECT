import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { api } from '../api/client'
import { ClassBadge, SyncBadge } from '../components/ui'

interface VerifyResponse { valid: boolean; detail?: string }

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const record = useLiveQuery(() => (id ? db.records.get(id) : undefined), [id])
  const [verifying, setVerifying] = useState(false)
  const [verdict, setVerdict] = useState<{ pass: boolean; detail: string } | null>(null)

  async function verify() {
    if (!record) return
    setVerifying(true); setVerdict(null)
    try {
      const { data: res } = await api.get<VerifyResponse>(`/api/records/verify`, {
        params: { recordId: record.id }
      })
      setVerdict({
        pass: res.valid,
        detail: res.detail ?? (res.valid ? 'Server verified signature + payload.' : 'Server rejected record.')
      })
    } catch (e) {
      setVerdict({ pass: false, detail: e instanceof Error ? e.message : 'Verify call failed (offline?)' })
    } finally { setVerifying(false) }
  }

  if (!record) return <p className="hint">Record not found.</p>
  const { image, ...view } = record

  return (
    <div>
      <h2>Record detail</h2>
      <div className="card">
        <div className="row">
          <ClassBadge c={record.classification} />
          <SyncBadge synced={record.synced} />
          <button className="btn btn-small" onClick={verify} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify on server'}
          </button>
        </div>
        {verdict && (
          <div className={verdict.pass ? 'banner' : 'banner banner-warn'} style={{ marginTop: 12 }}>
            {verdict.pass ? '✅ PASS' : '❌ FAIL'} — {verdict.detail}
          </div>
        )}
      </div>
      <pre className="json">
        {JSON.stringify({ ...view, image: image ? `<${image.size} bytes JPEG, local only>` : null }, null, 2)}
      </pre>
    </div>
  )
}
