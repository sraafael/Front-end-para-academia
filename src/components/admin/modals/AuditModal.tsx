import { useEffect, useState } from 'react'
import { auditApi, type AuditLog } from '../../../api/audit'

interface Props { onClose: () => void }

const ACTION_LABELS: Record<AuditLog['action'], string> = {
  insert: 'Cadastro',
  update: 'Alteração',
  delete: 'Exclusão',
  reset: 'Limpeza de dados',
  seed: 'Carga inicial',
}

const ENTITY_LABELS: Record<string, string> = {
  alunos: 'Aluno',
  professores: 'Professor',
  planos: 'Plano',
  turmas: 'Turma',
  transacoes: 'Transação',
  historico_peso: 'Histórico de peso',
  frequencia: 'Frequência',
  treinos: 'Treino',
  exercicios: 'Exercício',
  series_realizadas: 'Série realizada',
  academies: 'Academia',
  academy_admins: 'Administrador',
  ambiente_teste: 'Sistema',
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function AuditModal({ onClose }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setLogs(await auditApi.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a auditoria.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-3xl max-h-[92vh] bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5 border-b border-[#242424]">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#86efac]">PROPRIETÁRIO</span>
              <h2 className="text-white font-bold font-mono text-lg">Auditoria</h2>
            </div>
            <p className="text-[#71717a] text-sm mt-1">Histórico automático das alterações realizadas no sistema.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-[#52525b] hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-white font-semibold">Histórico de alterações</h3>
              <p className="text-[#71717a] text-xs mt-0.5">Somente o proprietário pode consultar estes registros.</p>
            </div>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-[#2a2a2a] px-3 py-2 text-xs font-semibold text-[#a1a1aa] hover:text-white disabled:opacity-50">
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          {loading ? (
            <p className="py-10 text-center text-[#52525b] text-sm">Carregando auditoria...</p>
          ) : logs.length === 0 ? (
            <p className="rounded-xl border border-[#242424] bg-[#0d0d0d] py-10 text-center text-[#52525b] text-sm">Nenhuma ação registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="rounded-xl border border-[#242424] bg-[#0d0d0d] px-4 py-3 flex items-start gap-3">
                  <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${log.action === 'delete' || log.action === 'reset' ? 'bg-red-400' : log.action === 'seed' ? 'bg-amber-300' : 'bg-[#22c55e]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm"><span className="font-semibold">{ACTION_LABELS[log.action]}</span> · {ENTITY_LABELS[log.entity] ?? log.entity}</p>
                    {log.label && <p className="text-[#a1a1aa] text-xs mt-0.5 truncate">{log.label}</p>}
                    <p className="text-[#52525b] text-[11px] mt-1">{log.actorEmail} · {formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
