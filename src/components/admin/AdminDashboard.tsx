import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../../store/authStore'
import { useDataStore } from '../../store/dataStore'
import GerenciarAlunos from './modals/GerenciarAlunos'
import GerenciarProfessores from './modals/GerenciarProfessores'
import Financeiro from './modals/Financeiro'
import AgendaAdmin from './modals/AgendaAdmin'
import Relatorios from './modals/Relatorios'
import Planos from './modals/Planos'

type ModalType = 'alunos' | 'professores' | 'financeiro' | 'agenda' | 'relatorios' | 'planos' | null

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { alunos, professores, turmas, planos, transacoes, loadAll, loading } = useDataStore()

  const [modal, setModal] = useState<ModalType>(null)

  useEffect(() => { loadAll() }, [loadAll])

  const handleLogout = () => { logout(); navigate('/login') }

  if (loading && alunos.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#52525b] text-sm">Carregando dados...</p>
        </div>
      </div>
    )
  }

  const alunosAtivos = alunos.filter(a => a.status === 'ativo').length
  const emAtraso = alunos.filter(a => a.pagamentoStatus === 'atrasado' || a.status === 'atrasado').length
  const professoresAtivos = professores.filter(p => p.status === 'ativo').length
  const emFerias = professores.filter(p => p.status === 'ferias').length
  const receita = transacoes.filter(t => t.tipo === 'receita' && t.status === 'pago').reduce((s, t) => s + t.valor, 0)
  const pagamentos = transacoes.filter(t => t.tipo === 'receita' && t.status === 'pago').length
  const turmasHoje = turmas.length
  const totalVagas = turmas.reduce((s, t) => s + t.capacidade, 0)
  const ocupadas = turmas.reduce((s, t) => s + t.alunoIds.length, 0)
  const ocupacaoPct = totalVagas > 0 ? Math.round((ocupadas / totalVagas) * 100) : 0

  const evasaoRisco = alunos.filter(a => {
    const freq = a.frequencia.slice(-14)
    const presentes = freq.filter(f => f.presente).length
    return a.status === 'ativo' && presentes < 3
  })

  const atividades = [
    ...alunos.slice(-3).map(a => ({ icon: '👤', msg: `${a.nome} foi cadastrado(a)`, data: a.matriculaData })),
    ...turmas.slice(-2).map(t => ({ icon: '📅', msg: `Turma "${t.nome}" criada`, data: new Date().toISOString().split('T')[0] })),
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5)

  const fmtReal = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

  const QUICK_LINKS = [
    { label: 'Gerenciar Alunos', modal: 'alunos' as ModalType, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg> },
    { label: 'Gerenciar Professores', modal: 'professores' as ModalType, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg> },
    { label: 'Financeiro', modal: 'financeiro' as ModalType, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg> },
    { label: 'Agenda', modal: 'agenda' as ModalType, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> },
    { label: 'Relatórios', modal: 'relatorios' as ModalType, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg> },
    { label: 'Planos da Academia', modal: 'planos' as ModalType, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1" /></svg> },
  ]

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
            <p className="text-[#52525b] text-xs">Painel Administrativo</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-[#71717a] hover:text-white transition-colors text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sair
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono">{getGreeting()}, Administrador</h1>
            <p className="text-[#71717a] text-sm mt-1">Aqui está o resumo da sua academia hoje.</p>
          </div>
          <button onClick={() => setModal('alunos')}
            className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /><path d="M19 8v6M22 11h-6" />
            </svg>
            Novo Aluno
          </button>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h2 className="text-white font-semibold text-sm">Alertas de Evasão</h2>
          </div>
          {evasaoRisco.length === 0 ? (
            <p className="text-[#52525b] text-sm">Nenhum aluno em risco detectado.</p>
          ) : (
            <div className="space-y-2">
              {evasaoRisco.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-2.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-white text-sm flex-1">{a.nome}</p>
                  <p className="text-red-400 text-xs">Baixa frequência nas últimas 2 semanas</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>, label: 'Alunos Ativos', value: alunosAtivos, sub: `${emAtraso} em atraso`, subColor: emAtraso > 0 ? 'text-red-400' : 'text-[#22c55e]', iconBg: 'bg-[#1a3a1a] text-[#22c55e]' },
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 6.5a6 6 0 0 0 0 11M17.5 6.5a6 6 0 0 1 0 11M3 12h18M12 3v18" /></svg>, label: 'Professores Ativos', value: professoresAtivos, sub: `${emFerias} em férias`, subColor: 'text-[#71717a]', iconBg: 'bg-[#1a3a1a] text-[#22c55e]' },
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>, label: 'Receita Confirmada', value: fmtReal(receita), sub: `${pagamentos} pagamento(s)`, subColor: 'text-[#22c55e]', iconBg: 'bg-[#1a3a1a] text-[#22c55e]', large: true },
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>, label: 'Turmas Hoje', value: turmasHoje, sub: `${ocupacaoPct}% ocupação`, subColor: 'text-[#22c55e]', iconBg: 'bg-[#1a3a1a] text-[#22c55e]' },
          ].map((s, i) => (
            <div key={i} className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
              <div className="min-w-0">
                <p className="text-[#71717a] text-xs">{s.label}</p>
                <p className={`text-white font-bold font-mono mt-0.5 ${s.large ? 'text-lg' : 'text-2xl'}`}>{s.value}</p>
                <p className={`text-xs mt-0.5 ${s.subColor}`}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h2 className="text-white font-semibold text-sm">Alertas e Pendências</h2>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-red-500 text-white px-3 py-1 rounded-full font-medium">Prioridade Máxima ({emAtraso})</span>
              <span className="text-xs bg-[#1a1a1a] text-[#71717a] border border-[#2a2a2a] px-3 py-1 rounded-full">Informativos (0)</span>
            </div>
          </div>
          {emAtraso === 0 ? (
            <p className="text-[#52525b] text-sm py-4">Nenhum alerta no momento.</p>
          ) : (
            <div className="space-y-2">
              {alunos.filter(a => a.pagamentoStatus === 'atrasado').map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-white text-sm flex-1">{a.nome}</p>
                  <span className="text-xs text-red-400">Mensalidade vencida</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
              <h2 className="text-white font-semibold text-sm">Atividades Recentes</h2>
            </div>
            {atividades.length === 0 ? (
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-4 py-8 text-center text-[#52525b] text-sm">
                Nenhuma atividade recente registrada no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {atividades.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-4 py-3">
                    <span className="text-lg">{a.icon}</span>
                    <p className="text-[#a1a1aa] text-sm flex-1">{a.msg}</p>
                    <p className="text-[#3f3f46] text-xs">{new Date(a.data).toLocaleDateString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.42 1.42M4.93 4.93l1.42 1.42M19.07 19.07l-1.42-1.42M4.93 19.07l1.42-1.42M12 2v2M12 20v2M2 12h2M20 12h2" />
              </svg>
              <h2 className="text-white font-semibold text-sm">Acesso Rápido</h2>
            </div>
            <div className="space-y-2">
              {QUICK_LINKS.map(l => (
                <button key={l.label} onClick={() => setModal(l.modal)}
                  className="w-full flex items-center gap-3 bg-[#0f0f0f] border border-[#1f1f1f] hover:bg-[#161616] hover:border-[#22c55e]/30 rounded-xl px-4 py-3 transition-all group text-left">
                  <span className="text-[#22c55e]">{l.icon}</span>
                  <p className="text-white text-sm flex-1">{l.label}</p>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" className="group-hover:stroke-[#22c55e] transition-colors">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {modal === 'alunos' && <GerenciarAlunos onClose={() => setModal(null)} />}
      {modal === 'professores' && <GerenciarProfessores onClose={() => setModal(null)} />}
      {modal === 'financeiro' && <Financeiro onClose={() => setModal(null)} />}
      {modal === 'agenda' && <AgendaAdmin onClose={() => setModal(null)} />}
      {modal === 'relatorios' && <Relatorios onClose={() => setModal(null)} />}
      {modal === 'planos' && <Planos onClose={() => setModal(null)} />}
    </div>
  )
}
