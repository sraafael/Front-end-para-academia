import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './app/routes'
import { useAuthStore } from './store/authStore'
import { supabase } from './lib/supabase'
import AppErrorBoundary from './components/shared/AppErrorBoundary'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const clearSession = useAuthStore((s) => s.clearSession)

  useEffect(() => {
    // Restaura a sessão ao abrir ou recarregar o sistema.
    initialize()

    // Limpa os dados locais quando a sessão for encerrada.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearSession()
    })

    return () => subscription.unsubscribe()
  }, [initialize, clearSession])

  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  )
}
