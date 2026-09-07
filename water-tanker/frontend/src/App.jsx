import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Deliveries from './pages/Deliveries'
import DeliveryDetail from './pages/DeliveryDetail'
import Fleet from './pages/Fleet'
import Bookings from './pages/Bookings'
import Invoices from './pages/Invoices'
import Disputes from './pages/Disputes'
import Communities from './pages/Communities'
import Admin from './pages/Admin'
import Settings from './pages/Settings'

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function RequireRole({ roles, children }) {
  const { role } = useAuth()
  if (!roles.includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="deliveries" element={<Deliveries />} />
              <Route path="deliveries/:id" element={<DeliveryDetail />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="disputes" element={<Disputes />} />
              <Route path="fleet" element={<RequireRole roles={['Operator', 'Admin']}><Fleet /></RequireRole>} />
              <Route path="communities" element={<Communities />} />
              <Route path="admin" element={<RequireRole roles={['Admin', 'Operator']}><Admin /></RequireRole>} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
