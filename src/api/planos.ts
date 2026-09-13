import { useDataStore } from '../store/dataStore'
import type { Plano } from '../types'

// ── Fachada de acesso aos planos ────────────────────────────────────────

export const planosApi = {
  list: (): Promise<Plano[]> =>
    Promise.resolve(useDataStore.getState().planos),

  create: (data: Omit<Plano, 'id'>): Promise<void> => {
    return useDataStore.getState().addPlano(data)
  },

  update: (id: string, data: Partial<Plano>): Promise<void> => {
    return useDataStore.getState().updatePlano(id, data)
  },
}
