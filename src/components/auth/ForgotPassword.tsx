import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { buildWhatsappRecoveryUrl, getRecoveryWhatsapp, studentRecoveryApi, type RecoveryAcademy } from '../../api/recovery'
import { formatCpf, isValidCpf, onlyCpfDigits } from '../../lib/cpf'
import type { UserRole } from '../../types'

export default function ForgotPassword() {
  // Perfil que solicitou a recuperação
  const params = useParams()
  const validRoles: UserRole[] = ['admin', 'professor', 'aluno']
  const role: UserRole = validRoles.includes(params.role as UserRole) ? params.role as UserRole : 'admin'
  const navigate = useNavigate()
  const roleLabel = role === 'admin' ? 'Administração' : role === 'professor' ? 'Professor' : 'Aluno'
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [academies, setAcademies] = useState<RecoveryAcademy[]>([])
  const [academyId, setAcademyId] = useState('')
  const [academyError, setAcademyError] = useState('')

  useEffect(() => {
    if (role !== 'aluno') return
    let active = true
    studentRecoveryApi.academies()
      .then(items => { if (active) setAcademies(items) })
      .catch(() => { if (active) setAcademyError('Não foi possível carregar as academias. Tente novamente mais tarde.') })
    return () => { active = false }
  }, [role])

  const requestWhatsapp = async () => {
    setError('')
    setNotice('')
    if (!isValidCpf(cpf)) { setError('Informe um CPF válido.'); return }
    const whatsappWindow = window.open('about:blank', '_blank')
    setLoading(true)
    try {
      const phone = await getRecoveryWhatsapp(role, cpf)
      const message = [
        'Olá! Preciso recuperar meu acesso ao FitPro.',
        `Perfil: ${roleLabel}`,
        `CPF: ${formatCpf(onlyCpfDigits(cpf))}`,
        'Podem confirmar minha identidade e emitir uma nova senha temporária?',
      ].join('\n')
      const url = buildWhatsappRecoveryUrl(phone, message)
      if (whatsappWindow) {
        whatsappWindow.opener = null
        whatsappWindow.location.href = url
      } else {
        window.location.href = url
      }
      setNotice(phone
        ? 'O WhatsApp da academia foi aberto com a solicitação pronta para enviar.'
        : 'A academia ainda não cadastrou um WhatsApp. Escolha o contato da administração no WhatsApp para enviar a solicitação.')
    } catch {
      whatsappWindow?.close()
      setError('Não foi possível abrir o contato da academia. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const requestRecovery = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!isValidCpf(cpf)) {
      setError('Informe um CPF válido.')
      return
    }

    if (role === 'aluno') {
      if (!academyId) { setError('Selecione a academia em que você está cadastrado.'); return }
      setLoading(true)
      try {
        setNotice(await studentRecoveryApi.request(cpf, academyId))
      } catch {
        setError('Não foi possível enviar o pedido agora. Tente novamente mais tarde.')
      } finally {
        setLoading(false)
      }
      return
    }

    await requestWhatsapp()
  }

  // Orientação de recuperação segura
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col px-4 py-8">
      <button onClick={() => navigate(`/login/${role}`)}
        className="flex items-center gap-2 text-[#71717a] hover:text-white transition-colors text-sm mb-8 w-fit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Voltar ao login
      </button>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1a3a1a] text-[#22c55e] flex items-center justify-center mb-5">
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </div>
          <p className="text-[#22c55e] text-[10px] font-mono tracking-widest">{roleLabel.toUpperCase()}</p>
          <h1 className="text-white text-2xl font-bold font-mono mt-1">Recuperação de acesso</h1>
          <p className="text-[#71717a] text-sm leading-relaxed mt-3">
            {role === 'aluno'
              ? 'Informe seu CPF e selecione sua academia. A administração receberá um aviso para conferir o pedido.'
              : 'Informe seu CPF para solicitar uma nova senha temporária à administração da academia.'}
          </p>

          <form onSubmit={requestRecovery} className="mt-5 space-y-4">
            <label className="block text-[#a1a1aa] text-sm">CPF
              <input
                value={cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
              />
            </label>

            {role === 'aluno' && (
              <label className="block text-[#a1a1aa] text-sm">Academia
                <select value={academyId} onChange={event => setAcademyId(event.target.value)}
                  className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#22c55e]">
                  <option value="">Selecione sua academia</option>
                  {academies.map(academy => <option key={academy.id} value={academy.id}>{academy.name}</option>)}
                </select>
                {academyError && <span className="mt-1 block text-xs text-red-300">{academyError}</span>}
              </label>
            )}

            <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 p-4">
              <p className="text-[#86efac] text-sm font-semibold">Como funciona</p>
              <p className="text-[#a1a1aa] text-xs leading-relaxed mt-1">
                {role === 'aluno'
                  ? 'O pedido não altera sua senha. A academia confirmará sua identidade antes de entregar uma nova senha temporária.'
                  : 'O WhatsApp abrirá com uma mensagem pronta. A administração confirmará sua identidade antes de gerar a nova senha.'}
              </p>
            </div>

            {error && <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</p>}
            {notice && <p className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-3 text-sm text-[#86efac]">{notice}</p>}

            <button
              type="submit"
              disabled={loading || (role === 'aluno' && academies.length === 0)}
              className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-black font-semibold rounded-xl py-3 text-sm"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {role === 'aluno'
                  ? <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>
                  : <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6A8.38 8.38 0 0 1 12.5 3h.5a8.48 8.48 0 0 1 8 8z" />}
              </svg>
              {loading ? (role === 'aluno' ? 'Enviando pedido...' : 'Abrindo WhatsApp...') : (role === 'aluno' ? 'Enviar aviso à academia' : 'Solicitar pelo WhatsApp')}
            </button>
          </form>

          {role === 'aluno' && (
            <button type="button" onClick={() => void requestWhatsapp()} disabled={loading}
              className="mt-3 w-full rounded-xl border border-[#2a2a2a] py-3 text-sm font-semibold text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white disabled:opacity-50">
              Pedir ajuda pelo WhatsApp
            </button>
          )}

          <button onClick={() => navigate(`/login/${role}`)}
            className="w-full border border-[#2a2a2a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-white font-semibold rounded-xl py-3 mt-3 text-sm">
            Voltar ao login
          </button>
        </div>
      </div>
    </div>
  )
}
