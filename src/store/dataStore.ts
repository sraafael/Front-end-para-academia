import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js' 
import { projectId, publicAnonKey } from '../../utils/supabase/info'
import { toLocalDate } from '../lib/date'
import { isValidCpf, onlyCpfDigits } from '../lib/cpf'
import type {
  Aluno, Professor, Turma, Plano, Transacao,
  AlunoStatus, PagamentoStatus, TreinoFicha, TreinoFichaInput, HistoricoPesoEntry, FrequenciaEntry,
} from '../types'

// DB row → frontend type mappers
function mapPlano(r: Record<string, unknown>): Plano {
  return {
    id:          r.id as string,
    nome:        r.nome as string,
    preco:       Number(r.preco),
    duracao:     r.duracao as string,
    modalidades: (r.modalidades as string[]) ?? [],
    beneficios:  (r.beneficios as string[]) ?? [],
    ativo:       r.ativo as boolean,
  }
}

function mapProfessor(r: Record<string, unknown>): Professor {
  return {
    id:           r.id as string,
    nome:         r.nome as string,
    cpf:          r.cpf as string,
    senha:        '',
    telefone:     r.telefone as string,
    email:        r.email as string,
    horario:      r.horario as string,
    salario:      Number(r.salario),
    especialidade:r.especialidade as string,
    status:       r.status as Professor['status'],
    feriasInicio: (r.ferias_inicio as string) ?? undefined,
    feriasFim:    (r.ferias_fim as string) ?? undefined,
  }
}

function mapAluno(
  r: Record<string, unknown>,
  historicoPeso: HistoricoPesoEntry[] = [],
  frequencia: FrequenciaEntry[] = [],
  treinos: TreinoFicha[] = [],
): Aluno {
  return {
    id:                      r.id as string,
    nome:                    r.nome as string,
    cpf:                     r.cpf as string,
    senha:                   '',
    telefone:                r.telefone as string,
    email:                   r.email as string,
    idade:                   Number(r.idade),
    peso:                    Number(r.peso),
    planoId:                 (r.plano_id as string) ?? '',
    professorId:             (r.professor_id as string) ?? undefined,
    status:                  r.status as AlunoStatus,
    turmaId:                 (r.turma_id as string) ?? undefined,
    matriculaData:           r.matricula_data as string,
    isFirstLogin:            r.is_first_login as boolean,
    formaPagamento:          r.forma_pagamento as string,
    pagamentoStatus:         r.pagamento_status as PagamentoStatus,
    vencimento:              (r.vencimento as string) ?? undefined,
    sequencia:               Number(r.sequencia),
    metaSemanal:             { meta: Number(r.meta_semanal), concluidos: 0 },
    conquistasDesbloqueadas: (r.conquistas_desbloqueadas as string[]) ?? [],
    historicoPeso,
    frequencia,
    treinos,
  }
}

function mapTreino(r: Record<string, unknown>): TreinoFicha {
  return {
    id:        r.id as string,
    nome:      r.nome as string,
    grupo:     r.grupo as string,
    createdAt: (r.created_at as string) ?? undefined,
    updatedAt: (r.updated_at as string) ?? (r.created_at as string) ?? undefined,
    exercicios: ((r.exercicios as Record<string, unknown>[]) ?? []).map(ex => {
      const totalSeries = Number(ex.series)
      const realizadas = ((ex.series_realizadas as Record<string, unknown>[]) ?? []).map(sr => ({
        serieNum:   Number(sr.serie_num),
        cargaReal:  Number(sr.carga_real),
        repeticoes: Number(sr.repeticoes),
        concluida:  Boolean(sr.concluida),
      }))

      return {
        id:            ex.id as string,
        nome:          ex.nome as string,
        series:        totalSeries,
        reps:          Number(ex.reps),
        cargaSugerida: Number(ex.carga_sugerida),
        seriesRealizadas: Array.from({ length: totalSeries }, (_, index) => {
          const serieNum = index + 1
          return realizadas.find(sr => sr.serieNum === serieNum) ?? {
            serieNum,
            cargaReal: Number(ex.carga_sugerida),
            repeticoes: Number(ex.reps),
            concluida: false,
          }
        }),
      }
    }),
  }
}

function mapTurma(r: Record<string, unknown>): Turma {
  return {
    id:          r.id as string,
    nome:        r.nome as string,
    modalidade:  r.modalidade as string,
    horario:     r.horario as string,
    diasSemana:  (r.dias_semana as string[]) ?? [],
    capacidade:  Number(r.capacidade),
    professorId: (r.professor_id as string) ?? '',
    sala:        r.sala as string,
    alunoIds:    (r.aluno_ids as string[]) ?? [],
    status:      r.status as Turma['status'],
    createdAt:   (r.created_at as string) ?? undefined,
  }
}

function mapTransacao(r: Record<string, unknown>): Transacao {
  return {
    id:        r.id as string,
    tipo:      r.tipo as Transacao['tipo'],
    categoria: r.categoria as string,
    descricao: r.descricao as string,
    valor:     Number(r.valor),
    data:      r.data as string,
    status:    (r.status as PagamentoStatus) ?? undefined,
    alunoId:   (r.aluno_id as string) ?? undefined,
  }
}

// Store
type CreateAlunoPayload = Omit<Aluno, 'id' | 'historicoPeso' | 'frequencia' | 'treinos' | 'sequencia' | 'metaSemanal' | 'conquistasDesbloqueadas' | 'pagamentoStatus' | 'isFirstLogin' | 'senha'>
type CreatedAccount<T> = { record: T; temporaryPassword: string }

function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

interface DataState {
  alunos: Aluno[]
  professores: Professor[]
  turmas: Turma[]
  planos: Plano[]
  transacoes: Transacao[]
  loading: boolean
  error: string | null

  reset: () => void
  loadAll: () => Promise<void>
  loadAluno: (alunoId: string) => Promise<void>
  loadProfessorDashboard: (professorId: string) => Promise<void>

  addAluno: (data: CreateAlunoPayload) => Promise<CreatedAccount<Aluno>>
  updateAluno: (id: string, data: Partial<Aluno>) => Promise<void>
  updatePeso: (alunoId: string, novoPeso: number) => Promise<void>
  checkSerie: (alunoId: string, treinoId: string, exercicioId: string, serieNum: number, cargaReal: number, reps: number) => Promise<void>
  saveAttendance: (turmaId: string, presencas: Record<string, boolean>, data?: string) => Promise<void>
  saveTreino: (alunoId: string, treinoId: string | null, ficha: TreinoFichaInput) => Promise<void>

  addProfessor: (data: Omit<Professor, 'id' | 'senha'>) => Promise<CreatedAccount<Professor>>
  updateProfessor: (id: string, data: Partial<Professor>) => Promise<void>
  resetProfessorPassword: (id: string) => Promise<CreatedAccount<Professor>>

  addTurma: (data: Omit<Turma, 'id' | 'status'>) => Promise<void>

  addPlano: (data: Omit<Plano, 'id'>) => Promise<void>
  updatePlano: (id: string, data: Partial<Plano>) => Promise<void>

  addTransacao: (data: Omit<Transacao, 'id'>) => Promise<void>
  
}

const emptyData = () => ({
  alunos: [] as Aluno[],
  professores: [] as Professor[],
  turmas: [] as Turma[],
  planos: [] as Plano[],
  transacoes: [] as Transacao[],
  loading: false,
  error: null,
})

// Controle de carregamentos concorrentes
let dataGeneration = 0
const activeLoadControllers = new Set<AbortController>()
let activeLoadAll: { generation: number; promise: Promise<void> } | null = null
const activeAlunoLoads = new Map<string, { generation: number; promise: Promise<void> }>()
const activeProfessorLoads = new Map<string, { generation: number; promise: Promise<void> }>()

// Estado e operações de dados
export const useDataStore = create<DataState>()((set, get) => ({
  ...emptyData(),

  // Libera dados privados e impede respostas pendentes de repovoarem a store
  // depois que o usuário encerrou a sessão.
  reset: () => {
    dataGeneration += 1
    activeLoadControllers.forEach(controller => controller.abort())
    activeLoadControllers.clear()
    activeLoadAll = null
    activeAlunoLoads.clear()
    activeProfessorLoads.clear()
    set(emptyData())
  },

  // Dados dos painéis do administrador e do professor.
  loadAll: () => {
    if (activeLoadAll?.generation === dataGeneration) {
      return activeLoadAll.promise
    }

    const generation = dataGeneration
    const controller = new AbortController()
    activeLoadControllers.add(controller)
    set({ loading: true, error: null })

    const promise = Promise.all([
      supabase.from('alunos').select('*').order('nome').abortSignal(controller.signal),
      supabase.from('professores').select('*').order('nome').abortSignal(controller.signal),
      supabase.from('turmas').select('*').order('nome').abortSignal(controller.signal),
      supabase.from('planos').select('*').order('nome').abortSignal(controller.signal),
      supabase.from('transacoes').select('*').order('data', { ascending: false }).abortSignal(controller.signal),
      supabase.from('frequencia').select('*').order('data').abortSignal(controller.signal),
    ])
      .then(([alunosRes, professoresRes, turmasRes, planosRes, transacoesRes, frequenciaRes]) => {
        if (controller.signal.aborted || generation !== dataGeneration) return

        const failures = [
          ['alunos', alunosRes.error],
          ['professores', professoresRes.error],
          ['turmas', turmasRes.error],
          ['planos', planosRes.error],
          ['transações', transacoesRes.error],
          ['frequências', frequenciaRes.error],
        ].filter((entry): entry is [string, NonNullable<typeof alunosRes.error>] => entry[1] !== null)

        if (failures.length > 0) {
          const resources = failures.map(([resource]) => resource).join(', ')
          throw new Error(`Não foi possível carregar ${resources}: ${failures[0][1].message}`)
        }

        const frequenciasPorAluno = new Map<string, FrequenciaEntry[]>()
        ;(frequenciaRes.data ?? []).forEach(row => {
          const alunoId = row.aluno_id as string
          const entries = frequenciasPorAluno.get(alunoId) ?? []
          entries.push({ data: row.data as string, presente: Boolean(row.presente) })
          frequenciasPorAluno.set(alunoId, entries)
        })

        set({
          loading: false,
          error: null,
          alunos:      (alunosRes.data ?? []).map(r => mapAluno(
            r as Record<string, unknown>,
            [],
            frequenciasPorAluno.get(r.id as string) ?? [],
          )),
          professores: (professoresRes.data ?? []).map(r => mapProfessor(r as Record<string, unknown>)),
          turmas:      (turmasRes.data ?? []).map(r => mapTurma(r as Record<string, unknown>)),
          planos:      (planosRes.data ?? []).map(r => mapPlano(r as Record<string, unknown>)),
          transacoes:  (transacoesRes.data ?? []).map(r => mapTransacao(r as Record<string, unknown>)),
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generation === dataGeneration) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Não foi possível carregar os dados.',
          })
        }
      })
      .finally(() => {
        activeLoadControllers.delete(controller)
        if (activeLoadAll?.promise === promise) activeLoadAll = null
      })

    activeLoadAll = { generation, promise }
    return promise
  },

  // Perfil completo usado no painel do aluno.
  loadAluno: (alunoId) => {
    const activeLoad = activeAlunoLoads.get(alunoId)
    if (activeLoad?.generation === dataGeneration) return activeLoad.promise

    const generation = dataGeneration
    const controller = new AbortController()
    activeLoadControllers.add(controller)
    set({ loading: true, error: null })

    const promise = Promise.all([
      supabase.from('alunos').select('*').eq('id', alunoId).abortSignal(controller.signal).single(),
      supabase.from('historico_peso').select('*').eq('aluno_id', alunoId).order('data').abortSignal(controller.signal),
      supabase.from('frequencia').select('*').eq('aluno_id', alunoId).order('data').abortSignal(controller.signal),
      supabase.from('treinos').select('*, exercicios(*, series_realizadas(*))').eq('aluno_id', alunoId).abortSignal(controller.signal),
      supabase.from('planos').select('*').order('nome').abortSignal(controller.signal),
    ])
      .then(([alunoRes, pesoRes, freqRes, treinosRes, planosRes]) => {
        if (controller.signal.aborted || generation !== dataGeneration) return
        if (!alunoRes.data) {
          set({ loading: false, error: alunoRes.error?.message ?? 'Perfil de aluno não encontrado.' })
          return
        }

        const relatedError = pesoRes.error ?? freqRes.error ?? treinosRes.error ?? planosRes.error
        if (relatedError) {
          throw new Error(relatedError.message)
        }

        const historicoPeso: HistoricoPesoEntry[] = (pesoRes.data ?? []).map((p: Record<string, unknown>) => ({
          data: p.data as string,
          peso: Number(p.peso),
        }))
        const frequencia: FrequenciaEntry[] = (freqRes.data ?? []).map((f: Record<string, unknown>) => ({
          data: f.data as string,
          presente: f.presente as boolean,
        }))
        const treinos: TreinoFicha[] = (treinosRes.data ?? []).map((t: Record<string, unknown>) => mapTreino(t))

        const aluno = mapAluno(alunoRes.data as Record<string, unknown>, historicoPeso, frequencia, treinos)
        set(s => ({
          loading: false,
          error: null,
          alunos: s.alunos.some(a => a.id === alunoId)
            ? s.alunos.map(a => a.id === alunoId ? aluno : a)
            : [...s.alunos, aluno],
          planos: (planosRes.data ?? []).map(row => mapPlano(row as Record<string, unknown>)),
        }))
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generation === dataGeneration) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Não foi possível carregar o perfil do aluno.',
          })
        }
      })
      .finally(() => {
        activeLoadControllers.delete(controller)
        if (activeAlunoLoads.get(alunoId)?.promise === promise) {
          activeAlunoLoads.delete(alunoId)
        }
      })

    activeAlunoLoads.set(alunoId, { generation, promise })
    return promise
  },

  // Carrega somente os registros necessários ao profissional, evitando dados
  // financeiros/administrativos e consumo desnecessário de memória.
  loadProfessorDashboard: (professorId) => {
    const activeLoad = activeProfessorLoads.get(professorId)
    if (activeLoad?.generation === dataGeneration) return activeLoad.promise

    const generation = dataGeneration
    const controller = new AbortController()
    activeLoadControllers.add(controller)
    set({ loading: true, error: null })

    const promise = Promise.all([
      supabase.from('professores').select('*').eq('id', professorId).abortSignal(controller.signal).single(),
      supabase.from('alunos').select('*').eq('professor_id', professorId).order('nome').abortSignal(controller.signal),
      supabase.from('turmas').select('*').eq('professor_id', professorId).order('horario').abortSignal(controller.signal),
    ])
      .then(async ([professorRes, alunosRes, turmasRes]) => {
        if (controller.signal.aborted || generation !== dataGeneration) return

        const firstError = professorRes.error ?? alunosRes.error ?? turmasRes.error
        if (firstError) throw new Error(firstError.message)

        const alunoRows = (alunosRes.data ?? []) as Record<string, unknown>[]
        const alunoIds = alunoRows.map(row => row.id as string)
        let frequenciaRows: Record<string, unknown>[] = []
        let treinoRows: Record<string, unknown>[] = []

        if (alunoIds.length > 0) {
          const [frequenciaRes, treinosRes] = await Promise.all([
            supabase.from('frequencia').select('*').in('aluno_id', alunoIds).order('data').abortSignal(controller.signal),
            supabase.from('treinos').select('*, exercicios(*, series_realizadas(*))').in('aluno_id', alunoIds).abortSignal(controller.signal),
          ])
          const relatedError = frequenciaRes.error ?? treinosRes.error
          if (relatedError) throw new Error(relatedError.message)
          frequenciaRows = (frequenciaRes.data ?? []) as Record<string, unknown>[]
          treinoRows = (treinosRes.data ?? []) as Record<string, unknown>[]
        }

        if (controller.signal.aborted || generation !== dataGeneration) return

        const frequenciasPorAluno = new Map<string, FrequenciaEntry[]>()
        frequenciaRows.forEach(row => {
          const alunoId = row.aluno_id as string
          const entries = frequenciasPorAluno.get(alunoId) ?? []
          entries.push({ data: row.data as string, presente: Boolean(row.presente) })
          frequenciasPorAluno.set(alunoId, entries)
        })

        const treinosPorAluno = new Map<string, TreinoFicha[]>()
        treinoRows.forEach(row => {
          const alunoId = row.aluno_id as string
          const entries = treinosPorAluno.get(alunoId) ?? []
          entries.push(mapTreino(row))
          treinosPorAluno.set(alunoId, entries)
        })

        set({
          loading: false,
          error: null,
          professores: professorRes.data ? [mapProfessor(professorRes.data as Record<string, unknown>)] : [],
          turmas: (turmasRes.data ?? []).map(row => mapTurma(row as Record<string, unknown>)),
          alunos: alunoRows.map(row => {
            const alunoId = row.id as string
            return mapAluno(row, [], frequenciasPorAluno.get(alunoId) ?? [], treinosPorAluno.get(alunoId) ?? [])
          }),
          planos: [],
          transacoes: [],
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generation === dataGeneration) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Não foi possível carregar a área do professor.',
          })
        }
      })
      .finally(() => {
        activeLoadControllers.delete(controller)
        if (activeProfessorLoads.get(professorId)?.promise === promise) {
          activeProfessorLoads.delete(professorId)
        }
      })

    activeProfessorLoads.set(professorId, { generation, promise })
    return promise
  },

  // Mutations
  addAluno: async (data) => {
    const hoje = toLocalDate()
    if (!isValidCpf(data.cpf)) throw new Error('Informe um CPF válido.')
    const cpfLimpo = onlyCpfDigits(data.cpf)
    const emailInterno = `aluno.${cpfLimpo}@fitpro.internal`
    const temporaryPassword = generateTemporaryPassword()

    // 1. Instancia um Cliente Fantasma que NÃO afeta a sessão do Administrador
    const tempClient = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // 2. Usa a API oficial para criar o usuário perfeitamente
    const { data: authRes, error: authErr } = await tempClient.auth.signUp({
      email: emailInterno,
      password: temporaryPassword,
      options: { data: { role: 'aluno' } }
    })

    if (authErr) throw new Error(`Erro ao criar acesso: ${authErr.message}`)
    if (!authRes.user) throw new Error('Falha ao gerar ID do usuário no sistema.')

    const userId = authRes.user.id

    // 3. Cria o perfil na tabela pública
    const row = {
      id: userId,
      user_id: userId,
      nome: data.nome,
      cpf: cpfLimpo,
      telefone: data.telefone,
      email: data.email,
      idade: data.idade,
      peso: data.peso,
      plano_id: data.planoId || null,
      professor_id: data.professorId || null,
      status: data.status,
      turma_id: data.turmaId ?? null,
      matricula_data: data.matriculaData || hoje,
      is_first_login: true,
      forma_pagamento: data.formaPagamento,
      pagamento_status: 'pendente',
      vencimento: data.vencimento ?? null,
    }
    
    const { data: inserted, error } = await supabase.from('alunos').insert(row).select().single()
    if (error) throw new Error(`Erro ao salvar perfil: ${error.message}`)

    if (data.turmaId) {
      const { error: turmaError } = await supabase.rpc('vincular_aluno_turma', {
        p_aluno_id: userId,
        p_turma_id: data.turmaId,
      })
      if (turmaError) throw new Error(`Aluno criado, mas não foi possível vinculá-lo à turma: ${turmaError.message}`)
    }
    
    const novo = mapAluno(inserted as Record<string, unknown>)
    set(s => ({
      alunos: [...s.alunos, novo],
      turmas: data.turmaId ? s.turmas.map(turma => turma.id === data.turmaId
        ? { ...turma, alunoIds: Array.from(new Set([...turma.alunoIds, novo.id])) }
        : turma) : s.turmas,
    }))
    
    if (data.peso > 0) {
      const { error: pesoError } = await supabase.rpc('registrar_peso', {
        p_aluno_id: novo.id,
        p_peso: data.peso,
        p_data: hoje,
      })
      if (pesoError) throw new Error(`Aluno criado, mas não foi possível registrar o peso inicial: ${pesoError.message}`)
    }
    return { record: novo, temporaryPassword }
  },

  updateAluno: async (id, data) => {
    const updates: Record<string, unknown> = {}
    if (data.turmaId !== undefined) {
      const { error: turmaError } = await supabase.rpc('vincular_aluno_turma', {
        p_aluno_id: id,
        p_turma_id: data.turmaId || null,
      })
      if (turmaError) throw new Error(`Não foi possível alterar a turma: ${turmaError.message}`)
    }
    if (data.nome !== undefined)            updates.nome             = data.nome
    if (data.telefone !== undefined)        updates.telefone         = data.telefone
    if (data.email !== undefined)           updates.email            = data.email
    if (data.idade !== undefined)           updates.idade            = data.idade
    if (data.peso !== undefined)            updates.peso             = data.peso
    if (data.planoId !== undefined)         updates.plano_id         = data.planoId || null
    if (data.professorId !== undefined)     updates.professor_id     = data.professorId || null
    if (data.status !== undefined)          updates.status           = data.status
    if (data.isFirstLogin !== undefined)    updates.is_first_login   = data.isFirstLogin
    if (data.formaPagamento !== undefined)  updates.forma_pagamento  = data.formaPagamento
    if (data.pagamentoStatus !== undefined) updates.pagamento_status = data.pagamentoStatus
    if (data.vencimento !== undefined)      updates.vencimento       = data.vencimento ?? null
    if (data.sequencia !== undefined)       updates.sequencia        = data.sequencia
    if (data.conquistasDesbloqueadas !== undefined) updates.conquistas_desbloqueadas = data.conquistasDesbloqueadas
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('alunos').update(updates).eq('id', id)
      if (error) throw new Error(error.message)
    }
    set(s => ({
      alunos: s.alunos.map(a => a.id === id ? {
        ...a,
        ...data,
        ...(data.turmaId !== undefined ? { turmaId: data.turmaId || undefined } : {}),
      } : a),
      turmas: data.turmaId === undefined ? s.turmas : s.turmas.map(turma => ({
        ...turma,
        alunoIds: turma.id === data.turmaId
          ? Array.from(new Set([...turma.alunoIds, id]))
          : turma.alunoIds.filter(alunoId => alunoId !== id),
      })),
    }))
  },

  updatePeso: async (alunoId, novoPeso) => {
    const hoje = toLocalDate()
    const { error } = await supabase.rpc('registrar_peso', {
      p_aluno_id: alunoId,
      p_peso: novoPeso,
      p_data: hoje,
    })
    if (error) throw new Error(`Não foi possível registrar o peso: ${error.message}`)
    set(s => ({
      alunos: s.alunos.map(a =>
        a.id === alunoId
          ? { ...a, peso: novoPeso, historicoPeso: [...a.historicoPeso, { data: hoje, peso: novoPeso }] }
          : a
      ),
    }))
  },

  checkSerie: async (alunoId, treinoId, exercicioId, serieNum, cargaReal, reps) => {
    const estadoAnterior = get().alunos
    set(s => ({
      alunos: s.alunos.map(a => {
        if (a.id !== alunoId) return a
        return {
          ...a,
          treinos: a.treinos.map(t => {
            if (t.id !== treinoId) return t
            return {
              ...t,
              exercicios: t.exercicios.map(ex => {
                if (ex.id !== exercicioId) return ex
                return {
                  ...ex,
                  seriesRealizadas: ex.seriesRealizadas.map(sr =>
                    sr.serieNum === serieNum
                      ? { ...sr, cargaReal, repeticoes: reps, concluida: !sr.concluida }
                      : sr
                  ),
                }
              }),
            }
          }),
        }
      }),
    }))
    const toggledSerie = get().alunos
      .find(a => a.id === alunoId)?.treinos
      .find(t => t.id === treinoId)?.exercicios
      .find(ex => ex.id === exercicioId)?.seriesRealizadas
      .find(sr => sr.serieNum === serieNum)
    const { error } = await supabase.from('series_realizadas').upsert({
      exercicio_id: exercicioId,
      serie_num:    serieNum,
      carga_real:   cargaReal,
      repeticoes:   reps,
      concluida:    toggledSerie?.concluida ?? false,
    }, { onConflict: 'exercicio_id,serie_num' })

    if (error) {
      set({ alunos: estadoAnterior })
      throw new Error(`Não foi possível salvar a série: ${error.message}`)
    }
  },

  saveAttendance: async (_turmaId, presencas, data) => {
    const dataChamada = data ?? toLocalDate()
    const rows = Object.entries(presencas).map(([alunoId, presente]) => ({
      aluno_id: alunoId,
      data: dataChamada,
      presente,
    }))
    if (rows.length === 0) return

    const { error } = await supabase
      .from('frequencia')
      .upsert(rows, { onConflict: 'aluno_id,data' })
    if (error) throw new Error(`Não foi possível salvar a chamada: ${error.message}`)

    set(s => ({
      alunos: s.alunos.map(aluno => {
        if (!(aluno.id in presencas)) return aluno
        const entry = { data: dataChamada, presente: presencas[aluno.id] }
        const jaExiste = aluno.frequencia.some(item => item.data === dataChamada)
        return {
          ...aluno,
          frequencia: jaExiste
            ? aluno.frequencia.map(item => item.data === dataChamada ? entry : item)
            : [...aluno.frequencia, entry],
        }
      }),
    }))
  },

  saveTreino: async (alunoId, treinoId, ficha) => {
    const { data: savedId, error: saveError } = await supabase.rpc('salvar_ficha_treino', {
      p_treino_id: treinoId,
      p_aluno_id: alunoId,
      p_nome: ficha.nome,
      p_grupo: ficha.grupo,
      p_exercicios: ficha.exercicios.map(exercicio => ({
        id: exercicio.id ?? null,
        nome: exercicio.nome,
        series: exercicio.series,
        reps: exercicio.reps,
        carga_sugerida: exercicio.cargaSugerida,
      })),
    })
    if (saveError) throw new Error(`Não foi possível salvar a ficha: ${saveError.message}`)

    const id = String(savedId)
    const { data: treinoRow, error: loadError } = await supabase
      .from('treinos')
      .select('*, exercicios(*, series_realizadas(*))')
      .eq('id', id)
      .single()
    if (loadError || !treinoRow) {
      throw new Error(`Ficha salva, mas não foi possível atualizá-la na tela: ${loadError?.message ?? 'registro não encontrado'}`)
    }

    const treino = mapTreino(treinoRow as Record<string, unknown>)
    set(s => ({
      alunos: s.alunos.map(aluno => {
        if (aluno.id !== alunoId) return aluno
        const jaExiste = aluno.treinos.some(item => item.id === treino.id)
        return {
          ...aluno,
          treinos: jaExiste
            ? aluno.treinos.map(item => item.id === treino.id ? treino : item)
            : [...aluno.treinos, treino],
        }
      }),
    }))
  },

  addProfessor: async (data) => {
    if (!isValidCpf(data.cpf)) throw new Error('Informe um CPF válido.')
    const cpfLimpo = onlyCpfDigits(data.cpf)
    const emailInterno = `professor.${cpfLimpo}@fitpro.internal`
    const temporaryPassword = generateTemporaryPassword()

    // 1. Instancia um Cliente Fantasma
    const tempClient = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // 2. Usa a API oficial para criar o professor perfeitamente
    const { data: authRes, error: authErr } = await tempClient.auth.signUp({
      email: emailInterno,
      password: temporaryPassword,
      options: { data: { role: 'professor' } }
    })

    if (authErr) throw new Error(`Erro ao criar acesso: ${authErr.message}`)
    if (!authRes.user) throw new Error('Falha ao gerar ID do usuário no sistema.')

    const userId = authRes.user.id

    // 3. Cria o perfil do professor
    const row = {
      id: userId,
      user_id: userId,
      nome: data.nome,
      cpf: cpfLimpo,
      telefone: data.telefone,
      email: data.email,
      horario: data.horario,
      salario: data.salario,
      especialidade: data.especialidade,
      status: data.status,
      is_first_login: true
    }
    
    const { data: inserted, error } = await supabase.from('professores').insert(row).select().single()
    if (error) throw new Error(`Erro ao salvar perfil: ${error.message}`)
    
    const professor = mapProfessor(inserted as Record<string, unknown>)
    set(s => ({ professores: [...s.professores, professor] }))
    return { record: professor, temporaryPassword }
  },

  updateProfessor: async (id, data) => {
    const updates: Record<string, unknown> = {}
    if (data.nome !== undefined)          updates.nome          = data.nome
    if (data.cpf !== undefined) {
      if (!isValidCpf(data.cpf)) throw new Error('Informe um CPF válido.')
      updates.cpf = onlyCpfDigits(data.cpf)
    }
    if (data.telefone !== undefined)      updates.telefone      = data.telefone
    if (data.email !== undefined)         updates.email         = data.email
    if (data.horario !== undefined)       updates.horario       = data.horario
    if (data.salario !== undefined)       updates.salario       = data.salario
    if (data.especialidade !== undefined) updates.especialidade = data.especialidade
    if (data.status !== undefined)        updates.status        = data.status
    if (data.feriasInicio !== undefined)  updates.ferias_inicio = data.feriasInicio || null
    if (data.feriasFim !== undefined)     updates.ferias_fim    = data.feriasFim || null
    const { error } = await supabase.from('professores').update(updates).eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ professores: s.professores.map(p => p.id === id ? { ...p, ...data } : p) }))
  },

  resetProfessorPassword: async (id) => {
    if (!id) throw new Error('Professor não encontrado.')
    const temporaryPassword = generateTemporaryPassword()
    const { error } = await supabase.rpc('reset_professor_password', {
      p_professor_id: id,
      p_temporary_password: temporaryPassword,
    })
    if (error) throw new Error(error.message)

    const { data, error: loadError } = await supabase
      .from('professores')
      .select('*')
      .eq('id', id)
      .single()
    if (loadError || !data) throw new Error(loadError?.message ?? 'Professor não encontrado.')

    const professor = mapProfessor(data as Record<string, unknown>)
    set(s => ({ professores: s.professores.map(item => item.id === id ? professor : item) }))
    return { record: professor, temporaryPassword }
  },

  addTurma: async (data) => {
    const row = {
      nome:         data.nome,
      modalidade:   data.modalidade,
      horario:      data.horario,
      dias_semana:  data.diasSemana,
      capacidade:   data.capacidade,
      professor_id: data.professorId || null,
      sala:         data.sala,
      aluno_ids:    data.alunoIds,
      status:       'proxima',
    }
    const { data: inserted, error } = await supabase.from('turmas').insert(row).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ turmas: [...s.turmas, mapTurma(inserted as Record<string, unknown>)] }))
  },

  addPlano: async (data) => {
    const { data: inserted, error } = await supabase.from('planos').insert({
      nome:        data.nome,
      preco:       data.preco,
      duracao:     data.duracao,
      modalidades: data.modalidades,
      beneficios:  data.beneficios,
      ativo:       data.ativo,
    }).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ planos: [...s.planos, mapPlano(inserted as Record<string, unknown>)] }))
  },

  updatePlano: async (id, data) => {
    const { error } = await supabase.from('planos').update(data).eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ planos: s.planos.map(p => p.id === id ? { ...p, ...data } : p) }))
  },

  addTransacao: async (data) => {
    const row = {
      tipo:      data.tipo,
      categoria: data.categoria,
      descricao: data.descricao,
      valor:     data.valor,
      data:      data.data,
      status:    data.status ?? null,
      aluno_id:  data.alunoId ?? null,
    }
    const { data: inserted, error } = await supabase.from('transacoes').insert(row).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ transacoes: [mapTransacao(inserted as Record<string, unknown>), ...s.transacoes] }))
  },
}))
