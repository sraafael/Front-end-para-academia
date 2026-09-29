import { createClient } from 'npm:@supabase/supabase-js@2'
import { digitsOnly, isValidCpfDigits, isValidPhoneDigits } from '../_shared/identity.ts'

type MemberRole = 'aluno' | 'professor'
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

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return `Aa2!${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`
}

function conflictMessage(role: MemberRole, field: ConflictField) {
  const entity = role === 'aluno' ? 'aluno' : 'professor'
  const label = field === 'cpf' ? 'CPF' : field === 'email' ? 'e-mail' : 'telefone'
  return `Já existe um ${entity} cadastrado com este ${label}.`
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

    const { data: administrator, error: administratorError } = await adminClient
      .from('academy_admins')
      .select('academy_id, status')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (administratorError || administrator?.status !== 'ativo' || !administrator.academy_id) {
      return jsonResponse({ error: 'Apenas a administração ativa da academia pode criar acessos.' }, 403)
    }

    const body = await request.json().catch(() => null) as {
      role?: MemberRole
      profile?: Record<string, unknown>
    } | null
    const role = body?.role
    const profile = body?.profile

    if ((role !== 'aluno' && role !== 'professor') || !profile) {
      return jsonResponse({ error: 'Dados do cadastro inválidos.' }, 400)
    }

    const cpf = digitsOnly(profile.cpf)
    const nome = String(profile.nome ?? '').trim()
    const telefone = digitsOnly(profile.telefone)
    const email = String(profile.email ?? '').trim().toLowerCase()
    if (!nome) return jsonResponse({ error: 'Informe o nome.' }, 400)
    if (!isValidCpfDigits(cpf)) return jsonResponse({ error: 'Informe um CPF válido.' }, 400)
    if (telefone && !isValidPhoneDigits(telefone)) {
      return jsonResponse({ error: 'Informe um telefone válido.' }, 400)
    }

    const { data: conflict, error: conflictError } = await adminClient.rpc('find_fitpro_registration_conflict', {
      p_role: role,
      p_academy_id: administrator.academy_id,
      p_cpf: cpf,
      p_telefone: telefone,
      p_email: email,
      p_exclude_id: null,
    })
    if (conflictError) {
      return jsonResponse({ error: `Não foi possível validar o cadastro: ${conflictError.message}` }, 400)
    }
    if (conflict === 'cpf' || conflict === 'telefone' || conflict === 'email') {
      return jsonResponse({ error: conflictMessage(role, conflict) }, 409)
    }

    const temporaryPassword = generateTemporaryPassword()
    const internalEmail = `${role}.${cpf}@fitpro.internal`
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { role, nome, cpf },
      app_metadata: { role, academy_id: administrator.academy_id },
    })

    if (createError || !created.user) {
      const duplicate = createError?.message.toLowerCase().includes('already')
      return jsonResponse({
        error: duplicate ? 'Já existe uma conta com este CPF.' : `Não foi possível criar o acesso: ${createError?.message ?? 'erro desconhecido'}`,
      }, duplicate ? 409 : 400)
    }

    const { data: record, error: profileError } = await adminClient.rpc('create_fitpro_member_profile', {
      p_actor_user_id: userData.user.id,
      p_user_id: created.user.id,
      p_role: role,
      p_academy_id: administrator.academy_id,
      p_profile: { ...profile, cpf },
    })

    if (profileError || !record) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      const field = conflictFieldFromError(profileError?.message ?? '')
      if (field) return jsonResponse({ error: conflictMessage(role, field) }, 409)
      return jsonResponse({ error: `Não foi possível salvar o perfil: ${profileError?.message ?? 'erro desconhecido'}` }, 400)
    }

    return jsonResponse({ record, temporaryPassword }, 201)
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.',
    }, 500)
  }
})
