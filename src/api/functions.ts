import { supabase } from '../lib/supabase'

// Centraliza chamadas para funções protegidas e aproveita a mensagem enviada pelo servidor.
export async function invokeProtectedFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    let message = error.message
    const response = 'context' in error && error.context instanceof Response
      ? error.context
      : null

    if (response) {
      const payload = await response.clone().json().catch(() => null) as { error?: string } | null
      if (payload?.error) message = payload.error
    }
    throw new Error(message)
  }

  return data as T
}
