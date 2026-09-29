import { useEffect, useRef, useState } from 'react'
import { pixApi, type PixSettings } from '../../api/pix'

interface Props {
  academyId: string
}

// Uma autorização do proprietário atende todas as academias da apresentação.
export default function OwnerPixSection({ academyId }: Props) {
  const [settings, setSettings] = useState<PixSettings | null>(null)
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const selectedAcademy = useRef(academyId)
  selectedAcademy.current = academyId

  const refresh = async () => {
    if (!academyId) return
    const requestedAcademy = academyId
    setLoading(true)
    setError('')
    try {
      const result = await pixApi.ownerSettings(requestedAcademy)
      if (selectedAcademy.current === requestedAcademy) setSettings(result)
    } catch (err) {
      if (selectedAcademy.current === requestedAcademy) setError(err instanceof Error ? err.message : 'Não foi possível consultar o Pix.')
    } finally {
      if (selectedAcademy.current === requestedAcademy) setLoading(false)
    }
  }

  useEffect(() => {
    setSettings(null)
    setLink('')
    setError('')
    setMessage('')
    void refresh()
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [academyId])

  useEffect(() => {
    if (!link) return
    const timer = window.setTimeout(() => setLink(''), 30 * 60_000)
    return () => window.clearTimeout(timer)
  }, [link])

  const generateLink = async () => {
    const requestedAcademy = academyId
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const result = await pixApi.ownerBeginConnection(requestedAcademy)
      if (selectedAcademy.current === requestedAcademy) {
        setLink(result.url)
        setMessage('Link criado. Ele expira em 30 minutos e substitui o anterior.')
      }
    } catch (err) {
      if (selectedAcademy.current === requestedAcademy) setError(err instanceof Error ? err.message : 'Não foi possível gerar o link.')
    } finally {
      if (selectedAcademy.current === requestedAcademy) setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Link copiado. Envie somente ao representante autorizado da academia.')
    } catch {
      setError('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  const toggle = async () => {
    if (!settings) return
    const requestedAcademy = academyId
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const result = await pixApi.ownerSetEnabled(requestedAcademy, !settings.enabled)
      if (selectedAcademy.current === requestedAcademy) {
        setSettings({ ...settings, enabled: result.enabled })
        setMessage(result.enabled ? 'Pix ativado para esta academia.' : 'Novos pagamentos Pix desativados para esta academia.')
      }
    } catch (err) {
      if (selectedAcademy.current === requestedAcademy) setError(err instanceof Error ? err.message : 'Não foi possível alterar o Pix.')
    } finally {
      if (selectedAcademy.current === requestedAcademy) setBusy(false)
    }
  }

  if (!academyId) {
    return <p className="text-sm text-[#71717a]">Salve a academia para preparar a conexão Mercado Pago.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Recebimento das mensalidades</p>
          <p className="mt-1 text-xs text-[#a1a1aa]">Sua conta Mercado Pago recebe os pagamentos de todas as academias atuais e futuras.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-[#343434] px-3 py-2 text-xs font-semibold text-white hover:bg-[#242424] disabled:opacity-50">
          {loading ? 'Atualizando...' : 'Atualizar status'}
        </button>
      </div>

      {settings && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#292929] bg-[#151515] p-4">
            <p className="text-xs text-[#71717a]">Conta Mercado Pago</p>
            <p className="mt-1 text-sm font-semibold text-white">{settings.connected ? `Conectada · ID ${settings.sellerId}` : 'Ainda não conectada'}</p>
            <p className="mt-2 text-xs text-[#71717a]">Confira se este ID pertence à sua conta antes de receber pagamentos.</p>
          </div>
          <div className="rounded-xl border border-[#292929] bg-[#151515] p-4">
            <p className="text-xs text-[#71717a]">Pix para alunos</p>
            <p className={`mt-1 text-sm font-semibold ${settings.enabled ? 'text-[#86efac]' : 'text-white'}`}>{settings.enabled ? 'Ativado' : 'Desativado'}</p>
            <button type="button" onClick={() => void toggle()} disabled={busy || !settings.connected || !settings.configured}
              className="mt-3 rounded-lg border border-[#22c55e]/40 px-3 py-2 text-xs font-semibold text-[#86efac] hover:bg-[#22c55e]/10 disabled:cursor-not-allowed disabled:opacity-40">
              {settings.enabled ? 'Desativar Pix' : 'Ativar Pix'}
            </button>
          </div>
        </div>
      )}

      {settings?.testMode && <p className="rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-200">Modo de teste: as simulações usam a conta de teste da aplicação e não movimentam a mensalidade real. Antes da produção, cada academia precisará reconectar a conta.</p>}
      {settings && !settings.testMode && <p className="rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-200">Ambiente real: os pagamentos de todas as academias serão recebidos na sua conta Mercado Pago autorizada.</p>}
      {settings && !settings.configured && <p className="text-xs text-yellow-200">A integração do servidor ainda não está configurada.</p>}

      <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
        <p className="text-sm font-semibold text-white">Autorização da sua conta</p>
        <p className="mt-1 text-xs leading-relaxed text-[#a1a1aa]">Autorize uma vez com a sua conta Mercado Pago. O vínculo será aplicado automaticamente a todas as academias da apresentação.</p>
        <button type="button" onClick={() => void generateLink()} disabled={busy || !settings?.configured}
          className="mt-3 rounded-lg bg-violet-400 px-4 py-2 text-xs font-bold text-black hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? 'Aguarde...' : settings?.connected ? 'Reconectar minha conta' : 'Conectar meu Mercado Pago'}
        </button>
        {link && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly aria-label="Link temporário do Mercado Pago" value={link} className="field-dark min-w-0 flex-1 !mt-0 text-xs" />
            <button type="button" onClick={() => void copyLink()} className="rounded-lg border border-violet-400/35 px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-400/10">Copiar link</button>
          </div>
        )}
      </div>
      {message && <p role="status" className="text-xs text-[#86efac]">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
