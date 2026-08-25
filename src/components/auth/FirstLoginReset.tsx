import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../../store/authStore'
import { confirmFirstLogin } from '../../api/auth'

export default function FirstLoginReset() {
  const navigate = useNavigate()
  const { role, currentAlunoId, currentProfessorId, setPendingFirstLogin } = useAuthStore()

  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [showNova, setShowNova] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (nova.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (nova !== confirma) { setError('As senhas não coincidem.'); return }
    const entityId = role === 'professor' ? currentProfessorId : currentAlunoId
    if (!entityId || !role) return
    
    setLoading(true)
    try {
      await confirmFirstLogin(role, entityId, nova)
      setPendingFirstLogin(false)
      // Redireciona para o painel correto
      navigate(role === 'professor' ? '/professor/dashboard' : '/aluno/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar senha.')
    } finally {
      setLoading(false)
    }
  }

  const firstName = 'Aluno'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white font-mono mb-1">Bem-vindo, {role === 'professor' ? 'Professor' : 'Aluno'}!</h1>
          <p className="text-[#71717a] text-sm text-center leading-relaxed">
            Este é seu primeiro acesso. Por segurança, crie uma nova senha pessoal para continuar.
          </p>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#a1a1aa] text-sm mb-1.5">Nova senha</label>
              <div className="relative">
                <input
                  type={showNova ? 'text' : 'password'}
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 pr-11 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNova(!showNova)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[#a1a1aa] text-sm mb-1.5">Confirmar nova senha</label>
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="Repita a senha"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#3f3f46] focus:outline-none focus:border-[#22c55e] transition-colors text-sm"
              />
            </div>

            {nova && (
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      nova.length >= (i + 1) * 2
                        ? i < 1 ? 'bg-red-500' : i < 2 ? 'bg-yellow-500' : i < 3 ? 'bg-blue-400' : 'bg-[#22c55e]'
                        : 'bg-[#2a2a2a]'
                    }`}
                  />
                ))}
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-black font-semibold rounded-xl py-3.5 transition-colors text-sm mt-2"
            >
              {loading ? 'Salvando...' : 'Criar senha e acessar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
