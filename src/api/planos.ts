import { useDataStore } from '../store/dataStore'
import type { Plano } from '../types'

export const planosApi = {
  list: (): Promise<Plano[]> =>
    Promise.resolve(useDataStore.getState().planos),

  create: (data: Omit<Plano, 'id'>): Promise<void> => {
    useDataStore.getState().addPlano(data)
    return Promise.resolve()
  },

  update: (id: string, data: Partial<Plano>): Promise<void> => {
    useDataStore.getState().updatePlano(id, data)
    return Promise.resolve()
  },
}
