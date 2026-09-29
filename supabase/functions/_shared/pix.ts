import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyPixOrder, type MercadoPagoOrder, type StoredPixCharge } from './pixOrder.ts'

export type { MercadoPagoOrder, StoredPixCharge } from './pixOrder.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase não configurado no servidor.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function signedInUser(request: Request) {
  const token = request.headers.get('Authorization')
  if (!token) return null
  const client = adminClient()
  const { data, error } = await client.auth.getUser(token.replace(/^Bearer\s+/i, ''))
  return error ? null : data.user
}

export function pixConfigured() {
  return Boolean(
    Deno.env.get('MP_CLIENT_ID') &&
    Deno.env.get('MP_CLIENT_SECRET') &&
    Deno.env.get('MP_OAUTH_REDIRECT_URI') &&
    webhookSecret() &&
    Deno.env.get('FITPRO_APP_URL') &&
    Deno.env.get('FITPRO_PIX_ENCRYPTION_KEY') &&
    (!isTestMode() || (Deno.env.get('MP_TEST_ACCESS_TOKEN') && Deno.env.get('MP_TEST_SELLER_ID'))),
  )
}

export function isTestMode() {
  return Deno.env.get('FITPRO_PIX_TEST_MODE') !== 'false'
}

// A assinatura de produção deve ser configurada separadamente antes de cobrar dinheiro real.
function webhookSecret() {
  return isTestMode()
    ? Deno.env.get('MP_TEST_WEBHOOK_SECRET') || Deno.env.get('MP_WEBHOOK_SECRET')
    : Deno.env.get('MP_PROD_WEBHOOK_SECRET')
}

// Cada token de academia é cifrado antes de entrar no banco.
async function encryptionKey() {
  const encoded = Deno.env.get('FITPRO_PIX_ENCRYPTION_KEY')
  if (!encoded) throw new Error('Chave de proteção do Pix não configurada.')
  const raw = Uint8Array.from(atob(encoded), char => char.charCodeAt(0))
  if (raw.length !== 32) throw new Error('A chave de proteção do Pix deve ter 32 bytes.')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(value)
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), data))
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...ciphertext))}`
}

export async function decrypt(value: string) {
  const [ivPart, ciphertextPart] = value.split('.')
  if (!ivPart || !ciphertextPart) throw new Error('Credencial da academia inválida.')
  const iv = Uint8Array.from(atob(ivPart), char => char.charCodeAt(0))
  const ciphertext = Uint8Array.from(atob(ciphertextPart), char => char.charCodeAt(0))
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await encryptionKey(), ciphertext)
  return new TextDecoder().decode(plaintext)
}

export async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
}

export type PixConnection = {
  academy_id: string
  enabled: boolean
  seller_id: string | null
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  live_mode: boolean
  connected_at: string | null
  use_owner_account?: boolean
  owner_user_id?: string | null
}

// Resolve a configuração da academia e, no modo de apresentação, injeta
// as credenciais únicas do proprietário sem copiá-las para cada unidade.
export async function pixConnectionForAcademy(academyId: string): Promise<PixConnection | null> {
  const client = adminClient()
  const [{ data: academy, error: academyError }, { data: setting, error: settingError }] = await Promise.all([
    client.from('academies').select('owner_id').eq('id', academyId).maybeSingle(),
    client.from('academy_pix_connections').select('*').eq('academy_id', academyId).maybeSingle(),
  ])
  if (academyError || settingError) throw academyError ?? settingError
  if (!setting) return null
  if (!setting.use_owner_account) return setting as PixConnection
  if (!academy?.owner_id) return null

  const { data: ownerConnection, error } = await client.from('owner_pix_connections')
    .select('*').eq('owner_user_id', academy.owner_id).maybeSingle()
  if (error) throw error
  if (!ownerConnection) return null

  return {
    ...setting,
    seller_id: ownerConnection.seller_id,
    access_token_encrypted: ownerConnection.access_token_encrypted,
    refresh_token_encrypted: ownerConnection.refresh_token_encrypted,
    token_expires_at: ownerConnection.token_expires_at,
    live_mode: ownerConnection.live_mode,
    connected_at: ownerConnection.connected_at,
    owner_user_id: ownerConnection.owner_user_id,
  } as PixConnection
}

type OAuthTokens = {
  access_token: string
  refresh_token: string
  user_id: number | string
  expires_in: number
}

export async function exchangeToken(params: Record<string, string>): Promise<OAuthTokens> {
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('MP_CLIENT_ID'),
      client_secret: Deno.env.get('MP_CLIENT_SECRET'),
      ...params,
    }),
  })
  const payload = await response.json().catch(() => null) as Partial<OAuthTokens> | null
  if (!response.ok || !payload?.access_token || !payload.refresh_token || !payload.user_id ||
      !Number.isFinite(Number(payload.expires_in)) || Number(payload.expires_in) <= 0) {
    throw new Error('O Mercado Pago não autorizou a conexão. Tente novamente.')
  }
  return payload as OAuthTokens
}

export async function accessToken(connection: PixConnection) {
  if (!connection.access_token_encrypted || !connection.refresh_token_encrypted) {
    throw new Error('Conta Mercado Pago não conectada.')
  }
  const expiresAt = new Date(connection.token_expires_at ?? 0).getTime()
  if (expiresAt > Date.now() + 5 * 60_000) return decrypt(connection.access_token_encrypted)

  const renewed = await exchangeToken({
    grant_type: 'refresh_token',
    refresh_token: await decrypt(connection.refresh_token_encrypted),
  })
  if (String(renewed.user_id) !== connection.seller_id) {
    throw new Error('A conta recebedora mudou. Reconecte o Mercado Pago.')
  }
  const client = adminClient()
  const update = {
    access_token_encrypted: await encrypt(renewed.access_token),
    refresh_token_encrypted: await encrypt(renewed.refresh_token),
    token_expires_at: new Date(Date.now() + renewed.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = connection.owner_user_id
    ? await client.from('owner_pix_connections').update(update).eq('owner_user_id', connection.owner_user_id)
    : await client.from('academy_pix_connections').update(update).eq('academy_id', connection.academy_id)
  if (error) throw new Error('Não foi possível renovar a conexão do Mercado Pago.')
  return renewed.access_token
}

// No teste, a cobrança usa a conta de teste da aplicação, não a conta real da academia.
export async function chargeAccessToken(connection: PixConnection) {
  if (!isTestMode()) return accessToken(connection)
  const token = Deno.env.get('MP_TEST_ACCESS_TOKEN')
  if (!token) throw new Error('Credencial de teste do Mercado Pago não configurada.')
  return token
}

export async function fetchOrder(orderId: string, token: string): Promise<MercadoPagoOrder> {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('Não foi possível conferir a cobrança no Mercado Pago.')
  return response.json() as Promise<MercadoPagoOrder>
}

// Só o estado consultado no Mercado Pago pode quitar uma mensalidade.
export async function reconcilePixCharge(charge: StoredPixCharge, order: MercadoPagoOrder) {
  const { payment, accredited } = verifyPixOrder(charge, order)
  const client = adminClient()

  if (accredited) {
    const { error } = await client.rpc('confirm_fitpro_pix_charge', {
      p_charge_id: charge.id,
      p_order_id: charge.provider_order_id,
      p_payment_id: payment.id ?? null,
    })
    if (error) throw error
    return
  }
  if (['cancelled', 'canceled', 'expired', 'failed'].includes(order.status ?? '')) {
    const { error } = await client.from('pix_charges')
      .update({ status: order.status === 'expired' ? 'expired' : 'failed', updated_at: new Date().toISOString() })
      .eq('id', charge.id).in('status', ['creating', 'pending'])
    if (error) throw error
    return
  }
  const method = payment.payment_method
  if (method?.qr_code || method?.ticket_url) {
    const { error } = await client.from('pix_charges').update({
      status: 'pending',
      qr_code: method.qr_code ?? null,
      qr_code_base64: method.qr_code_base64 ?? null,
      ticket_url: method.ticket_url ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', charge.id).in('status', ['creating', 'pending'])
    if (error) throw error
  }
}

// Assinatura HMAC documentada pelo Mercado Pago para notificações de orders.
export async function validWebhookSignature(request: Request, orderId: string) {
  const secret = webhookSecret()
  const signature = request.headers.get('x-signature') ?? ''
  const requestId = request.headers.get('x-request-id')
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=', 2)))
  const timestamp = parts.ts
  const hash = parts.v1
  if (!secret || !requestId || !/^\d+$/.test(timestamp ?? '') || !/^[0-9a-f]{64}$/i.test(hash ?? '')) {
    console.warn('Assinatura Pix incompleta', {
      secretConfigured: Boolean(secret), requestIdPresent: Boolean(requestId),
      timestampValid: /^\d+$/.test(timestamp ?? ''), hashValid: /^[0-9a-f]{64}$/i.test(hash ?? ''),
    })
    return false
  }
  // Reenvios antigos são aceitos: a consulta ao provedor e a confirmação idempotente impedem duplicidade.
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const received = Uint8Array.from((hash as string).match(/../g) ?? [], pair => parseInt(pair, 16))
  // Algumas integrações assinam o ID original; outras usam a forma minúscula documentada pelo provedor.
  for (const id of new Set([orderId, orderId.toLowerCase()])) {
    const manifest = `id:${id};request-id:${requestId};ts:${timestamp};`
    if (await crypto.subtle.verify('HMAC', key, received, new TextEncoder().encode(manifest))) return true
  }
  console.warn('Assinatura Pix não confere', { idHasUppercase: orderId !== orderId.toLowerCase() })
  return false
}
