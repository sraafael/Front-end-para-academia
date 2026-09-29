import { useEffect, useState } from 'react'
import { pixApi, type PixHistoryItem } from '../../../api/pix'
import { formatLocalDate } from '../../../lib/date'

const labels: Record<PixHistoryItem['status'], string> = {
  creating: 'Preparando',
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  expired: 'Expirado',
  failed: 'Falhou',
  review: 'Conferir',
}

const colors: Record<PixHistoryItem['status'], string> = {
  creating: 'text-blue-300 bg-blue-500/10',
  pending: 'text-yellow-300 bg-yellow-500/10',
  paid: 'text-green-300 bg-green-500/10',
  expired: 'text-zinc-300 bg-zinc-500/10',
  failed: 'text-red-300 bg-red-500/10',
  review: 'text-orange-300 bg-orange-500/10',
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—'

export default function PixHistory() {
  const [charges, setCharges] = useState<PixHistoryItem[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // A lista vem do servidor já restrita à academia do administrador.
  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setCharges((await pixApi.history()).charges)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar os pagamentos Pix.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visible = filter === 'all' ? charges : charges.filter(charge => charge.status === filter)

  return (
    <section className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4" aria-label="Histórico de cobranças Pix">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Histórico Pix</h3>
          <p className="mt-1 text-xs text-[#71717a]">Últimas 50 cobranças desta academia. O valor é o cobrado do aluno, antes da tarifa do Mercado Pago.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="rounded-lg border border-[#343434] px-3 py-1.5 text-xs text-white hover:bg-[#1f1f1f] disabled:opacity-50">
          Atualizar
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="pix-history-filter" className="text-xs text-[#a1a1aa]">Status</label>
        <select id="pix-history-filter" value={filter} onChange={event => setFilter(event.target.value)}
          className="rounded-lg border border-[#343434] bg-[#181818] px-2 py-1.5 text-xs text-white">
          <option value="all">Todos</option>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {loading && <p role="status" className="mt-4 text-sm text-[#a1a1aa]">Carregando cobranças...</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      {!loading && !error && visible.length === 0 && <p className="mt-4 text-sm text-[#a1a1aa]">Nenhuma cobrança Pix neste filtro.</p>}

      {!loading && !error && visible.length > 0 && (
        <div className="mt-4 space-y-2">
          {visible.map(charge => (
            <article key={charge.id} className="rounded-lg border border-[#292929] bg-[#171717] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{charge.studentName || 'Aluno não identificado'}</p>
                  <p className="text-xs text-[#a1a1aa]">{charge.planName || 'Plano não registrado'} · vencimento {formatLocalDate(charge.periodDue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{money(charge.amount)}</p>
                  <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs ${colors[charge.status]}`}>{labels[charge.status]}</span>
                  {charge.testMode && <span className="ml-1 text-xs text-yellow-300">Teste</span>}
                </div>
              </div>
              <p className="mt-2 text-xs text-[#a1a1aa]">Criado: {dateTime(charge.createdAt)} · Pago: {dateTime(charge.paidAt)}</p>
              <div className="mt-2 space-y-1 text-xs text-[#71717a]">
                <p className="break-all">Cobrança: <code>{charge.id}</code></p>
                {charge.providerOrderId && <p className="break-all">Order Mercado Pago: <code>{charge.providerOrderId}</code></p>}
                {charge.providerPaymentId && <p className="break-all">Pagamento Mercado Pago: <code>{charge.providerPaymentId}</code></p>}
              </div>
              {charge.status === 'review' && <p className="mt-2 text-xs text-orange-200">Pix recebido, mas a mensalidade mudou. Confira antes de ajustar o aluno.</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
