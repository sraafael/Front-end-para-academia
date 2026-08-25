import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { lookupCpf } from '../../api/auth'
import type { UserRole } from '../../types'

export default function ForgotPassword() {
  const params = useParams()
  const VALID: UserRole[] = ['admin', 'professor', 'aluno']
  const role: UserRole = VALID.includes(params.role as UserRole) ? (params.role as UserRole) : 'admin'
  const navigate = useNavigate()

  const [step, setStep] = useState<'cpf' | 'code'>('cpf')
  const [cpf, setCpf] = useState('')
  const [code, setCode] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentCode] = useState('847392')

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
      .replace(/(\d{3})(\d{3})/, '$1.$2')
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!cpf) { setError('Informe o CPF.'); return }
    setLoading(true)
    const found = await lookupCpf(role, cpf)
    setLoading(false)
    if (!found) { setError('CPF não encontrado.'); return }
    setStep('code')
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (code !== sentCode) { setError('Código inválido. Verifique o WhatsApp.'); return }
    if (newPass.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (newPass !== confirmPass) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    setLoading(false)
    navigate(`/login/${role}`)
  }

  const roleLabel = role === 'admin' ? 'Administração' : role === 'professor' ? 'Professor' : 'Aluno'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col px-4 py-8">
      <button
        onClick={() => navigate(`/login/${role}`)}
        className="flex items-center gap-2 text-[#71717a] hover:text-white transition-colors text-sm mb-8 w-fit"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Voltar ao login
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="w-16 h-16 rounded-2xl bg-[#1a3a1a] flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white font-mono mb-1">Redefinir Senha</h1>
        <p className="text-[#71717a] text-sm mb-8 text-center">{roleLabel} — recupere o acesso via WhatsApp</p>

        {step === 'cpf' ? (
          <form onSubmit={handleSendCode} className="w-full space-y-4">
            <div>
              <label className="block text-[#a1a1aa] text-sm mb-1.5">CPF cadastrado</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="Ex: 123.456.789-00"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-black font-semibold rounded-xl py-3.5 transition-colors text-sm"
            >
              {loading ? 'Verificando...' : 'Enviar código via WhatsApp'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="w-full space-y-4">
            <p className="text-[#22c55e] text-sm">Código enviado com sucesso.</p>
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-[#a1a1aa] text-sm mb-1.5">Código de redefinição</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ex: 123456"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm font-mono tracking-widest"
                />
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-sm mb-1.5">Nova senha</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-[#a1a1aa] text-sm mb-1.5">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-black font-semibold rounded-xl py-3.5 transition-colors text-sm"
            >
              {loading ? 'Atualizando...' : 'Atualizar senha com código'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
