import { useDataStore } from '../store/dataStore'
import type { Professor } from '../types'

// ── Fachada de acesso aos professores ────────────────────────────────────

export const professoresApi = {
  list: (): Promise<Professor[]> =>
    Promise.resolve(useDataStore.getState().professores),

  create: (data: Omit<Professor, 'id'>): Promise<void> => {
    return useDataStore.getState().addProfessor(data).then(() => undefined)
  },

  update: (id: string, data: Partial<Professor>): Promise<void> => {
    return useDataStore.getState().updateProfessor(id, data)
  },
}
