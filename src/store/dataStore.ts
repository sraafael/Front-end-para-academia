import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js' 
import { projectId, publicAnonKey } from '../../utils/supabase/info'
import type {
  Aluno, Professor, Turma, Plano, Transacao,
  AlunoStatus, PagamentoStatus, TreinoFicha, HistoricoPesoEntry, FrequenciaEntry,
} from '../types'

// ── DB row → frontend type mappers ───────────────────────────────────────────

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

// ── Store ────────────────────────────────────────────────────────────────────

type CreateAlunoPayload = Omit<Aluno, 'id' | 'historicoPeso' | 'frequencia' | 'treinos' | 'sequencia' | 'metaSemanal' | 'conquistasDesbloqueadas' | 'pagamentoStatus' | 'isFirstLogin' | 'senha'>

interface DataState {
  alunos: Aluno[]
  professores: Professor[]
  turmas: Turma[]
  planos: Plano[]
  transacoes: Transacao[]
  loading: boolean

  loadAll: () => Promise<void>
  loadAluno: (alunoId: string) => Promise<void>

  addAluno: (data: CreateAlunoPayload) => Promise<Aluno>
  updateAluno: (id: string, data: Partial<Aluno>) => Promise<void>
  updatePeso: (alunoId: string, novoPeso: number) => Promise<void>
  checkSerie: (alunoId: string, treinoId: string, exercicioId: string, serieNum: number, cargaReal: number, reps: number) => void

  addProfessor: (data: Omit<Professor, 'id' | 'senha'>) => Promise<void>
  updateProfessor: (id: string, data: Partial<Professor>) => Promise<void>

  addTurma: (data: Omit<Turma, 'id' | 'status'>) => Promise<void>

  addPlano: (data: Omit<Plano, 'id'>) => Promise<void>
  updatePlano: (id: string, data: Partial<Plano>) => Promise<void>

  addTransacao: (data: Omit<Transacao, 'id'>) => Promise<void>
  
}

export const useDataStore = create<DataState>()((set, get) => ({
  alunos: [],
  professores: [],
  turmas: [],
  planos: [],
  transacoes: [],
  loading: false,

  // ── Load all data (admin / professor dashboards) ────────────────────────
  loadAll: async () => {
    set({ loading: true })
    const [alunosRes, professoresRes, turmasRes, planosRes, transacoesRes] = await Promise.all([
      supabase.from('alunos').select('*').order('nome'),
      supabase.from('professores').select('*').order('nome'),
      supabase.from('turmas').select('*').order('nome'),
      supabase.from('planos').select('*').order('nome'),
      supabase.from('transacoes').select('*').order('data', { ascending: false }),
    ])
    set({
      loading: false,
      alunos:      (alunosRes.data ?? []).map(r => mapAluno(r as Record<string, unknown>)),
      professores: (professoresRes.data ?? []).map(r => mapProfessor(r as Record<string, unknown>)),
      turmas:      (turmasRes.data ?? []).map(r => mapTurma(r as Record<string, unknown>)),
      planos:      (planosRes.data ?? []).map(r => mapPlano(r as Record<string, unknown>)),
      transacoes:  (transacoesRes.data ?? []).map(r => mapTransacao(r as Record<string, unknown>)),
    })
  },

  // ── Load a single aluno with full related data (aluno dashboard) ─────────
  loadAluno: async (alunoId) => {
    const [alunoRes, pesoRes, freqRes, treinosRes] = await Promise.all([
      supabase.from('alunos').select('*').eq('id', alunoId).single(),
      supabase.from('historico_peso').select('*').eq('aluno_id', alunoId).order('data'),
      supabase.from('frequencia').select('*').eq('aluno_id', alunoId).order('data'),
      supabase.from('treinos').select('*, exercicios(*, series_realizadas(*))').eq('aluno_id', alunoId),
    ])
    if (!alunoRes.data) return

    const historicoPeso: HistoricoPesoEntry[] = (pesoRes.data ?? []).map((p: Record<string, unknown>) => ({
      data: p.data as string,
      peso: Number(p.peso),
    }))
    const frequencia: FrequenciaEntry[] = (freqRes.data ?? []).map((f: Record<string, unknown>) => ({
      data: f.data as string,
      presente: f.presente as boolean,
    }))
    const treinos: TreinoFicha[] = (treinosRes.data ?? []).map((t: Record<string, unknown>) => ({
      id:    t.id as string,
      nome:  t.nome as string,
      grupo: t.grupo as string,
      exercicios: ((t.exercicios as Record<string, unknown>[]) ?? []).map(ex => ({
        id:             ex.id as string,
        nome:           ex.nome as string,
        series:         Number(ex.series),
        reps:           Number(ex.reps),
        cargaSugerida:  Number(ex.carga_sugerida),
        seriesRealizadas: ((ex.series_realizadas as Record<string, unknown>[]) ?? []).map(sr => ({
          serieNum:   Number(sr.serie_num),
          cargaReal:  Number(sr.carga_real),
          repeticoes: Number(sr.repeticoes),
          concluida:  sr.concluida as boolean,
        })),
      })),
    }))

    const aluno = mapAluno(alunoRes.data as Record<string, unknown>, historicoPeso, frequencia, treinos)
    set(s => ({
      alunos: s.alunos.some(a => a.id === alunoId)
        ? s.alunos.map(a => a.id === alunoId ? aluno : a)
        : [...s.alunos, aluno],
    }))
  },

  // ── Mutations ─────────────────────────────────────────────────────────────

  addAluno: async (data) => {
    const hoje = new Date().toISOString().split('T')[0]
    const cpfLimpo = data.cpf.replace(/\D/g, '')
    const emailInterno = `aluno.${cpfLimpo}@fitpro.internal`

    // 1. Instancia um Cliente Fantasma que NÃO afeta a sessão do Administrador
    const tempClient = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // 2. Usa a API oficial para criar o usuário perfeitamente
    const { data: authRes, error: authErr } = await tempClient.auth.signUp({
      email: emailInterno,
      password: '123456',
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
      professor_id: (data as any).professorId || null,
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
    
    const novo = mapAluno(inserted as Record<string, unknown>)
    set(s => ({ alunos: [...s.alunos, novo] }))
    
    if (data.peso > 0) {
      await supabase.from('historico_peso').insert({ aluno_id: novo.id, data: hoje, peso: data.peso })
    }
    return novo
  },

  updateAluno: async (id, data) => {
    const updates: Record<string, unknown> = {}
    if (data.nome !== undefined)            updates.nome             = data.nome
    if (data.telefone !== undefined)        updates.telefone         = data.telefone
    if (data.email !== undefined)           updates.email            = data.email
    if (data.idade !== undefined)           updates.idade            = data.idade
    if (data.peso !== undefined)            updates.peso             = data.peso
    if (data.planoId !== undefined)         updates.plano_id         = data.planoId || null
    if (data.professorId !== undefined)     updates.professor_id     = data.professorId || null
    if (data.status !== undefined)          updates.status           = data.status
    if (data.turmaId !== undefined)         updates.turma_id         = data.turmaId ?? null
    if (data.isFirstLogin !== undefined)    updates.is_first_login   = data.isFirstLogin
    if (data.formaPagamento !== undefined)  updates.forma_pagamento  = data.formaPagamento
    if (data.pagamentoStatus !== undefined) updates.pagamento_status = data.pagamentoStatus
    if (data.vencimento !== undefined)      updates.vencimento       = data.vencimento ?? null
    if (data.sequencia !== undefined)       updates.sequencia        = data.sequencia
    if (data.conquistasDesbloqueadas !== undefined) updates.conquistas_desbloqueadas = data.conquistasDesbloqueadas
    if (Object.keys(updates).length === 0) return
    const { error } = await supabase.from('alunos').update(updates).eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ alunos: s.alunos.map(a => a.id === id ? { ...a, ...data } : a) }))
  },

  updatePeso: async (alunoId, novoPeso) => {
    const hoje = new Date().toISOString().split('T')[0]
    await supabase.from('alunos').update({ peso: novoPeso }).eq('id', alunoId)
    await supabase.from('historico_peso').insert({ aluno_id: alunoId, data: hoje, peso: novoPeso })
    set(s => ({
      alunos: s.alunos.map(a =>
        a.id === alunoId
          ? { ...a, peso: novoPeso, historicoPeso: [...a.historicoPeso, { data: hoje, peso: novoPeso }] }
          : a
      ),
    }))
  },

  checkSerie: (alunoId, treinoId, exercicioId, serieNum, cargaReal, reps) => {
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
    supabase.from('series_realizadas').upsert({
      exercicio_id: exercicioId,
      serie_num:    serieNum,
      carga_real:   cargaReal,
      repeticoes:   reps,
      concluida:    toggledSerie?.concluida ?? false,
    }, { onConflict: 'exercicio_id,serie_num' }).then(() => null)
  },

  addProfessor: async (data) => {
    const cpfLimpo = data.cpf.replace(/\D/g, '')
    const emailInterno = `professor.${cpfLimpo}@fitpro.internal`

    // 1. Instancia um Cliente Fantasma
    const tempClient = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // 2. Usa a API oficial para criar o professor perfeitamente
    const { data: authRes, error: authErr } = await tempClient.auth.signUp({
      email: emailInterno,
      password: '123456',
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
    
    set(s => ({ professores: [...s.professores, mapProfessor(inserted as Record<string, unknown>)] }))
  },

  updateProfessor: async (id, data) => {
    const updates: Record<string, unknown> = {}
    if (data.nome !== undefined)          updates.nome          = data.nome
    if (data.telefone !== undefined)      updates.telefone      = data.telefone
    if (data.email !== undefined)         updates.email         = data.email
    if (data.horario !== undefined)       updates.horario       = data.horario
    if (data.salario !== undefined)       updates.salario       = data.salario
    if (data.especialidade !== undefined) updates.especialidade = data.especialidade
    if (data.status !== undefined)        updates.status        = data.status
    const { error } = await supabase.from('professores').update(updates).eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ professores: s.professores.map(p => p.id === id ? { ...p, ...data } : p) }))
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