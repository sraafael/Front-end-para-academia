import { useEffect, useState } from 'react'
import { pixApi, type PixSettings } from '../../../api/pix'
import { useModalKeyboard } from '../../../hooks/useModalKeyboard'

interface Props {
  onClose: () => void
  connectionResult?: 'conectado' | 'erro' | null
}

export default function PixSettingsModal({ onClose, connectionResult }: Props) {
  const [settings, setSettings] = useState<PixSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useModalKeyboard(onClose)

  useEffect(() => {
    let active = true
    pixApi.settings()
      .then(result => { if (active) setSettings(result) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível consultar o Pix.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const connect = async () => {
    setError('')
    setSaving(true)
    try {
      const { url } = await pixApi.beginConnection()
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar a conexão.')
      setSaving(false)
    }
  }

  const toggle = async () => {
    if (!settings) return
    setError('')
    setSaving(true)
    try {
      const { enabled } = await pixApi.setEnabled(!settings.enabled)
      setSettings({ ...settings, enabled })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o Pix.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Pix da academia">
      <div className="w-full max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#111111] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Pix da academia</h2>
            <p className="mt-1 text-sm text-[#a1a1aa]">Sua academia decide se quer receber mensalidades pelo aplicativo.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar Pix" className="text-2xl leading-none text-[#71717a] hover:text-white">×</button>
        </div>

        {connectionResult === 'conectado' && <p role="status" className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-200">Conta conectada. O Pix ainda está desativado; ative-o quando quiser oferecer aos alunos.</p>}
        {connectionResult === 'erro' && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">A conexão não foi concluída. Tente novamente ou confira a configuração com o proprietário.</p>}

        {loading ? <p className="mt-6 text-sm text-[#71717a]">Carregando configuração...</p> : settings && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#171717] p-4">
              <p className="text-sm font-semibold text-white">Conta Mercado Pago</p>
              <p className="mt-1 text-sm text-[#a1a1aa]">
                {settings.connected ? `Conectada (ID ${settings.sellerId})` : 'Ainda não conectada'}
              </p>
              <p className="mt-2 text-xs text-[#71717a]">Cada pagamento vai para a conta autorizada por esta academia. O FitPro não retém comissão.</p>
              {settings.configured && (
                <button type="button" onClick={() => void connect()} disabled={saving}
                  className="mt-4 rounded-lg border border-[#22c55e]/40 px-4 py-2 text-sm font-semibold text-[#86efac] hover:bg-[#22c55e]/10 disabled:opacity-50">
                  {settings.connected ? 'Reconectar conta' : 'Conectar Mercado Pago'}
                </button>
              )}
            </div>

            {settings.testMode && <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">Ambiente de testes: nenhuma cobrança real será feita.</p>}
            {!settings.configured && <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">A integração ainda precisa ser configurada pelo proprietário no servidor.</p>}

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2a2a2a] p-4">
              <div>
                <p className="text-sm font-semibold text-white">Oferecer Pix aos alunos</p>
                <p className="mt-1 text-xs text-[#71717a]">Desligado por padrão. O registro manual continua disponível.</p>
              </div>
              <button type="button" onClick={() => void toggle()} disabled={!settings.connected || !settings.configured || saving}
                aria-pressed={settings.enabled}
                className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${settings.enabled ? 'bg-[#22c55e] text-black' : 'bg-[#292929] text-white'}`}>
                {settings.enabled ? 'Ativado' : 'Desativado'}
              </button>
            </div>

            {settings.reviewCharges?.length > 0 && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-sm font-semibold text-yellow-100">Pagamentos para conferir</p>
                <p className="mt-1 text-xs text-yellow-200/80">O Pix foi recebido, mas a mensalidade do aluno mudou antes da confirmação. Confira no Mercado Pago antes de ajustar o financeiro.</p>
                <ul className="mt-3 space-y-2 text-sm text-white">
                  {settings.reviewCharges.map(item => (
                    <li key={item.id} className="rounded-lg bg-black/20 px-3 py-2">
                      {item.studentName || 'Aluno não identificado'} · R$ {item.amount.toFixed(2).replace('.', ',')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  )
}
