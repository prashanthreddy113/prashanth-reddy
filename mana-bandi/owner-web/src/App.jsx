import { Suspense, lazy } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

// Hash routing is used for the static prototype build (no server-side rewrites available there).
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { TownProvider } from './lib/town'
import Layout from './components/Layout'
import Login from './pages/Login'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Live = lazy(() => import('./pages/Live'))
const Areas = lazy(() => import('./pages/Areas'))
const Captains = lazy(() => import('./pages/Captains'))
const CaptainDetail = lazy(() => import('./pages/CaptainDetail'))
const CaptainNew = lazy(() => import('./pages/CaptainNew'))
const Rides = lazy(() => import('./pages/Rides'))
const Parcels = lazy(() => import('./pages/Parcels'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settlements = lazy(() => import('./pages/Settlements'))
const Commission = lazy(() => import('./pages/Commission'))
const Settings = lazy(() => import('./pages/Settings'))

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function OwnerOnly({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'owner') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div className="loading">Loading…</div>}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth><TownProvider><Layout /></TownProvider></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="live" element={<Live />} />
              <Route path="areas" element={<Areas />} />
              <Route path="captains" element={<Captains />} />
              <Route path="captains/new" element={<CaptainNew />} />
              <Route path="captains/:id" element={<CaptainDetail />} />
              <Route path="rides" element={<Rides />} />
              <Route path="parcels" element={<Parcels />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settlements" element={<Settlements />} />
              <Route path="commission" element={<Commission />} />
              <Route path="settings" element={<OwnerOnly><Settings /></OwnerOnly>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </Router>
  )
}
