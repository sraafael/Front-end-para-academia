import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'

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
