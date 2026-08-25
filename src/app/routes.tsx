import { createBrowserRouter, Navigate } from 'react-router'

import RoleSelect from '../components/auth/RoleSelect'
import LoginScreen from '../components/auth/LoginScreen'
import ForgotPassword from '../components/auth/ForgotPassword'
import FirstLoginReset from '../components/auth/FirstLoginReset'
import AdminDashboard from '../components/admin/AdminDashboard'
import ProfessorDashboard from '../components/professor/ProfessorDashboard'
import AlunoDashboard from '../components/aluno/AlunoDashboard'
import ProtectedRoute from '../components/shared/ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <RoleSelect /> },
  { path: '/login/:role', element: <LoginScreen /> },
  { path: '/recuperar-senha/:role', element: <ForgotPassword /> },
  { path: '/primeiro-acesso', element: <FirstLoginReset /> },

  {
    element: <ProtectedRoute role="admin" />,
    children: [{ path: '/admin/dashboard', element: <AdminDashboard /> }],
  },
  {
    element: <ProtectedRoute role="professor" />,
    children: [{ path: '/professor/dashboard', element: <ProfessorDashboard /> }],
  },
  {
    element: <ProtectedRoute role="aluno" />,
    children: [{ path: '/aluno/dashboard', element: <AlunoDashboard /> }],
  },
])
