import { accessToken, adminClient, fetchOrder, isTestMode, json, pixConfigured, pixConnectionForAcademy, reconcilePixCharge } from '../_shared/pix.ts'

type OpenCharge = {
  id: string
  academy_id: string
  amount: number
  status: string
  provider_order_id: string
  live_mode: boolean
}

// O agendamento não usa uma sessão de aluno nem expõe a chave de serviço.
async function authorized(request: Request) {
  const expected = Deno.env.get('FITPRO_PIX_RECONCILE_SECRET') ?? ''
  const received = request.headers.get('x-fitpro-reconcile-secret') ?? ''
  if (expected.length < 32 || !received) return false

  const encoder = new TextEncoder()
  const [expectedHash, receivedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
  ])
  const a = new Uint8Array(expectedHash)
  const b = new Uint8Array(receivedHash)
  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index]
  return difference === 0
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!await authorized(request)) return json({ error: 'Acesso negado.' }, 401)
  if (isTestMode() || !pixConfigured()) return json({ error: 'Pix de produção não configurado.' }, 503)

  try {
    const client = adminClient()
    // Rodadas pequenas evitam sobrecarregar a API; as mais antigas são verificadas primeiro.
    const { data, error } = await client.from('pix_charges')
      .select('id, academy_id, amount, status, provider_order_id, live_mode')
      .eq('live_mode', true)
      .in('status', ['creating', 'pending'])
      .not('provider_order_id', 'is', null)
      .lt('created_at', new Date(Date.now() - 60_000).toISOString())
      .order('last_reconciled_at', { ascending: true, nullsFirst: true })
      .limit(12)
    if (error) throw error
    const charges = (data ?? []) as OpenCharge[]
    if (charges.length === 0) return json({ checked: 0, errors: 0 })

    const tokens = new Map<string, Promise<string>>()
    let cursor = 0
    let failures = 0

    async function processNext() {
      while (cursor < charges.length) {
        const charge = charges[cursor++]
        try {
          const connection = await pixConnectionForAcademy(charge.academy_id)
          if (!connection?.seller_id || !connection.live_mode) throw new Error('Conta recebedora indisponível.')
          const tokenKey = connection.owner_user_id ?? charge.academy_id
          let token = tokens.get(tokenKey)
          if (!token) {
            token = accessToken(connection)
            tokens.set(tokenKey, token)
          }
          // A mesma verificação usada pelo webhook confirma valor, order e crédito.
          await reconcilePixCharge(charge, await fetchOrder(charge.provider_order_id, await token))
        } catch (error) {
          failures++
          console.error('Falha na conciliação Pix', charge.id, error instanceof Error ? error.message : error)
        } finally {
          const { error } = await client.from('pix_charges')
            .update({ last_reconciled_at: new Date().toISOString() })
            .eq('id', charge.id)
          if (error) console.error('Falha ao registrar conferência Pix', charge.id, error.message)
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(3, charges.length) }, () => processNext()))
    return json({ checked: charges.length, errors: failures })
  } catch (error) {
    console.error('Falha na rotina de conciliação Pix:', error instanceof Error ? error.message : error)
    return json({ error: 'Não foi possível conferir as cobranças agora.' }, 503)
  }
})
