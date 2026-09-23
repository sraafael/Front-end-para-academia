import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

// Evita que um erro isolado deixe a aplicação inteira em branco.
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Erro não tratado na interface:', error, info.componentStack)
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <section className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#111111] p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
            !
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Não foi possível abrir esta tela</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
            Seus dados não foram apagados. Recarregue o sistema para tentar novamente.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-xl bg-[#22c55e] py-3 text-sm font-semibold text-black hover:bg-[#16a34a]"
          >
            Recarregar sistema
          </button>
        </section>
      </main>
    )
  }
}
