import { useDataStore } from '../store/dataStore'
import type { Turma } from '../types'

export const turmasApi = {
  list: (): Promise<Turma[]> =>
    Promise.resolve(useDataStore.getState().turmas),

  create: (data: Omit<Turma, 'id' | 'status'>): Promise<void> => {
    useDataStore.getState().addTurma(data)
    return Promise.resolve()
  },
}
