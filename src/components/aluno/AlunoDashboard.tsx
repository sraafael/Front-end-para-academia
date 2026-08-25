import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Aluno, Plano, TreinoFicha } from '../../types'
import { CONQUISTAS_CATALOGO } from '../../constants'
import { useAuthStore } from '../../store/authStore'
import { useDataStore } from '../../store/dataStore'

function getGreeting(nome: string): string {
  const h = new Date().getHours()
  const first = nome.split(' ')[0]
  if (h < 5) return `Boa madrugada, ${first}!`
  if (h < 12) return `Bom dia, ${first}! Bem-vindo de volta ao seu treino.`
  if (h < 18) return `Boa tarde, ${first}! Pronto para treinar?`
  return `Boa noite, ${first}! Hora de superar seus limites.`
}

function getFraseDinamica(aluno: Aluno): string {
  const h = new Date().getHours()
  const diasSemana = new Date().getDay()
  const treinou = aluno.frequencia.some(f => f.data === new Date().toISOString().split('T')[0] && f.presente)

  if (treinou) return '✅ Você já treinou hoje. Ótimo trabalho, continue assim!'
  if (aluno.pagamentoStatus === 'atrasado') return '⚠️ Sua mensalidade está em atraso. Regularize para continuar treinando.'
  if (aluno.sequencia >= 7) return `🔥 ${aluno.sequencia} dias consecutivos! Você está incrível.`
  if (aluno.metaSemanal.concluidos >= aluno.metaSemanal.meta) return '🏆 Meta semanal batida! Você arrasou nesta semana.'
  if (h < 12) return 'Continue firme no seu treino de hoje!'
  if (h < 15) return 'Um treino no meio do dia é sempre uma boa ideia!'
  if (diasSemana === 1) return 'Semana nova, começo forte. Bora treinar!'
  if (diasSemana === 5) return 'Quinta-feira é dia de dar tudo na academia!'
  if (diasSemana === 6) return 'Finalize a semana com chave de ouro!'
  return 'Cada treino é um passo para a melhor versão de você.'
}

const NIVEL_CORES = {
  bronze: 'text-amber-600 bg-amber-600/10 border-amber-600/30',
  prata: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
  ouro: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  platina: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/30',
}

function MetaSemanalCard({ aluno }: { aluno: Aluno }) {
  const hoje = new Date()
  const diasSemana: { date: Date; label: string; presente: boolean }[] = []
  const dayOfWeek = hoje.getDay()
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  for (let i = 0; i < 7; i++) {
    const d = new Date(inicioSemana)
    d.setDate(inicioSemana.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const presente = aluno.frequencia.some(f => f.data === dateStr && f.presente)
    diasSemana.push({ date: d, label: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][i], presente })
  }

  const isToday = (d: Date) => d.toDateString() === hoje.toDateString()
  const isFuture = (d: Date) => d > hoje

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#71717a] text-xs font-mono tracking-widest">META SEMANAL</p>
        <span className="text-[#22c55e] text-xs font-mono">{aluno.metaSemanal.concluidos}/{aluno.metaSemanal.meta}</span>
      </div>
      <div className="flex gap-1 justify-between">
        {diasSemana.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[#52525b] text-[10px]">{d.label}</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-medium border transition-colors ${
              d.presente ? 'bg-[#22c55e] border-[#22c55e] text-black' :
              isToday(d.date) ? 'border-[#22c55e]/50 text-[#22c55e] bg-[#22c55e]/5' :
              isFuture(d.date) ? 'border-[#1f1f1f] text-[#3f3f46]' :
              'border-[#1f1f1f] bg-[#1a1a1a] text-[#3f3f46]'
            }`}>
              {d.presente ? '✓' : d.date.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 w-full bg-[#1a1a1a] rounded-full h-1">
        <div className="bg-[#22c55e] h-1 rounded-full transition-all"
          style={{ width: `${(aluno.metaSemanal.concluidos / aluno.metaSemanal.meta) * 100}%` }} />
      </div>
    </div>
  )
}

function ConquistasModal({ aluno, onClose }: { aluno: Aluno; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-bold text-white font-mono">Conquistas</h2>
            <p className="text-[#71717a] text-xs">{aluno.conquistasDesbloqueadas.length}/{CONQUISTAS_CATALOGO.length} desbloqueadas</p>
          </div>
          <button onClick={onClose} className="text-[#52525b] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            {CONQUISTAS_CATALOGO.map(c => {
              const desbloqueada = aluno.conquistasDesbloqueadas.includes(c.id)
              return (
                <div key={c.id} className={`border rounded-xl p-4 transition-all ${desbloqueada ? `${NIVEL_CORES[c.nivel as keyof typeof NIVEL_CORES]} border` : 'border-[#1f1f1f] bg-[#0f0f0f] opacity-50'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{desbloqueada ? c.icon : '🔒'}</span>
                    <div>
                      <p className={`text-sm font-semibold ${desbloqueada ? 'text-white' : 'text-[#52525b]'}`}>{c.nome}</p>
                      <span className={`text-[10px] font-mono uppercase tracking-wide ${desbloqueada ? NIVEL_CORES[c.nivel as keyof typeof NIVEL_CORES].split(' ')[0] : 'text-[#3f3f46]'}`}>{c.nivel}</span>
                    </div>
                  </div>
                  <p className={`text-xs ${desbloqueada ? 'text-[#a1a1aa]' : 'text-[#3f3f46]'}`}>{c.descricao}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoricoPesoModal({ aluno, onClose, onAtualizar }: { aluno: Aluno; onClose: () => void; onAtualizar: (p: number) => void }) {
  const [novoPeso, setNovoPeso] = useState('')

  const chartData = aluno.historicoPeso.map(h => ({
    data: new Date(h.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    peso: h.peso,
  }))

  const min = aluno.historicoPeso.length > 0 ? Math.min(...aluno.historicoPeso.map(h => h.peso)) - 1 : 0
  const max = aluno.historicoPeso.length > 0 ? Math.max(...aluno.historicoPeso.map(h => h.peso)) + 1 : 100
  const diff = aluno.historicoPeso.length > 1
    ? aluno.historicoPeso[aluno.historicoPeso.length - 1].peso - aluno.historicoPeso[0].peso
    : 0

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-bold text-white font-mono">Histórico de Peso</h2>
            <p className="text-[#71717a] text-xs">Sua evolução ao longo do tempo</p>
          </div>
          <button onClick={onClose} className="text-[#52525b] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3 text-center">
              <p className="text-[#71717a] text-[10px] mb-1">INICIAL</p>
              <p className="text-white font-bold font-mono">{aluno.historicoPeso[0]?.peso ?? '—'} kg</p>
            </div>
            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3 text-center">
              <p className="text-[#71717a] text-[10px] mb-1">ATUAL</p>
              <p className="text-white font-bold font-mono">{aluno.historicoPeso[aluno.historicoPeso.length - 1]?.peso ?? '—'} kg</p>
            </div>
            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3 text-center">
              <p className="text-[#71717a] text-[10px] mb-1">VARIAÇÃO</p>
              <p className={`font-bold font-mono ${diff < 0 ? 'text-[#22c55e]' : diff > 0 ? 'text-red-400' : 'text-[#71717a]'}`}>
                {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
              </p>
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              </svg>
              <p className="text-white text-sm font-semibold">Evolução Corporal</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="data" tick={{ fill: '#52525b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[min, max]} tick={{ fill: '#52525b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#a1a1aa' }}
                  itemStyle={{ color: '#f97316' }}
                  formatter={(v) => [`${v} kg`, 'Peso']}
                />
                <Line type="monotone" dataKey="peso" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <p className="text-white text-sm font-semibold mb-3">Atualizar Peso</p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={novoPeso}
                onChange={e => setNovoPeso(e.target.value)}
                placeholder="Ex: 78,5"
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] font-mono"
              />
              <button
                onClick={() => {
                  const p = parseFloat(novoPeso.replace(',', '.'))
                  if (p > 0) { onAtualizar(p); setNovoPeso('') }
                }}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TreinoTab({ treino, onCheckSerie }: { treino: TreinoFicha; onCheckSerie: (exId: string, serieNum: number, carga: number, reps: number) => void }) {
  const [cargas, setCargas] = useState<Record<string, Record<number, { carga: string; reps: string }>>>({})

  const getVal = (exId: string, serieNum: number, campo: 'carga' | 'reps', padrao: number) =>
    cargas[exId]?.[serieNum]?.[campo] ?? String(padrao)

  const setVal = (exId: string, serieNum: number, campo: 'carga' | 'reps', val: string) =>
    setCargas(prev => ({ ...prev, [exId]: { ...prev[exId], [serieNum]: { ...prev[exId]?.[serieNum], [campo]: val } } }))

  const totalSeries = treino.exercicios.reduce((s, e) => s + e.series, 0)
  const concluidas = treino.exercicios.reduce((s, e) => s + e.seriesRealizadas.filter(sr => sr.concluida).length, 0)
  const pct = totalSeries > 0 ? Math.round((concluidas / totalSeries) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <h2 className="text-white font-semibold">{treino.nome} — {treino.grupo}</h2>
          </div>
          <span className="text-[#22c55e] text-sm font-mono">{pct}%</span>
        </div>
        <div className="w-full bg-[#1a1a1a] rounded-full h-1 mb-5">
          <div className="bg-[#22c55e] h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="space-y-4">
          {treino.exercicios.map(ex => (
            <div key={ex.id} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#71717a] text-xs font-mono flex-shrink-0">
                  {ex.series}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{ex.nome}</p>
                  <p className="text-[#52525b] text-xs">{ex.series}×{ex.reps} &nbsp;|&nbsp; Carga: {ex.cargaSugerida}kg</p>
                </div>
              </div>

              <div className="space-y-2">
                {ex.seriesRealizadas.map(sr => {
                  const concluida = sr.concluida
                  const cargaVal = getVal(ex.id, sr.serieNum, 'carga', sr.cargaReal)
                  const repsVal = getVal(ex.id, sr.serieNum, 'reps', sr.repeticoes)
                  return (
                    <div key={sr.serieNum} className={`flex items-center gap-3 bg-[#1a1a1a] rounded-xl px-4 py-3 border transition-colors ${concluida ? 'border-[#22c55e]/30' : 'border-[#2a2a2a]'}`}>
                      <p className={`text-xs w-12 flex-shrink-0 ${concluida ? 'text-[#22c55e]' : 'text-[#71717a]'}`}>Série {sr.serieNum}</p>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[#52525b] text-[10px] font-mono mb-1">CARGA REAL</p>
                          <input
                            type="number"
                            value={cargaVal}
                            onChange={e => setVal(ex.id, sr.serieNum, 'carga', e.target.value)}
                            className={`w-full bg-[#111111] border rounded-lg px-2 py-1.5 text-white text-sm font-mono focus:outline-none ${concluida ? 'border-[#22c55e]/30' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`}
                          />
                        </div>
                        <div>
                          <p className="text-[#52525b] text-[10px] font-mono mb-1">REPETIÇÕES</p>
                          <input
                            type="number"
                            value={repsVal}
                            onChange={e => setVal(ex.id, sr.serieNum, 'reps', e.target.value)}
                            className={`w-full bg-[#111111] border rounded-lg px-2 py-1.5 text-white text-sm font-mono focus:outline-none ${concluida ? 'border-[#22c55e]/30' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => onCheckSerie(ex.id, sr.serieNum, parseFloat(cargaVal) || 0, parseInt(repsVal) || 0)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 border ${
                          concluida
                            ? 'bg-[#22c55e]/15 border-[#22c55e]/30 text-[#22c55e]'
                            : 'bg-[#222] border-[#2a2a2a] text-white hover:bg-[#22c55e] hover:text-black hover:border-[#22c55e]'
                        }`}
                      >
                        {concluida ? '✓' : 'Check'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MensalidadeTab({ aluno, plano }: { aluno: Aluno; plano: Plano | undefined }) {
  const [showPix, setShowPix] = useState(false)

  const statusMap = {
    pago: { label: 'Em dia', cls: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30' },
    pendente: { label: 'Pagamento pendente', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    atrasado: { label: 'Vencido', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  }
  const statusCfg = statusMap[aluno.pagamentoStatus]

  const mesMatricula = new Date(aluno.matriculaData).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })

  if (showPix) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-sm">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono">Pagar com PIX</h2>
              <p className="text-[#71717a] text-xs">Escaneie o QR Code ou copie a chave PIX para realizar o pagamento.</p>
            </div>
            <button onClick={() => setShowPix(false)} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-[#0f0f0f] border border-[#22c55e]/30 rounded-xl p-6 flex flex-col items-center justify-center">
              <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
                <rect x="5" y="5" width="35" height="35" rx="4" stroke="#22c55e" strokeWidth="4" fill="none" />
                <rect x="15" y="15" width="15" height="15" fill="#22c55e" rx="2" />
                <rect x="60" y="5" width="35" height="35" rx="4" stroke="#22c55e" strokeWidth="4" fill="none" />
                <rect x="70" y="15" width="15" height="15" fill="#22c55e" rx="2" />
                <rect x="5" y="60" width="35" height="35" rx="4" stroke="#22c55e" strokeWidth="4" fill="none" />
                <rect x="15" y="70" width="15" height="15" fill="#22c55e" rx="2" />
                <rect x="60" y="60" width="10" height="10" fill="#22c55e" rx="1" />
                <rect x="75" y="60" width="10" height="10" fill="#22c55e" rx="1" />
                <rect x="60" y="75" width="10" height="10" fill="#22c55e" rx="1" />
                <rect x="75" y="75" width="20" height="20" fill="#22c55e" rx="1" />
                <rect x="45" y="5" width="10" height="10" fill="#22c55e" rx="1" />
                <rect x="45" y="45" width="10" height="10" fill="#22c55e" rx="1" />
                <rect x="5" y="45" width="10" height="10" fill="#22c55e" rx="1" />
                <rect x="20" y="45" width="10" height="10" fill="#22c55e" rx="1" />
              </svg>
              <p className="text-[#52525b] text-xs mt-3">QR Code PIX</p>
            </div>

            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
              <p className="text-[#71717a] text-xs mb-2">Chave PIX (e-mail)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-white text-sm font-mono truncate">studiobiofitness@pix.com.br</code>
                <button
                  onClick={() => navigator.clipboard.writeText('studiobiofitness@pix.com.br')}
                  className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-white border border-[#2a2a2a] hover:border-[#22c55e] px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copiar
                </button>
              </div>
            </div>

            <div className="bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-4">
              <p className="text-[#52525b] text-xs mb-1">Valor da mensalidade</p>
              <p className="text-white font-bold font-mono text-xl">R$ {plano?.preco.toFixed(2).replace('.', ',') ?? '0,00'}</p>
              <p className="text-[#52525b] text-xs mt-2">Após o pagamento, envie o comprovante na recepção para confirmação.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#1a3a1a] flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8">
                <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div>
              <p className="text-[#71717a] text-xs">Mensalidade Atual</p>
              <p className="text-white font-bold font-mono text-2xl mt-0.5">R$ {plano?.preco.toFixed(2).replace('.', ',') ?? '—'}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${statusCfg.cls}`}>{statusCfg.label}</span>
            <p className="text-[#52525b] text-xs mt-1.5">
              Próximo vencimento: <span className="text-[#a1a1aa]">
                {aluno.vencimento ? new Date(aluno.vencimento).toLocaleDateString('pt-BR') : 'Sem previsão'}
              </span>
            </p>
          </div>
        </div>

        {aluno.pagamentoStatus !== 'pago' && (
          <button onClick={() => setShowPix(true)}
            className="mt-4 flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            <svg width="16" height="16" viewBox="0 0 100 100" fill="none">
              <rect x="5" y="5" width="35" height="35" rx="4" stroke="currentColor" strokeWidth="8" fill="none" />
              <rect x="60" y="5" width="35" height="35" rx="4" stroke="currentColor" strokeWidth="8" fill="none" />
              <rect x="5" y="60" width="35" height="35" rx="4" stroke="currentColor" strokeWidth="8" fill="none" />
              <rect x="60" y="60" width="35" height="35" fill="currentColor" rx="4" />
            </svg>
            Pagar com PIX
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8"><path d="M6.5 6.5a6 6 0 0 0 0 11M17.5 6.5a6 6 0 0 1 0 11M3 12h18M12 3v18" /></svg>, label: 'Plano', value: plano?.nome ?? '—', iconBg: 'bg-[#1a3a1a]' },
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>, label: 'Membro desde', value: mesMatricula, iconBg: 'bg-[#1a2a3a]' },
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: 'Forma de pagamento', value: aluno.formaPagamento, iconBg: 'bg-[#2a2a1a]' },
        ].map(c => (
          <div key={c.label} className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 flex flex-col items-center text-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>{c.icon}</div>
            <p className="text-[#71717a] text-xs">{c.label}</p>
            <p className="text-white font-semibold text-sm">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AlunoDashboard() {
  const navigate = useNavigate()
  const { currentAlunoId, logout } = useAuthStore()
  const { alunos, planos, loadAluno, updatePeso, checkSerie, loading } = useDataStore()
  
  const aluno = alunos.find(a => a.id === currentAlunoId)
  const plano = planos.find(p => p.id === aluno?.planoId)

  // 1. TODOS OS HOOKS NO TOPO: Nada de retornos precoces antes disso
  const [tab, setTab] = useState<string>('mensalidade')
  const [showConquistas, setShowConquistas] = useState(false)
  const [showPeso, setShowPeso] = useState(false)

  useEffect(() => {
    if (currentAlunoId) loadAluno(currentAlunoId)
  }, [currentAlunoId, loadAluno])

  useEffect(() => {
    if (aluno?.treinos && aluno.treinos.length > 0) {
      setTab(aluno.treinos[0].id)
    }
  }, [aluno])

  // 2. RETORNOS PRECOCES: Agora eles não bloqueiam a leitura dos hooks
  if (loading && !aluno) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  
  if (!aluno) return null

  // 3. FUNÇÕES COMUNS
  const onLogout = () => { logout(); navigate('/login') }
  const onUpdatePeso = (p: number) => updatePeso(aluno.id, p)
  const onCheckSerie = (treinoId: string, exId: string, sn: number, carga: number, reps: number) =>
    checkSerie(aluno.id, treinoId, exId, sn, carga, reps)

  const pesoAtual = aluno.historicoPeso[aluno.historicoPeso.length - 1]?.peso

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1f1f1f] px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1a3a1a] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M6.5 6.5a6 6 0 0 0 0 11M17.5 6.5a6 6 0 0 1 0 11M3 12h18M12 3v18" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">FitPro</p>
            <p className="text-[#52525b] text-xs">Meu Treino</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 text-[#71717a] hover:text-white transition-colors text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sair
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono">{getGreeting(aluno.nome)}</h1>
          <p className="text-[#71717a] text-sm mt-1">{getFraseDinamica(aluno)}</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Sequência */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <span className="text-xl">🔥</span>
              </div>
              <div>
                <p className="text-[#71717a] text-xs">Sequência</p>
                <p className="text-white font-bold font-mono text-xl">{aluno.sequencia} / <span className="text-[#52525b] text-base">7</span></p>
              </div>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-1">
              <div className="bg-red-500 h-1 rounded-full" style={{ width: `${Math.min(100, (aluno.sequencia / 7) * 100)}%` }} />
            </div>
          </div>

          {/* Meta Semanal */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#1a3a1a] flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <div>
                <p className="text-[#71717a] text-xs">Meta Semanal</p>
                <p className="text-white font-bold font-mono text-xl">{aluno.metaSemanal.concluidos}/{aluno.metaSemanal.meta}</p>
              </div>
            </div>
            <MetaSemanalCard aluno={aluno} />
          </div>

          {/* Conquistas */}
          <button onClick={() => setShowConquistas(true)}
            className="bg-[#111111] border border-[#1f1f1f] hover:border-yellow-400/30 rounded-2xl p-4 text-left transition-all group">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center">
                <span className="text-xl">🏆</span>
              </div>
              <div>
                <p className="text-[#71717a] text-xs">Conquistas</p>
                <p className="text-white font-bold font-mono text-xl">{aluno.conquistasDesbloqueadas.length}</p>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {CONQUISTAS_CATALOGO.filter(c => aluno.conquistasDesbloqueadas.includes(c.id)).slice(0, 4).map(c => (
                <span key={c.id} className="text-base">{c.icon}</span>
              ))}
              {aluno.conquistasDesbloqueadas.length > 4 && (
                <span className="text-[#52525b] text-xs self-center">+{aluno.conquistasDesbloqueadas.length - 4}</span>
              )}
            </div>
          </button>

          {/* Peso Atual */}
          <button onClick={() => setShowPeso(true)}
            className="bg-[#111111] border border-[#1f1f1f] hover:border-blue-400/30 rounded-2xl p-4 text-left transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#1a2a3a] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[#71717a] text-xs">Peso Atual</p>
                <p className="text-white font-bold font-mono text-xl">{pesoAtual ? `${pesoAtual} kg` : '—'}</p>
              </div>
            </div>
            <p className="text-red-400 text-xs flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
              Acompanhe sua evolução corporal.
            </p>
            <div className="mt-2 bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg px-3 py-1.5">
              <p className="text-[#52525b] text-xs">Atualizar Peso</p>
            </div>
          </button>
        </div>

        {/* Treino tabs */}
        {(aluno.treinos.length > 0 || true) && (
          <div>
            <div className="flex gap-1 bg-[#111111] border border-[#1f1f1f] rounded-xl p-1 mb-4 overflow-x-auto">
              {aluno.treinos.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'bg-[#1f1f1f] text-white' : 'text-[#71717a] hover:text-white'}`}>
                  {t.nome}
                </button>
              ))}
              <button onClick={() => setTab('mensalidade')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === 'mensalidade' ? 'bg-[#1f1f1f] text-white' : 'text-[#71717a] hover:text-white'}`}>
                Mensalidade
              </button>
            </div>

            {aluno.treinos.map(t => t.id === tab && (
              <TreinoTab key={t.id} treino={t}
                onCheckSerie={(exId, serieNum, carga, reps) => onCheckSerie(t.id, exId, serieNum, carga, reps)} />
            ))}
            {tab === 'mensalidade' && <MensalidadeTab aluno={aluno} plano={plano} />}
            {aluno.treinos.length === 0 && tab !== 'mensalidade' && (
              <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-10 text-center">
                <p className="text-[#52525b]">Nenhuma ficha de treino cadastrada ainda.</p>
                <p className="text-[#3f3f46] text-xs mt-1">Aguarde seu professor montar sua ficha.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {showConquistas && <ConquistasModal aluno={aluno} onClose={() => setShowConquistas(false)} />}
      {showPeso && <HistoricoPesoModal aluno={aluno} onClose={() => setShowPeso(false)} onAtualizar={p => { onUpdatePeso(p); setShowPeso(false) }} />}
    </div>
  )
}