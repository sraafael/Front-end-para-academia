import { accessToken, adminClient, corsHeaders, encrypt, exchangeToken, isTestMode, json, pixConfigured, sha256, signedInUser } from '../_shared/pix.ts'

function appReturn(result: string) {
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
  if (!pixConfigured() || !state || !code || url.searchParams.has('error')) return appReturn('erro')

  const client = adminClient()
  const stateHash = await sha256(state)
  const { data: savedState, error: stateError } = await client
    .from('academy_pix_oauth_states')
    .delete()
    .eq('state_hash', stateHash)
    .gt('expires_at', new Date().toISOString())
    .select('academy_id, actor_user_id')
    .maybeSingle()
  if (stateError || !savedState) return appReturn('erro')

  const { data: admin } = await client.from('academy_admins')
    .select('academy_id, status, is_owner')
    .eq('user_id', savedState.actor_user_id)
    .maybeSingle()
  if (admin?.is_owner || admin?.status !== 'ativo' || admin.academy_id !== savedState.academy_id) {
    return appReturn('erro')
  }

  try {
    const tokens = await exchangeToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: Deno.env.get('MP_OAUTH_REDIRECT_URI')!,
      test_token: String(isTestMode()),
    })
    const { data: current, error: currentError } = await client.from('academy_pix_connections')
      .select('seller_id, live_mode').eq('academy_id', savedState.academy_id).maybeSingle()
    if (currentError) throw currentError
    if (current?.seller_id && (current.seller_id !== String(tokens.user_id) || current.live_mode !== !isTestMode())) {
      const { count, error: chargeError } = await client.from('pix_charges')
        .select('id', { head: true, count: 'exact' })
        .eq('academy_id', savedState.academy_id).in('status', ['creating', 'pending'])
      if (chargeError) throw chargeError
      if (count) throw new Error('Existem cobranças Pix em aberto para a conta anterior.')
    }
    const { error } = await client.from('academy_pix_connections').upsert({
      academy_id: savedState.academy_id,
      enabled: false,
      seller_id: String(tokens.user_id),
      access_token_encrypted: await encrypt(tokens.access_token),
      refresh_token_encrypted: await encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      live_mode: !isTestMode(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'academy_id' })
    if (error) throw error
    return appReturn('conectado')
  } catch (error) {
    console.error('Falha ao conectar academia ao Mercado Pago:', error instanceof Error ? error.message : error)
    return appReturn('erro')
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
    if (adminError || !admin?.academy_id || admin.status !== 'ativo' || admin.is_owner) {
      return json({ error: 'Apenas a administração da academia pode configurar o Pix.' }, 403)
    }

    const body = await request.json().catch(() => ({})) as { action?: string; enabled?: boolean }
    const { data: connection, error } = await client.from('academy_pix_connections')
      .select('*').eq('academy_id', admin.academy_id).maybeSingle()
    if (error) throw error

    if (body.action === 'status') {
      const { data: reviews, error: reviewsError } = await client.from('pix_charges')
        .select('id, amount, paid_at, alunos(nome)')
        .eq('academy_id', admin.academy_id).eq('status', 'review')
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
    if (!pixConfigured()) return json({ error: 'O proprietário ainda não configurou a integração Pix no servidor.' }, 503)

    if (body.action === 'connect') {
      const random = crypto.getRandomValues(new Uint8Array(32))
      const state = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('')
      const { error: insertError } = await client.from('academy_pix_oauth_states').insert({
        state_hash: await sha256(state),
        academy_id: admin.academy_id,
        actor_user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
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
      if (body.enabled) await accessToken(connection)
      const { error: updateError } = await client.from('academy_pix_connections')
        .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
        .eq('academy_id', admin.academy_id)
      if (updateError) throw updateError
      return json({ enabled: body.enabled })
    }
    return json({ error: 'Ação inválida.' }, 400)
  } catch (error) {
    console.error('Falha na configuração Pix:', error instanceof Error ? error.message : error)
    return json({ error: 'Não foi possível configurar o Pix agora.' }, 500)
  }
})
