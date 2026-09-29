import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'
import { isValidCpf } from '../lib/cpf'
import { trustedUserRole } from '../lib/authRole'

// Tipos e identificação do usuário
export type LoginResult =
  | { ok: true; role: UserRole; userId: string | null; displayName: string; isFirstLogin?: boolean; isOwner: boolean }
  | { ok: false; error: string }

/** Converte CPF e perfil no e-mail interno usado pelo Supabase Auth. */
function cpfToEmail(role: UserRole, cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (role === 'admin') {
    return `admin.${digits}@fitpro.internal`
  }
  return `${role}.${digits}@fitpro.internal`
}

async function resolveLoginEmail(role: UserRole, cpf: string): Promise<string | null> {
  if (role !== 'owner') return cpfToEmail(role, cpf)

  const { data, error } = await supabase.rpc('resolve_fitpro_owner_login_email', {
    p_cpf: cpf.replace(/\D/g, ''),
  })
  if (error || typeof data !== 'string' || !data) return null
  return data
}

// Entrada e validação do perfil
export async function login(role: UserRole, cpf: string, senha: string): Promise<LoginResult> {
  if (!isValidCpf(cpf)) {
    return { ok: false, error: 'Informe um CPF válido.' }
  }
  const email = await resolveLoginEmail(role, cpf)
  if (!email) return { ok: false, error: 'CPF ou senha incorretos.' }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error) {
    if (error.message.toLowerCase().includes('invalid login')) {
      return { ok: false, error: 'CPF ou senha incorretos.' }
    }
    if (error.status === 400) {
      return { ok: false, error: 'CPF ou senha incorretos.' }
    }
    return { ok: false, error: 'Erro ao conectar com o servidor. Tente novamente.' }
  }

  const userRole = trustedUserRole(data.user.email, data.user.app_metadata)
  let entityId: string | null = null
  let isFirstLogin = false
  let displayName = String(data.user.user_metadata?.nome ?? '').trim()
  const isOwner = userRole === 'owner'

  if (role === 'owner' && !isOwner) {
    await supabase.auth.signOut()
    return { ok: false, error: 'Este acesso é exclusivo do proprietário.' }
  }

  if (role !== 'owner' && isOwner) {
    await supabase.auth.signOut()
    return { ok: false, error: 'Use o perfil Proprietário para entrar com este CPF.' }
  }

  if (role !== 'owner' && userRole !== role) {
    await supabase.auth.signOut()
    return { ok: false, error: 'Perfil de acesso incorreto.' }
  }

  if (role === 'owner' || role === 'admin') {
    const { data: row } = await supabase
      .from('academy_admins')
      .select('id, nome, is_first_login, status')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (row?.status !== 'ativo') {
      await supabase.auth.signOut()
      return { ok: false, error: 'Este acesso administrativo está inativo. Contate o proprietário.' }
    }
    entityId = row?.id ?? null
    isFirstLogin = row?.is_first_login ?? false
    displayName = row?.nome?.trim() || displayName
  } else if (role === 'aluno') {
    const { data: row, error: rowErr } = await supabase
      .from('alunos')
      .select('id, nome, is_first_login')
      .eq('user_id', data.user.id)
      .single()
    if (rowErr || !row) {
      await supabase.auth.signOut()
      return { ok: false, error: 'Perfil de aluno não encontrado. Contate a administração.' }
    }
    entityId = row.id
    isFirstLogin = row.is_first_login
    displayName = row.nome?.trim() || displayName
  } else if (role === 'professor') {
    const { data: row, error: rowErr } = await supabase
      .from('professores')
      .select('id, nome, is_first_login')
      .eq('user_id', data.user.id)
      .single()
    if (rowErr || !row) {
      await supabase.auth.signOut()
      return { ok: false, error: 'Perfil de professor não encontrado. Contate a administração.' }
    }
    entityId = row.id
    isFirstLogin = row.is_first_login
    displayName = row.nome?.trim() || displayName
  }

  return { ok: true, role, userId: entityId, displayName, isFirstLogin, isOwner }
}

// Primeiro acesso
export async function confirmFirstLogin(role: UserRole, entityId: string, novaSenha: string): Promise<void> {
  // 1. Atualiza a senha no núcleo de autenticação do Supabase
  const { error: passErr } = await supabase.auth.updateUser({ password: novaSenha })
  if (passErr) throw new Error(passErr.message)

  // 2. Remove a flag apenas do perfil pertencente a esta sessão. A função
  // protegida evita que as regras de acesso silenciosamente atualizem zero linhas.
  const { error: rowErr } = await supabase.rpc('complete_first_login_profile', {
    p_role: role,
    p_entity_id: entityId,
  })
    
  if (rowErr) throw new Error(rowErr.message)
}
