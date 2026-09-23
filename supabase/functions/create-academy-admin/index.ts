import { createClient } from 'npm:@supabase/supabase-js@2'

type ConflictField = 'cpf' | 'telefone' | 'email'

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

function onlyDigits(value: unknown, limit: number) {
  return String(value ?? '').replace(/\D/g, '').slice(0, limit)
}

function isValidCpf(value: string) {
  if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) return false
  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10])
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return `Aa2!${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`
}

function conflictMessage(field: ConflictField) {
  const label = field === 'cpf' ? 'CPF' : field === 'email' ? 'e-mail' : 'telefone'
  return `Já existe um administrador cadastrado com este ${label}.`
}

function conflictFieldFromError(message: string): ConflictField | null {
  const normalized = message.toLowerCase()
  if (normalized.includes('cpf')) return 'cpf'
  if (normalized.includes('telefone') || normalized.includes('phone')) return 'telefone'
  if (normalized.includes('email') || normalized.includes('e-mail')) return 'email'
  return null
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
  if (!authorization) return jsonResponse({ error: 'Sessão do proprietário não encontrada.' }, 401)

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

    const { data: owner, error: ownerError } = await adminClient
      .from('academy_admins')
      .select('is_owner, status')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (ownerError || !owner?.is_owner || owner.status !== 'ativo') {
      return jsonResponse({ error: 'Apenas o proprietário ativo pode criar administradores.' }, 403)
    }

    const body = await request.json().catch(() => null) as {
      profile?: Record<string, unknown>
    } | null
    const profile = body?.profile
    if (!profile) return jsonResponse({ error: 'Dados do cadastro inválidos.' }, 400)

    const academyId = String(profile.academyId ?? '').trim()
    const nome = String(profile.nome ?? '').trim()
    const cpf = onlyDigits(profile.cpf, 11)
    const telefone = onlyDigits(profile.telefone, 11)

    if (!academyId) return jsonResponse({ error: 'Selecione a academia do administrador.' }, 400)
    if (!nome) return jsonResponse({ error: 'Informe o nome do administrador.' }, 400)
    if (!isValidCpf(cpf)) return jsonResponse({ error: 'Informe um CPF válido.' }, 400)
    if (telefone && telefone.length < 10) return jsonResponse({ error: 'Informe um telefone válido.' }, 400)

    const email = String(profile.email ?? '').trim().toLowerCase()
    const { data: conflict, error: conflictError } = await adminClient.rpc('find_fitpro_registration_conflict', {
      p_role: 'admin',
      p_academy_id: academyId,
      p_cpf: cpf,
      p_telefone: telefone,
      p_email: email,
      p_exclude_id: null,
    })
    if (conflictError) {
      return jsonResponse({ error: `Não foi possível validar o cadastro: ${conflictError.message}` }, 400)
    }
    if (conflict === 'cpf' || conflict === 'telefone' || conflict === 'email') {
      return jsonResponse({ error: conflictMessage(conflict) }, 409)
    }

    const temporaryPassword = generateTemporaryPassword()
    const internalEmail = `admin.${cpf}@fitpro.internal`
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', cpf, nome },
      app_metadata: { role: 'admin', is_owner: false, academy_id: academyId },
    })

    if (createError || !created.user) {
      const duplicate = createError?.message.toLowerCase().includes('already')
      return jsonResponse({
        error: duplicate
          ? 'Já existe um administrador cadastrado com este CPF.'
          : `Não foi possível criar o acesso: ${createError?.message ?? 'erro desconhecido'}`,
      }, duplicate ? 409 : 400)
    }

    const { data: record, error: profileError } = await adminClient.rpc('create_fitpro_academy_admin_profile', {
      p_actor_user_id: userData.user.id,
      p_user_id: created.user.id,
      p_academy_id: academyId,
      p_profile: {
        nome,
        cpf,
        telefone,
        email,
        cargo: String(profile.cargo ?? '').trim(),
      },
    })

    if (profileError || !record) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      const field = conflictFieldFromError(profileError?.message ?? '')
      if (field) return jsonResponse({ error: conflictMessage(field) }, 409)
      return jsonResponse({
        error: `Não foi possível salvar o administrador: ${profileError?.message ?? 'erro desconhecido'}`,
      }, 400)
    }

    return jsonResponse({ record, temporaryPassword }, 201)
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.',
    }, 500)
  }
})
