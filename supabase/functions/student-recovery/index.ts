import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false
  const digit = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i += 1) sum += Number(value[i]) * (length + 1 - i)
    const result = (sum * 10) % 11
    return result === 10 ? 0 : result
  }
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10])
}

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return `Aa2!${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'Servidor não configurado.' }, 500)

  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await request.json().catch(() => ({})) as {
      action?: string
      cpf?: string
      academyId?: string
      requestId?: string
      decision?: 'reset' | 'dismiss'
    }

    if (body.action === 'academies') {
      const { data, error } = await client.from('academies')
        .select('id, nome_fantasia').order('nome_fantasia').limit(200)
      if (error) throw error
      return json({ academies: (data ?? []).map(item => ({ id: item.id, name: item.nome_fantasia })) })
    }

    if (body.action === 'request') {
      const cpf = String(body.cpf ?? '').replace(/\D/g, '')
      const academyId = String(body.academyId ?? '')
      if (!validCpf(cpf) || !/^[0-9a-f-]{36}$/i.test(academyId)) {
        return json({ error: 'Informe CPF e academia válidos.' }, 400)
      }

      // A resposta não revela se o CPF pertence à academia escolhida.
      const accepted = { message: 'Se os dados estiverem corretos, a administração da academia receberá o pedido.' }
      const { data: aluno, error: studentError } = await client.from('alunos')
        .select('id, user_id, status').eq('cpf', cpf).eq('academy_id', academyId).maybeSingle()
      if (studentError) throw studentError
      if (!aluno?.user_id || aluno.status === 'inativo') return json(accepted)

      const { data: latest, error: latestError } = await client.from('student_password_recovery_requests')
        .select('status, created_at').eq('aluno_id', aluno.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (latestError) throw latestError
      if (latest?.status === 'pending' || (latest && Date.now() - new Date(latest.created_at).getTime() < 15 * 60_000)) {
        return json(accepted)
      }

      const { error } = await client.from('student_password_recovery_requests')
        .insert({ academy_id: academyId, aluno_id: aluno.id })
      if (error && error.code !== '23505') throw error
      return json(accepted)
    }

    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Entre novamente como administrador.' }, 401)
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const { data: admin, error: adminError } = await client.from('academy_admins')
      .select('academy_id, status, is_owner').eq('user_id', userData.user.id).maybeSingle()
    if (adminError || !admin?.academy_id || admin.status !== 'ativo' || admin.is_owner) {
      return json({ error: 'Apenas a administração da academia pode ver estes pedidos.' }, 403)
    }

    if (body.action === 'list') {
      const { data, error } = await client.from('student_password_recovery_requests')
        .select('id, created_at, alunos(id, nome, cpf, telefone)')
        .eq('academy_id', admin.academy_id).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return json({ requests: (data ?? []).map(item => ({
        id: item.id,
        createdAt: item.created_at,
        student: Array.isArray(item.alunos) ? item.alunos[0] : item.alunos,
      })) })
    }

    if (body.action === 'handle' && body.decision && /^[0-9a-f-]{36}$/i.test(String(body.requestId ?? ''))) {
      const password = body.decision === 'reset' ? temporaryPassword() : null
      const { data, error } = await client.rpc('handle_fitpro_student_recovery', {
        p_actor_user_id: userData.user.id,
        p_request_id: body.requestId,
        p_action: body.decision,
        p_temporary_password: password,
      })
      if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 400)
      return json({ record: data, temporaryPassword: password })
    }
    return json({ error: 'Ação inválida.' }, 400)
  } catch (error) {
    console.error('Falha no pedido de recuperação:', error instanceof Error ? error.message : error)
    return json({ error: 'Não foi possível concluir a solicitação agora.' }, 500)
  }
})
