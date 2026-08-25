import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'

export type LoginResult =
  | { ok: true; role: UserRole; userId: string | null; isFirstLogin?: boolean }
  | { ok: false; error: string }

/** Converts CPF (any format) + role into the Supabase auth email */
export function cpfToEmail(role: UserRole, cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (role === 'admin') return 'admin@fitpro.internal'
  return `${role}.${digits}@fitpro.internal`
}

export async function login(role: UserRole, cpf: string, senha: string): Promise<LoginResult> {
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

  const userRole = data.user?.user_metadata?.role as UserRole | undefined
  if (!userRole || userRole !== role) {
    await supabase.auth.signOut()
    return { ok: false, error: 'Perfil de acesso incorreto.' }
  }

  let entityId: string | null = null
  let isFirstLogin = false

  if (role === 'aluno') {
    const { data: row, error: rowErr } = await supabase
      .from('alunos')
      .select('id, is_first_login')
      .eq('user_id', data.user.id)
      .single()
    if (rowErr || !row) {
      await supabase.auth.signOut()
      return { ok: false, error: 'Perfil de aluno não encontrado. Contate a administração.' }
    }
    entityId = row.id
    isFirstLogin = row.is_first_login
  } else if (role === 'professor') {
    const { data: row, error: rowErr } = await supabase
      .from('professores')
      .select('id, is_first_login')
      .eq('user_id', data.user.id)
      .single()
    if (rowErr || !row) {
      await supabase.auth.signOut()
      return { ok: false, error: 'Perfil de professor não encontrado. Contate a administração.' }
    }
    entityId = row.id
    isFirstLogin = row.is_first_login
  }

  return { ok: true, role: userRole, userId: entityId, isFirstLogin }
}

export async function lookupCpf(role: UserRole, cpf: string): Promise<boolean> {
  const digits = cpf.replace(/\D/g, '')
  if (role === 'admin') return digits === '00000000000'
  const table = role === 'professor' ? 'professores' : 'alunos'
  const { data } = await supabase.from(table).select('id').eq('cpf', digits).maybeSingle()
  return !!data
}

export async function confirmFirstLogin(role: UserRole, entityId: string, novaSenha: string): Promise<void> {
  // 1. Atualiza a senha no núcleo de autenticação do Supabase
  const { error: passErr } = await supabase.auth.updateUser({ password: novaSenha })
  if (passErr) throw new Error(passErr.message)

  // 2. Descobre qual tabela atualizar
  const table = role === 'professor' ? 'professores' : 'alunos'

  // 3. Remove a flag de primeiro acesso da tabela correta
  const { error: rowErr } = await supabase
    .from(table)
    .update({ is_first_login: false })
    .eq('id', entityId)
    
  if (rowErr) throw new Error(rowErr.message)
}
