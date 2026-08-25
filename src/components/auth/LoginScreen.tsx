import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuthStore } from '../../store/authStore'
import { login } from '../../api/auth'
import type { UserRole } from '../../types'

const ROLE_CONFIG: Record<UserRole, {
  label: string
  hint: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
}> = {
  admin: {
    label: 'Administração',
    hint: '',
    iconBg: 'bg-[#1a3a1a]',
    iconColor: '#22c55e',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  professor: {
    label: 'Professor',
    hint: '',
    iconBg: 'bg-[#1a2a3a]',
    iconColor: '#3b82f6',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  aluno: {
    label: 'Aluno',
    hint: 'No primeiro acesso, use a senha numérica de 6 dígitos gerada pela administração.',
    iconBg: 'bg-[#3a1a1a]',
    iconColor: '#ef4444',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
}

export default function LoginScreen() {
  const params = useParams()
  const VALID: UserRole[] = ['admin', 'professor', 'aluno']
  const role: UserRole = VALID.includes(params.role as UserRole) ? (params.role as UserRole) : 'admin'
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setPendingFirstLogin = useAuthStore((s) => s.setPendingFirstLogin)

  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.admin

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
      .replace(/(\d{3})(\d{3})/, '$1.$2')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!cpf || !senha) { setError('Preencha todos os campos.'); return }
    setLoading(true)
    const result = await login(role, cpf, senha)
    setLoading(false)
    if (!result.ok) { setError(result.error); return }

    setAuth(result.role, result.userId)

    if (result.role === 'aluno' && result.isFirstLogin) {
      setPendingFirstLogin(true)
      navigate('/primeiro-acesso')
    } else if (result.role === 'admin') {
      navigate('/admin/dashboard')
    } else if (result.role === 'professor') {
      navigate('/professor/dashboard')
    } else {
      navigate('/aluno/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col px-4 py-8">
      <button
        onClick={() => navigate('/login')}
        className="flex items-center gap-2 text-[#71717a] hover:text-white transition-colors text-sm mb-8 w-fit"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Voltar
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div
          className={`w-20 h-20 rounded-2xl ${config.iconBg} flex items-center justify-center mb-6`}
          style={{ color: config.iconColor }}
        >
          {config.icon}
        </div>
        <h1 className="text-3xl font-bold text-white font-mono mb-1">{config.label}</h1>
        <p className="text-[#71717a] text-sm mb-8">Entre com suas credenciais para acessar</p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-[#a1a1aa] text-sm mb-1.5">CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="Ex: 123.456.789-00"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-[#a1a1aa] text-sm mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 pr-11 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa] transition-colors"
              >
                {showSenha ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate(`/recuperar-senha/${role}`)}
              className="text-[#22c55e] text-sm hover:text-[#16a34a] transition-colors"
            >
              Esqueceu a senha?
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {config.hint && <p className="text-[#52525b] text-xs leading-relaxed">{config.hint}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-black font-semibold rounded-xl py-3.5 transition-colors text-sm"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
