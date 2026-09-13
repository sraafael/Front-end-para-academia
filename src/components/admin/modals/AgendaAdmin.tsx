import { useState } from 'react'
import type { Turma } from '../../../types'
import { useDataStore } from '../../../store/dataStore'
import { toLocalDate } from '../../../lib/date'

interface Props { onClose: () => void }

// ── Opções de cadastro ────────────────────────────────────────────────

const MODALIDADES = ['Musculação', 'Funcional', 'Crossfit', 'Personal', 'Pilates', 'Natação', 'HIIT', 'Yoga', 'Hidroginástica']
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function AgendaAdmin({ onClose }: Props) {
  // ── Dados e estado dos modais ─────────────────────────────────────────

  const { turmas, professores, alunos, addTurma, saveAttendance } = useDataStore()
  const [showNovaTurma, setShowNovaTurma] = useState(false)
  const [chamadaTurma, setChamadaTurma] = useState<Turma | null>(null)
  const [presencas, setPresencas] = useState<Record<string, boolean>>({})
  const [salvandoChamada, setSalvandoChamada] = useState(false)
  const [chamadaFeedback, setChamadaFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Campos da nova turma ────────────────────────────────────────────────

  const [nome, setNome] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [horario, setHorario] = useState('')
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([])
  const [capacidade, setCapacidade] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [sala, setSala] = useState('')

  const toggleDia = (d: string) => setDiasSelecionados(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  // ── Cadastro da turma ──────────────────────────────────────────────────

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!nome || !modalidade || !horario || !professorId || diasSelecionados.length === 0) {
      setFormError('Preencha nome, modalidade, horário, dias e professor.')
      return
    }
    setSaving(true)
    try {
      await addTurma({ nome, modalidade, horario, diasSemana: diasSelecionados, capacidade: parseInt(capacidade) || 20, professorId, sala, alunoIds: [] })
      setShowNovaTurma(false)
      setNome(''); setModalidade(''); setHorario(''); setDiasSelecionados([]); setCapacidade(''); setProfessorId(''); setSala('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a turma.')
    } finally {
      setSaving(false)
    }
  }

  const hoje = toLocalDate()

  // ── Registro de presenças ──────────────────────────────────────────────

  const abrirChamada = (turma: Turma) => {
    const alunosDaTurma = alunos.filter(aluno => turma.alunoIds.includes(aluno.id))
    setPresencas(Object.fromEntries(alunosDaTurma.map(aluno => [
      aluno.id,
      aluno.frequencia.find(item => item.data === hoje)?.presente ?? false,
    ])))
    setChamadaFeedback('')
    setChamadaTurma(turma)
  }

  const salvarChamada = async () => {
    if (!chamadaTurma) return
    setSalvandoChamada(true)
    setChamadaFeedback('')
    try {
      await saveAttendance(chamadaTurma.id, presencas, hoje)
      setChamadaFeedback('Chamada salva no histórico dos alunos.')
    } catch (err) {
      setChamadaFeedback(err instanceof Error ? err.message : 'Não foi possível salvar a chamada.')
    } finally {
      setSalvandoChamada(false)
    }
  }

  const statusConfig = {
    concluida: { label: 'Concluída', cls: 'bg-[#22c55e]/15 text-[#22c55e]' },
    em_andamento: { label: 'Em andamento', cls: 'bg-yellow-500/15 text-yellow-400' },
    proxima: { label: 'Próxima', cls: 'bg-[#1a1a1a] text-[#71717a]' },
    cancelada: { label: 'Cancelada', cls: 'bg-red-500/15 text-red-400' },
  }

  const sorted = [...turmas].sort((a, b) => a.horario.localeCompare(b.horario))

  // ── Interface principal ────────────────────────────────────────────────

  if (chamadaTurma) {
    const alunosDaTurma = alunos.filter(a => chamadaTurma.alunoIds.includes(a.id))
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <p className="text-blue-400 text-xs font-mono mb-0.5">📅 {chamadaTurma.nome}</p>
              <h2 className="font-bold text-white font-mono">Lista de Chamada</h2>
              <p className="text-[#71717a] text-xs">Horário: {chamadaTurma.horario} · {chamadaTurma.alunoIds.length} alunos</p>
            </div>
            <button onClick={() => setChamadaTurma(null)} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white text-sm font-semibold">Marque a presença.</p>
              <p className="text-[#52525b] text-xs flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {chamadaTurma.sala}
              </p>
            </div>
            <div className="space-y-2">
              {alunosDaTurma.map(a => {
                const presente = presencas[a.id] ?? false
                return (
                  <div key={a.id} className="flex items-center gap-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-[#1a2a3a] flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
                      {a.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <p className="flex-1 text-white text-sm">{a.nome}</p>
                    <button
                      onClick={() => setPresencas(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
                        presente
                          ? 'bg-[#22c55e] text-black'
                          : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222]'
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />{presente && <path d="M17 11l2 2 4-4" />}
                      </svg>
                      {presente ? 'Presente' : 'Marcar Presença'}
                    </button>
                  </div>
                )
              })}
              {alunosDaTurma.length === 0 && (
                <p className="text-[#52525b] text-sm text-center py-6">Nenhum aluno matriculado nesta turma.</p>
              )}
            </div>
            {chamadaFeedback && (
              <p className={`text-xs mt-4 px-3 py-2 rounded-xl border ${chamadaFeedback.startsWith('Chamada salva') ? 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20' : 'text-red-300 bg-red-500/10 border-red-500/20'}`}>
                {chamadaFeedback}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setChamadaTurma(null)} className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white text-sm rounded-xl py-2.5">Fechar</button>
              <button onClick={salvarChamada} disabled={salvandoChamada || alunosDaTurma.length === 0}
                className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-semibold text-sm rounded-xl py-2.5">
                {salvandoChamada ? 'Salvando...' : 'Salvar chamada'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showNovaTurma) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono">Criar Nova Turma</h2>
              <p className="text-[#71717a] text-xs mt-0.5">Configure os detalhes da turma</p>
            </div>
            <button onClick={() => setShowNovaTurma(false)} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={handleCriar} className="p-5 space-y-4">
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Nome da Turma</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Musculação - Turma D"
                className="w-full bg-[#1a1a1a] border border-[#22c55e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Modalidade</label>
                <select value={modalidade} onChange={e => setModalidade(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]">
                  <option value="">Selecione</option>
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Horário</label>
                <input type="time" value={horario} onChange={e => setHorario(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
              </div>
            </div>
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-2">Dias da semana</label>
              <div className="flex gap-2 flex-wrap">
                {DIAS.map(d => (
                  <button key={d} type="button" onClick={() => toggleDia(d)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      diasSelecionados.includes(d)
                        ? 'bg-[#22c55e] border-[#22c55e] text-black font-semibold'
                        : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#a1a1aa] hover:border-[#22c55e]/50'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Capacidade máxima</label>
                <input type="number" value={capacidade} onChange={e => setCapacidade(e.target.value)} placeholder="20"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Sala / Local</label>
                <input value={sala} onChange={e => setSala(e.target.value)} placeholder="Sala 1"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
              </div>
            </div>
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Professor responsável</label>
              <select value={professorId} onChange={e => setProfessorId(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]">
                <option value="">Selecione</option>
                {professores.filter(p => p.status === 'ativo').map(p => <option key={p.id} value={p.id}>{p.nome} — {p.especialidade}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowNovaTurma(false)}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-2.5 text-sm transition-colors">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-black font-semibold rounded-xl py-2.5 text-sm transition-colors">{saving ? 'Salvando...' : 'Criar Turma'}</button>
            </div>
            {formError && <p className="text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-bold text-white font-mono text-lg">Agenda de Hoje</h2>
            <p className="text-[#71717a] text-xs mt-0.5">{turmas.length} atividade(s) programada(s)</p>
          </div>
          <button onClick={onClose} className="text-[#52525b] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex gap-3 p-5 pb-0">
          <button onClick={() => setShowNovaTurma(true)}
            className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            Criar Nova Turma
          </button>
          <button className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-white text-sm px-5 py-2.5 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9H9M15 15H9" /></svg>
            Cancelar Aula
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-2">
          {sorted.length === 0 ? (
            <p className="text-[#52525b] text-sm text-center py-12">Nenhuma turma cadastrada.</p>
          ) : (
            sorted.map(t => {
              const prof = professores.find(p => p.id === t.professorId)
              const cfg = statusConfig[t.status]
              return (
                <button
                  key={t.id}
                  onClick={() => abrirChamada(t)}
                  className="w-full flex items-center gap-4 bg-[#0f0f0f] border border-[#1f1f1f] hover:bg-[#161616] rounded-xl px-4 py-3.5 transition-colors text-left group"
                >
                  <span className="text-[#71717a] font-mono text-sm w-12 flex-shrink-0">{t.horario}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{t.nome}</p>
                    <p className="text-[#52525b] text-xs">{t.alunoIds.length} aluno(s) · {prof?.nome ?? '—'} · {t.sala}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${cfg.cls} flex-shrink-0`}>{cfg.label}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" className="group-hover:stroke-white transition-colors flex-shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
