import { useDataStore } from '../store/dataStore'
import type { Transacao } from '../types'

export const transacoesApi = {
  list: (): Promise<Transacao[]> =>
    Promise.resolve(useDataStore.getState().transacoes),

  create: (data: Omit<Transacao, 'id'>): Promise<void> => {
    useDataStore.getState().addTransacao(data)
    return Promise.resolve()
  },
}
