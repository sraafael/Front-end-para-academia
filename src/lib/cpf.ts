// Normalização, máscara visual e validação dos dígitos verificadores do CPF.
export function onlyCpfDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatCpf(value: string): string {
  const digits = onlyCpfDigits(value)
  return digits
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    .replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/(\d{3})(\d{3})/, '$1.$2')
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false

  const calculateDigit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calculateDigit(9) === Number(digits[9])
    && calculateDigit(10) === Number(digits[10])
}
