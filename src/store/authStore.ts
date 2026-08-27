import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { useDataStore } from './dataStore'
import type { UserRole } from '../types'

interface AuthState {
  role: UserRole | null
  currentAlunoId: string | null
  currentProfessorId: string | null
  isAuthenticated: boolean
  pendingFirstLogin: boolean
  // hydrating is true while we verify the Supabase session on startup
  hydrating: boolean

  setAuth: (role: UserRole, userId: string | null) => void
  setPendingFirstLogin: (v: boolean) => void
  clearSession: () => void
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

const loggedOutState = {
  role: null,
  currentAlunoId: null,
  currentProfessorId: null,
  isAuthenticated: false,
  pendingFirstLogin: false,
} as const

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      role: null,
      currentAlunoId: null,
      currentProfessorId: null,
      isAuthenticated: false,
      pendingFirstLogin: false,
      hydrating: false,

      setAuth: (role, userId) =>
        set({
          role,
          isAuthenticated: true,
          currentAlunoId: role === 'aluno' ? userId : null,
          currentProfessorId: role === 'professor' ? userId : null,
          pendingFirstLogin: false,
        }),

      setPendingFirstLogin: (v) => set({ pendingFirstLogin: v }),

      clearSession: () => {
        useDataStore.getState().reset()
        set(loggedOutState)
      },

      logout: async () => {
        // Clear the UI immediately. The SIGNED_OUT listener only repeats this
        // local cleanup and never calls signOut again.
        get().clearSession()
        await supabase.auth.signOut().catch(() => null)
      },

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) return

          const role = session.user.user_metadata?.role as UserRole | undefined
          if (!role || !['admin', 'professor', 'aluno'].includes(role)) return

          let entityId: string | null = null
          let isFirstLogin = false

          if (role === 'aluno') {
            const { data } = await supabase
              .from('alunos')
              .select('id, is_first_login')
              .eq('user_id', session.user.id)
              .maybeSingle()
            entityId = data?.id ?? null
            isFirstLogin = data?.is_first_login ?? false
          } else if (role === 'professor') {
            const { data } = await supabase
              .from('professores')
              .select('id, is_first_login')
              .eq('user_id', session.user.id)
              .maybeSingle()
            entityId = data?.id ?? null
            isFirstLogin = data?.is_first_login ?? false
          }

          set({
            role,
            isAuthenticated: true,
            currentAlunoId: role === 'aluno' ? entityId : null,
            currentProfessorId: role === 'professor' ? entityId : null,
            pendingFirstLogin: isFirstLogin,
          })
        } catch {
          // If DB query fails (tables not yet set up), keep existing persisted state
        }
      },
    }),
    {
      name: 'fitpro-auth',
      // Don't persist hydrating — it's always a runtime value
      partialize: (s) => ({
        role: s.role,
        currentAlunoId: s.currentAlunoId,
        currentProfessorId: s.currentProfessorId,
        isAuthenticated: s.isAuthenticated,
        pendingFirstLogin: s.pendingFirstLogin,
      }),
    }
  )
)
