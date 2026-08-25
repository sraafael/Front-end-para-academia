import type { Conquista } from './types'

export const CONQUISTAS_CATALOGO: Conquista[] = [
  { id: 'primeiro_treino', nome: 'Primeiro Passo',   descricao: 'Completou o primeiro treino',             icon: '🏋️', nivel: 'bronze',  criterio: '' },
  { id: 'seq_7',           nome: '7 Dias de Fogo',   descricao: '7 dias consecutivos na academia',         icon: '🔥', nivel: 'bronze',  criterio: '' },
  { id: 'seq_30',          nome: 'Mês Completo',     descricao: '30 dias consecutivos',                    icon: '💪', nivel: 'prata',   criterio: '' },
  { id: 'treinos_50',      nome: '50 Treinos',       descricao: 'Completou 50 sessões de treino',          icon: '⚡', nivel: 'prata',   criterio: '' },
  { id: 'treinos_100',     nome: 'Centenário',       descricao: '100 treinos concluídos',                  icon: '🏆', nivel: 'ouro',    criterio: '' },
  { id: 'meta_4x',         nome: 'Meta Semanal',     descricao: 'Bateu a meta semanal completa',           icon: '🎯', nivel: 'bronze',  criterio: '' },
  { id: 'peso_5kg',        nome: '5kg a Menos',      descricao: 'Perdeu 5kg desde o início',               icon: '📉', nivel: 'prata',   criterio: '' },
  { id: 'avaliacao',       nome: 'Avaliado',         descricao: 'Fez a primeira avaliação física',         icon: '⭐', nivel: 'bronze',  criterio: '' },
  { id: 'meses_3',         nome: '3 Meses Forte',   descricao: '3 meses de academia',                     icon: '🏅', nivel: 'ouro',    criterio: '' },
  { id: 'meses_6',         nome: 'Meio Ano',         descricao: '6 meses dedicados',                       icon: '💫', nivel: 'ouro',    criterio: '' },
  { id: 'meses_12',        nome: 'Veterano',         descricao: '1 ano de academia',                       icon: '🌟', nivel: 'platina', criterio: '' },
  { id: 'modalidades',     nome: 'Multiatleta',      descricao: 'Participou de 3 modalidades diferentes',  icon: '🤸', nivel: 'prata',   criterio: '' },
]
