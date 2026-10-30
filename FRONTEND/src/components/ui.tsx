import type { ReactNode } from 'react'
import type { Classification } from '../config'

export function ClassBadge({ c }: { c: Classification }) {
  return <span className={`badge badge-${c}`}>{c.toUpperCase()}</span>
}

export function SyncBadge({ synced }: { synced: 0 | 1 }) {
  return synced ? <span className="badge badge-synced">SYNCED</span>
                : <span className="badge badge-pending">PENDING</span>
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return <div className="banner banner-warn" role="alert">{children}</div>
}
