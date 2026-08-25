import { useState } from 'react'
import { useDataStore } from '../../../store/dataStore'

interface Props { onClose: () => void }

type ModalType = 'receita' | 'despesa' | null

const CATEGORIAS_RECEITA = ['Mensalidade', 'Matrícula', 'Personal Training', 'Loja / Suplementos', 'Outros']
const CATEGORIAS_DESPESA = ['Aluguel', 'Energia', 'Água', 'Internet', 'Folha de Pagamento', 'Manutenção', 'Limpeza', 'Marketing', 'Equipamentos', 'Outros']

export default function Financeiro({ onClose }: Props) {
  const { transacoes, professores, addTransacao } = useDataStore()
  const [subModal, setSubModal] = useState<ModalType>(null)
  const [categoria, setCategoria] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])

  const receitas = transacoes.filter(t => t.tipo === 'receita')
  const despesas = transacoes.filter(t => t.tipo === 'despesa')
  const totalReceitas = receitas.reduce((s, t) => s + t.valor, 0)
  const totalDespesas = despesas.reduce((s, t) => s + t.valor, 0)
  const saldo = totalReceitas - totalDespesas

  const folhaMes = professores.filter(p => p.status === 'ativo').reduce((s, p) => s + p.salario, 0)

  const pagos = receitas.filter(t => t.status === 'pago').length
  const pendentes = receitas.filter(t => t.status === 'pendente').length
  const atrasados = receitas.filter(t => t.status === 'atrasado').length

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

  const formatValor = (v: string) => {
    const digits = v.replace(/\D/g, '')
    if (!digits) return ''
    const num = parseInt(digits) / 100
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const valorNumerico = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoria || !valor || valorNumerico <= 0) return
    addTransacao({
      tipo: subModal as 'receita' | 'despesa',
      categoria,
      descricao,
      valor: valorNumerico,
      data,
      status: subModal === 'receita' ? 'pago' : undefined,
    })
    setSubModal(null); setCategoria(''); setDescricao(''); setValor(''); setData(new Date().toISOString().split('T')[0])
  }

  const categorias = subModal === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA

  if (subModal) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono">{subModal === 'receita' ? 'Novo Recebimento' : 'Nova Despesa'}</h2>
              <p className="text-[#71717a] text-xs mt-0.5">{subModal === 'receita' ? 'Registre um recebimento' : 'Registre uma despesa'}</p>
            </div>
            <button onClick={() => setSubModal(null)} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={handleAdd} className="p-5 space-y-4">
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]">
                <option value="">Selecione</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Descrição</label>
              <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
            </div>
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Valor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm font-mono">R$</span>
                <input
                  inputMode="numeric"
                  value={valor}
                  onChange={e => setValor(formatValor(e.target.value))}
                  placeholder="0,00"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setSubModal(null)}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-2.5 text-sm transition-colors">Cancelar</button>
              <button type="submit"
                className={`flex-1 ${subModal === 'receita' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-red-500 hover:bg-red-600'} text-${subModal === 'receita' ? 'black' : 'white'} font-semibold rounded-xl py-2.5 text-sm transition-colors`}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-bold text-white font-mono text-lg">Financeiro</h2>
            <p className="text-[#71717a] text-xs mt-0.5">Extrato completo de receitas e despesas da academia</p>
          </div>
          <button onClick={onClose} className="text-[#52525b] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-5">
          <div className="flex gap-3">
            <button onClick={() => setSubModal('receita')}
              className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm py-3 rounded-xl transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7-7 7 7" /></svg>
              Novo Recebimento
            </button>
            <button onClick={() => setSubModal('despesa')}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-white font-semibold text-sm py-3 rounded-xl transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              Nova Despesa
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total de Receitas', value: fmt(totalReceitas), color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/5 border-[#22c55e]/20' },
              { label: 'Total de Despesas', value: fmt(totalDespesas), color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/20' },
              { label: 'Saldo Atual', value: fmt(saldo), color: saldo >= 0 ? 'text-white' : 'text-red-400', bg: 'bg-[#1a1a1a] border-[#2a2a2a]' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} border rounded-xl p-3`}>
                <p className="text-[#71717a] text-xs mb-1">{c.label}</p>
                <p className={`text-lg font-bold font-mono ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm">Folha de Pagamento dos Professores</p>
                <p className="text-[#52525b] text-xs">Referência {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })} · vencimento padrão no 5º dia útil</p>
              </div>
              <span className="text-xs bg-[#1a2a3a] text-blue-400 px-2 py-1 rounded-full">Ajustes: 0</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a1a1a] rounded-xl p-3">
                <p className="text-[#71717a] text-xs mb-1">Total Base</p>
                <p className="text-white font-bold font-mono text-lg">{fmt(folhaMes)}</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-xl p-3">
                <p className="text-[#71717a] text-xs mb-1">Total Ajustado</p>
                <p className="text-[#22c55e] font-bold font-mono text-lg">{fmt(folhaMes)}</p>
              </div>
            </div>
            {professores.filter(p => p.status === 'ativo').length === 0 && (
              <p className="text-[#52525b] text-sm mt-3">Nenhuma provisão de folha encontrada para este mês.</p>
            )}
          </div>

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm">Recebimentos Recentes</p>
                <p className="text-[#52525b] text-xs">Confirmações automáticas recebidas por webhook do provedor</p>
              </div>
              <div className="flex gap-2">
                <span className="text-xs bg-[#22c55e]/15 text-[#22c55e] px-2 py-1 rounded-full">Pago: {pagos}</span>
                <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-1 rounded-full">Pendente: {pendentes}</span>
                <span className="text-xs bg-red-500/15 text-red-400 px-2 py-1 rounded-full">Atrasado: {atrasados}</span>
              </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white text-sm font-semibold">Previsto x Realizado</p>
                  <p className="text-[#52525b] text-xs">Mensalidades ativas comparadas ao caixa confirmado</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#71717a]">Previsto</span>
                    <span className="text-[#a1a1aa] font-mono">{fmt(totalReceitas + 89.9)}</span>
                  </div>
                  <div className="w-full bg-[#2a2a2a] rounded-full h-1.5">
                    <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#71717a]">Realizado</span>
                    <span className="text-[#22c55e] font-mono">{fmt(totalReceitas)}</span>
                  </div>
                  <div className="w-full bg-[#2a2a2a] rounded-full h-1.5">
                    <div className="bg-[#22c55e] h-1.5 rounded-full" style={{ width: `${Math.min(100, (totalReceitas / (totalReceitas + 89.9)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {receitas.slice(-5).reverse().map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5 border-b border-[#1a1a1a] last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0" />
                  <p className="flex-1 text-white text-xs truncate">{t.descricao || t.categoria}</p>
                  <p className="text-[#22c55e] text-xs font-mono">{fmt(t.valor)}</p>
                  <p className="text-[#52525b] text-xs">{new Date(t.data).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
              {despesas.slice(-3).reverse().map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5 border-b border-[#1a1a1a] last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <p className="flex-1 text-white text-xs truncate">{t.descricao || t.categoria}</p>
                  <p className="text-red-400 text-xs font-mono">-{fmt(t.valor)}</p>
                  <p className="text-[#52525b] text-xs">{new Date(t.data).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
