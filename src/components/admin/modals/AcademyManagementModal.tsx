import { useEffect, useRef, useState } from 'react'
import { academyApi, type Academy, type AcademyAdmin } from '../../../api/academy'
import { lookupCep } from '../../../api/cep'
import { formatCpf, isValidCpf } from '../../../lib/cpf'
import { formatPhone, isValidPhone } from '../../../lib/phone'
import { useAuthStore } from '../../../store/authStore'
import TemporaryAccessModal from './TemporaryAccessModal'
import OwnerPixSection from '../../owner/OwnerPixSection'

// Tela central do proprietário: cadastro das unidades, administradores e conta
// recebedora do Pix. `standalone` remove a moldura de modal no dashboard.
interface Props {
  onClose?: () => void
  standalone?: boolean
}
type Tab = 'academy' | 'admins'
interface AdminEditForm {
  academyId: string
  nome: string
  cpf: string
  telefone: string
  email: string
  cargo: string
  status: 'ativo' | 'inativo'
}

const EMPTY_ACADEMY: Academy = {
  nomeFantasia: '', razaoSocial: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '', responsavelLegal: '',
  telefone: '', whatsapp: '', email: '', site: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  pixTitularNome: '', pixTitularDocumento: '',
  horarioSemana: '06:00 às 23:00', horarioSabado: '08:00 às 18:00', horarioDomingo: 'Fechado', observacoes: '',
}

function formatCnpj(value: string) {
  return value.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function formatCep(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

function hasCompleteHours(value: string) {
  return value === 'Fechado' || /^\d{2}:\d{2} às \d{2}:\d{2}$/.test(value)
}

interface OpeningHoursEditorProps {
  label: string
  value: string
  defaultStart: string
  defaultEnd: string
  required?: boolean
  onChange: (value: string) => void
}

function OpeningHoursEditor({ label, value, defaultStart, defaultEnd, required = false, onChange }: OpeningHoursEditorProps) {
  const isClosed = value === 'Fechado'
  const [start = '', end = ''] = isClosed ? ['', ''] : value.split(' às ')
  const setTime = (nextStart: string, nextEnd: string) => onChange(`${nextStart} às ${nextEnd}`)

  return (
    <div className="rounded-xl border border-[#292929] bg-[#151515] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}{required ? ' *' : ''}</p>
        <button
          type="button"
          aria-pressed={!isClosed}
          onClick={() => onChange(isClosed ? `${defaultStart} às ${defaultEnd}` : 'Fechado')}
          className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${isClosed ? 'bg-zinc-700/40 text-zinc-300 hover:bg-zinc-700/60' : 'bg-[#22c55e]/15 text-[#86efac] hover:bg-[#22c55e]/25'}`}
        >
          {isClosed ? 'Fechado' : 'Aberto'}
        </button>
      </div>

      {isClosed ? (
        <div className="flex h-[46px] items-center rounded-xl border border-dashed border-[#303030] px-4 text-sm text-[#71717a]">Sem atendimento neste dia</div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">Abre
            <input type="time" required={required} value={start} onChange={(event) => setTime(event.target.value, end)} className="field-dark [color-scheme:dark]" />
          </label>
          <span className="pb-3 text-xs text-[#52525b]">até</span>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">Fecha
            <input type="time" required={required} value={end} onChange={(event) => setTime(start, event.target.value)} className="field-dark [color-scheme:dark]" />
          </label>
        </div>
      )}
    </div>
  )
}

export default function AcademyManagementModal({ onClose, standalone = false }: Props) {
  const isOwner = useAuthStore((state) => state.isOwner)

  // Estado da unidade selecionada e dos fluxos auxiliares (edição, acesso e exclusão).
  const [tab, setTab] = useState<Tab>('academy')
  const [academies, setAcademies] = useState<Academy[]>([])
  const [selectedAcademyId, setSelectedAcademyId] = useState('')
  const [academy, setAcademy] = useState<Academy>(EMPTY_ACADEMY)
  const [academyEditing, setAcademyEditing] = useState(true)
  const [admins, setAdmins] = useState<AcademyAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [assigningAdminId, setAssigningAdminId] = useState<string | null>(null)
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AdminEditForm | null>(null)
  const [resetTarget, setResetTarget] = useState<AcademyAdmin | null>(null)
  const [resetting, setResetting] = useState(false)
  const [deleteAcademyTarget, setDeleteAcademyTarget] = useState<Academy | null>(null)
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AcademyAdmin | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepFeedback, setCepFeedback] = useState('')
  const cepRequestRef = useRef(0)
  const [adminForm, setAdminForm] = useState({ academyId: '', nome: '', cpf: '', telefone: '', email: '', cargo: 'Administrador' })
  const [temporaryAccess, setTemporaryAccess] = useState<{ nome: string; cpf: string; senha: string; mode: 'created' | 'reset' } | null>(null)

  // Carrega unidades e responsáveis em paralelo sempre que o proprietário entra.
  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [academyData, adminData] = await Promise.all([academyApi.listAcademies(), academyApi.listAdmins()])
      const firstAcademy = academyData[0]
      setAcademies(academyData)
      setSelectedAcademyId(firstAcademy?.id ?? '')
      setAcademy(firstAcademy ?? { ...EMPTY_ACADEMY })
      setAcademyEditing(!firstAcademy || !firstAcademy.nomeFantasia.trim())
      setAdminForm((form) => ({ ...form, academyId: firstAcademy?.id ?? '' }))
      setAdmins(adminData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados da academia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isOwner) void load() }, [isOwner])

  if (!isOwner) return null

  const setField = (field: keyof Academy, value: string) => setAcademy((current) => ({ ...current, [field]: value }))

  // Preenche o endereço pelo CEP e ignora respostas antigas de buscas concorrentes.
  const findAddressByCep = async (value: string) => {
    const cep = value.replace(/\D/g, '')
    if (cep.length !== 8) {
      setCepFeedback('Informe os 8 números do CEP.')
      return
    }

    const requestId = ++cepRequestRef.current
    setCepLoading(true)
    setCepFeedback('Buscando endereço...')
    try {
      const address = await lookupCep(cep)
      if (requestId !== cepRequestRef.current) return
      setAcademy((current) => {
        if (current.cep.replace(/\D/g, '') !== cep) return current
        return {
          ...current,
          cep,
          endereco: address.street || current.endereco,
          bairro: address.neighborhood || current.bairro,
          cidade: address.city || current.cidade,
          estado: address.state || current.estado,
          complemento: current.complemento || address.complement,
        }
      })
      setCepFeedback(address.street ? 'Endereço preenchido automaticamente.' : 'Cidade e estado preenchidos. Complete a rua e o número.')
    } catch (err) {
      if (requestId !== cepRequestRef.current) return
      setCepFeedback(err instanceof Error ? err.message : 'Não foi possível consultar o CEP.')
    } finally {
      if (requestId === cepRequestRef.current) setCepLoading(false)
    }
  }

  const changeCep = (value: string) => {
    const cep = value.replace(/\D/g, '').slice(0, 8)
    setField('cep', cep)
    setCepFeedback('')
    if (cep.length === 8) {
      void findAddressByCep(cep)
    } else {
      cepRequestRef.current += 1
      setCepLoading(false)
    }
  }

  // Validações do formulário da academia ficam antes da chamada de persistência.
  const saveAcademy = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!academy.nomeFantasia.trim()) {
      setError('Informe o nome da academia.')
      return
    }
    if (academy.telefone && !isValidPhone(academy.telefone)) {
      setError('Informe um telefone com DDD e 10 ou 11 números.')
      return
    }
    if (academy.whatsapp && !isValidPhone(academy.whatsapp)) {
      setError('Informe um WhatsApp com DDD e 10 ou 11 números.')
      return
    }
    if (academy.cnpj && academy.cnpj.replace(/\D/g, '').length !== 14) {
      setError('Informe um CNPJ com 14 números.')
      return
    }
    if (academy.cep && academy.cep.replace(/\D/g, '').length !== 8) {
      setError('Informe um CEP com 8 números.')
      return
    }
    const payeeDocument = academy.pixTitularDocumento.replace(/\D/g, '')
    if (payeeDocument && ![11, 14].includes(payeeDocument.length)) {
      setError('Informe CPF ou CNPJ do titular do Mercado Pago.')
      return
    }
    if (!hasCompleteHours(academy.horarioSemana)) {
      setError('Informe os horários de abertura e fechamento de segunda a sexta.')
      return
    }
    if (academy.horarioSabado && !hasCompleteHours(academy.horarioSabado)) {
      setError('Complete o horário de sábado ou marque como fechado.')
      return
    }
    if (academy.horarioDomingo && !hasCompleteHours(academy.horarioDomingo)) {
      setError('Complete o horário de domingo e feriados ou marque como fechado.')
      return
    }
    setSaving(true)
    try {
      const saved = await academyApi.saveAcademy(academy)
      setAcademy(saved)
      setSelectedAcademyId(saved.id ?? '')
      setAcademies((current) => {
        const exists = current.some((item) => item.id === saved.id)
        const next = exists ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]
        return next.sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia))
      })
      setAdminForm((form) => ({ ...form, academyId: form.academyId || saved.id || '' }))
      setAcademyEditing(false)
      setMessage('Informações da academia salvas com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a academia.')
    } finally {
      setSaving(false)
    }
  }

  // Cria o usuário no servidor e abre a credencial temporária retornada uma vez.
  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!adminForm.academyId) {
      setError('Selecione a academia que este administrador vai gerenciar.')
      return
    }
    if (!adminForm.nome.trim() || !adminForm.cpf.trim()) {
      setError('Informe o nome e o CPF do administrador.')
      return
    }
    if (!isValidCpf(adminForm.cpf)) {
      setError('Informe um CPF válido.')
      return
    }
    if (adminForm.telefone && !isValidPhone(adminForm.telefone)) {
      setError('Informe um telefone com DDD e 10 ou 11 números.')
      return
    }
    setSaving(true)
    try {
      const result = await academyApi.createAdmin(adminForm)
      setAdmins((current) => [...current, result.admin].sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.nome.localeCompare(b.nome)))
      setTemporaryAccess({ nome: result.admin.nome, cpf: result.admin.cpf, senha: result.temporaryPassword, mode: 'created' })
      setAdminForm({ academyId: selectedAcademyId || academies[0]?.id || '', nome: '', cpf: '', telefone: '', email: '', cargo: 'Administrador' })
      setShowAdminForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar o administrador.')
    } finally {
      setSaving(false)
    }
  }

  // Troca de unidade e ações de manutenção dos administradores.
  const selectAcademy = (academyId: string) => {
    const selected = academies.find((item) => item.id === academyId)
    if (!selected) return
    setSelectedAcademyId(academyId)
    setAcademy(selected)
    setAcademyEditing(false)
    setError('')
    setMessage('')
    setCepFeedback('')
  }

  const startNewAcademy = () => {
    setSelectedAcademyId('')
    setAcademy({ ...EMPTY_ACADEMY })
    setAcademyEditing(true)
    setError('')
    setCepFeedback('')
    setMessage('Preencha os dados para cadastrar uma nova academia.')
  }

  const assignAdmin = async (adminId: string, academyId: string) => {
    setError('')
    setMessage('')
    setAssigningAdminId(adminId)
    try {
      const saved = await academyApi.assignAdminToAcademy(adminId, academyId)
      setAdmins((current) => current.map((item) => item.id === adminId ? saved : item))
      const academyName = academies.find((item) => item.id === academyId)?.nomeFantasia ?? 'academia selecionada'
      setMessage(`Administrador vinculado à academia “${academyName}” com sucesso.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a academia do administrador.')
    } finally {
      setAssigningAdminId(null)
    }
  }

  const startEditAdmin = (admin: AcademyAdmin) => {
    setShowAdminForm(false)
    setEditingAdminId(admin.id)
    setEditForm({
      academyId: admin.academyId,
      nome: admin.nome,
      cpf: admin.cpf,
      telefone: admin.telefone,
      email: admin.email,
      cargo: admin.cargo,
      status: admin.status,
    })
    setError('')
    setMessage('')
  }

  const saveAdmin = async (event: React.FormEvent, admin: AcademyAdmin) => {
    event.preventDefault()
    if (!editForm) return
    setError('')
    setMessage('')
    if (!editForm.nome.trim()) {
      setError('Informe o nome do administrador.')
      return
    }
    if (editForm.telefone && !isValidPhone(editForm.telefone)) {
      setError('Informe um telefone com DDD e 10 ou 11 números.')
      return
    }

    setSaving(true)
    try {
      const saved = await academyApi.updateAdmin({
        id: admin.id,
        academyId: editForm.academyId,
        nome: editForm.nome,
        telefone: editForm.telefone,
        email: editForm.email,
        cargo: editForm.cargo,
        status: editForm.status,
      })
      setAdmins((current) => current.map((item) => item.id === saved.id ? saved : item))
      setEditingAdminId(null)
      setEditForm(null)
      setMessage('Informações do administrador salvas com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o administrador.')
    } finally {
      setSaving(false)
    }
  }

  const resetAdminPassword = async () => {
    if (!resetTarget) return
    setError('')
    setMessage('')
    setResetting(true)
    try {
      const result = await academyApi.resetAdminPassword(resetTarget.id)
      setAdmins((current) => current.map((item) => item.id === result.admin.id ? result.admin : item))
      setTemporaryAccess({
        nome: result.admin.nome,
        cpf: result.admin.cpf,
        senha: result.temporaryPassword,
        mode: 'reset',
      })
      setResetTarget(null)
      setEditingAdminId(null)
      setEditForm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha do administrador.')
    } finally {
      setResetting(false)
    }
  }

  const deleteAcademy = async () => {
    if (!deleteAcademyTarget?.id) return
    setError('')
    setMessage('')
    setDeleting(true)
    try {
      await academyApi.deleteAcademy(deleteAcademyTarget.id)
      const remainingAcademies = academies.filter((item) => item.id !== deleteAcademyTarget.id)
      const nextAcademy = remainingAcademies[0]
      setAcademies(remainingAcademies)
      setSelectedAcademyId(nextAcademy?.id ?? '')
      setAcademy(nextAcademy ?? { ...EMPTY_ACADEMY })
      setAcademyEditing(!nextAcademy)
      setAdminForm((form) => ({
        ...form,
        academyId: form.academyId === deleteAcademyTarget.id ? (nextAcademy?.id ?? '') : form.academyId,
      }))
      setDeleteAcademyTarget(null)
      setMessage('Academia excluída com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a academia.')
      setDeleteAcademyTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const deleteAdmin = async () => {
    if (!deleteAdminTarget) return
    setError('')
    setMessage('')
    setDeleting(true)
    try {
      await academyApi.deleteAdmin(deleteAdminTarget.id)
      setAdmins((current) => current.filter((item) => item.id !== deleteAdminTarget.id))
      setEditingAdminId(null)
      setEditForm(null)
      setDeleteAdminTarget(null)
      setMessage('Administrador e acesso de login excluídos com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o administrador.')
      setDeleteAdminTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // O proprietário nunca aparece na lista editável de administradores.
  const managedAdmins = admins.filter((admin) => !admin.isOwner)

  return (
    <div className={standalone ? 'w-full' : 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6'}>
      <div className={standalone
        ? 'w-full bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden'
        : 'w-full max-w-4xl max-h-[94vh] bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col'}>
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5 border-b border-[#242424]">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-violet-300">PROPRIETÁRIO</span>
              <h2 className="text-white font-bold font-mono text-lg">Academia e Administradores</h2>
            </div>
            <p className="text-[#71717a] text-sm mt-1">Esta área é visível somente para o proprietário do sistema.</p>
          </div>
          {!standalone && <button onClick={onClose} aria-label="Fechar" className="text-[#52525b] hover:text-white text-2xl leading-none">×</button>}
        </div>

        <div className="grid grid-cols-2 border-b border-[#242424]">
          <button onClick={() => { setTab('academy'); setError(''); setMessage('') }} className={`py-3 text-sm font-semibold ${tab === 'academy' ? 'text-violet-300 border-b-2 border-violet-400 bg-violet-400/5' : 'text-[#71717a] hover:text-white'}`}>Academias ({academies.length})</button>
          <button onClick={() => { setTab('admins'); setError(''); setMessage('') }} className={`py-3 text-sm font-semibold ${tab === 'admins' ? 'text-[#22c55e] border-b-2 border-[#22c55e] bg-[#22c55e]/5' : 'text-[#71717a] hover:text-white'}`}>Administradores ({managedAdmins.length})</button>
        </div>

        <div className={standalone ? 'p-5 sm:p-6' : 'overflow-y-auto p-5 sm:p-6'}>
          {error && <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          {message && <div className="mb-4 rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/10 px-4 py-3 text-sm text-[#86efac]">{message}</div>}

          {loading ? (
            <div className="py-16 text-center text-[#52525b] text-sm">Carregando informações...</div>
          ) : tab === 'academy' ? (
            <form onSubmit={saveAcademy} className="space-y-5">
              <section className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <label className="flex-1 text-[#a1a1aa] text-xs">Academia selecionada
                    <select
                      value={selectedAcademyId}
                      onChange={(event) => selectAcademy(event.target.value)}
                      className="field-dark"
                    >
                      {!selectedAcademyId && <option value="">Nova academia</option>}
                      {academies.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia}</option>)}
                    </select>
                  </label>
                  {selectedAcademyId && (
                    <button
                      type="button"
                      onClick={() => setAcademyEditing(true)}
                      disabled={academyEditing}
                      className="h-[46px] rounded-xl bg-violet-400 px-4 text-sm font-bold text-black hover:bg-violet-300 disabled:cursor-default disabled:opacity-50"
                    >
                      {academyEditing ? 'Editando dados' : 'Editar academia'}
                    </button>
                  )}
                  {selectedAcademyId && (
                    <button
                      type="button"
                      onClick={() => setDeleteAcademyTarget(academy)}
                      className="h-[46px] rounded-xl border border-red-500/35 bg-red-500/5 px-4 text-sm font-semibold text-red-300 hover:bg-red-500/10"
                    >
                      Excluir academia
                    </button>
                  )}
                  <button type="button" onClick={startNewAcademy} className="h-[46px] rounded-xl border border-violet-400/30 px-4 text-sm font-semibold text-violet-300 hover:bg-violet-400/10">Adicionar academia</button>
                </div>
                <p className="mt-3 text-xs text-[#a1a1aa]">Cadastre cada unidade com dados fiscais, contato, endereço e horários. Depois escolha quem administrará cada academia.</p>
              </section>

              <fieldset disabled={!academyEditing} className="space-y-5 disabled:[&_input]:cursor-not-allowed disabled:[&_input]:opacity-65 disabled:[&_textarea]:cursor-not-allowed disabled:[&_textarea]:opacity-65">
                <section className="rounded-2xl border border-[#242424] bg-[#0d0d0d] p-5">
                  <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-4">IDENTIFICAÇÃO E DADOS FISCAIS</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="text-[#a1a1aa] text-xs">Nome fantasia *<input required value={academy.nomeFantasia} onChange={(e) => setField('nomeFantasia', e.target.value)} className="field-dark" placeholder="Ex.: Academia FitPro" /></label>
                    <label className="text-[#a1a1aa] text-xs">Razão social *<input required value={academy.razaoSocial} onChange={(e) => setField('razaoSocial', e.target.value)} className="field-dark" placeholder="Nome empresarial" /></label>
                    <label className="text-[#a1a1aa] text-xs">CNPJ *<input required value={formatCnpj(academy.cnpj)} onChange={(e) => setField('cnpj', e.target.value)} className="field-dark" placeholder="00.000.000/0000-00" /></label>
                    <label className="text-[#a1a1aa] text-xs">Responsável legal *<input required value={academy.responsavelLegal} onChange={(e) => setField('responsavelLegal', e.target.value)} className="field-dark" placeholder="Nome completo" /></label>
                    <label className="text-[#a1a1aa] text-xs">Inscrição estadual<input value={academy.inscricaoEstadual} onChange={(e) => setField('inscricaoEstadual', e.target.value)} className="field-dark" placeholder="Isento ou número da inscrição" /></label>
                    <label className="text-[#a1a1aa] text-xs">Inscrição municipal<input value={academy.inscricaoMunicipal} onChange={(e) => setField('inscricaoMunicipal', e.target.value)} className="field-dark" placeholder="Número da inscrição" /></label>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#242424] bg-[#0d0d0d] p-5">
                  <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-4">CONTATO</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="text-[#a1a1aa] text-xs">Telefone *<input required type="tel" inputMode="numeric" maxLength={15} value={formatPhone(academy.telefone)} onChange={(e) => setField('telefone', formatPhone(e.target.value))} className="field-dark" placeholder="(00) 0000-0000" /></label>
                    <label className="text-[#a1a1aa] text-xs">WhatsApp<input type="tel" inputMode="numeric" maxLength={15} value={formatPhone(academy.whatsapp)} onChange={(e) => setField('whatsapp', formatPhone(e.target.value))} className="field-dark" placeholder="(00) 00000-0000" /></label>
                    <label className="text-[#a1a1aa] text-xs">E-mail *<input required type="email" value={academy.email} onChange={(e) => setField('email', e.target.value)} className="field-dark" placeholder="contato@academia.com" /></label>
                    <label className="text-[#a1a1aa] text-xs">Site<input type="url" value={academy.site} onChange={(e) => setField('site', e.target.value)} className="field-dark" placeholder="https://www.academia.com.br" /></label>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#242424] bg-[#0d0d0d] p-5">
                  <p className="text-[#71717a] text-[10px] font-mono tracking-widest mb-4">ENDEREÇO</p>
                  <div className="grid sm:grid-cols-6 gap-4">
                    <label className="sm:col-span-2 text-[#a1a1aa] text-xs">CEP *
                      <div className="relative mt-1.5">
                        <input required inputMode="numeric" maxLength={9} value={formatCep(academy.cep)} onChange={(event) => changeCep(event.target.value)} onBlur={(event) => { if (event.target.value.replace(/\D/g, '').length === 8 && !cepFeedback) void findAddressByCep(event.target.value) }} className="field-dark !mt-0 pr-24" placeholder="00000-000" />
                        <button type="button" disabled={cepLoading || academy.cep.replace(/\D/g, '').length !== 8} onClick={() => void findAddressByCep(academy.cep)} className="absolute inset-y-1.5 right-1.5 rounded-lg bg-violet-400/15 px-3 text-[11px] font-bold text-violet-300 hover:bg-violet-400/25 disabled:cursor-not-allowed disabled:opacity-40">{cepLoading ? 'Buscando...' : 'Buscar'}</button>
                      </div>
                      {cepFeedback && <span className={`mt-1.5 block text-[11px] ${cepFeedback.includes('preenchido') ? 'text-[#86efac]' : cepLoading ? 'text-violet-300' : 'text-[#fca5a5]'}`}>{cepFeedback}</span>}
                    </label>
                    <label className="sm:col-span-3 text-[#a1a1aa] text-xs">Rua / avenida *<input required value={academy.endereco} onChange={(e) => setField('endereco', e.target.value)} className="field-dark" placeholder="Nome do logradouro" /></label>
                    <label className="sm:col-span-1 text-[#a1a1aa] text-xs">Número *<input required value={academy.numero} onChange={(e) => setField('numero', e.target.value)} className="field-dark" /></label>
                    <label className="sm:col-span-2 text-[#a1a1aa] text-xs">Complemento<input value={academy.complemento} onChange={(e) => setField('complemento', e.target.value)} className="field-dark" placeholder="Sala, bloco, referência" /></label>
                    <label className="sm:col-span-2 text-[#a1a1aa] text-xs">Bairro *<input required value={academy.bairro} onChange={(e) => setField('bairro', e.target.value)} className="field-dark" /></label>
                    <label className="sm:col-span-1 text-[#a1a1aa] text-xs">Cidade *<input required value={academy.cidade} onChange={(e) => setField('cidade', e.target.value)} className="field-dark" /></label>
                    <label className="sm:col-span-1 text-[#a1a1aa] text-xs">UF *<input required value={academy.estado} onChange={(e) => setField('estado', e.target.value.toUpperCase().slice(0, 2))} className="field-dark" maxLength={2} placeholder="SP" /></label>
                  </div>
                </section>
              </fieldset>

              <section className="rounded-2xl border border-[#242424] bg-[#0d0d0d] p-5">
                <p className="text-[#71717a] text-[10px] font-mono tracking-widest">DADOS FINANCEIROS</p>
                <p className="mt-1 text-xs text-[#71717a]">Estes dados ajudam a conferir o titular. O dinheiro vai para a conta Mercado Pago autorizada, não para uma chave digitada aqui.</p>
                <fieldset disabled={!academyEditing} className="mt-4 grid gap-4 sm:grid-cols-2 disabled:[&_input]:cursor-not-allowed disabled:[&_input]:opacity-65">
                  <label className="text-[#a1a1aa] text-xs">Titular da conta Mercado Pago
                    <input value={academy.pixTitularNome} onChange={(e) => setField('pixTitularNome', e.target.value)} className="field-dark" placeholder="Nome da empresa ou do titular" />
                  </label>
                  <label className="text-[#a1a1aa] text-xs">CPF ou CNPJ do titular
                    <input inputMode="numeric" maxLength={14} value={academy.pixTitularDocumento} onChange={(e) => setField('pixTitularDocumento', e.target.value.replace(/\D/g, '').slice(0, 14))} className="field-dark" placeholder="Somente números" />
                  </label>
                </fieldset>
                <div className="mt-5 border-t border-[#292929] pt-5">
                  <OwnerPixSection academyId={selectedAcademyId} />
                </div>
              </section>

              <fieldset disabled={!academyEditing} className="space-y-5 disabled:[&_input]:cursor-not-allowed disabled:[&_input]:opacity-65 disabled:[&_textarea]:cursor-not-allowed disabled:[&_textarea]:opacity-65">

                <section className="rounded-2xl border border-[#242424] bg-[#0d0d0d] p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[#71717a] text-[10px] font-mono tracking-widest">HORÁRIO DE FUNCIONAMENTO</p>
                      <p className="mt-1 text-xs text-[#71717a]">Escolha os horários ou toque no status para marcar o período como fechado.</p>
                    </div>
                    <button type="button" onClick={() => setAcademy((current) => ({ ...current, horarioSemana: '06:00 às 23:00', horarioSabado: '08:00 às 18:00', horarioDomingo: 'Fechado' }))} className="self-start rounded-lg border border-violet-400/25 px-3 py-2 text-[11px] font-semibold text-violet-300 hover:bg-violet-400/10">Usar horários sugeridos</button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <OpeningHoursEditor label="Segunda a sexta" value={academy.horarioSemana} defaultStart="06:00" defaultEnd="23:00" required onChange={(value) => setField('horarioSemana', value)} />
                    <OpeningHoursEditor label="Sábado" value={academy.horarioSabado} defaultStart="08:00" defaultEnd="18:00" onChange={(value) => setField('horarioSabado', value)} />
                    <OpeningHoursEditor label="Domingo e feriados" value={academy.horarioDomingo} defaultStart="08:00" defaultEnd="14:00" onChange={(value) => setField('horarioDomingo', value)} />
                  </div>
                </section>

                <section className="rounded-2xl border border-[#242424] bg-[#0d0d0d] p-5">
                  <label className="text-[#a1a1aa] text-xs">Observações internas<textarea value={academy.observacoes} onChange={(e) => setField('observacoes', e.target.value)} className="field-dark min-h-24 resize-y" placeholder="Informações adicionais sobre a unidade" /></label>
                </section>
              </fieldset>

              {academyEditing ? (
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  {selectedAcademyId && <button type="button" onClick={() => { selectAcademy(selectedAcademyId); setAcademyEditing(false) }} className="rounded-xl border border-[#2a2a2a] px-5 py-3 text-sm font-semibold text-[#a1a1aa] hover:text-white">Cancelar edição</button>}
                  <button disabled={saving} className="rounded-xl bg-violet-400 hover:bg-violet-300 disabled:opacity-50 px-6 py-3 text-sm font-bold text-black">{saving ? 'Salvando...' : selectedAcademyId ? 'Salvar alterações' : 'Cadastrar academia'}</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-3">
                  <p className="text-sm text-[#86efac]">Cadastro salvo. Use “Editar academia” para alterar qualquer informação.</p>
                  <button type="button" onClick={() => setAcademyEditing(true)} className="shrink-0 rounded-lg bg-violet-400 px-3 py-2 text-xs font-bold text-black hover:bg-violet-300">Editar</button>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-white font-semibold">Administradores da academia</h3>
                  <p className="text-[#71717a] text-xs mt-0.5">Cadastre quem cuidará da operação diária e defina a unidade de cada pessoa.</p>
                </div>
                <button onClick={() => { setShowAdminForm(true); setEditingAdminId(null); setEditForm(null); setAdminForm((form) => ({ ...form, academyId: form.academyId || selectedAcademyId || academies[0]?.id || '' })); setError(''); setMessage('') }} className="rounded-xl bg-[#22c55e] hover:bg-[#16a34a] px-4 py-2.5 text-sm font-bold text-black whitespace-nowrap">Adicionar administrador</button>
              </div>

              {showAdminForm && (
                <form onSubmit={createAdmin} className="rounded-2xl border border-[#22c55e]/25 bg-[#22c55e]/5 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-semibold">Novo administrador</h4>
                    <button type="button" onClick={() => setShowAdminForm(false)} className="text-[#71717a] hover:text-white text-sm">Cancelar</button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="sm:col-span-2 text-[#a1a1aa] text-xs">Academia que vai administrar *
                      <select value={adminForm.academyId} onChange={(e) => setAdminForm((form) => ({ ...form, academyId: e.target.value }))} className="field-dark" required>
                        <option value="">Selecione a academia</option>
                        {academies.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia}</option>)}
                      </select>
                    </label>
                    <label className="text-[#a1a1aa] text-xs">Nome completo *<input value={adminForm.nome} onChange={(e) => setAdminForm((form) => ({ ...form, nome: e.target.value }))} className="field-dark" /></label>
                    <label className="text-[#a1a1aa] text-xs">CPF *<input value={formatCpf(adminForm.cpf)} onChange={(e) => setAdminForm((form) => ({ ...form, cpf: e.target.value }))} className="field-dark" placeholder="000.000.000-00" /></label>
                    <label className="text-[#a1a1aa] text-xs">Telefone<input type="tel" inputMode="numeric" maxLength={15} value={formatPhone(adminForm.telefone)} onChange={(e) => setAdminForm((form) => ({ ...form, telefone: formatPhone(e.target.value) }))} className="field-dark" placeholder="(00) 00000-0000" /></label>
                    <label className="text-[#a1a1aa] text-xs">E-mail de contato<input type="email" value={adminForm.email} onChange={(e) => setAdminForm((form) => ({ ...form, email: e.target.value }))} className="field-dark" /></label>
                    <label className="sm:col-span-2 text-[#a1a1aa] text-xs">Cargo<input value={adminForm.cargo} onChange={(e) => setAdminForm((form) => ({ ...form, cargo: e.target.value }))} className="field-dark" placeholder="Administrador" /></label>
                  </div>
                  <button disabled={saving} className="w-full mt-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 py-3 text-sm font-bold text-black">{saving ? 'Criando acesso...' : 'Cadastrar e gerar senha temporária'}</button>
                </form>
              )}

              <div className="space-y-2">
                {managedAdmins.length === 0 ? (
                  <p className="rounded-xl border border-[#242424] bg-[#0d0d0d] py-10 text-center text-[#52525b] text-sm">Nenhum administrador cadastrado.</p>
                ) : managedAdmins.map((admin) => (
                  <div key={admin.id} className="space-y-2">
                    <div className="rounded-xl border border-[#242424] bg-[#0d0d0d] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-400/10 text-violet-300 flex items-center justify-center font-bold">{admin.nome.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-semibold truncate">{admin.nome}</p>
                        </div>
                        <p className="text-[#71717a] text-xs mt-0.5">{admin.cargo} · {formatCpf(admin.cpf)}</p>
                      </div>
                      <div className="w-full sm:w-60">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">Academia responsável
                          <select
                            aria-label={`Academia de ${admin.nome}`}
                            value={admin.academyId}
                            onChange={(event) => void assignAdmin(admin.id, event.target.value)}
                            disabled={assigningAdminId === admin.id}
                            className="field-dark mt-1 disabled:opacity-50"
                          >
                            {academies.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="flex items-center gap-2 self-stretch sm:self-auto">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${admin.status === 'ativo' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-zinc-700/30 text-zinc-400'}`}>{admin.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingAdminId === admin.id) {
                              setEditingAdminId(null)
                              setEditForm(null)
                            } else {
                              startEditAdmin(admin)
                            }
                          }}
                          className="ml-auto rounded-lg border border-[#343434] px-3 py-2 text-xs font-semibold text-[#d4d4d8] hover:border-violet-400/40 hover:text-violet-300"
                        >
                          {editingAdminId === admin.id ? 'Fechar' : 'Editar'}
                        </button>
                      </div>
                    </div>

                    {editingAdminId === admin.id && editForm && (
                      <form onSubmit={(event) => void saveAdmin(event, admin)} className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <h4 className="text-white text-sm font-semibold">Editar administrador</h4>
                            <p className="text-[#71717a] text-xs mt-0.5">O CPF é o identificador do login e não pode ser alterado.</p>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <label className="text-[#a1a1aa] text-xs">Nome completo *
                            <input value={editForm.nome} onChange={(event) => setEditForm((form) => form ? ({ ...form, nome: event.target.value }) : form)} className="field-dark" />
                          </label>
                          <label className="text-[#71717a] text-xs">CPF do login
                            <input value={formatCpf(editForm.cpf)} readOnly disabled className="field-dark cursor-not-allowed opacity-60" />
                          </label>
                          <label className="text-[#a1a1aa] text-xs">Telefone
                            <input type="tel" inputMode="numeric" maxLength={15} value={formatPhone(editForm.telefone)} onChange={(event) => setEditForm((form) => form ? ({ ...form, telefone: formatPhone(event.target.value) }) : form)} className="field-dark" placeholder="(00) 00000-0000" />
                          </label>
                          <label className="text-[#a1a1aa] text-xs">E-mail de contato
                            <input type="email" value={editForm.email} onChange={(event) => setEditForm((form) => form ? ({ ...form, email: event.target.value }) : form)} className="field-dark" />
                          </label>
                          <label className="text-[#a1a1aa] text-xs">Cargo
                            <input value={editForm.cargo} onChange={(event) => setEditForm((form) => form ? ({ ...form, cargo: event.target.value }) : form)} className="field-dark" />
                          </label>
                          <label className="text-[#a1a1aa] text-xs">Status
                            <select value={editForm.status} onChange={(event) => setEditForm((form) => form ? ({ ...form, status: event.target.value as 'ativo' | 'inativo' }) : form)} className="field-dark">
                              <option value="ativo">Ativo</option>
                              <option value="inativo">Inativo</option>
                            </select>
                          </label>
                          <label className="sm:col-span-2 text-[#a1a1aa] text-xs">Academia responsável
                            <select value={editForm.academyId} onChange={(event) => setEditForm((form) => form ? ({ ...form, academyId: event.target.value }) : form)} className="field-dark">
                              {academies.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia}</option>)}
                            </select>
                          </label>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5">
                          <button
                            type="button"
                            disabled={admin.status !== 'ativo'}
                            title={admin.status !== 'ativo' ? 'Ative e salve o administrador antes de redefinir a senha.' : undefined}
                            onClick={() => setResetTarget(admin)}
                            className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Redefinir senha
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteAdminTarget(admin)}
                            className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/10"
                          >
                            Excluir administrador
                          </button>
                          <button type="button" onClick={() => { setEditingAdminId(null); setEditForm(null) }} className="sm:ml-auto rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-[#d4d4d8] hover:bg-[#222]">Cancelar</button>
                          <button disabled={saving} className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-black hover:bg-violet-300 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {temporaryAccess && (
        <TemporaryAccessModal
          nome={temporaryAccess.nome}
          cpf={temporaryAccess.cpf}
          perfil="Administrador"
          senha={temporaryAccess.senha}
          mode={temporaryAccess.mode}
          onClose={() => setTemporaryAccess(null)}
        />
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-yellow-500/25 bg-[#111111] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-300">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 4v6h6" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /><path d="M12 7v5l3 2" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white">Gerar nova senha temporária?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
              A senha atual de <strong className="text-white">{resetTarget.nome}</strong> deixará de funcionar e as sessões abertas serão encerradas. No próximo acesso, será obrigatório criar uma senha nova.
            </p>
            <div className="mt-6 flex gap-2">
              <button type="button" disabled={resetting} onClick={() => setResetTarget(null)} className="flex-1 rounded-xl bg-[#1a1a1a] py-3 text-sm text-white hover:bg-[#222] disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={resetting} onClick={() => void resetAdminPassword()} className="flex-1 rounded-xl bg-yellow-400 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">{resetting ? 'Gerando...' : 'Gerar nova senha'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteAcademyTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#111111] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white">Excluir esta academia?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
              O cadastro de <strong className="text-white">{deleteAcademyTarget.nomeFantasia}</strong> será removido permanentemente. Antes disso, transfira ou exclua todos os administradores vinculados a ela.
            </p>
            <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">Esta ação não pode ser desfeita.</p>
            <div className="mt-6 flex gap-2">
              <button type="button" disabled={deleting} onClick={() => setDeleteAcademyTarget(null)} className="flex-1 rounded-xl bg-[#1a1a1a] py-3 text-sm text-white hover:bg-[#222] disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={deleting} onClick={() => void deleteAcademy()} className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50">{deleting ? 'Excluindo...' : 'Excluir academia'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteAdminTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#111111] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white">Excluir este administrador?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
              O cadastro e o acesso de login de <strong className="text-white">{deleteAdminTarget.nome}</strong> serão removidos permanentemente.
            </p>
            <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">O proprietário nunca pode ser excluído por esta tela.</p>
            <div className="mt-6 flex gap-2">
              <button type="button" disabled={deleting} onClick={() => setDeleteAdminTarget(null)} className="flex-1 rounded-xl bg-[#1a1a1a] py-3 text-sm text-white hover:bg-[#222] disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={deleting} onClick={() => void deleteAdmin()} className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50">{deleting ? 'Excluindo...' : 'Excluir administrador'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
