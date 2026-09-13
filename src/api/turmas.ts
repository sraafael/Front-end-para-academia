import { useDataStore } from '../store/dataStore'
import type { Turma } from '../types'

// ── Fachada de acesso às turmas ─────────────────────────────────────────

export const turmasApi = {
  list: (): Promise<Turma[]> =>
    Promise.resolve(useDataStore.getState().turmas),

  create: (data: Omit<Turma, 'id' | 'status'>): Promise<void> => {
    return useDataStore.getState().addTurma(data)
  },
}
