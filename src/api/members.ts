import { invokeProtectedFunction } from './functions'

export type MemberRole = 'aluno' | 'professor'

interface CreateMemberResult {
  record: Record<string, unknown>
  temporaryPassword: string
}

interface ResetAccessResult extends CreateMemberResult {}

// Envia o cadastro para a função protegida do Supabase.
export async function createMemberAccount(
  role: MemberRole,
  profile: Record<string, unknown>,
): Promise<CreateMemberResult> {
  const data = await invokeProtectedFunction<Partial<CreateMemberResult>>('create-member', { role, profile })

  if (!data?.record || typeof data.temporaryPassword !== 'string') {
    throw new Error('O servidor não retornou os dados do novo acesso.')
  }

  return data as CreateMemberResult
}

// A senha é gerada e aplicada somente no servidor.
export async function resetProfessorAccess(professorId: string): Promise<ResetAccessResult> {
  const data = await invokeProtectedFunction<Partial<ResetAccessResult>>('reset-access-password', {
    targetRole: 'professor',
    targetId: professorId,
  })

  if (!data?.record || typeof data.temporaryPassword !== 'string') {
    throw new Error('O servidor não retornou a nova credencial do professor.')
  }

  return data as ResetAccessResult
}
