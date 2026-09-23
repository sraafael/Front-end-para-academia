import { useState } from 'react'
import { useDataStore } from '../../../store/dataStore'
import TemporaryAccessModal from './TemporaryAccessModal'
import { formatCpf, isValidCpf } from '../../../lib/cpf'
import { formatLocalDate, toLocalDate } from '../../../lib/date'
import type { Professor } from '../../../types'

interface Props { onClose: () => void }

type FilterType = 'todos' | 'ativos' | 'ferias' | 'inativos'

const ESPECIALIDADES = ['Musculação', 'Funcional', 'Crossfit', 'Personal', 'Pilates', 'Natação', 'HIIT', 'Yoga', 'Hidroginástica']

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = ['00', '15', '30', '45']

// Seleção e formatação de horário
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(':') : ['', '']
  return (
    <div className="flex gap-1 items-center">
      <select
        value={h}
        onChange={e => onChange(`${e.target.value}:${m || '00'}`)}
        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-[#22c55e] appearance-none text-center"
      >
        <option value="">HH</option>
        {HORAS.map(hr => <option key={hr} value={hr}>{hr}</option>)}
      </select>
      <span className="text-[#52525b] font-bold">:</span>
      <select
        value={m || ''}
        onChange={e => onChange(`${h || '00'}:${e.target.value}`)}
        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-[#22c55e] appearance-none text-center"
      >
        <option value="">MM</option>
        {MINUTOS.map(mn => <option key={mn} value={mn}>{mn}</option>)}
      </select>
    </div>
  )
}

function formatSalario(v: string) {
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits) / 100
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function GerenciarProfessores({ onClose }: Props) {
  // Dados, filtros e modais
  const { professores, addProfessor, updateProfessor, resetProfessorPassword } = useDataStore()
  const [filter, setFilter] = useState<FilterType>('todos')
  const [search, setSearch] = useState('')
  const [showCadastrar, setShowCadastrar] = useState(false)
  const [showEditar, setShowEditar] = useState(false)
  const [showFerias, setShowFerias] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [resetTargetId, setResetTargetId] = useState<string | null>(null)
  const [resettingPassword, setResettingPassword] = useState(false)

  // Campos do professor
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [horarioInicio, setHorarioInicio] = useState('')
  const [horarioFim, setHorarioFim] = useState('')
  const [salario, setSalario] = useState('')
  const [especialidade, setEspecialidade] = useState('')
  const [especialidadeSecundaria, setEspecialidadeSecundaria] = useState('')
  const [feriasInicio, setFeriasInicio] = useState(toLocalDate())
  const [feriasFim, setFeriasFim] = useState('')
  const [savingFerias, setSavingFerias] = useState(false)
  const [formError, setFormError] = useState('')
  const [credencialCriada, setCredencialCriada] = useState<{ nome: string; cpf: string; senha: string; mode: 'created' | 'reset' } | null>(null)

  const horario = horarioInicio && horarioFim ? `${horarioInicio} - ${horarioFim}` : ''

  const filtered = professores.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search)
    const matchFilter = filter === 'todos'
      || (filter === 'ativos' && p.status === 'ativo')
      || (filter === 'ferias' && p.status === 'ferias')
      || (filter === 'inativos' && p.status === 'inativo')
    return matchSearch && matchFilter
  })

  const ativos = professores.filter(p => p.status === 'ativo').length
  const ferias = professores.filter(p => p.status === 'ferias').length
  const folhaPendente = professores.filter(p => p.status === 'ativo').reduce((acc, p) => acc + p.salario, 0)

  // Formatação e preparação do formulário
  const formatTel = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.length <= 10
      ? d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
      : d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  const resetForm = () => {
    setNome(''); setCpf(''); setTelefone(''); setEmail('')
    setHorarioInicio(''); setHorarioFim(''); setSalario('')
    setEspecialidade(''); setEspecialidadeSecundaria(''); setFormError('')
  }

  const openEdit = (p: Professor) => {
    setEditingId(p.id)
    setNome(p.nome || '')
    setCpf(formatCpf(p.cpf || ''))
    setTelefone(p.telefone || '')
    setEmail(p.email || '')
    const [start, end] = (p.horario || '').split(' - ')
    setHorarioInicio(start || '')
    setHorarioFim(end || '')
    setSalario(p.salario ? p.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
    // Separa as duas especialidades para preencher os campos.
    const espParts = (p.especialidade || '').split(' / ')
    setEspecialidade(espParts[0] || '')
    setEspecialidadeSecundaria(espParts[1] || '')
    setFeriasInicio(p.feriasInicio || toLocalDate())
    setFeriasFim(p.feriasFim || '')
    setFormError('')
    setShowEditar(true)
  }

  // Cadastro, edição e status
  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    
    if (!nome.trim()) { setFormError('Preencha o nome.'); return }
    if (!isValidCpf(cpf)) { setFormError('Informe um CPF válido. Verifique os números digitados.'); return }
    if (telefone.replace(/\D/g, '').length < 10) { setFormError('Telefone inválido.'); return }
    if (!email.includes('@')) { setFormError('E-mail inválido.'); return }
    if (!horarioInicio || !horarioFim) { setFormError('Selecione o horário de início e fim.'); return }
    if (!salario) { setFormError('Informe o salário.'); return }
    if (!especialidade) { setFormError('Selecione a especialidade principal.'); return }

    const espStr = especialidadeSecundaria
      ? `${especialidade} / ${especialidadeSecundaria}`
      : especialidade

    try {
      const result = await addProfessor({
        nome: nome.trim(),
        cpf,
        telefone,
        email,
        horario,
        salario: parseFloat(salario.replace(/\./g, '').replace(',', '.')) || 0,
        especialidade: espStr,
        status: 'ativo',
      })
      setCredencialCriada({ nome: result.record.nome, cpf: result.record.cpf, senha: result.temporaryPassword, mode: 'created' })
      
      setShowCadastrar(false)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao cadastrar professor.')
    }
  }

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    if (!nome.trim()) { setFormError('Preencha o nome.'); return }
    if (!isValidCpf(cpf)) { setFormError('Informe um CPF válido. Verifique os números digitados.'); return }
    if (telefone.replace(/\D/g, '').length < 10) { setFormError('Telefone inválido.'); return }
    if (!email.includes('@')) { setFormError('E-mail inválido.'); return }
    if (!horarioInicio || !horarioFim) { setFormError('Selecione o horário de início e fim.'); return }
    if (!salario) { setFormError('Informe o salário.'); return }
    if (!especialidade) { setFormError('Selecione a especialidade principal.'); return }

    const espStr = especialidadeSecundaria
      ? `${especialidade} / ${especialidadeSecundaria}`
      : especialidade

    const salarioNum = parseFloat(salario.replace(/\./g, '').replace(',', '.')) || 0

    try {
      await updateProfessor(editingId, {
        nome: nome.trim(),
        cpf,
        telefone,
        email,
        horario: `${horarioInicio} - ${horarioFim}`,
        salario: salarioNum,
        especialidade: espStr,
      })
      setShowEditar(false)
      setEditingId(null)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar alterações.')
    }
  }

  const handleMudarStatus = async (status: 'ativo' | 'inativo') => {
    if (!editingId) return
    const confirmed = window.confirm(status === 'inativo' ? 'Tem certeza que deseja demitir este professor?' : 'Confirmar o retorno deste professor ao trabalho?')
    if (!confirmed) return
    try {
      await updateProfessor(editingId, {
        status,
        ...(status === 'ativo' ? { feriasInicio: '', feriasFim: '' } : {}),
      })
      setShowEditar(false)
      setEditingId(null)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    }
  }

  const handleRedefinirSenha = async () => {
    const professor = professores.find(item => item.id === resetTargetId)
    if (!professor) return
    setFormError('')
    setResettingPassword(true)
    try {
      const result = await resetProfessorPassword(professor.id)
      setCredencialCriada({
        nome: result.record.nome,
        cpf: result.record.cpf,
        senha: result.temporaryPassword,
        mode: 'reset',
      })
      setResetTargetId(null)
      setShowEditar(false)
      setEditingId(null)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha do professor.')
    } finally {
      setResettingPassword(false)
    }
  }

  const handleSalvarFerias = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setFormError('')
    if (!feriasInicio || !feriasFim) {
      setFormError('Selecione o primeiro e o último dia das férias.')
      return
    }
    if (feriasFim < feriasInicio) {
      setFormError('A data final não pode ser anterior à data inicial.')
      return
    }
    setSavingFerias(true)
    try {
      await updateProfessor(editingId, {
        status: 'ferias',
        feriasInicio,
        feriasFim,
      })
      setShowFerias(false)
      setShowEditar(false)
      setEditingId(null)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar o período de férias.')
    } finally {
      setSavingFerias(false)
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'ferias') return <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full">Férias</span>
    if (status === 'inativo') return <span className="text-xs bg-zinc-700/40 text-zinc-400 px-2 py-0.5 rounded-full">Inativo</span>
    return <span className="text-xs bg-[#22c55e]/15 text-[#22c55e] px-2 py-0.5 rounded-full">Ativo</span>
  }

  const FILTERS: { key: FilterType; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: professores.length },
    { key: 'ativos', label: 'Ativos', count: ativos },
    { key: 'ferias', label: 'Férias', count: ferias },
    { key: 'inativos', label: 'Inativos', count: professores.filter(p => p.status === 'inativo').length },
  ]

  const espSecOptions = ESPECIALIDADES.filter(e => e !== especialidade)

  const editingProfessor = professores.find(professor => professor.id === editingId)
  const resetTarget = professores.find(professor => professor.id === resetTargetId)

  if (resetTarget) {
    return (
      <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-yellow-500/25 bg-[#111111] p-6 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-300">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 4v6h6" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /><path d="M12 7v5l3 2" /></svg>
          </div>
          <h3 className="text-lg font-bold text-white">Gerar nova senha temporária?</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
            A senha atual de <strong className="text-white">{resetTarget.nome}</strong> deixará de funcionar e as sessões abertas serão encerradas. No próximo acesso, será obrigatório criar uma senha nova.
          </p>
          {formError && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{formError}</p>}
          <div className="mt-6 flex gap-2">
            <button type="button" disabled={resettingPassword} onClick={() => { setResetTargetId(null); setFormError('') }} className="flex-1 rounded-xl bg-[#1a1a1a] py-3 text-sm text-white hover:bg-[#222] disabled:opacity-50">Cancelar</button>
            <button type="button" disabled={resettingPassword} onClick={() => void handleRedefinirSenha()} className="flex-1 rounded-xl bg-yellow-400 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">{resettingPassword ? 'Gerando...' : 'Gerar nova senha'}</button>
          </div>
        </div>
      </div>
    )
  }

  if (showFerias && editingProfessor) {
    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
          <div className="flex items-start justify-between p-5 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18M5 21c1.5-5 4-8.5 7-11 3 2.5 5.5 6 7 11M12 10V3M9 6l3-3 3 3" /></svg>
              </div>
              <div>
                <h2 className="font-bold text-white font-mono">Definir período de férias</h2>
                <p className="text-[#71717a] text-xs mt-0.5">{editingProfessor.nome}</p>
              </div>
            </div>
            <button type="button" onClick={() => { setShowFerias(false); setFormError('') }} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleSalvarFerias} className="p-5 space-y-5">
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-yellow-200 text-sm font-semibold">Período completo de afastamento</p>
              <p className="text-[#a1a1aa] text-xs mt-1">Selecione o primeiro dia fora da escala e o último dia das férias.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1.5">Início das férias</label>
                <input type="date" value={feriasInicio} onChange={e => { setFeriasInicio(e.target.value); if (feriasFim && e.target.value > feriasFim) setFeriasFim('') }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1.5">Último dia de férias</label>
                <input type="date" min={feriasInicio || undefined} value={feriasFim} onChange={e => setFeriasFim(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-yellow-500" />
              </div>
            </div>

            {feriasInicio && feriasFim && (
              <div className="flex items-center justify-center gap-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-4 py-4">
                <span className="text-white font-mono font-semibold">{formatLocalDate(feriasInicio)}</span>
                <span className="text-yellow-400">→</span>
                <span className="text-white font-mono font-semibold">{formatLocalDate(feriasFim)}</span>
              </div>
            )}

            {formError && <p className="text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowFerias(false); setFormError('') }} className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-2.5 text-sm">Cancelar</button>
              <button type="submit" disabled={savingFerias} className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-black font-semibold rounded-xl py-2.5 text-sm">
                {savingFerias ? 'Salvando...' : 'Confirmar férias'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Formulário de edição
  if (showEditar) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono">Editar Professor</h2>
              <p className="text-[#71717a] text-xs mt-0.5">Altere os dados e salve ou ajuste o status</p>
            </div>
            <button onClick={() => { setShowEditar(false); setEditingId(null); resetForm() }} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={handleSalvarEdicao} className="p-5 space-y-4 overflow-auto flex-1">
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Nome Completo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do professor" autoFocus
                className="w-full bg-[#1a1a1a] border border-[#22c55e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">CPF</label>
                <input value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="123.456.789-00" inputMode="numeric" aria-invalid={cpf.length === 14 && !isValidCpf(cpf)}
                  className={`w-full bg-[#1a1a1a] border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none ${cpf.length === 14 && !isValidCpf(cpf) ? 'border-red-500 focus:border-red-400' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`} />
                {cpf.length === 14 && !isValidCpf(cpf) && <p className="text-red-400 text-[11px] mt-1">CPF inválido</p>}
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Telefone</label>
                <input value={telefone} onChange={e => setTelefone(formatTel(e.target.value))} placeholder="(11) 9XXXX-XXXX"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
              </div>
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@fitpro.com"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1.5">Horário de Trabalho</label>
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div>
                    <p className="text-[#52525b] text-[10px] mb-1.5 text-center">ENTRADA</p>
                    <TimeSelect value={horarioInicio} onChange={setHorarioInicio} />
                  </div>
                  <div className="text-[#3f3f46] text-sm font-mono pt-5">→</div>
                  <div>
                    <p className="text-[#52525b] text-[10px] mb-1.5 text-center">SAÍDA</p>
                    <TimeSelect value={horarioFim} onChange={setHorarioFim} />
                  </div>
                </div>
                {horario && (
                  <p className="text-[#22c55e] text-xs font-mono text-center mt-2">{horario}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Salário</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm font-mono">R$</span>
                <input
                  value={salario}
                  onChange={e => setSalario(formatSalario(e.target.value))}
                  placeholder="4.500,00"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Especialidade Principal</label>
              <select value={especialidade} onChange={e => { setEspecialidade(e.target.value); setEspecialidadeSecundaria('') }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]">
                <option value="">Selecione</option>
                {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">
                Especialidade Secundária <span className="text-[#52525b]">(opcional)</span>
              </label>
              <select
                value={especialidadeSecundaria}
                onChange={e => setEspecialidadeSecundaria(e.target.value)}
                disabled={!especialidade}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Nenhuma</option>
                {espSecOptions.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              {!especialidade && (
                <p className="text-[#3f3f46] text-xs mt-1">Selecione a especialidade principal primeiro.</p>
              )}
            </div>

            {editingProfessor?.status === 'ferias' && editingProfessor.feriasInicio && editingProfessor.feriasFim && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
                <p className="text-yellow-300 text-xs font-semibold">Férias atuais</p>
                <p className="text-white text-sm font-mono mt-1">{formatLocalDate(editingProfessor.feriasInicio)} → {formatLocalDate(editingProfessor.feriasFim)}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div>
                <p className="text-sm font-semibold text-white">Acesso do professor</p>
                <p className="mt-0.5 text-xs text-[#71717a]">Gere uma senha temporária e exija a troca no próximo acesso.</p>
              </div>
              <button
                type="button"
                disabled={editingProfessor?.status === 'inativo'}
                title={editingProfessor?.status === 'inativo' ? 'Reative o professor antes de redefinir a senha.' : undefined}
                onClick={() => editingProfessor && setResetTargetId(editingProfessor.id)}
                className="shrink-0 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-300 transition-colors hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Redefinir senha
              </button>
            </div>

            {formError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowEditar(false); setEditingId(null); resetForm() }}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-2.5 text-sm transition-colors">Cancelar</button>
              <button type="submit"
                className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold rounded-xl py-2.5 text-sm transition-colors">Salvar</button>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => { setFormError(''); setShowFerias(true) }} className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/15 text-yellow-400 rounded-xl py-2 text-sm">
                {editingProfessor?.status === 'ferias' ? 'Alterar Férias' : 'Programar Férias'}
              </button>
              {editingProfessor?.status === 'ferias' && (
                <button type="button" onClick={() => handleMudarStatus('ativo')} className="flex-1 bg-[#22c55e]/10 hover:bg-[#22c55e]/15 text-[#22c55e] rounded-xl py-2 text-sm">Retornar</button>
              )}
              <button type="button" onClick={() => handleMudarStatus('inativo')} className="flex-1 bg-red-500/10 text-red-400 rounded-xl py-2 text-sm">Demitir</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Formulário de cadastro
  if (showCadastrar) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              <h2 className="font-bold text-white font-mono">Cadastrar Professor</h2>
              <p className="text-[#71717a] text-xs mt-0.5">Será gerada uma senha temporária exclusiva para o primeiro acesso.</p>
            </div>
            <button onClick={() => { setShowCadastrar(false); resetForm() }} className="text-[#52525b] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={handleCadastrar} className="p-5 space-y-4 overflow-auto flex-1">
            {/* Nome */}
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Nome Completo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do professor" autoFocus
                className="w-full bg-[#1a1a1a] border border-[#22c55e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" />
            </div>

            {/* CPF + Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">CPF</label>
                <input value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="123.456.789-00" inputMode="numeric" aria-invalid={cpf.length === 14 && !isValidCpf(cpf)}
                  className={`w-full bg-[#1a1a1a] border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none ${cpf.length === 14 && !isValidCpf(cpf) ? 'border-red-500 focus:border-red-400' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`} />
                {cpf.length === 14 && !isValidCpf(cpf) && <p className="text-red-400 text-[11px] mt-1">CPF inválido</p>}
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-xs mb-1">Telefone</label>
                <input value={telefone} onChange={e => setTelefone(formatTel(e.target.value))} placeholder="(11) 9XXXX-XXXX"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@fitpro.com"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]" />
            </div>

            {/* Horário */}
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1.5">Horário de Trabalho</label>
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div>
                    <p className="text-[#52525b] text-[10px] mb-1.5 text-center">ENTRADA</p>
                    <TimeSelect value={horarioInicio} onChange={setHorarioInicio} />
                  </div>
                  <div className="text-[#3f3f46] text-sm font-mono pt-5">→</div>
                  <div>
                    <p className="text-[#52525b] text-[10px] mb-1.5 text-center">SAÍDA</p>
                    <TimeSelect value={horarioFim} onChange={setHorarioFim} />
                  </div>
                </div>
                {horario && (
                  <p className="text-[#22c55e] text-xs font-mono text-center mt-2">{horario}</p>
                )}
              </div>
            </div>

            {/* Salário */}
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Salário</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm font-mono">R$</span>
                <input
                  value={salario}
                  onChange={e => setSalario(formatSalario(e.target.value))}
                  placeholder="4.500,00"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] font-mono"
                />
              </div>
            </div>

            {/* Especialidade Principal */}
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">Especialidade Principal</label>
              <select value={especialidade} onChange={e => { setEspecialidade(e.target.value); setEspecialidadeSecundaria('') }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]">
                <option value="">Selecione</option>
                {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Especialidade Secundária */}
            <div>
              <label className="block text-[#a1a1aa] text-xs mb-1">
                Especialidade Secundária <span className="text-[#52525b]">(opcional)</span>
              </label>
              <select
                value={especialidadeSecundaria}
                onChange={e => setEspecialidadeSecundaria(e.target.value)}
                disabled={!especialidade}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Nenhuma</option>
                {espSecOptions.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              {!especialidade && (
                <p className="text-[#3f3f46] text-xs mt-1">Selecione a especialidade principal primeiro.</p>
              )}
            </div>

            {/* Erro */}
            {formError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowCadastrar(false); resetForm() }}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-2.5 text-sm transition-colors">Cancelar</button>
              <button type="submit"
                className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold rounded-xl py-2.5 text-sm transition-colors">Cadastrar</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Lista de professores
  return (
    <>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-bold text-white font-mono text-lg">Gerenciar Professores</h2>
            <p className="text-[#71717a] text-xs mt-0.5">{professores.length} professor(es) na equipe</p>
          </div>
          <button onClick={onClose} aria-label="Fechar professores" className="text-[#52525b] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-white text-sm">Central de Professores</p>
                  <p className="text-[#52525b] text-xs">Busca rápida, acompanhe agenda, folha e abra o perfil para editar.</p>
                </div>
                <button onClick={() => setShowCadastrar(true)}
                  className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /><path d="M19 8v6M22 11h-6" />
                  </svg>
                  Cadastrar Professor
                </button>
              </div>
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou CPF..."
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e]" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${filter === f.key ? 'bg-[#22c55e] text-black font-semibold' : 'bg-[#1a1a1a] text-[#a1a1aa] hover:bg-[#222]'}`}>
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { label: 'ATIVOS', value: ativos, color: 'text-[#22c55e]', desc: 'Professores em operação normal.' },
                { label: 'FÉRIAS', value: ferias, color: 'text-yellow-400', desc: 'Equipe temporariamente fora da escala.' },
                { label: 'FOLHA PENDENTE', value: `R$ ${folhaPendente.toFixed(2).replace('.', ',')}`, color: 'text-blue-400', desc: 'Lançamentos do mês aguardando fechamento.', small: true },
              ].map(s => (
                <div key={s.label} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3">
                  <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-1">{s.label}</p>
                  <p className={`${s.small ? 'text-lg' : 'text-2xl'} font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-[#52525b] text-xs mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-white text-sm font-semibold">Lista de professores</p>
            <p className="text-[#71717a] text-xs">{filtered.length} resultado(s)</p>
          </div>

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl overflow-hidden mb-4">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[#52525b] text-sm">Nenhum professor encontrado.</div>
            ) : (
              filtered.map((p, i) => (
                <div key={p.id} onClick={() => openEdit(p)} className={`cursor-pointer flex items-center gap-4 px-4 py-3 hover:bg-[#161616] transition-colors ${i < filtered.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-[#1a2a3a] flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
                    {p.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{p.nome}</p>
                    <p className="text-[#52525b] text-xs">{p.especialidade} · {p.horario}</p>
                    {p.status === 'ferias' && p.feriasInicio && p.feriasFim && (
                      <p className="text-yellow-400/80 text-[11px] mt-0.5">{formatLocalDate(p.feriasInicio)} → {formatLocalDate(p.feriasFim)}</p>
                    )}
                  </div>
                  <div className="hidden sm:block text-[#52525b] text-xs font-mono">R$ {p.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div>{statusBadge(p.status)}</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </div>
              ))
            )}
          </div>

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-semibold">Cobertura da equipe</p>
                <p className="text-[#52525b] text-xs">Professores sem turma hoje ou fora da escala aparecem aqui para ajuste rápido de agenda.</p>
              </div>
              <span className="text-xs bg-[#1a1a1a] text-[#71717a] px-3 py-1 rounded-full">0 sem turma</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    {credencialCriada && (
      <TemporaryAccessModal
        nome={credencialCriada.nome}
        cpf={credencialCriada.cpf}
        perfil="Professor"
        senha={credencialCriada.senha}
        mode={credencialCriada.mode}
        onClose={() => setCredencialCriada(null)}
      />
    )}
    </>
  )
}
