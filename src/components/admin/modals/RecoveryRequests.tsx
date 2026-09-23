import { useEffect, useState } from 'react'
import { studentRecoveryApi, type StudentRecoveryRequest } from '../../../api/recovery'
import { formatCpf } from '../../../lib/cpf'
import { useModalKeyboard } from '../../../hooks/useModalKeyboard'
import TemporaryAccessModal from './TemporaryAccessModal'

interface Props {
  onClose: () => void
  onPendingChange: (count: number) => void
}

export default function RecoveryRequests({ onClose, onPendingChange }: Props) {
  const [requests, setRequests] = useState<StudentRecoveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [credential, setCredential] = useState<{ nome: string; cpf: string; senha: string } | null>(null)

  useModalKeyboard(() => { if (credential) setCredential(null); else onClose() })

  const refresh = async () => {
    const items = await studentRecoveryApi.pending()
    setRequests(items)
    onPendingChange(items.length)
  }

  useEffect(() => {
    let active = true
    studentRecoveryApi.pending()
      .then(items => { if (active) { setRequests(items); onPendingChange(items.length) } })
      .catch(() => { if (active) setError('Não foi possível carregar os pedidos de recuperação.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onPendingChange])

  const handle = async (requestId: string, decision: 'reset' | 'dismiss') => {
    setError('')
    setBusyId(requestId)
    try {
      const result = await studentRecoveryApi.handle(requestId, decision)
      setConfirmingId(null)
      if (decision === 'reset' && result.temporaryPassword) {
        setCredential({ nome: result.record.nome, cpf: result.record.cpf, senha: result.temporaryPassword })
      }
      await refresh().catch(() => setError('O pedido foi tratado, mas a lista não atualizou. Abra esta tela novamente.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível tratar o pedido.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Pedidos de recuperação de senha">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-[#2a2a2a] bg-[#111111]">
        <div className="flex items-center justify-between gap-4 border-b border-[#2a2a2a] p-5">
          <div>
            <h2 className="text-lg font-bold text-white">Pedidos de recuperação</h2>
            <p className="mt-1 text-sm text-[#a1a1aa]">Alunos que solicitaram ajuda para acessar a conta.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar pedidos" className="text-2xl text-[#71717a] hover:text-white">×</button>
        </div>
        <div className="overflow-auto p-5">
          <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
            CPF e escolha da academia não comprovam identidade. Confirme com o aluno pelo contato já cadastrado ou pessoalmente antes de gerar uma nova senha.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          {loading ? <p className="mt-5 text-sm text-[#a1a1aa]">Carregando pedidos...</p> : requests.length === 0 ? (
            <p className="mt-5 text-sm text-[#a1a1aa]">Nenhum pedido pendente.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {requests.map(item => (
                <div key={item.id} className="rounded-xl border border-[#2a2a2a] bg-[#181818] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{item.student?.nome || 'Aluno não encontrado'}</p>
                      <p className="mt-1 text-xs text-[#a1a1aa]">CPF: {formatCpf(item.student?.cpf ?? '')}</p>
                      <p className="text-xs text-[#a1a1aa]">Telefone cadastrado: {item.student?.telefone || 'não informado'}</p>
                    </div>
                    <p className="text-xs text-[#71717a]">{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {confirmingId === item.id ? (
                      <>
                        <button type="button" onClick={() => void handle(item.id, 'reset')} disabled={busyId !== null}
                          className="rounded-lg bg-[#22c55e] px-3 py-2 text-xs font-bold text-black disabled:opacity-50">
                          {busyId === item.id ? 'Redefinindo...' : 'Confirmar redefinição'}
                        </button>
                        <button type="button" onClick={() => setConfirmingId(null)} disabled={busyId !== null}
                          className="rounded-lg border border-[#3f3f46] px-3 py-2 text-xs text-white">Cancelar</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmingId(item.id)} disabled={!item.student || busyId !== null}
                        className="rounded-lg border border-[#22c55e]/40 px-3 py-2 text-xs font-semibold text-[#86efac] disabled:opacity-50">
                        Gerar senha temporária
                      </button>
                    )}
                    <button type="button" onClick={() => void handle(item.id, 'dismiss')} disabled={busyId !== null}
                      className="rounded-lg border border-[#3f3f46] px-3 py-2 text-xs text-[#a1a1aa] disabled:opacity-50">Descartar pedido</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {credential && <TemporaryAccessModal nome={credential.nome} cpf={credential.cpf} perfil="Aluno" senha={credential.senha}
        mode="reset" onClose={() => setCredential(null)} />}
    </div>
  )
}
