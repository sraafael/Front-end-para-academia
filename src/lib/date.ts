// Datas no fuso local
export function toLocalDate(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Converte datas `YYYY-MM-DD` sem tratá-las como UTC. */
export function parseLocalDate(value: string): Date {
  const dateOnly = value.slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatLocalDate(value?: string): string {
  if (!value) return '—'
  return parseLocalDate(value).toLocaleDateString('pt-BR')
}

export function subtractLocalDays(days: number, date = new Date()): string {
  const result = new Date(date)
  result.setHours(12, 0, 0, 0)
  result.setDate(result.getDate() - days)
  return toLocalDate(result)
}
