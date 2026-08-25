import { useState } from 'react'
import { useDataStore } from '../../../store/dataStore'

interface Props { onClose: () => void }

const MODALIDADES_OPCOES = ['Musculação', 'Funcional', 'Crossfit', 'Personal', 'Pilates', 'Natação', 'HIIT', 'Yoga', 'Hidroginástica']
const BENEFICIOS_OPCOES = [
  'Acesso livre à musculação', 'Aulas coletivas inclusas', 'Armário',
  'Vestiário VIP', 'Avaliação física', 'Personal 2x/semana',
  'Suporte nutricional', 'Sem taxa de matrícula',
]
const DURACOES = ['1 mês', '3 meses', '6 meses', '12 meses']

function formatPreco(v: string) {
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits) / 100
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Planos({ onClose }: Props) {
  const { planos, addPlano } = useDataStore()
  const [showCriar, setShowCriar] = useState(false)
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [duracao, setDuracao] = useState('')
  const [modalidades, setModalidades] = useState<string[]>([])
  const [beneficios, setBeneficios] = useState<string[]>([])
  const [beneficioCustom, setBeneficioCustom] = useState('')
  const [formError, setFormError] = useState('')

  const toggleMod = (m: string) => setModalidades(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  const toggleBen = (b: string) => setBeneficios(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const removeBen = (b: string) => setBeneficios(prev => prev.filter(x => x !== b))

  const precoNumerico = parseFloat(preco.replace(/\./g, '').replace(',', '.')) || 0

  const [saving, setSaving] = useState(false)

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!nome.trim()) { setFormError('Informe o nome do plano.'); return }
    if (precoNumerico <= 0) { setFormError('Informe um preço válido.'); return }
    if (!duracao) { setFormError('Selecione a duração.'); return }
    setSaving(true)
    try {
      await addPlano({ nome: nome.trim(), preco: precoNumerico, duracao, modalidades, beneficios, ativo: true })
      setShowCriar(false)
      setNome(''); setPreco(''); setDuracao(''); setModalidades([]); setBeneficios([]); setFormError('')
    } catch (err) {
      setFormError('Erro ao salvar plano. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const ativos = planos.filter(p => p.ativo)
  const inativos = planos.filter(p => !p.ativo)

  const nivelColor = (preco: number) => preco < 100 ? 'text-[#22c55e] bg-[#22c55e]/10' : preco < 200 ? 'text-blue-400 bg-blue-400/10' : 'text-yellow-400 bg-yellow-400/10'

  if (showCriar) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono">Criar Novo Plano</h2>
              <p className="text-[#71717a] text-xs">Monte o plano com modalidades e benefícios</p>
            </div>
            <button onClick={() => setShowCriar(false)} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleCriar} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-auto p-5 space-y-5">
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Nome do Plano</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Plano Gold" autoFocus
                className="w-full bg-[#1a1a1a] border border-[#22c55e] rounded-xl px-4 py-3 text-white text-sm focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Preço</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm font-mono">R$</span>
                  <input
                    inputMode="numeric"
                    value={preco}
                    onChange={e => setPreco(formatPreco(e.target.value))}
                    placeholder="0,00"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#22c55e] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Duração</label>
                <select value={duracao} onChange={e => setDuracao(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#22c55e]">
                  <option value="">Selecione</option>
                  {DURACOES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-xs mb-2">Modalidades cobertas</label>
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3">
                <p className="text-[#52525b] text-xs mb-3">Selecione quais modalidades esse plano libera para o aluno.</p>
                <div className="flex flex-wrap gap-2">
                  {MODALIDADES_OPCOES.map(m => (
                    <button key={m} type="button" onClick={() => toggleMod(m)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                        modalidades.includes(m)
                          ? 'bg-white text-black border-white font-medium'
                          : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#a1a1aa] hover:border-[#22c55e]/50'
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-xs mb-2">Benefícios do plano</label>
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3 space-y-3">
                <p className="text-[#52525b] text-xs">Clique para adicionar. Clique novamente para remover.</p>
                <div className="flex flex-wrap gap-2">
                  {BENEFICIOS_OPCOES.map(b => (
                    <button key={b} type="button" onClick={() => toggleBen(b)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                        beneficios.includes(b)
                          ? 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e]'
                          : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#a1a1aa] hover:border-[#22c55e]/30'
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>

                {/* Adicionar benefício personalizado */}
                <div className="border-t border-[#1f1f1f] pt-3">
                  <p className="text-[#52525b] text-xs mb-2">Adicionar benefício personalizado</p>
                  <div className="flex gap-2">
                    <input
                      value={beneficioCustom}
                      onChange={e => setBeneficioCustom(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (beneficioCustom.trim()) { setBeneficios(prev => [...prev, beneficioCustom.trim()]); setBeneficioCustom('') }
                        }
                      }}
                      placeholder="Ex: Congelamento de mensalidade"
                      className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#22c55e]"
                    />
                    <button
                      type="button"
                      onClick={() => { if (beneficioCustom.trim()) { setBeneficios(prev => [...prev, beneficioCustom.trim()]); setBeneficioCustom('') } }}
                      className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-xs px-3 py-2 rounded-xl transition-colors whitespace-nowrap">
                      + Adicionar
                    </button>
                  </div>
                </div>

                {/* Benefícios selecionados como chips removíveis */}
                {beneficios.length > 0 && (
                  <div className="border-t border-[#1f1f1f] pt-3">
                    <p className="text-[#52525b] text-xs mb-2">Selecionados ({beneficios.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {beneficios.map(b => (
                        <span key={b} className="flex items-center gap-1.5 text-xs bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] pl-2.5 pr-1.5 py-1 rounded-full">
                          {b}
                          <button type="button" onClick={() => removeBen(b)} className="hover:text-white transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>
            )}
          </div>

            <div className="flex gap-2 p-5 border-t border-[#1f1f1f]">
              <button type="button" onClick={() => { setShowCriar(false); setFormError('') }}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-3 text-sm transition-colors">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-3 text-sm transition-colors">
                {saving ? 'Salvando...' : 'Criar Plano'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-bold text-white font-mono text-lg">Planos da Academia</h2>
            <p className="text-[#71717a] text-xs mt-0.5">Gerencie os planos e preços oferecidos</p>
          </div>
          <button onClick={onClose} className="text-[#52525b] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <button onClick={() => setShowCriar(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm py-3.5 rounded-xl transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            Criar Novo Plano
          </button>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-semibold text-sm">Planos Ativos</p>
              <span className="text-xs bg-[#1a1a1a] text-[#22c55e] border border-[#22c55e]/30 px-2.5 py-0.5 rounded-full">{ativos.length}</span>
            </div>
            {ativos.length === 0 ? (
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-4 py-6 text-center text-[#52525b] text-sm">
                Nenhum plano nesta seção.
              </div>
            ) : (
              <div className="space-y-2">
                {ativos.map(p => (
                  <div key={p.id} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${nivelColor(p.preco)}`}>{p.nome}</span>
                        <span className="text-[#52525b] text-xs">{p.duracao}</span>
                      </div>
                      <p className="text-white font-bold font-mono">R$ {p.preco.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {p.modalidades.map(m => <span key={m} className="text-[10px] bg-[#1a1a1a] text-[#a1a1aa] px-2 py-0.5 rounded">{m}</span>)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.beneficios.slice(0, 3).map(b => <span key={b} className="text-[10px] text-[#52525b]">· {b}</span>)}
                      {p.beneficios.length > 3 && <span className="text-[10px] text-[#3f3f46]">+{p.beneficios.length - 3} mais</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-semibold text-sm">Planos Inativos</p>
              <span className="text-xs bg-[#1a1a1a] text-[#71717a] border border-[#2a2a2a] px-2.5 py-0.5 rounded-full">{inativos.length}</span>
            </div>
            {inativos.length === 0 ? (
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-4 py-6 text-center text-[#52525b] text-sm">
                Nenhum plano nesta seção.
              </div>
            ) : (
              <div className="space-y-2">
                {inativos.map(p => (
                  <div key={p.id} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <span className="text-[#a1a1aa] text-sm">{p.nome}</span>
                      <p className="text-[#71717a] font-mono text-sm">R$ {p.preco.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
