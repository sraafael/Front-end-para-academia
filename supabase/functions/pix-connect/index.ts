import { accessToken, adminClient, corsHeaders, encrypt, exchangeToken, isTestMode, json, pixConfigured, pixConnectionForAcademy, sha256, signedInUser } from '../_shared/pix.ts'

function appReturn(result: string, owner: boolean) {
  if (owner) {
    const connected = result === 'conectado'
    const title = connected ? 'Conta autorizada' : 'Autorização não concluída'
    const message = connected
      ? 'Sua conta Mercado Pago foi vinculada e o Pix foi ativado nas suas academias. Novas academias serão vinculadas automaticamente. Volte ao FitPro e atualize o status.'
      : 'Peça ao proprietário do FitPro um novo link para tentar novamente.'
    // O representante pode concluir a autorização sem entrar no FitPro.
    return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><body style="font:16px system-ui;background:#0a0a0a;color:#fff;min-height:100vh;display:grid;place-items:center;margin:0;padding:20px;box-sizing:border-box"><main style="max-width:480px;background:#151515;border:1px solid #303030;border-radius:16px;padding:32px;text-align:center"><h1>${title}</h1><p style="color:#aaa;line-height:1.6">${message}</p></main></body></html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    })
  }
  const appUrl = Deno.env.get('FITPRO_APP_URL')
  if (!appUrl) return new Response('Endereço do aplicativo não configurado.', { status: 500 })
  const url = new URL('/admin/dashboard', appUrl)
  url.searchParams.set('pix', result)
  return Response.redirect(url.toString(), 303)
}

async function callback(request: Request) {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  if (!pixConfigured() || !state || !code || url.searchParams.has('error')) {
    return new Response('Autorização não concluída. Solicite um novo link ao proprietário.', { status: 400 })
  }

  const client = adminClient()
  const stateHash = await sha256(state)
  const { data: savedState, error: stateError } = await client
    .from('academy_pix_oauth_states')
    .delete()
    .eq('state_hash', stateHash)
    .gt('expires_at', new Date().toISOString())
    .select('academy_id, actor_user_id')
    .maybeSingle()
  if (stateError || !savedState) {
    return new Response('Link expirado ou já utilizado. Solicite um novo link ao proprietário.', { status: 400 })
  }

  const { data: admin } = await client.from('academy_admins')
    .select('academy_id, status, is_owner')
    .eq('user_id', savedState.actor_user_id)
    .maybeSingle()
  const owner = Boolean(admin?.is_owner)
  if (admin?.status !== 'ativo' || !owner) return appReturn('erro', owner)
  const { data: academy } = await client.from('academies')
    .select('owner_id').eq('id', savedState.academy_id).maybeSingle()
  if (academy?.owner_id !== savedState.actor_user_id) return appReturn('erro', true)

  try {
    const tokens = await exchangeToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: Deno.env.get('MP_OAUTH_REDIRECT_URI')!,
      test_token: String(isTestMode()),
    })
    const { data: current, error: currentError } = await client.from('owner_pix_connections')
      .select('seller_id, live_mode').eq('owner_user_id', savedState.actor_user_id).maybeSingle()
    if (currentError) throw currentError
    if (current?.seller_id && (current.seller_id !== String(tokens.user_id) || current.live_mode !== !isTestMode())) {
      const { data: ownerAcademies, error: academiesError } = await client.from('academies')
        .select('id').eq('owner_id', savedState.actor_user_id)
      if (academiesError) throw academiesError
      const { count, error: chargeError } = await client.from('pix_charges')
        .select('id', { head: true, count: 'exact' })
        .in('academy_id', (ownerAcademies ?? []).map(item => item.id)).in('status', ['creating', 'pending'])
      if (chargeError) throw chargeError
      if (count) throw new Error('Existem cobranças Pix em aberto para a conta anterior.')
    }
    const connectedAt = new Date().toISOString()
    const { error } = await client.from('owner_pix_connections').upsert({
      owner_user_id: savedState.actor_user_id,
      seller_id: String(tokens.user_id),
      access_token_encrypted: await encrypt(tokens.access_token),
      refresh_token_encrypted: await encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      live_mode: !isTestMode(),
      auto_attach: true,
      connected_at: connectedAt,
      updated_at: connectedAt,
    }, { onConflict: 'owner_user_id' })
    if (error) throw error

    const { data: ownerAcademies, error: academyListError } = await client.from('academies')
      .select('id').eq('owner_id', savedState.actor_user_id)
    if (academyListError) throw academyListError
    const { error: attachError } = await client.from('academy_pix_connections').upsert(
      (ownerAcademies ?? []).map(item => ({
        academy_id: item.id,
        enabled: true,
        seller_id: String(tokens.user_id),
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        live_mode: !isTestMode(),
        use_owner_account: true,
        connected_at: connectedAt,
        updated_at: connectedAt,
      })),
      { onConflict: 'academy_id' },
    )
    if (attachError) throw attachError
    return appReturn('conectado', owner)
  } catch (error) {
    console.error('Falha ao conectar academia ao Mercado Pago:', error instanceof Error ? error.message : error)
    return appReturn('erro', owner)
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method === 'GET') return callback(request)
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const user = await signedInUser(request)
    if (!user) return json({ error: 'Entre novamente para configurar o Pix.' }, 401)
    const client = adminClient()
    const { data: admin, error: adminError } = await client.from('academy_admins')
      .select('academy_id, status, is_owner')
      .eq('user_id', user.id)
      .maybeSingle()
    if (adminError || !admin || admin.status !== 'ativo') return json({ error: 'Acesso negado.' }, 403)

    const body = await request.json().catch(() => ({})) as { action?: string; enabled?: boolean; academyId?: string }
    let academyId = admin.academy_id as string | null
    if (admin.is_owner) {
      if (!body.academyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.academyId)) {
        return json({ error: 'Selecione uma academia cadastrada.' }, 400)
      }
      const { data: academy, error: academyError } = await client.from('academies')
        .select('id, owner_id').eq('id', body.academyId).maybeSingle()
      if (academyError || !academy || academy.owner_id !== user.id) return json({ error: 'Academia não encontrada.' }, 403)
      academyId = academy.id
    } else if (!academyId) {
      return json({ error: 'Academia não encontrada.' }, 403)
    }

    const connection = await pixConnectionForAcademy(academyId)

    if (body.action === 'status') {
      const { data: reviews, error: reviewsError } = await client.from('pix_charges')
        .select('id, amount, paid_at, alunos(nome)')
        .eq('academy_id', academyId).eq('status', 'review')
        .order('paid_at', { ascending: false }).limit(20)
      if (reviewsError) throw reviewsError
      return json({
        configured: pixConfigured(),
        connected: Boolean(connection?.seller_id && connection?.access_token_encrypted && connection.live_mode === !isTestMode()),
        enabled: Boolean(connection?.enabled && connection.live_mode === !isTestMode()),
        testMode: isTestMode(),
        sellerId: connection?.seller_id ?? null,
        reviewCharges: (reviews ?? []).map(charge => ({
          id: charge.id,
          amount: Number(charge.amount),
          paidAt: charge.paid_at,
          studentName: Array.isArray(charge.alunos) ? charge.alunos[0]?.nome : charge.alunos?.nome,
        })),
      })
    }
    if (body.action === 'history') {
      // O academyId foi definido pelo perfil autenticado, nunca pelo filtro enviado ao banco.
      const { data: charges, error: historyError } = await client.from('pix_charges')
        .select('id, amount, status, period_due, plan_name, provider_order_id, provider_payment_id, paid_at, created_at, live_mode, alunos(nome)')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (historyError) throw historyError
      return json({
        charges: (charges ?? []).map(charge => ({
          id: charge.id,
          studentName: Array.isArray(charge.alunos) ? charge.alunos[0]?.nome ?? null : charge.alunos?.nome ?? null,
          planName: charge.plan_name ?? null,
          amount: Number(charge.amount),
          status: charge.status,
          periodDue: charge.period_due,
          createdAt: charge.created_at,
          paidAt: charge.paid_at,
          providerOrderId: charge.provider_order_id,
          providerPaymentId: charge.provider_payment_id,
          testMode: !charge.live_mode,
        })),
      })
    }
    if (!pixConfigured()) return json({ error: 'O proprietário ainda não configurou a integração Pix no servidor.' }, 503)
    if (!admin.is_owner) return json({ error: 'Peça ao proprietário para configurar o Pix desta academia.' }, 403)

    if (body.action === 'connect') {
      const { error: revokeError } = await client.from('academy_pix_oauth_states').delete()
        .eq('academy_id', academyId).eq('actor_user_id', user.id)
      if (revokeError) throw revokeError
      const random = crypto.getRandomValues(new Uint8Array(32))
      const state = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('')
      const { error: insertError } = await client.from('academy_pix_oauth_states').insert({
        state_hash: await sha256(state),
        academy_id: academyId,
        actor_user_id: user.id,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      if (insertError) throw insertError
      const authorize = new URL('https://auth.mercadopago.com/authorization')
      authorize.searchParams.set('client_id', Deno.env.get('MP_CLIENT_ID')!)
      authorize.searchParams.set('response_type', 'code')
      authorize.searchParams.set('platform_id', 'mp')
      authorize.searchParams.set('scope', 'read write offline_access')
      authorize.searchParams.set('redirect_uri', Deno.env.get('MP_OAUTH_REDIRECT_URI')!)
      authorize.searchParams.set('state', state)
      return json({ url: authorize.toString() })
    }

    if (body.action === 'toggle' && typeof body.enabled === 'boolean') {
      if (!connection?.seller_id || !connection.access_token_encrypted || connection.live_mode !== !isTestMode()) {
        return json({ error: 'Conecte a conta Mercado Pago da academia primeiro.' }, 400)
      }
      if (body.enabled && !isTestMode()) await accessToken(connection)
      const { error: updateError } = await client.from('academy_pix_connections').upsert({
        academy_id: academyId,
        enabled: body.enabled,
        seller_id: connection.seller_id,
        live_mode: connection.live_mode,
        use_owner_account: Boolean(connection.use_owner_account),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'academy_id' })
      if (updateError) throw updateError
      return json({ enabled: body.enabled })
    }
    return json({ error: 'Ação inválida.' }, 400)
  } catch (error) {
    console.error('Falha na configuração Pix:', error instanceof Error ? error.message : error)
    return json({ error: 'Não foi possível configurar o Pix agora.' }, 500)
  }
})
