export function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "")
}

export function isValidCpfDigits(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false

  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return digit(9) === Number(value[9]) && digit(10) === Number(value[10])
}

export function isValidPhoneDigits(value: string): boolean {
  return /^\d{10,11}$/.test(value)
}
