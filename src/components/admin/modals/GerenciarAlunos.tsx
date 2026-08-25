import { useState } from 'react'
import type { Aluno, Plano } from '../../../types'
import { useDataStore } from '../../../store/dataStore'

interface Props { onClose: () => void }

type FilterType = 'todos' | 'em_dia' | 'atrasados' | 'inativos'
const PAGE_SIZE = 8

function AlunoPerfilModal({
  aluno, planos, professores, onClose, onSave,
}: {
  aluno: Aluno
  planos: Plano[]
  professores: any[] 
  onClose: () => void
  onSave: (data: Partial<Aluno>) => void
}) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(aluno.nome)
  const [telefone, setTelefone] = useState(aluno.telefone)
  const [email, setEmail] = useState(aluno.email)
  const [idade, setIdade] = useState(String(aluno.idade || ''))
  const [peso, setPeso] = useState(String(aluno.peso || ''))
  const [planoId, setPlanoId] = useState(aluno.planoId)
  const [professorId, setProfessorId] = useState('')
  const [status, setStatus] = useState(aluno.status)
  const [pagamentoStatus, setPagamentoStatus] = useState(aluno.pagamentoStatus)
  const [formaPagamento, setFormaPagamento] = useState(aluno.formaPagamento)

  const plano = planos.find(p => p.id === aluno.planoId)
  const professor = professores.find(p => p.id === professorId)
  const presencas = aluno.frequencia.filter(f => f.presente).length
  const totalFreq = aluno.frequencia.length

  const handleSave = () => {
    onSave({ 
      nome,
      telefone,
      email, 
      idade: parseInt(idade) || 0, 
      peso: parseFloat(peso) || 0, 
      planoId, 
      professorId, 
      status, 
      pagamentoStatus, 
      formaPagamento 
    } as Partial<Aluno>)
    setEditando(false)
  }

  const statusCor = {
    ativo: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
    atrasado: 'bg-red-500/15 text-red-400 border-red-500/30',
    inativo: 'bg-zinc-700/30 text-zinc-400 border-zinc-700/30',
  }
  const pagCor = {
    pago: 'bg-[#22c55e]/15 text-[#22c55e]',
    pendente: 'bg-yellow-500/15 text-yellow-400',
    atrasado: 'bg-red-500/15 text-red-400',
  }
  const pagLabel = { pago: 'Em dia', pendente: 'Pendente', atrasado: 'Vencido' }

  const initials = aluno.nome.split(' ').map(n => n[0]).slice(0, 2).join('')

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#1a3a1a] flex items-center justify-center text-[#22c55e] font-bold text-sm">
              {initials}
            </div>
            <div>
              <h2 className="font-bold text-white font-mono">{aluno.nome}</h2>
              <p className="text-[#52525b] text-xs font-mono">{aluno.cpf}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 text-xs bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#22c55e]/50 text-[#a1a1aa] hover:text-white px-3 py-1.5 rounded-xl transition-all"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar
              </button>
            )}
            <button onClick={onClose} className="text-[#52525b] hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${statusCor[aluno.status]}`}>
              {aluno.status === 'ativo' ? 'Ativo' : aluno.status === 'atrasado' ? 'Atrasado' : 'Inativo'}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full ${pagCor[aluno.pagamentoStatus]}`}>
              {pagLabel[aluno.pagamentoStatus]}
            </span>
            {plano && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-400/10 text-blue-400">
                {plano.nome}
              </span>
            )}
            {aluno.isFirstLogin && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400">
                Aguardando 1º acesso
              </span>
            )}
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Sequência', value: `${aluno.sequencia} dias`, color: 'text-red-400' },
              { label: 'Frequência', value: totalFreq > 0 ? `${Math.round((presencas / totalFreq) * 100)}%` : '—', color: 'text-[#22c55e]' },
              { label: 'Conquistas', value: aluno.conquistasDesbloqueadas.length, color: 'text-yellow-400' },
            ].map(m => (
              <div key={m.label} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3 text-center">
                <p className="text-[#52525b] text-[10px] mb-1">{m.label}</p>
                <p className={`font-bold font-mono text-lg ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Dados pessoais */}
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-3">DADOS PESSOAIS</p>
            {editando ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[#71717a] text-xs mb-1">Nome completo</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Telefone</label>
                    <input value={telefone} onChange={e => setTelefone(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Idade</label>
                    <input type="number" value={idade} onChange={e => setIdade(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Peso (kg)</label>
                    <input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {[
                  { label: 'Telefone', value: aluno.telefone || '—' },
                  { label: 'Email', value: aluno.email || '—' },
                  { label: 'Idade', value: aluno.idade ? `${aluno.idade} anos` : '—' },
                  { label: 'Peso', value: aluno.peso ? `${aluno.peso} kg` : '—' },
                  { label: 'Matrícula', value: new Date(aluno.matriculaData).toLocaleDateString('pt-BR') },
                  { label: 'Forma Pgto.', value: aluno.formaPagamento || '—' },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[#52525b] text-xs">{f.label}</p>
                    <p className="text-white mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plano e status */}
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-3">PLANO & STATUS</p>
            {editando ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Plano</label>
                    <select value={planoId} onChange={e => setPlanoId(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors">
                      <option value="">Sem plano</option>
                      {planos.filter(p => p.ativo).map(p => (
                        <option key={p.id} value={p.id}>{p.nome} — R$ {p.preco.toFixed(2).replace('.', ',')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Professor Responsável</label>
                    <select value={professorId} onChange={e => setProfessorId(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors">
                      <option value="">Sem professor</option>
                      {professores.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as Aluno['status'])}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors">
                      <option value="ativo">Ativo</option>
                      <option value="atrasado">Atrasado</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#71717a] text-xs mb-1">Pagamento</label>
                    <select value={pagamentoStatus} onChange={e => setPagamentoStatus(e.target.value as Aluno['pagamentoStatus'])}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors">
                      <option value="pago">Em dia</option>
                      <option value="pendente">Pendente</option>
                      <option value="atrasado">Vencido</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[#71717a] text-xs mb-1">Forma de pagamento</label>
                  <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#22c55e] rounded-xl px-3 py-2 text-white text-sm outline-none transition-colors">
                    <option value="">Selecione</option>
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX / Cartão">PIX / Cartão</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <p className="text-[#52525b] text-xs">Plano atual</p>
                  <p className="text-white mt-0.5">{plano?.nome ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[#52525b] text-xs">Professor</p>
                  <p className="text-white mt-0.5">{professor?.nome ?? 'Sem professor definido'}</p>
                </div>
                <div>
                  <p className="text-[#52525b] text-xs">Valor mensal</p>
                  <p className="text-white mt-0.5 font-mono">{plano ? `R$ ${plano.preco.toFixed(2).replace('.', ',')}` : '—'}</p>
                </div>
                <div>
                  <p className="text-[#52525b] text-xs">Forma de pagamento</p>
                  <p className="text-white mt-0.5">{aluno.formaPagamento || '—'}</p>
                </div>
                <div>
                  <p className="text-[#52525b] text-xs">Vencimento</p>
                  <p className="text-white mt-0.5">{aluno.vencimento ? new Date(aluno.vencimento).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Histórico peso inline */}
          {aluno.historicoPeso.length > 0 && !editando && (
            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
              <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-3">HISTÓRICO DE PESO</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {aluno.historicoPeso.slice(-6).map((h, i) => (
                  <div key={i} className="flex-shrink-0 text-center">
                    <div className="text-[#52525b] text-[10px] mb-1">
                      {new Date(h.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 min-w-[56px]">
                      <p className="text-white text-xs font-mono">{h.peso}kg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {editando ? (
          <div className="flex gap-2 p-5 border-t border-[#1f1f1f]">
            <button onClick={() => setEditando(false)}
              className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-2.5 text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave}
              className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold rounded-xl py-2.5 text-sm transition-colors">
              Salvar alterações
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 pt-2 border-t border-[#1f1f1f]">
            <button onClick={onClose}
              className="w-full text-[#52525b] hover:text-white text-sm transition-colors py-2">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GerenciarAlunos({ onClose }: Props) {
  const { alunos, planos, professores, addAluno, updateAluno } = useDataStore()
  const [filter, setFilter] = useState<FilterType>('todos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCadastrar, setShowCadastrar] = useState(false)
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null)

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [idade, setIdade] = useState('')
  const [peso, setPeso] = useState('')
  const [planoId, setPlanoId] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [formError, setFormError] = useState('')

  const ativos = alunos.filter(a => a.status === 'ativo').length
  const emAtraso = alunos.filter(a => a.pagamentoStatus === 'atrasado' || a.status === 'atrasado').length
  const semTurma = alunos.filter(a => !a.turmaId).length

  const filtered = alunos.filter(a => {
    const matchSearch = a.nome.toLowerCase().includes(search.toLowerCase()) || a.cpf.includes(search)
    const matchFilter =
      filter === 'todos' ? true :
      filter === 'em_dia' ? a.pagamentoStatus === 'pago' :
      filter === 'atrasados' ? (a.pagamentoStatus === 'atrasado' || a.status === 'atrasado') :
      a.status === 'inativo'
    return matchSearch && matchFilter
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3').replace(/(\d{3})(\d{3})/, '$1.$2')
  }
  const formatTel = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.length <= 10 ? d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  const formatPeso = (v: string) => {
    const clean = v.replace(/[^\d,]/g, '').replace(/,{2,}/g, ',')
    const parts = clean.split(',')
    return parts.length > 2 ? parts[0] + ',' + parts[1] : clean
  }

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    
    if (!nome.trim() || cpf.replace(/\D/g, '').length < 11 || !planoId || !professorId) {
      setFormError('Preencha todos os campos obrigatórios corretamente.')
      return
    }

    try {
      await addAluno({
        nome: nome.trim(),
        cpf,
        telefone,
        email,
        idade: parseInt(idade) || 0,
        peso: parseFloat(peso.replace(',', '.')) || 0,
        planoId,
        professorId,
        turmaId: undefined,
        matriculaData: new Date().toISOString().split('T')[0],
        status: 'ativo',
        formaPagamento: 'pix', 
        pagamentoStatus: 'pago' 
      })
      
      setShowCadastrar(false)
      setNome('')
      setCpf('')
      setTelefone('')
      setEmail('')
      setIdade('')
      setPeso('')
      setPlanoId('')
      setProfessorId('')
      setFormError('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao cadastrar aluno.')
    }
  }

  const statusBadge = (a: Aluno) => {
    if (a.pagamentoStatus === 'atrasado' || a.status === 'atrasado')
      return <span className="text-xs bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full">Atrasado</span>
    if (a.status === 'inativo')
      return <span className="text-xs bg-zinc-700/30 text-zinc-400 px-2.5 py-1 rounded-full">Inativo</span>
    return <span className="text-xs bg-[#22c55e]/15 text-[#22c55e] px-2.5 py-1 rounded-full">Em dia</span>
  }

  const FILTERS: { key: FilterType; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: alunos.length },
    { key: 'em_dia', label: 'Em dia', count: alunos.filter(a => a.pagamentoStatus === 'pago').length },
    { key: 'atrasados', label: 'Atrasados', count: emAtraso },
    { key: 'inativos', label: 'Inativos', count: alunos.filter(a => a.status === 'inativo').length },
  ]

  if (showCadastrar) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono">Cadastrar Novo Aluno</h2>
              <p className="text-[#71717a] text-xs mt-0.5">A senha inicial será <span className="font-mono text-[#a1a1aa]">123456</span> — aluno redefine no 1º acesso.</p>
            </div>
            <button onClick={() => setShowCadastrar(false)} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={handleCadastrar} className="p-5 space-y-4">
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Nome Completo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do aluno" autoFocus
                className="w-full bg-[#1a1a1a] border border-[#22c55e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">CPF</label>
                <input value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="123.456.789-00"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors" />
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Telefone</label>
                <input value={telefone} onChange={e => setTelefone(formatTel(e.target.value))} placeholder="(11) 9XXXX-XXXX"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@email.com"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Idade</label>
                <input
                  inputMode="numeric"
                  value={idade}
                  onChange={e => setIdade(e.target.value.replace(/\D/g, ''))}
                  placeholder="25"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Peso (kg)</label>
                <input
                  inputMode="decimal"
                  value={peso}
                  onChange={e => setPeso(formatPeso(e.target.value))}
                  placeholder="70,0"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Plano</label>
                <select value={planoId} onChange={e => setPlanoId(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors">
                  <option value="">Selecione o plano</option>
                  {planos.filter(p => p.ativo).map(p => (
                    <option key={p.id} value={p.id}>{p.nome} — R$ {p.preco.toFixed(2).replace('.', ',')}</option>
                  ))}
                </select>
                {planos.filter(p => p.ativo).length === 0 && (
                  <p className="text-[#52525b] text-xs mt-1">Nenhum plano ativo. Crie um plano primeiro.</p>
                )}
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Professor Responsável</label>
                <select value={professorId} onChange={e => setProfessorId(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors">
                  <option value="">Selecione o professor</option>
                  {professores.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            </div>
            {formError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowCadastrar(false); setFormError('') }}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-2.5 text-sm transition-colors">Cancelar</button>
              <button type="submit"
                className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold rounded-xl py-2.5 text-sm transition-colors">Cadastrar</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono text-lg">Gerenciar Alunos</h2>
              <p className="text-[#71717a] text-xs mt-0.5">{alunos.length} aluno(s) · {emAtraso} atrasado(s)</p>
            </div>
            <button onClick={onClose} className="text-[#52525b] hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Central */}
              <div className="lg:col-span-2 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white text-sm">Central de Alunos</p>
                    <p className="text-[#52525b] text-xs">Clique em um aluno para ver o perfil completo ou editar.</p>
                  </div>
                  <button onClick={() => setShowCadastrar(true)}
                    className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /><path d="M19 8v6M22 11h-6" />
                    </svg>
                    Cadastrar Novo Aluno
                  </button>
                </div>
                <div className="relative mb-3">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Buscar por nome ou CPF..."
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {FILTERS.map(f => (
                    <button key={f.key} onClick={() => { setFilter(f.key); setPage(1) }}
                      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${filter === f.key ? 'bg-[#22c55e] text-black font-semibold' : 'bg-[#1a1a1a] text-[#a1a1aa] hover:bg-[#222]'}`}>
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-3">
                {[
                  { label: 'ATIVOS', value: ativos, color: 'text-[#22c55e]', desc: 'Alunos com matrícula ativa.' },
                  { label: 'EM ATRASO', value: emAtraso, color: 'text-red-400', desc: 'Precisam de acompanhamento financeiro.' },
                  { label: 'SEM TURMA', value: semTurma, color: 'text-yellow-400', desc: 'Prontos para encaixe na agenda.' },
                ].map(s => (
                  <div key={s.label} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3">
                    <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-[#52525b] text-xs mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-semibold">Lista de alunos</p>
              <p className="text-[#71717a] text-xs">{filtered.length} resultado(s)</p>
            </div>

            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl overflow-hidden">
              {paginated.length === 0 ? (
                <div className="py-12 text-center text-[#52525b] text-sm">Nenhum aluno encontrado.</div>
              ) : (
                paginated.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setAlunoSelecionado(a)}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-[#161616] transition-colors text-left group ${i < paginated.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#1a3a1a] flex items-center justify-center text-[#22c55e] text-xs font-bold flex-shrink-0 group-hover:bg-[#22c55e]/20 transition-colors">
                      {a.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{a.nome}</p>
                      <p className="text-[#52525b] text-xs font-mono">{a.cpf}</p>
                    </div>
                    <div className="hidden sm:block text-[#52525b] text-xs">{a.telefone || '—'}</div>
                    <div className="hidden md:flex items-center gap-2">
                      {statusBadge(a)}
                      {a.isFirstLogin && (
                        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">1º acesso</span>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" className="flex-shrink-0 group-hover:stroke-[#22c55e] transition-colors">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 text-xs text-[#a1a1aa] disabled:text-[#3f3f46] hover:text-white transition-colors px-3 py-1.5 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] disabled:cursor-not-allowed">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                  Anterior
                </button>
                <span className="text-xs text-[#71717a]">Página {page} de {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="flex items-center gap-1 text-xs text-[#a1a1aa] disabled:text-[#3f3f46] hover:text-white transition-colors px-3 py-1.5 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] disabled:cursor-not-allowed">
                  Próxima
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {alunoSelecionado && (
        <AlunoPerfilModal
          aluno={alunoSelecionado}
          planos={planos}
          professores={professores}
          onClose={() => setAlunoSelecionado(null)}
          onSave={async data => {
            await updateAluno(alunoSelecionado.id, data)
            setAlunoSelecionado(prev => prev ? { ...prev, ...data } : null)
          }}
        />
      )}
    </>
  )
}