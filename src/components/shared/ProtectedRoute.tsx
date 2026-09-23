import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'

interface Props {
  role: UserRole
}

// Proteção de acesso por perfil
export default function ProtectedRoute({ role }: Props) {
  const { isAuthenticated, role: userRole, pendingFirstLogin, hydrating } = useAuthStore()

  if (hydrating) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center" role="status" aria-label="Verificando acesso">
        <div className="w-8 h-8 rounded-full border-2 border-[#27272a] border-t-[#22c55e] animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || !userRole) {
    return <Navigate to="/login" replace />
  }

  if (userRole !== role) {
    // Ao alternar do preview para a administração, o perfil muda antes da
    // rota. Redirecionar ao painel correto evita encerrar a navegação no login.
    return <Navigate to={`/${userRole}/dashboard`} replace />
  }

  if (pendingFirstLogin) {
    return <Navigate to="/primeiro-acesso" replace />
  }

  return <Outlet />
}
