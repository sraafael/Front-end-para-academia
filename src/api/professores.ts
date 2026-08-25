import { useDataStore } from '../store/dataStore'
import type { Professor } from '../types'

export const professoresApi = {
  list: (): Promise<Professor[]> =>
    Promise.resolve(useDataStore.getState().professores),

  create: (data: Omit<Professor, 'id'>): Promise<void> => {
    useDataStore.getState().addProfessor(data)
    return Promise.resolve()
  },

  update: (id: string, data: Partial<Professor>): Promise<void> => {
    useDataStore.getState().updateProfessor(id, data)
    return Promise.resolve()
  },
}
