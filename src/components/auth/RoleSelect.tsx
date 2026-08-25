import { useNavigate } from 'react-router'
import type { UserRole } from '../../types'

export default function RoleSelect() {
  const navigate = useNavigate()

  const roles = [
    {
      role: 'admin' as UserRole,
      label: 'Administração',
      desc: 'Gerencie alunos, professores, financeiro e relatórios.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      iconBg: 'bg-[#1a3a1a]',
      iconColor: 'text-[#22c55e]',
      border: 'hover:border-[#22c55e]/40',
    },
    {
      role: 'professor' as UserRole,
      label: 'Professor',
      desc: 'Acompanhe seus alunos, agenda e planos de treino.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      ),
      iconBg: 'bg-[#1a2a3a]',
      iconColor: 'text-[#3b82f6]',
      border: 'hover:border-[#3b82f6]/40',
    },
    {
      role: 'aluno' as UserRole,
      label: 'Aluno',
      desc: 'Veja seu treino, progresso e conquistas pessoais.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      ),
      iconBg: 'bg-[#3a1a1a]',
      iconColor: 'text-[#ef4444]',
      border: 'hover:border-[#ef4444]/40',
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center mb-12">
        <div className="w-16 h-16 rounded-2xl bg-[#1a3a1a] flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <path d="M6.5 6.5a6 6 0 0 0 0 11M17.5 6.5a6 6 0 0 1 0 11M3 12h18M12 3v18" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">FitPro</h1>
        <p className="text-[#71717a] mt-2 text-center text-sm">
          Sistema de gerenciamento de academia. Selecione seu perfil para continuar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
        {roles.map(({ role, label, desc, icon, iconBg, iconColor, border }) => (
          <button
            key={role}
            onClick={() => navigate(`/login/${role}`)}
            className={`flex flex-col items-center text-center p-8 rounded-2xl bg-[#111111] border border-[#1f1f1f] ${border} transition-all duration-200 hover:bg-[#161616] hover:scale-[1.02] active:scale-100`}
          >
            <div className={`w-20 h-20 rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center mb-5`}>
              {icon}
            </div>
            <h2 className="text-lg font-bold text-white mb-2 font-mono">{label}</h2>
            <p className="text-[#71717a] text-sm leading-relaxed">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
