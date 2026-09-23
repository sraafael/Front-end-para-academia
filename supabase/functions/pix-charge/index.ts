import { accessToken, adminClient, corsHeaders, fetchOrder, isTestMode, json, pixConfigured, reconcilePixCharge, signedInUser, type MercadoPagoOrder, type PixConnection } from '../_shared/pix.ts'

type Charge = {
  id: string
  academy_id: string
  aluno_id: string
  period_due: string
  amount: number
  payer_email: string
  status: string
  provider_order_id: string | null
  qr_code: string | null
  qr_code_base64: string | null
  ticket_url: string | null
  expires_at: string | null
  created_at: string
  live_mode: boolean
}

function publicCharge(charge: Charge | null) {
  if (!charge) return null
  return {
    id: charge.id,
    amount: Number(charge.amount),
    status: charge.status,
    periodDue: charge.period_due,
    qrCode: charge.qr_code,
    qrCodeBase64: charge.qr_code_base64,
    ticketUrl: charge.ticket_url,
    expiresAt: charge.expires_at,
    testMode: !charge.live_mode,
  }
}

function paymentFrom(order: MercadoPagoOrder) {
  return order.transactions?.payments?.find(payment => payment.payment_method?.id === 'pix')
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const user = await signedInUser(request)
    if (!user) return json({ error: 'Entre novamente para usar o Pix.' }, 401)
    const client = adminClient()
    const { data: student, error: studentError } = await client.from('alunos')
      .select('id, academy_id, plano_id, email, pagamento_status, vencimento, status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (studentError || !student) return json({ error: 'Perfil do aluno não encontrado.' }, 403)

    const body = await request.json().catch(() => ({})) as { action?: string }
    const { data: connection, error: connectionError } = await client.from('academy_pix_connections')
      .select('*').eq('academy_id', student.academy_id).maybeSingle()
    if (connectionError) throw connectionError
    const { data: latest, error: latestError } = await client.from('pix_charges')
      .select('*').eq('aluno_id', student.id).eq('live_mode', !isTestMode())
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (latestError) throw latestError

    const available = Boolean(pixConfigured() && connection?.enabled && connection?.seller_id && connection.live_mode === !isTestMode())
    if (body.action === 'status') {
      let current = latest as Charge | null
      if (current?.provider_order_id && ['creating', 'pending'].includes(current.status) && connection?.seller_id) {
        try {
          const token = await accessToken(connection as PixConnection)
          await reconcilePixCharge(current, await fetchOrder(current.provider_order_id, token))
          const { data, error } = await client.from('pix_charges').select('*').eq('id', current.id).single()
          if (error) throw error
          current = data as Charge
        } catch (error) {
          console.error('Pix ainda não conciliado:', error instanceof Error ? error.message : error)
        }
      }
      return json({ available, testMode: isTestMode(), charge: publicCharge(current) })
    }
    if (body.action !== 'create') return json({ error: 'Ação inválida.' }, 400)
    if (!available) return json({ error: 'Esta academia não ativou o pagamento online por Pix.' }, 403)
    if (student.status === 'inativo') return json({ error: 'Cadastro inativo. Fale com a academia.' }, 403)
    if (!student.vencimento || !student.plano_id) {
      return json({ error: 'Peça à academia para definir seu plano e vencimento.' }, 400)
    }
    if (student.pagamento_status === 'pago' && student.vencimento >= new Date().toISOString().slice(0, 10)) {
      return json({ error: 'Sua mensalidade já está em dia.' }, 400)
    }
    const email = isTestMode() ? 'test_user_br@testuser.com' : String(student.email ?? '').trim().toLowerCase()
    if (!isTestMode() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@fitpro.internal'))) {
      return json({ error: 'Peça à academia para cadastrar um e-mail válido no seu perfil antes de pagar.' }, 400)
    }
    const { data: plan, error: planError } = await client.from('planos')
      .select('preco, ativo').eq('id', student.plano_id)
      .eq('academy_id', student.academy_id).maybeSingle()
    if (planError || !plan?.ativo || Number(plan.preco) <= 0) {
      return json({ error: 'Plano não disponível para cobrança.' }, 400)
    }

    const { data: open, error: openError } = await client.from('pix_charges')
      .select('*').eq('aluno_id', student.id).eq('period_due', student.vencimento)
      .eq('live_mode', !isTestMode())
      .in('status', ['creating', 'pending']).maybeSingle()
    if (openError) throw openError
    let charge = open as Charge | null
    if (charge?.provider_order_id) {
      try {
        const token = await accessToken(connection as PixConnection)
        await reconcilePixCharge(charge, await fetchOrder(charge.provider_order_id, token))
      } catch (error) {
        console.error('Pix ainda não conciliado:', error instanceof Error ? error.message : error)
      }
      const { data: refreshed, error: refreshError } = await client.from('pix_charges').select('*').eq('id', charge.id).single()
      if (refreshError) throw refreshError
      charge = refreshed as Charge
      // Com um ID do provedor já salvo, só consultamos a order; não abrimos outra.
      return json({ available: true, testMode: isTestMode(), charge: publicCharge(charge) })
    }
    if (charge?.status === 'creating' && Date.now() - new Date(charge.created_at).getTime() < 60_000) {
      return json({ available: true, testMode: isTestMode(), charge: publicCharge(charge) })
    }

    if (!charge) {
      const { data: created, error: createError } = await client.from('pix_charges').insert({
        academy_id: student.academy_id,
        aluno_id: student.id,
        period_due: student.vencimento,
        // O sandbox do Mercado Pago usa R$ 50,00; não é a mensalidade real do aluno.
        amount: isTestMode() ? 50 : Number(plan.preco),
        payer_email: email,
        status: 'creating',
        live_mode: (connection as PixConnection).live_mode,
      }).select('*').single()
      if (createError) {
        if (createError.code === '23505') return json({ error: 'Uma cobrança já está sendo preparada. Aguarde alguns segundos.' }, 409)
        throw createError
      }
      charge = created as Charge
    }

    const token = await accessToken(connection as PixConnection)
    const amount = Number(charge.amount).toFixed(2)
    let response: Response
    try {
      response = await fetch('https://api.mercadopago.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Idempotency-Key': charge.id,
        },
        body: JSON.stringify({
          type: 'online',
          external_reference: charge.id,
          total_amount: amount,
          processing_mode: 'automatic',
          transactions: {
            payments: [{ amount, payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: 'P1D' }],
          },
          // O e-mail da primeira tentativa não muda nos reenvios com a mesma chave de idempotência.
          payer: isTestMode()
            ? { email: charge.payer_email, first_name: 'APRO' }
            : { email: charge.payer_email },
        }),
      })
    } catch {
      // O resultado pode ser incerto; o mesmo ID será reutilizado na próxima tentativa.
      return json({ error: 'Não foi possível confirmar a criação do Pix. Tente novamente em instantes.' }, 503)
    }

    const order = await response.json().catch(() => null) as MercadoPagoOrder | null
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && ![409, 429].includes(response.status)) {
        await client.from('pix_charges').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', charge.id)
      }
      return json({ error: 'O Mercado Pago não conseguiu gerar esta cobrança Pix.' }, 502)
    }
    if (!order?.id) {
      // Uma resposta inconclusiva não autoriza abrir outra cobrança; a tentativa pode ser repetida com a mesma chave.
      return json({ error: 'O Pix ainda está sendo preparado. Tente novamente em instantes.' }, 503)
    }
    const payment = paymentFrom(order)
    // A criação pode ser assíncrona: primeiro vem o ID, depois os dados para mostrar o Pix.
    const verified = order.external_reference === charge.id && Number(order.total_amount) === Number(charge.amount)
    const hasPaymentInstructions = Boolean(payment?.payment_method?.qr_code || payment?.payment_method?.ticket_url)
    const nextStatus = verified && hasPaymentInstructions ? 'pending' : 'creating'
    const { data: updated, error: updateError } = await client.from('pix_charges').update({
      status: nextStatus,
      provider_order_id: order.id,
      qr_code: payment?.payment_method?.qr_code ?? null,
      qr_code_base64: payment?.payment_method?.qr_code_base64 ?? null,
      ticket_url: payment?.payment_method?.ticket_url ?? null,
      expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', charge.id).eq('status', 'creating').select('*').maybeSingle()
    if (updateError) throw updateError
    if (updated && verified && order.status === 'processed') await reconcilePixCharge(updated as Charge, order)
    const { data: finalCharge, error: finalError } = await client.from('pix_charges').select('*').eq('id', charge.id).single()
    if (finalError) throw finalError
    return json({ available: true, testMode: isTestMode(), charge: publicCharge(finalCharge as Charge) })
  } catch (error) {
    console.error('Falha na cobrança Pix:', error instanceof Error ? error.message : error)
    return json({ error: 'Não foi possível processar a cobrança Pix agora.' }, 500)
  }
})
