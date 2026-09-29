import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useDataStore } from './dataStore'
import type { UserRole } from '../types'
import { trustedUserRole } from '../lib/authRole'

// Dados da sessão usados pelos painéis.
interface AuthState {
  role: UserRole | null
  currentAlunoId: string | null
  currentProfessorId: string | null
  currentAdminId: string | null
  displayName: string
  isOwner: boolean
  isAuthenticated: boolean
  pendingFirstLogin: boolean
  hydrating: boolean

  setAuth: (role: UserRole, userId: string | null, isOwner?: boolean, displayName?: string) => void
  setPendingFirstLogin: (value: boolean) => void
  clearSession: () => void
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

const loggedOutState = {
  role: null,
  currentAlunoId: null,
  currentProfessorId: null,
  currentAdminId: null,
  displayName: '',
  isOwner: false,
  isAuthenticated: false,
  pendingFirstLogin: false,
  hydrating: false,
} as const

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...loggedOutState,
  hydrating: true,

  setAuth: (role, userId, isOwner = false, displayName = '') => set({
    role,
    isAuthenticated: true,
    currentAlunoId: role === 'aluno' ? userId : null,
    currentProfessorId: role === 'professor' ? userId : null,
    currentAdminId: role === 'owner' || role === 'admin' ? userId : null,
    displayName: displayName.trim(),
    isOwner,
    pendingFirstLogin: false,
    hydrating: false,
  }),

  setPendingFirstLogin: value => set({ pendingFirstLogin: value }),

  clearSession: () => {
    useDataStore.getState().reset()
    set(loggedOutState)
  },

  logout: async () => {
    get().clearSession()
    await supabase.auth.signOut().catch(() => null)
  },

  initialize: async () => {
    set({ hydrating: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        get().clearSession()
        return
      }

      const role = trustedUserRole(session.user.email, session.user.app_metadata)
      const isOwner = role === 'owner'

      if (!role || !['owner', 'admin', 'professor', 'aluno'].includes(role)) {
        get().clearSession()
        await supabase.auth.signOut().catch(() => null)
        return
      }

      let entityId: string | null = null
      let isFirstLogin = false
      let displayName = String(session.user.user_metadata?.nome ?? '').trim()

      if (role === 'owner' || role === 'admin') {
        const { data } = await supabase
          .from('academy_admins')
          .select('id, nome, is_first_login, status')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (data?.status !== 'ativo') {
          get().clearSession()
          await supabase.auth.signOut().catch(() => null)
          return
        }
        entityId = data.id
        isFirstLogin = data.is_first_login ?? false
        displayName = data.nome?.trim() || displayName
      } else {
        const table = role === 'aluno' ? 'alunos' : 'professores'
        const { data } = await supabase
          .from(table)
          .select('id, nome, is_first_login')
          .eq('user_id', session.user.id)
          .maybeSingle()
        entityId = data?.id ?? null
        isFirstLogin = data?.is_first_login ?? false
        displayName = data?.nome?.trim() || displayName
      }

      if (!entityId) {
        get().clearSession()
        await supabase.auth.signOut().catch(() => null)
        return
      }

      set({
        role,
        isAuthenticated: true,
        currentAlunoId: role === 'aluno' ? entityId : null,
        currentProfessorId: role === 'professor' ? entityId : null,
        currentAdminId: role === 'owner' || role === 'admin' ? entityId : null,
        displayName,
        isOwner,
        pendingFirstLogin: isFirstLogin,
        hydrating: false,
      })
    } catch {
      // Uma sessão não validada nunca libera dados privados.
      get().clearSession()
    }
  },
}))
