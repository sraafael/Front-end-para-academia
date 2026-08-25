import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import type { Turma } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { useDataStore } from '../../store/dataStore'

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function getMotivacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Comece o dia com energia. Seus alunos estão contando com você!'
  if (h < 18) return 'Continue o bom trabalho. Cada aula faz a diferença na vida dos seus alunos.'
  return 'Ótimo trabalho hoje. Finalize o dia com tudo em dia!'
}

export default function ProfessorDashboard() {
  const navigate = useNavigate()
  const { currentProfessorId, logout } = useAuthStore()
  const { professores, turmas, alunos, loadAll, loading } = useDataStore()
  const professor = professores.find(p => p.id === currentProfessorId)
  const handleLogout = () => { logout(); navigate('/login') }

  useEffect(() => { loadAll() }, [loadAll])
  const [tab, setTab] = useState<'agenda' | 'alunos'>('agenda')
  const [chamadaTurma, setChamadaTurma] = useState<Turma | null>(null)
  const [presencas, setPresencas] = useState<Record<string, boolean>>({})

  if (loading && !professor) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!professor) return null
const minhasTurmas = turmas.filter(t => t.professorId === professor.id)
  const meusAlunos = alunos.filter(a => a.professorId === professor.id) 
  const sorted = [...minhasTurmas].sort((a, b) => a.horario.localeCompare(b.horario))
  const horasTrabalhadas = () => {
    const mins = minhasTurmas.reduce((s, t) => s + 60, 0)
    return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`
  }

  const statusConfig = {
    concluida: { label: 'Concluída', cls: 'bg-[#22c55e]/15 text-[#22c55e]' },
    em_andamento: { label: 'Em andamento', cls: 'bg-yellow-500/15 text-yellow-400' },
    proxima: { label: 'Próxima', cls: 'text-[#52525b]' },
    cancelada: { label: 'Cancelada', cls: 'bg-red-500/15 text-red-400' },
  }

  const firstName = professor.nome.split(' ')[0]

  if (chamadaTurma) {
    const alunosDaTurma = alunos.filter(a => chamadaTurma.alunoIds.includes(a.id))
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-[#1f1f1f] px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-40">
          <button onClick={() => setChamadaTurma(null)} className="flex items-center gap-2 text-[#71717a] hover:text-white text-sm transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Voltar
          </button>
        </header>
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-[#1f1f1f]">
              <p className="text-blue-400 text-xs font-mono mb-1">📅 {chamadaTurma.modalidade}</p>
              <h2 className="font-bold text-white font-mono text-lg">{chamadaTurma.nome}</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[#71717a] text-xs">Horário: {chamadaTurma.horario}</p>
                <p className="text-[#71717a] text-xs">· {chamadaTurma.alunoIds.length} alunos</p>
                <p className="text-[#52525b] text-xs flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {chamadaTurma.sala}
                </p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-semibold">Lista de Chamada</p>
                <p className="text-[#52525b] text-xs">Marque a presença.</p>
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
                          presente ? 'bg-[#22c55e] text-black' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222]'
                        }`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                        {presente ? 'Presente' : 'Marcar Presença'}
                      </button>
                    </div>
                  )
                })}
                {alunosDaTurma.length === 0 && (
                  <p className="text-[#52525b] text-sm text-center py-8">Nenhum aluno matriculado nesta turma.</p>
                )}
              </div>
              <button onClick={() => setChamadaTurma(null)}
                className="w-full mt-4 text-[#52525b] text-sm hover:text-white transition-colors py-2">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1f1f1f] px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1a2a3a] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">FitPro</p>
            <p className="text-[#52525b] text-xs">Área do Professor</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-[#71717a] hover:text-white transition-colors text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sair
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono">{getGreeting()}, {firstName}!</h1>
          <p className="text-[#71717a] text-sm mt-1">{getMotivacao()}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>, label: 'Aulas Hoje', value: minhasTurmas.length, color: 'bg-[#1a2a3a] text-blue-400' },
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>, label: 'Meus Alunos', value: meusAlunos.length, color: 'bg-[#1a2a3a] text-blue-400' },
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: 'Horas Trabalhadas', value: horasTrabalhadas(), color: 'bg-[#1a2a3a] text-blue-400' },
          ].map((s, i) => (
            <div key={i} className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
              <div>
                <p className="text-[#71717a] text-xs">{s.label}</p>
                <p className="text-white font-bold font-mono text-xl mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 bg-[#111111] border border-[#1f1f1f] rounded-xl p-1 w-fit mb-4">
            {(['agenda', 'alunos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-[#1f1f1f] text-white' : 'text-[#71717a] hover:text-white'}`}>
                {t === 'agenda' ? 'Agenda' : 'Meus Alunos'}
              </button>
            ))}
          </div>

          {tab === 'agenda' && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <h2 className="text-white font-semibold text-sm">Agenda de Hoje</h2>
              </div>
              {sorted.length === 0 ? (
                <p className="text-[#52525b] text-sm py-8 text-center">Nenhuma aula programada para hoje.</p>
              ) : (
                <div className="space-y-2">
                  {sorted.map(t => {
                    const cfg = statusConfig[t.status]
                    return (
                      <button key={t.id} onClick={() => setChamadaTurma(t)}
                        className="w-full flex items-center gap-4 bg-[#0f0f0f] border border-[#1f1f1f] hover:bg-[#161616] rounded-xl px-4 py-3.5 transition-colors text-left group">
                        <span className="text-[#71717a] font-mono text-sm w-12 flex-shrink-0">{t.horario}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">{t.nome}</p>
                          <p className="text-[#52525b] text-xs">{t.alunoIds.length} aluno(s)</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${cfg.cls} flex-shrink-0`}>{cfg.label}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" className="group-hover:stroke-white transition-colors flex-shrink-0">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'alunos' && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-sm">Meus Alunos</h2>
                <span className="text-xs text-[#71717a]">{meusAlunos.length} aluno(s)</span>
              </div>
              {meusAlunos.length === 0 ? (
                <p className="text-[#52525b] text-sm py-8 text-center">Nenhum aluno designado para você.</p>
              ) : (
                <div className="space-y-2">
                  {meusAlunos.map(a => {
                    const turmaDoAluno = minhasTurmas.find(t => t.alunoIds.includes(a.id))
                    return (
                      <div key={a.id} className="flex items-center gap-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-[#1a2a3a] flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
                          {a.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">{a.nome}</p>
                          <p className="text-[#52525b] text-xs">{turmaDoAluno?.nome ?? '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#71717a] text-xs">{a.frequencia.filter(f => f.presente).length} presenças</p>
                          <p className="text-[#3f3f46] text-xs">{a.peso} kg</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
