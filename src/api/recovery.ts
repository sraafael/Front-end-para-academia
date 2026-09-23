import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'
import { invokeProtectedFunction } from './functions'

export interface RecoveryAcademy { id: string; name: string }
export interface StudentRecoveryRequest {
  id: string
  createdAt: string
  student: { id: string; nome: string; cpf: string; telefone: string } | null
}

export const studentRecoveryApi = {
  async academies(): Promise<RecoveryAcademy[]> {
    const result = await invokeProtectedFunction<{ academies: RecoveryAcademy[] }>('student-recovery', { action: 'academies' })
    return result.academies
  },
  async request(cpf: string, academyId: string): Promise<string> {
    const result = await invokeProtectedFunction<{ message: string }>('student-recovery', {
      action: 'request', cpf: cpf.replace(/\D/g, ''), academyId,
    })
    return result.message
  },
  async pending(): Promise<StudentRecoveryRequest[]> {
    const result = await invokeProtectedFunction<{ requests: StudentRecoveryRequest[] }>('student-recovery', { action: 'list' })
    return result.requests
  },
  handle(requestId: string, decision: 'reset' | 'dismiss') {
    return invokeProtectedFunction<{ record: { nome: string; cpf: string }; temporaryPassword: string | null }>(
      'student-recovery', { action: 'handle', requestId, decision },
    )
  },
}

export async function getRecoveryWhatsapp(role: UserRole, cpf: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_recovery_whatsapp', {
    p_role: role,
    p_cpf: cpf.replace(/\D/g, ''),
  })
  if (error) throw new Error(error.message)
  return String(data ?? '').replace(/\D/g, '')
}

export function buildWhatsappRecoveryUrl(phone: string, message: string): string {
  const localPhone = phone.replace(/\D/g, '')
  const brazilPhone = localPhone && !localPhone.startsWith('55') ? `55${localPhone}` : localPhone
  const target = brazilPhone ? `https://wa.me/${brazilPhone}` : 'https://wa.me/'
  return `${target}?text=${encodeURIComponent(message)}`
}
