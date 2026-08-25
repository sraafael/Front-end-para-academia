import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'

interface Props {
  role: UserRole
}

export default function ProtectedRoute({ role }: Props) {
  const { isAuthenticated, role: userRole, pendingFirstLogin } = useAuthStore()

  if (!isAuthenticated || userRole !== role) {
    return <Navigate to="/login" replace />
  }

  if (pendingFirstLogin && userRole !== 'admin') {
    return <Navigate to="/primeiro-acesso" replace />
  }

  return <Outlet />
}
