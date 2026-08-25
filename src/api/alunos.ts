/**
 * Alunos API — localStorage-backed today; swap body for HTTP calls when a backend exists.
 */
import { useDataStore } from '../store/dataStore'
import type { Aluno } from '../types'

type CreatePayload = Omit<Aluno, 'id' | 'historicoPeso' | 'frequencia' | 'treinos' | 'sequencia' | 'metaSemanal' | 'conquistasDesbloqueadas' | 'pagamentoStatus' | 'isFirstLogin'>

export const alunosApi = {
  list: (): Promise<Aluno[]> =>
    Promise.resolve(useDataStore.getState().alunos),

  create: (data: CreatePayload): Promise<Aluno> => {
    const novo = useDataStore.getState().addAluno(data)
    return Promise.resolve(novo)
  },

  update: (id: string, data: Partial<Aluno>): Promise<void> => {
    useDataStore.getState().updateAluno(id, data)
    return Promise.resolve()
  },

  updatePeso: (alunoId: string, novoPeso: number): Promise<void> => {
    useDataStore.getState().updatePeso(alunoId, novoPeso)
    return Promise.resolve()
  },

  checkSerie: (
    alunoId: string,
    treinoId: string,
    exercicioId: string,
    serieNum: number,
    cargaReal: number,
    reps: number
  ): Promise<void> => {
    useDataStore.getState().checkSerie(alunoId, treinoId, exercicioId, serieNum, cargaReal, reps)
    return Promise.resolve()
  },
}
