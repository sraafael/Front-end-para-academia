import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'
import { isValidCpf } from '../lib/cpf'

// ── Tipos e identificação do usuário ────────────────────────────────────

export type LoginResult =
  | { ok: true; role: UserRole; userId: string | null; displayName: string; isFirstLogin?: boolean; isOwner: boolean; isPreview: boolean }
  | { ok: false; error: string }

export const OWNER_CPF = '54514214809'

/** Converte CPF e perfil no e-mail interno usado pelo Supabase Auth. */
export function cpfToEmail(role: UserRole, cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits === OWNER_CPF) return 'admin@fitpro.internal'
  if (role === 'admin') {
    return `admin.${digits}@fitpro.internal`
  }
  return `${role}.${digits}@fitpro.internal`
}

// ── Entrada e validação do perfil ────────────────────────────────────────

export async function login(role: UserRole, cpf: string, senha: string): Promise<LoginResult> {
  if (!isValidCpf(cpf)) {
    return { ok: false, error: 'Informe um CPF válido.' }
  }
  if (role === 'owner' && cpf.replace(/\D/g, '') !== OWNER_CPF) {
    return { ok: false, error: 'CPF ou senha incorretos.' }
  }
  const email = cpfToEmail(role, cpf)

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()
  const userRole = (data.user?.app_metadata?.role
    ?? profile?.role
    ?? data.user?.user_metadata?.role) as UserRole | undefined
  let entityId: string | null = null
  let isFirstLogin = false
  let displayName = String(data.user.user_metadata?.nome ?? '').trim()
  const isOwner = data.user.email?.toLowerCase() === 'admin@fitpro.internal'
    || data.user.app_metadata?.is_owner === true
  const isPreview = false

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

  return { ok: true, role, userId: entityId, displayName, isFirstLogin, isOwner, isPreview }
}

export async function lookupCpf(role: UserRole, cpf: string): Promise<boolean> {
  const digits = cpf.replace(/\D/g, '')
  if (!isValidCpf(cpf)) return false
  if (digits === OWNER_CPF) return true
  const table = role === 'owner' || role === 'admin' ? 'academy_admins' : role === 'professor' ? 'professores' : 'alunos'
  const { data } = await supabase.from(table).select('id').eq('cpf', digits).maybeSingle()
  return !!data
}

// ── Primeiro acesso ──────────────────────────────────────────────────────

export async function confirmFirstLogin(role: UserRole, entityId: string, novaSenha: string): Promise<void> {
  // 1. Atualiza a senha no núcleo de autenticação do Supabase
  const { error: passErr } = await supabase.auth.updateUser({ password: novaSenha })
  if (passErr) throw new Error(passErr.message)

  // 2. Descobre qual tabela atualizar
  const table = role === 'owner' || role === 'admin' ? 'academy_admins' : role === 'professor' ? 'professores' : 'alunos'

  // 3. Remove a flag de primeiro acesso da tabela correta
  const { error: rowErr } = await supabase
    .from(table)
    .update({ is_first_login: false })
    .eq('id', entityId)
    
  if (rowErr) throw new Error(rowErr.message)
}
