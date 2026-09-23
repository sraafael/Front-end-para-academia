import { accessToken, adminClient, fetchOrder, json, reconcilePixCharge, validWebhookSignature, type PixConnection } from '../_shared/pix.ts'

type Charge = {
  id: string
  academy_id: string
  amount: number
  status: string
  provider_order_id: string
  live_mode: boolean
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const orderId = new URL(request.url).searchParams.get('data.id')
  if (!orderId || !await validWebhookSignature(request, orderId)) {
    return json({ error: 'Notificação não autenticada.' }, 401)
  }
  const event = await request.json().catch(() => null) as {
    type?: string
    live_mode?: boolean
    user_id?: string | number
    data?: { id?: string }
  } | null
  if (event?.type !== 'order' || event.data?.id !== orderId) {
    return json({ error: 'Notificação inválida.' }, 400)
  }

  try {
    const client = adminClient()
    const { data: charge, error: chargeError } = await client.from('pix_charges')
      .select('id, academy_id, amount, status, provider_order_id, live_mode')
      .eq('provider_order_id', orderId).maybeSingle()
    if (chargeError) throw chargeError
    if (!charge) return json({ error: 'Cobrança ainda não disponível.' }, 503)
    if (charge.status === 'paid' || charge.status === 'review') return json({ ok: true })

    const { data: connection, error: connectionError } = await client.from('academy_pix_connections')
      .select('*').eq('academy_id', charge.academy_id).maybeSingle()
    if (connectionError || !connection?.seller_id) throw connectionError ?? new Error('Conta da academia não conectada.')
    if (String(event.user_id ?? '') !== String(connection.seller_id) || Boolean(event.live_mode) !== charge.live_mode) {
      return json({ error: 'Recebedor ou ambiente não confere.' }, 403)
    }

    // A notificação só avisa: o servidor busca o estado definitivo no provedor.
    const token = await accessToken(connection as PixConnection)
    const order = await fetchOrder(orderId, token)
    await reconcilePixCharge(charge, order)
    return json({ ok: true })
  } catch (error) {
    console.error('Falha ao conciliar Pix:', error instanceof Error ? error.message : error)
    return json({ error: 'Não foi possível conferir a cobrança agora.' }, 503)
  }
})
