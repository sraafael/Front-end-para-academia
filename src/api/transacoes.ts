import { useDataStore } from '../store/dataStore'
import type { Transacao } from '../types'

// ── Fachada de acesso às transações ────────────────────────────────────

export const transacoesApi = {
  list: (): Promise<Transacao[]> =>
    Promise.resolve(useDataStore.getState().transacoes),

  create: (data: Omit<Transacao, 'id'>): Promise<void> => {
    return useDataStore.getState().addTransacao(data)
  },
}
