import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { RequireAuth, RequireRole } from './components/guards'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import CapturePage from './pages/CapturePage'
import ResultPage from './pages/ResultPage'
import LogPage from './pages/LogPage'
import RecordDetailPage from './pages/RecordDetailPage'
import ScanPage from './pages/ScanPage'

// Leaflet is the heaviest chunk and only supervisors need it.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

function HomeRedirect() {
  const { session } = useAuth()
  return <Navigate to={session?.role === 'SUPERVISOR' ? '/dashboard' : '/capture'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/log" element={<LogPage />} />
        <Route path="/records/:id" element={<RecordDetailPage />} />
        <Route path="/dashboard"
               element={<RequireRole role="SUPERVISOR"><Suspense fallback={<div className="skel" style={{ height: 400 }} />}><DashboardPage /></Suspense></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
