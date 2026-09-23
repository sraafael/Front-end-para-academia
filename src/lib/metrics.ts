import type { FrequenciaEntry, HistoricoPesoEntry, Turma, TurmaStatus } from '../types'
import { parseLocalDate, toLocalDate } from './date'

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

function normalizeDay(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .slice(0, 3)
    .toLowerCase()
}

export function isClassScheduledOnDate(turma: Pick<Turma, 'diasSemana'>, date = new Date()) {
  const todayKey = DAY_KEYS[date.getDay()]
  return turma.diasSemana.some(day => normalizeDay(day) === todayKey)
}

export function getClassStatusToday(
  turma: Pick<Turma, 'status' | 'horario' | 'duracaoMinutos'>,
  reference = new Date(),
): TurmaStatus {
  if (turma.status === 'cancelada') return 'cancelada'

  const [hours, minutes] = turma.horario.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return turma.status

  const start = new Date(reference)
  start.setHours(hours, minutes, 0, 0)
  const end = new Date(start.getTime() + turma.duracaoMinutos * 60_000)
  if (reference < start) return 'proxima'
  if (reference < end) return 'em_andamento'
  return 'concluida'
}

export function isDateInCurrentMonth(value: string, reference = new Date()) {
  const date = parseLocalDate(value)
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
}

export function countWeeklyAttendance(frequencia: FrequenciaEntry[], reference = new Date()) {
  const monday = new Date(reference)
  monday.setHours(12, 0, 0, 0)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const start = toLocalDate(monday)
  const end = toLocalDate(sunday)

  return new Set(
    frequencia
      .filter(entry => entry.presente && entry.data >= start && entry.data <= end)
      .map(entry => entry.data),
  ).size
}

export function calculateAttendanceStreak(frequencia: FrequenciaEntry[], reference = new Date()) {
  const presentDays = new Set(
    frequencia.filter(entry => entry.presente).map(entry => entry.data),
  )
  const cursor = new Date(reference)
  cursor.setHours(12, 0, 0, 0)

  if (!presentDays.has(toLocalDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (presentDays.has(toLocalDate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function deriveAchievementIds({
  frequencia,
  historicoPeso,
  matriculaData,
  weeklyGoal,
}: {
  frequencia: FrequenciaEntry[]
  historicoPeso: HistoricoPesoEntry[]
  matriculaData: string
  weeklyGoal: number
}) {
  const ids: string[] = []
  const totalTreinos = new Set(
    frequencia.filter(entry => entry.presente).map(entry => entry.data),
  ).size
  const streak = calculateAttendanceStreak(frequencia)
  const weeklyAttendance = countWeeklyAttendance(frequencia)

  if (totalTreinos >= 1) ids.push('primeiro_treino')
  if (streak >= 7) ids.push('seq_7')
  if (streak >= 30) ids.push('seq_30')
  if (totalTreinos >= 50) ids.push('treinos_50')
  if (totalTreinos >= 100) ids.push('treinos_100')
  if (weeklyAttendance >= weeklyGoal) ids.push('meta_4x')

  if (historicoPeso.length > 1) {
    const firstWeight = historicoPeso[0].peso
    const currentWeight = historicoPeso[historicoPeso.length - 1].peso
    if (firstWeight - currentWeight >= 5) ids.push('peso_5kg')
  }

  const enrollment = parseLocalDate(matriculaData)
  const months = (new Date().getFullYear() - enrollment.getFullYear()) * 12
    + new Date().getMonth() - enrollment.getMonth()
  if (months >= 3) ids.push('meses_3')
  if (months >= 6) ids.push('meses_6')
  if (months >= 12) ids.push('meses_12')

  return ids
}

export function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const remaining = safeMinutes % 60
  if (hours === 0) return `${remaining}min`
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`
}
