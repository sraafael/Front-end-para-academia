import { useDataStore } from '../../../store/dataStore'

interface Props { onClose: () => void }

export default function Relatorios({ onClose }: Props) {
  const { alunos, turmas, planos, transacoes, professores } = useDataStore()
  const adimplentes = alunos.filter(a => a.pagamentoStatus === 'pago').length
  const totalAtivos = alunos.filter(a => a.status === 'ativo').length
  const adimplencia = totalAtivos > 0 ? Math.round((adimplentes / totalAtivos) * 100) : 0

  const totalVagas = turmas.reduce((s, t) => s + t.capacidade, 0)
  const ocupadas = turmas.reduce((s, t) => s + t.alunoIds.length, 0)
  const ocupacao = totalVagas > 0 ? Math.round((ocupadas / totalVagas) * 100) : 0

  const planosAtivos = planos.filter(p => p.ativo).length

  const folha = professores.filter(p => p.status === 'ativo').reduce((s, p) => s + p.salario, 0)
  const ajustes = 0

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

  const indicadores = [
    {
      titulo: 'Adimplência',
      valor: `${adimplencia}%`,
      extra: `+${adimplentes}`,
      extraColor: 'text-[#22c55e]',
      desc: `${alunos.filter(a => a.pagamentoStatus === 'atrasado').length} aluno(s) exigem ação de cobrança no momento.`,
      bg: '',
    },
    {
      titulo: 'Ocupação das Turmas',
      valor: `${ocupacao}%`,
      extra: '',
      extraColor: '',
      desc: `${ocupadas} vaga(s) ocupadas em ${turmas.length} turma(s) da agenda atual.`,
      bg: '',
    },
    {
      titulo: 'Planos em Operação',
      valor: `${planosAtivos}`,
      extra: `+${planos.filter(p => !p.ativo).length}`,
      extraColor: 'text-[#22c55e]',
      desc: `${planos.filter(p => !p.ativo).length} plano(s) permanecem inativos para venda ou realocação.`,
      bg: '',
    },
    {
      titulo: 'Folha Ajustada',
      valor: fmt(folha + ajustes),
      extra: '',
      extraColor: '',
      desc: `${ajustes} lançamento(s) tiveram ajuste manual neste ciclo.`,
      bg: '',
    },
  ]

  const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
  const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-bold text-white font-mono text-lg">Relatórios</h2>
            <p className="text-[#71717a] text-xs mt-0.5">Indicadores de desempenho da academia</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#52525b] hover:text-white hover:border-[#22c55e] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-3">
          {indicadores.map(ind => (
            <div key={ind.titulo} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white font-semibold text-sm">{ind.titulo}</p>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold font-mono">{ind.valor}</span>
                  {ind.extra && <span className={`text-sm font-mono ${ind.extraColor}`}>{ind.extra}</span>}
                </div>
              </div>
              <p className="text-[#52525b] text-xs">{ind.desc}</p>
            </div>
          ))}

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <p className="text-white font-semibold text-sm mb-3">Resumo Financeiro do Mês</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Receitas', value: fmt(receitas), color: 'text-[#22c55e]' },
                { label: 'Despesas', value: fmt(despesas), color: 'text-red-400' },
                { label: 'Saldo', value: fmt(receitas - despesas), color: receitas - despesas >= 0 ? 'text-white' : 'text-red-400' },
              ].map(c => (
                <div key={c.label} className="bg-[#1a1a1a] rounded-xl p-2.5 text-center">
                  <p className="text-[#52525b] text-[10px] mb-1">{c.label}</p>
                  <p className={`text-sm font-bold font-mono ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4">
            <p className="text-white font-semibold text-sm mb-3">Distribuição de Alunos</p>
            <div className="space-y-2">
              {planos.filter(p => p.ativo).map(plano => {
                const count = alunos.filter(a => a.planoId === plano.id).length
                const pct = totalAtivos > 0 ? (count / totalAtivos) * 100 : 0
                return (
                  <div key={plano.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#a1a1aa]">{plano.nome}</span>
                      <span className="text-[#71717a] font-mono">{count} alunos ({Math.round(pct)}%)</span>
                    </div>
                    <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
                      <div className="bg-[#22c55e] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
