import { useEffect, useRef, useState } from 'react'
import { pixApi, type PixCharge } from '../../api/pix'

interface Props {
  dueDate?: string
  preview: boolean
  onPaid: () => void
}

function safeTicketUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'mercadopago.com.br' || url.hostname.endsWith('.mercadopago.com.br'))
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export default function PixPaymentCard({ dueDate, preview, onPaid }: Props) {
  const [available, setAvailable] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const [charge, setCharge] = useState<PixCharge | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const notifiedPaid = useRef<string | null>(null)

  const refresh = async () => {
    const result = await pixApi.myStatus()
    setAvailable(result.available)
    setTestMode(result.testMode)
    const currentCharge = result.charge?.periodDue === dueDate ? result.charge : null
    setCharge(currentCharge)
    if (currentCharge?.status === 'paid' && !currentCharge.testMode && notifiedPaid.current !== currentCharge.id) {
      notifiedPaid.current = currentCharge.id
      onPaid()
    }
  }

  useEffect(() => {
    if (preview) return
    let active = true
    pixApi.myStatus().then(result => {
      if (!active) return
      setAvailable(result.available)
      setTestMode(result.testMode)
      const currentCharge = result.charge?.periodDue === dueDate ? result.charge : null
      setCharge(currentCharge)
      if (currentCharge?.status === 'paid' && !currentCharge.testMode && notifiedPaid.current !== currentCharge.id) {
        notifiedPaid.current = currentCharge.id
        onPaid()
      }
    }).catch(() => { /* O pagamento manual continua disponível se o serviço estiver fora do ar. */ })
    return () => { active = false }
  }, [dueDate, preview])

  useEffect(() => {
    if (preview || !charge || !['creating', 'pending'].includes(charge.status)) return
    const timer = window.setInterval(() => { void refresh().catch(() => null) }, 15_000)
    return () => window.clearInterval(timer)
  }, [charge?.id, charge?.status, dueDate, preview])

  const create = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await pixApi.createCharge()
      setAvailable(result.available)
      setTestMode(result.testMode)
      setCharge(result.charge)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o Pix.')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!charge?.qrCode) return
    try {
      await navigator.clipboard.writeText(charge.qrCode)
      setCopied(true)
    } catch {
      setError('Não foi possível copiar. Selecione o código e copie manualmente.')
    }
  }

  // Desativar novos Pix não esconde uma cobrança que o aluno já recebeu.
  const existingCharge = charge && ['creating', 'pending', 'paid', 'review'].includes(charge.status)
  if (preview || (!available && !existingCharge)) {
    return <p className="mt-1 text-xs text-[#a1a1aa]">Solicite a chave Pix ou outra forma de pagamento diretamente à recepção. Esta academia não oferece cobrança online no momento.</p>
  }

  const current = charge?.status === 'pending' || charge?.status === 'creating' ? charge : null
  const ticketUrl = safeTicketUrl(current?.ticketUrl ?? null)

  return (
    <div className="mt-3 space-y-3">
      {!available && current && <p className="text-xs text-[#a1a1aa]">A academia desativou novos Pix. Esta cobrança continua em acompanhamento.</p>}
      {available && !current && charge?.status !== 'paid' && charge?.status !== 'review' && (
        <button type="button" onClick={() => void create()} disabled={loading}
          className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-bold text-black hover:bg-[#16a34a] disabled:opacity-50">
          {loading ? 'Gerando Pix...' : testMode ? 'Simular cobrança Pix' : 'Pagar mensalidade com Pix'}
        </button>
      )}
      {(testMode || charge?.testMode) && <p className="text-xs font-semibold text-yellow-200">Simulação de R$ 50,00. Não pague o QR Code: ela não quita a mensalidade nem registra receita.</p>}
      {charge?.status === 'creating' && (
        <div className="space-y-2">
          <p className="text-sm text-[#a1a1aa]">Preparando a cobrança. A tela atualiza automaticamente.</p>
          <button type="button" onClick={() => void create()} disabled={loading}
            className="rounded-lg border border-[#3f3f46] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {loading ? 'Conferindo...' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {current?.status === 'pending' && (
        <div className="rounded-xl border border-[#22c55e]/25 bg-[#0f1a12] p-4">
          <p className="text-sm font-semibold text-white">Cobrança de R$ {current.amount.toFixed(2).replace('.', ',')}</p>
          <p className="mt-1 text-xs text-[#a1a1aa]">O pagamento só será confirmado quando o Mercado Pago avisar a academia.</p>
          {current.qrCodeBase64 && <img className="mx-auto mt-4 h-48 w-48 rounded-lg bg-white p-2" alt="QR Code Pix" src={`data:image/png;base64,${current.qrCodeBase64}`} />}
          {current.qrCode && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input readOnly aria-label="Pix copia e cola" value={current.qrCode}
                className="min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-xs text-white" />
              <button type="button" onClick={() => void copy()} className="rounded-lg border border-[#22c55e]/40 px-3 py-2 text-xs font-semibold text-[#86efac]">
                {copied ? 'Copiado' : 'Copiar código'}
              </button>
            </div>
          )}
          {ticketUrl && <a className="mt-3 inline-block text-xs font-semibold text-[#86efac] underline" href={ticketUrl} target="_blank" rel="noopener noreferrer">Abrir instruções do pagamento</a>}
        </div>
      )}
      {charge?.status === 'paid' && <p className="text-sm font-semibold text-[#86efac]">{charge.testMode ? 'Simulação aprovada. A mensalidade real continua pendente.' : 'Pagamento confirmado. Atualizando sua mensalidade...'}</p>}
      {charge?.status === 'review' && <p className="text-sm text-yellow-200">Pagamento recebido, mas a mensalidade mudou durante a cobrança. Fale com a academia para conciliar.</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
