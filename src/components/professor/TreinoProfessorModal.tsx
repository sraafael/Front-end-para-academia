import { useMemo, useState } from 'react'
import type { Aluno, TreinoFicha, TreinoFichaInput } from '../../types'
import { useDataStore } from '../../store/dataStore'

// ── Contratos do modal ───────────────────────────────────────────────────

interface Props {
  aluno: Aluno
  onClose: () => void
  readOnly?: boolean
}

interface ExercicioDraft {
  key: string
  id?: string
  nome: string
  series: string
  reps: string
  cargaSugerida: string
}

// ── Valores iniciais e utilitários ──────────────────────────────────────

const novoExercicio = (): ExercicioDraft => ({
  key: crypto.randomUUID(),
  nome: '',
  series: '3',
  reps: '10',
  cargaSugerida: '0',
})

function diasDesde(data?: string) {
  if (!data) return null
  return Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 86_400_000))
}

export default function TreinoProfessorModal({ aluno, onClose, readOnly = false }: Props) {
  // ── Estado do formulário ─────────────────────────────────────────────

  const saveTreino = useDataStore(state => state.saveTreino)
  const [editando, setEditando] = useState(aluno.treinos.length === 0)
  const [treinoId, setTreinoId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState('')
  const [exercicios, setExercicios] = useState<ExercicioDraft[]>([novoExercicio()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const ultimaAtualizacao = useMemo(() => {
    const timestamps = aluno.treinos
      .map(treino => treino.updatedAt ?? treino.createdAt)
      .filter((data): data is string => Boolean(data))
      .map(data => new Date(data).getTime())
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : undefined
  }, [aluno.treinos])

  // ── Ações de criação e edição ───────────────────────────────────────

  const iniciarNova = () => {
    setTreinoId(null)
    setNome('')
    setGrupo('')
    setExercicios([novoExercicio()])
    setError('')
    setSuccess('')
    setEditando(true)
  }

  const iniciarEdicao = (treino: TreinoFicha) => {
    setTreinoId(treino.id)
    setNome(treino.nome)
    setGrupo(treino.grupo)
    setExercicios(treino.exercicios.map(exercicio => ({
      key: exercicio.id,
      id: exercicio.id,
      nome: exercicio.nome,
      series: String(exercicio.series),
      reps: String(exercicio.reps),
      cargaSugerida: String(exercicio.cargaSugerida),
    })))
    setError('')
    setSuccess('')
    setEditando(true)
  }

  const atualizarExercicio = (key: string, campo: keyof Omit<ExercicioDraft, 'key'>, valor: string) => {
    setExercicios(lista => lista.map(exercicio => exercicio.key === key ? { ...exercicio, [campo]: valor } : exercicio))
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (readOnly) {
      setError('Modo de visualização: nenhuma alteração será salva.')
      return
    }

    const ficha: TreinoFichaInput = {
      nome: nome.trim(),
      grupo: grupo.trim(),
      exercicios: exercicios.map(exercicio => ({
        id: exercicio.id,
        nome: exercicio.nome.trim(),
        series: Number(exercicio.series),
        reps: Number(exercicio.reps),
        cargaSugerida: Number(exercicio.cargaSugerida.replace(',', '.')),
      })),
    }

    if (!ficha.nome || !ficha.grupo) {
      setError('Informe o nome e o grupo muscular da ficha.')
      return
    }
    if (ficha.exercicios.length === 0 || ficha.exercicios.some(exercicio => !exercicio.nome || exercicio.series < 1 || exercicio.reps < 1 || exercicio.cargaSugerida < 0)) {
      setError('Revise os exercícios: nome, séries e repetições são obrigatórios.')
      return
    }

    setSaving(true)
    try {
      await saveTreino(aluno.id, treinoId, ficha)
      setSuccess(treinoId ? 'Ficha atualizada e liberada para o aluno.' : 'Ficha criada e liberada para o aluno.')
      setEditando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
    } finally {
      setSaving(false)
    }
  }

  // ── Interface do modal ───────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-[#1f1f1f]">
          <div className="min-w-0">
            <p className="text-blue-400 text-[10px] font-mono tracking-widest">FICHAS DE TREINO</p>
            <h2 className="text-white font-bold font-mono truncate">{aluno.nome}</h2>
            <p className="text-[#71717a] text-xs mt-0.5">
              {aluno.treinos.length === 0
                ? 'Ainda não possui ficha cadastrada.'
                : `Última revisão há ${diasDesde(ultimaAtualizacao) ?? 0} dia(s).`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-[#52525b] hover:text-white p-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {readOnly && (
            <p className="text-blue-300 text-xs bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 mb-4">
              Visualização demonstrativa: os controles de edição não salvam alterações.
            </p>
          )}
          {editando ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#a1a1aa] text-xs mb-1.5">Nome da ficha</label>
                  <input value={nome} onChange={event => setNome(event.target.value)} placeholder="Ex: Treino A" autoFocus
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-blue-400 rounded-xl px-4 py-3 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[#a1a1aa] text-xs mb-1.5">Grupo / objetivo</label>
                  <input value={grupo} onChange={event => setGrupo(event.target.value)} placeholder="Ex: Peito e tríceps"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-blue-400 rounded-xl px-4 py-3 text-white text-sm outline-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white text-sm font-semibold">Exercícios</p>
                    <p className="text-[#52525b] text-xs">Defina a orientação que aparecerá para o aluno.</p>
                  </div>
                  <button type="button" onClick={() => setExercicios(lista => [...lista, novoExercicio()])}
                    className="text-xs bg-blue-500 hover:bg-blue-400 text-white font-semibold px-3 py-2 rounded-xl transition-colors">
                    + Exercício
                  </button>
                </div>

                <div className="space-y-3">
                  {exercicios.map((exercicio, index) => (
                    <div key={exercicio.key} className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-7 h-7 rounded-lg bg-[#1a2a3a] text-blue-400 text-xs font-bold flex items-center justify-center">{index + 1}</span>
                        <input value={exercicio.nome} onChange={event => atualizarExercicio(exercicio.key, 'nome', event.target.value)} placeholder="Nome do exercício"
                          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] focus:border-blue-400 rounded-xl px-3 py-2 text-white text-sm outline-none" />
                        {exercicios.length > 1 && (
                          <button type="button" onClick={() => setExercicios(lista => lista.filter(item => item.key !== exercicio.key))}
                            className="text-red-400/70 hover:text-red-400 text-xs p-2">Remover</button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ['series', 'Séries'],
                          ['reps', 'Repetições'],
                          ['cargaSugerida', 'Carga (kg)'],
                        ] as const).map(([campo, label]) => (
                          <div key={campo}>
                            <label className="block text-[#52525b] text-[10px] mb-1">{label}</label>
                            <input type="number" min={campo === 'cargaSugerida' ? 0 : 1} step={campo === 'cargaSugerida' ? '0.5' : '1'}
                              value={exercicio[campo]} onChange={event => atualizarExercicio(exercicio.key, campo, event.target.value)}
                              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] focus:border-blue-400 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditando(false)}
                  className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl py-3 text-sm">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm">
                  {saving ? 'Salvando...' : treinoId ? 'Salvar revisão' : 'Criar ficha'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {success && <p className="text-[#22c55e] text-xs bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl px-3 py-2">{success}</p>}
              <button onClick={iniciarNova}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
                + Criar nova ficha
              </button>
              {aluno.treinos.map(treino => (
                <div key={treino.id} className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1a2a3a] text-blue-400 flex items-center justify-center font-mono font-bold">
                    {treino.exercicios.length}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{treino.nome}</p>
                    <p className="text-[#52525b] text-xs truncate">{treino.grupo} · {treino.exercicios.length} exercício(s)</p>
                  </div>
                  <button onClick={() => iniciarEdicao(treino)}
                    className="bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-white text-xs px-3 py-2 rounded-xl">
                    Editar ficha
                  </button>
                </div>
              ))}
              {aluno.treinos.length === 0 && (
                <div className="border border-dashed border-[#2a2a2a] rounded-xl p-8 text-center">
                  <p className="text-[#71717a] text-sm">Nenhuma ficha cadastrada.</p>
                  <p className="text-[#3f3f46] text-xs mt-1">Crie a primeira ficha para ela aparecer no painel do aluno.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
