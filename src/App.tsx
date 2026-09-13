import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './app/routes'
import { useAuthStore } from './store/authStore'
import { supabase } from './lib/supabase'
import { projectId, publicAnonKey } from '../utils/supabase/info'

// ── Configuração da inicialização ──────────────────────────────────────

const SETUP_KEY = 'fitpro-setup-v3'
const SETUP_URL = ``

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const clearSession = useAuthStore((s) => s.clearSession)

  useEffect(() => {
    // ── Sincronização da sessão ────────────────────────────────────────────

    // Restaura a sessão do Supabase ao abrir ou recarregar a aplicação.
    initialize()

    // Reage a expiração de token e logout realizado em outra aba.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearSession()
    })

    // ── Preparação inicial do banco ───────────────────────────────────────

    // Executa o setup apenas uma vez por navegador.
    if (!localStorage.getItem(SETUP_KEY) && SETUP_URL.trim() !== '') {
      fetch(SETUP_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      })
        .then(async (r) => {
          const text = await r.text();
          if (!text) throw new Error("Empty response");
          return JSON.parse(text);
        })
        .then((d) => {
          if (d.ok) {
            localStorage.setItem(SETUP_KEY, '1')
            console.log('[FitPro] Supabase setup complete', d.results)
          } else {
            console.warn('[FitPro] Setup returned error', d)
          }
        })
        .catch((e) => console.warn('[FitPro] Setup call failed or skipped', e))
    }
    
    return () => subscription.unsubscribe()
  }, [initialize, clearSession])

  // ── Navegação principal ────────────────────────────────────────────────

  return <RouterProvider router={router} />
}
