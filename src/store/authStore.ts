import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { useDataStore } from './dataStore'
import type { UserRole } from '../types'

// ── Contrato do estado de autenticação ───────────────────────────────────

interface AuthState {
  role: UserRole | null
  currentAlunoId: string | null
  currentProfessorId: string | null
  currentAdminId: string | null
  displayName: string
  isOwner: boolean
  isPreviewMode: boolean
  isAuthenticated: boolean
  pendingFirstLogin: boolean
  // Indica que a sessão do Supabase ainda está sendo verificada.
  hydrating: boolean

  setAuth: (role: UserRole, userId: string | null, isOwner?: boolean, isPreviewMode?: boolean, displayName?: string) => void
  exitPreview: () => void
  setPendingFirstLogin: (v: boolean) => void
  clearSession: () => void
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

// ── Estado sem sessão ativa ───────────────────────────────────────────

const loggedOutState = {
  role: null,
  currentAlunoId: null,
  currentProfessorId: null,
  currentAdminId: null,
  displayName: '',
  isOwner: false,
  isPreviewMode: false,
  isAuthenticated: false,
  pendingFirstLogin: false,
} as const

// ── Store de autenticação ──────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      role: null,
      currentAlunoId: null,
      currentProfessorId: null,
      currentAdminId: null,
      displayName: '',
      isOwner: false,
      isPreviewMode: false,
      isAuthenticated: false,
      pendingFirstLogin: false,
      hydrating: false,

      setAuth: (role, userId, isOwner = false, isPreviewMode = false, displayName = '') =>
        set({
          role,
          isAuthenticated: true,
          currentAlunoId: role === 'aluno' ? userId : null,
          currentProfessorId: role === 'professor' ? userId : null,
          currentAdminId: role === 'owner' || role === 'admin' ? userId : null,
          displayName: displayName.trim(),
          isOwner,
          isPreviewMode,
          pendingFirstLogin: false,
        }),

      exitPreview: () => set({
        role: 'owner',
        currentAlunoId: null,
        currentProfessorId: null,
        currentAdminId: null,
        displayName: 'Proprietário',
        isAuthenticated: true,
        isOwner: true,
        isPreviewMode: false,
        pendingFirstLogin: false,
      }),

      setPendingFirstLogin: (v) => set({ pendingFirstLogin: v }),

      clearSession: () => {
        useDataStore.getState().reset()
        set(loggedOutState)
      },

      logout: async () => {
        // Limpa a interface imediatamente; o listener SIGNED_OUT apenas repete
        // a limpeza local e não chama signOut novamente.
        get().clearSession()
        await supabase.auth.signOut().catch(() => null)
      },

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) return

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle()
          const metadataRole = session.user.app_metadata?.role as UserRole | undefined
          const isOwnerEmail = session.user.email?.toLowerCase() === 'admin@fitpro.internal'
          const isOwner = isOwnerEmail || session.user.app_metadata?.is_owner === true
          const fallbackRole = (profile?.role ?? metadataRole ?? session.user.user_metadata?.role) as UserRole | undefined
          const authenticatedRole: UserRole | undefined = isOwnerEmail
            ? 'owner'
            : metadataRole === 'admin'
              ? 'admin'
              : fallbackRole === 'admin' ? undefined : fallbackRole
          const role = authenticatedRole
          if (!role || !['owner', 'admin', 'professor', 'aluno'].includes(role)) return

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
              set(loggedOutState)
              await supabase.auth.signOut().catch(() => null)
              return
            }
            entityId = data?.id ?? null
            isFirstLogin = data?.is_first_login ?? false
            displayName = data?.nome?.trim() || displayName
          } else if (role === 'aluno') {
            const { data } = await supabase
              .from('alunos')
              .select('id, nome, is_first_login')
              .eq('user_id', session.user.id)
              .maybeSingle()
            entityId = data?.id ?? null
            isFirstLogin = data?.is_first_login ?? false
            displayName = data?.nome?.trim() || displayName
          } else if (role === 'professor') {
            const { data } = await supabase
              .from('professores')
              .select('id, nome, is_first_login')
              .eq('user_id', session.user.id)
              .maybeSingle()
            entityId = data?.id ?? null
            isFirstLogin = data?.is_first_login ?? false
            displayName = data?.nome?.trim() || displayName
          }

          set({
            role,
            isAuthenticated: true,
            currentAlunoId: role === 'aluno' ? entityId : null,
            currentProfessorId: role === 'professor' ? entityId : null,
            currentAdminId: role === 'owner' || role === 'admin' ? entityId : null,
            displayName,
            isOwner,
            isPreviewMode: false,
            pendingFirstLogin: isFirstLogin,
          })
        } catch {
          // Mantém o estado persistido se as tabelas ainda não estiverem prontas.
        }
      },
    }),
    {
      name: 'fitpro-auth',
      // Não persiste hydrating, pois ele representa apenas a execução atual.
      partialize: (s) => ({
        role: s.role,
        currentAlunoId: s.currentAlunoId,
        currentProfessorId: s.currentProfessorId,
        currentAdminId: s.currentAdminId,
        displayName: s.displayName,
        isOwner: s.isOwner,
        isPreviewMode: s.isPreviewMode,
        isAuthenticated: s.isAuthenticated,
        pendingFirstLogin: s.pendingFirstLogin,
      }),
    }
  )
)
