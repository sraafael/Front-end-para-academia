import { createClient } from 'npm:@supabase/supabase-js@2'

type TargetRole = 'admin' | 'professor'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return `Aa2!${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Configuração do servidor incompleta.' }, 500)
  }
  if (!authorization) return jsonResponse({ error: 'Sessão administrativa não encontrada.' }, 401)

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401)

    const body = await request.json().catch(() => null) as {
      targetRole?: TargetRole
      targetId?: string
    } | null
    const targetRole = body?.targetRole
    const targetId = String(body?.targetId ?? '').trim()

    if ((targetRole !== 'admin' && targetRole !== 'professor') || !targetId) {
      return jsonResponse({ error: 'Dados da redefinição inválidos.' }, 400)
    }

    const temporaryPassword = generateTemporaryPassword()
    const { data: record, error: resetError } = await adminClient.rpc('reset_fitpro_access_password', {
      p_actor_user_id: userData.user.id,
      p_target_role: targetRole,
      p_target_id: targetId,
      p_temporary_password: temporaryPassword,
    })

    if (resetError || !record) {
      return jsonResponse({
        error: resetError?.message ?? 'Não foi possível redefinir a senha.',
      }, resetError?.code === '42501' ? 403 : 400)
    }

    return jsonResponse({ record, temporaryPassword })
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Não foi possível redefinir a senha.',
    }, 500)
  }
})
