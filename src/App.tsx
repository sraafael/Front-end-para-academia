import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './app/routes'
import { useAuthStore } from './store/authStore'
import { supabase } from './lib/supabase'
import { projectId, publicAnonKey } from '../utils/supabase/info'

const SETUP_KEY = 'fitpro-setup-v3'
const SETUP_URL = ``

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    // Restore session from Supabase on every page load
    initialize()

    // React to Supabase auth state changes (token expiry, sign-out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') logout()
    })

  // Run DB setup once per browser (creates tables + seeds test users)
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
  }, [initialize, logout])

  return <RouterProvider router={router} />
}
