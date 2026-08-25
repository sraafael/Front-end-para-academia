export type UserRole = 'admin' | 'professor' | 'aluno'

export type View =
  | 'roleSelect'
  | 'loginAdmin'
  | 'loginProfessor'
  | 'loginAluno'
  | 'forgotPassword'
  | 'firstLoginReset'
  | 'adminDashboard'
  | 'professorDashboard'
  | 'alunoDashboard'

export type AlunoStatus = 'ativo' | 'atrasado' | 'inativo'
export type ProfessorStatus = 'ativo' | 'ferias' | 'inativo'
export type TurmaStatus = 'concluida' | 'em_andamento' | 'proxima' | 'cancelada'
export type TransacaoTipo = 'receita' | 'despesa'
export type PagamentoStatus = 'pago' | 'pendente' | 'atrasado'

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
  exercicios: ExercicioFicha[]
}

export interface HistoricoPesoEntry {
  data: string
  peso: number
}

export interface FrequenciaEntry {
  data: string
  presente: boolean
}

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

export interface AppState {
  alunos: Aluno[]
  professores: Professor[]
  turmas: Turma[]
  planos: Plano[]
  transacoes: Transacao[]
}
