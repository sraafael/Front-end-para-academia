import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../../store/authStore'
import AcademyManagementModal from '../admin/modals/AcademyManagementModal'
import AuditModal from '../admin/modals/AuditModal'

// Página inicial exclusiva do proprietário. A gestão detalhada foi mantida
// em componentes próprios para esta tela continuar apenas como composição.
export default function OwnerDashboard() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [showAudit, setShowAudit] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
              <path d="M9 10h.01M15 10h.01" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">FitPro</p>
              <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-violet-300">PROPRIETÁRIO</span>
            </div>
            <p className="text-xs text-[#52525b]">Central de academias</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAudit(true)}
            className="hidden rounded-xl border border-[#2a2a2a] px-3 py-2 text-sm font-semibold text-[#a1a1aa] hover:border-violet-400/30 hover:text-violet-300 sm:inline-flex"
          >
            Ver auditoria
          </button>
          <button onClick={() => void handleLogout()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#71717a] hover:bg-[#151515] hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Configuração do negócio</p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Suas academias e responsáveis</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#71717a]">Mantenha os dados cadastrais de cada unidade completos e controle quem terá acesso ao painel administrativo.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#71717a] sm:text-xs">
            <div className="rounded-xl border border-[#242424] bg-[#111111] px-3 py-3"><span className="mb-1 block text-base text-violet-300">01</span>Academia</div>
            <div className="rounded-xl border border-[#242424] bg-[#111111] px-3 py-3"><span className="mb-1 block text-base text-violet-300">02</span>Responsáveis</div>
            <div className="rounded-xl border border-[#242424] bg-[#111111] px-3 py-3"><span className="mb-1 block text-base text-violet-300">03</span>Acessos</div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setShowAudit(true)}
          className="w-full rounded-xl border border-[#2a2a2a] py-3 text-sm font-semibold text-[#a1a1aa] hover:border-violet-400/30 hover:text-violet-300 sm:hidden"
        >
          Ver auditoria do sistema
        </button>

        <AcademyManagementModal standalone />
      </main>

      {showAudit && <AuditModal onClose={() => setShowAudit(false)} />}
    </div>
  )
}
