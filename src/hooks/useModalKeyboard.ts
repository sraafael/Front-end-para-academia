import { useEffect, useRef } from 'react'

// Fecha a janela com Esc e evita rolagem da página ao fundo.
export function useModalKeyboard(onClose: () => void) {
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      activeElement?.focus()
    }
  }, [])
}
