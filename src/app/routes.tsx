import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import ProtectedRoute from '../components/shared/ProtectedRoute'

// ── Páginas carregadas sob demanda ─────────────────────────────────────────

const RoleSelect = lazy(() => import('../components/auth/RoleSelect'))
const LoginScreen = lazy(() => import('../components/auth/LoginScreen'))
const ForgotPassword = lazy(() => import('../components/auth/ForgotPassword'))
const FirstLoginReset = lazy(() => import('../components/auth/FirstLoginReset'))
const AdminDashboard = lazy(() => import('../components/admin/AdminDashboard'))
const OwnerDashboard = lazy(() => import('../components/owner/OwnerDashboard'))
const ProfessorDashboard = lazy(() => import('../components/professor/ProfessorDashboard'))
const AlunoDashboard = lazy(() => import('../components/aluno/AlunoDashboard'))

// ── Estado de carregamento compartilhado ────────────────────────────────────

function page(Component: ComponentType) {
  return (
    <Suspense fallback={(
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
      </div>
    )}>
      <Component />
    </Suspense>
  )
}

// ── Mapa de rotas ──────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Rotas públicas de autenticação.
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: page(RoleSelect) },
  { path: '/login/:role', element: page(LoginScreen) },
  { path: '/recuperar-senha/:role', element: page(ForgotPassword) },
  { path: '/primeiro-acesso', element: page(FirstLoginReset) },

  // Painéis protegidos conforme o perfil autenticado.
  {
    element: <ProtectedRoute role="owner" />,
    children: [{ path: '/owner/dashboard', element: page(OwnerDashboard) }],
  },
  {
    element: <ProtectedRoute role="admin" />,
    children: [{ path: '/admin/dashboard', element: page(AdminDashboard) }],
  },
  {
    element: <ProtectedRoute role="professor" />,
    children: [{ path: '/professor/dashboard', element: page(ProfessorDashboard) }],
  },
  {
    element: <ProtectedRoute role="aluno" />,
    children: [{ path: '/aluno/dashboard', element: page(AlunoDashboard) }],
  },
])
