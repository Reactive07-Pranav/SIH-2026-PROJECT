import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../config'
import { BrandMark } from './Icon'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="center-page" aria-busy="true"><BrandMark size={40} /></div>
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useAuth()
  if (session?.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}
