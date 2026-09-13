import { useState } from 'react'

// ── Dados da credencial temporária ─────────────────────────────────────

interface Props {
  nome: string
  cpf: string
  perfil: 'Aluno' | 'Professor' | 'Administrador'
  senha: string
  mode?: 'created' | 'reset'
  onClose: () => void
}

export default function TemporaryAccessModal({ nome, cpf, perfil, senha, mode = 'created', onClose }: Props) {
  // ── Cópia segura da mensagem de primeiro acesso ───────────────────────────────

  const [copiado, setCopiado] = useState(false)
  const cpfLimpo = cpf.replace(/\D/g, '')
  const accessMoment = mode === 'reset' ? 'acesso após redefinição' : 'primeiro acesso'
  const texto = `FitPro — ${accessMoment}\nPerfil: ${perfil}\nCPF: ${cpfLimpo}\nSenha temporária: ${senha}\nA senha deverá ser trocada no próximo acesso.`

  const copiar = async () => {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#22c55e]/30 rounded-2xl w-full max-w-md p-6">
        <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>
        </div>
        <h2 className="text-white font-bold font-mono text-lg">{mode === 'reset' ? 'Nova senha temporária' : 'Cadastro concluído'}</h2>
        <p className="text-[#71717a] text-sm mt-1">
          {mode === 'reset'
            ? `O acesso de ${nome} foi redefinido. A nova senha aparece somente agora.`
            : `Entregue estes dados a ${nome}. A senha aparece somente agora.`}
        </p>

        <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-4 mt-5 space-y-3">
          <div>
            <p className="text-[#52525b] text-[10px] font-mono">PERFIL</p>
            <p className="text-white text-sm">{perfil}</p>
          </div>
          <div>
            <p className="text-[#52525b] text-[10px] font-mono">CPF</p>
            <p className="text-white text-sm font-mono">{cpfLimpo}</p>
          </div>
          <div>
            <p className="text-[#52525b] text-[10px] font-mono">SENHA TEMPORÁRIA</p>
            <p className="text-[#22c55e] text-xl font-bold font-mono tracking-wider break-all">{senha}</p>
          </div>
        </div>

        <p className="text-yellow-300/80 text-xs mt-4">Por segurança, não armazene esta senha no cadastro. O sistema exigirá a troca no próximo acesso.</p>

        <div className="flex gap-2 mt-5">
          <button onClick={copiar} className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white text-sm rounded-xl py-3">
            {copiado ? 'Copiado!' : 'Copiar acesso'}
          </button>
          <button onClick={onClose} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm rounded-xl py-3">Concluir</button>
        </div>
      </div>
    </div>
  )
}
