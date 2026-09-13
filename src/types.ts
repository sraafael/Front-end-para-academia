// ── Perfis de acesso e navegação ────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'professor' | 'aluno'

export type View =
  | 'roleSelect'
  | 'loginOwner'
  | 'loginAdmin'
  | 'loginProfessor'
  | 'loginAluno'
  | 'forgotPassword'
  | 'firstLoginReset'
  | 'ownerDashboard'
  | 'adminDashboard'
  | 'professorDashboard'
  | 'alunoDashboard'

export type AlunoStatus = 'ativo' | 'atrasado' | 'inativo'
export type ProfessorStatus = 'ativo' | 'ferias' | 'inativo'
export type TurmaStatus = 'concluida' | 'em_andamento' | 'proxima' | 'cancelada'
export type TransacaoTipo = 'receita' | 'despesa'
export type PagamentoStatus = 'pago' | 'pendente' | 'atrasado'

// ── Fichas de treino ─────────────────────────────────────────────────────

export interface SerieRealizada {
  serieNum: number
  cargaReal: number
  repeticoes: number
  concluida: boolean
}

export interface ExercicioFicha {
  id: string
  nome: string
  series: number
  reps: number
  cargaSugerida: number
  seriesRealizadas: SerieRealizada[]
}

export interface TreinoFicha {
  id: string
  nome: string
  grupo: string
  createdAt?: string
  updatedAt?: string
  exercicios: ExercicioFicha[]
}

export interface ExercicioFichaInput {
  id?: string
  nome: string
  series: number
  reps: number
  cargaSugerida: number
}

export interface TreinoFichaInput {
  nome: string
  grupo: string
  exercicios: ExercicioFichaInput[]
}

// ── Acompanhamento do aluno ────────────────────────────────────────────

export interface HistoricoPesoEntry {
  data: string
  peso: number
}

export interface FrequenciaEntry {
  data: string
  presente: boolean
}

// ── Entidades principais ────────────────────────────────────────────────

export interface Aluno {
  id: string
  nome: string
  cpf: string
  senha: string
  telefone: string
  email: string
  idade: number
  peso: number
  planoId: string
  professorId?: string
  status: AlunoStatus
  turmaId?: string
  matriculaData: string
  isFirstLogin: boolean
  historicoPeso: HistoricoPesoEntry[]
  frequencia: FrequenciaEntry[]
  treinos: TreinoFicha[]
  sequencia: number
  metaSemanal: { meta: number; concluidos: number }
  conquistasDesbloqueadas: string[]
  formaPagamento: string
  pagamentoStatus: PagamentoStatus
  vencimento?: string
}

export interface Professor {
  id: string
  nome: string
  cpf: string
  senha: string
  telefone: string
  email: string
  horario: string
  salario: number
  especialidade: string
  status: ProfessorStatus
  feriasInicio?: string
  feriasFim?: string
}

export interface Turma {
  id: string
  nome: string
  modalidade: string
  horario: string
  diasSemana: string[]
  capacidade: number
  professorId: string
  sala: string
  alunoIds: string[]
  status: TurmaStatus
  createdAt?: string
}

export interface Plano {
  id: string
  nome: string
  preco: number
  duracao: string
  modalidades: string[]
  beneficios: string[]
  ativo: boolean
}

export interface Transacao {
  id: string
  tipo: TransacaoTipo
  categoria: string
  descricao: string
  valor: number
  data: string
  status?: PagamentoStatus
  alunoId?: string
}

export interface Conquista {
  id: string
  nome: string
  descricao: string
  icon: string
  nivel: 'bronze' | 'prata' | 'ouro' | 'platina'
  criterio: string
}

// ── Estado agregado da aplicação ─────────────────────────────────────────

export interface AppState {
  alunos: Aluno[]
  professores: Professor[]
  turmas: Turma[]
  planos: Plano[]
  transacoes: Transacao[]
}
