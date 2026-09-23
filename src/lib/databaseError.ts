export type RegistrationEntity = 'aluno' | 'professor' | 'administrador'

// Converte erros técnicos de duplicidade em mensagens úteis para o formulário.
export function registrationErrorMessage(error: unknown, entity: RegistrationEntity): string {
  const original = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error ?? '')
  const message = original.toLowerCase()

  if (message.includes('já existe') || message.includes('ja existe')) return original
  const isDuplicate = message.includes('duplicate key')
    || message.includes('unique constraint')
    || message.includes('23505')
    || /\b[\w]+_(?:key|idx)\b/.test(message)
  if (!isDuplicate) return original || 'Não foi possível concluir o cadastro.'

  if (message.includes('cpf')) return `Já existe um ${entity} cadastrado com este CPF.`
  if (message.includes('telefone') || message.includes('phone')) {
    return `Já existe um ${entity} cadastrado com este telefone.`
  }
  if (message.includes('email') || message.includes('e-mail')) {
    return `Já existe um ${entity} cadastrado com este e-mail.`
  }
  return `Já existe um ${entity} cadastrado com esses dados.`
}
