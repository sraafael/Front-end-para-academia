import { useDataStore } from '../store/dataStore'
import type { Aluno } from '../types'

// ── Fachada de acesso aos alunos ───────────────────────────────────────

type CreatePayload = Omit<Aluno, 'id' | 'historicoPeso' | 'frequencia' | 'treinos' | 'sequencia' | 'metaSemanal' | 'conquistasDesbloqueadas' | 'pagamentoStatus' | 'isFirstLogin'>

export const alunosApi = {
  list: (): Promise<Aluno[]> =>
    Promise.resolve(useDataStore.getState().alunos),

  create: (data: CreatePayload): Promise<Aluno> => {
    return useDataStore.getState().addAluno(data).then(result => result.record)
  },

  update: (id: string, data: Partial<Aluno>): Promise<void> => {
    return useDataStore.getState().updateAluno(id, data)
  },

  updatePeso: (alunoId: string, novoPeso: number): Promise<void> => {
    return useDataStore.getState().updatePeso(alunoId, novoPeso)
  },

  checkSerie: (
    alunoId: string,
    treinoId: string,
    exercicioId: string,
    serieNum: number,
    cargaReal: number,
    reps: number
  ): Promise<void> => {
    return useDataStore.getState().checkSerie(alunoId, treinoId, exercicioId, serieNum, cargaReal, reps)
  },
}
