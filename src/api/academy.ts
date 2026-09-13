import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { isValidCpf, onlyCpfDigits } from '../lib/cpf'
import { formatPhone, isValidPhone } from '../lib/phone'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

export interface Academy {
  id?: string
  nomeFantasia: string
  razaoSocial: string
  cnpj: string
  inscricaoEstadual: string
  inscricaoMunicipal: string
  responsavelLegal: string
  telefone: string
  whatsapp: string
  email: string
  site: string
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  horarioSemana: string
  horarioSabado: string
  horarioDomingo: string
  observacoes: string
}

export interface AcademyAdmin {
  id: string
  academyId: string
  nome: string
  cpf: string
  telefone: string
  email: string
  cargo: string
  status: 'ativo' | 'inativo'
  isOwner: boolean
}

export interface CreateAcademyAdminPayload {
  academyId: string
  nome: string
  cpf: string
  telefone: string
  email: string
  cargo: string
}

export interface UpdateAcademyAdminPayload {
  id: string
  academyId: string
  nome: string
  telefone: string
  email: string
  cargo: string
  status: 'ativo' | 'inativo'
}

const EMPTY_ACADEMY: Academy = {
  nomeFantasia: '',
  razaoSocial: '',
  cnpj: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  responsavelLegal: '',
  telefone: '',
  whatsapp: '',
  email: '',
  site: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  horarioSemana: '',
  horarioSabado: '',
  horarioDomingo: '',
  observacoes: '',
}

function mapAcademy(row?: Record<string, unknown> | null): Academy {
  if (!row) return { ...EMPTY_ACADEMY }
  return {
    id: String(row.id),
    nomeFantasia: String(row.nome_fantasia ?? ''),
    razaoSocial: String(row.razao_social ?? ''),
    cnpj: String(row.cnpj ?? ''),
    inscricaoEstadual: String(row.inscricao_estadual ?? ''),
    inscricaoMunicipal: String(row.inscricao_municipal ?? ''),
    responsavelLegal: String(row.responsavel_legal ?? ''),
    telefone: formatPhone(String(row.telefone ?? '')),
    whatsapp: formatPhone(String(row.whatsapp ?? '')),
    email: String(row.email ?? ''),
    site: String(row.site ?? ''),
    cep: String(row.cep ?? ''),
    endereco: String(row.endereco ?? ''),
    numero: String(row.numero ?? ''),
    complemento: String(row.complemento ?? ''),
    bairro: String(row.bairro ?? ''),
    cidade: String(row.cidade ?? ''),
    estado: String(row.estado ?? ''),
    horarioSemana: String(row.horario_semana ?? ''),
    horarioSabado: String(row.horario_sabado ?? ''),
    horarioDomingo: String(row.horario_domingo ?? ''),
    observacoes: String(row.observacoes ?? ''),
  }
}

function mapAdmin(row: Record<string, unknown>): AcademyAdmin {
  return {
    id: String(row.id),
    academyId: String(row.academy_id ?? ''),
    nome: String(row.nome),
    cpf: String(row.cpf),
    telefone: formatPhone(String(row.telefone ?? '')),
    email: String(row.email ?? ''),
    cargo: String(row.cargo ?? 'Administrador'),
    status: row.status as AcademyAdmin['status'],
    isOwner: Boolean(row.is_owner),
  }
}

function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export const academyApi = {
  async listAcademies(): Promise<Academy[]> {
    const { data, error } = await supabase
      .from('academies')
      .select('*')
      .order('nome_fantasia')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapAcademy(row as Record<string, unknown>))
  },

  async getAcademy(): Promise<Academy> {
    const { data, error } = await supabase.from('academies').select('*').limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    return mapAcademy(data as Record<string, unknown> | null)
  },

  async saveAcademy(academy: Academy): Promise<Academy> {
    if (!academy.nomeFantasia.trim()) throw new Error('Informe o nome da academia.')
    if (academy.cnpj && academy.cnpj.replace(/\D/g, '').length !== 14) {
      throw new Error('Informe um CNPJ com 14 números.')
    }
    if (academy.cep && academy.cep.replace(/\D/g, '').length !== 8) {
      throw new Error('Informe um CEP com 8 números.')
    }
    if (academy.telefone && !isValidPhone(academy.telefone)) {
      throw new Error('Informe um telefone com DDD e 10 ou 11 números.')
    }
    if (academy.whatsapp && !isValidPhone(academy.whatsapp)) {
      throw new Error('Informe um WhatsApp com DDD e 10 ou 11 números.')
    }
    const row = {
      nome_fantasia: academy.nomeFantasia.trim(),
      razao_social: academy.razaoSocial.trim(),
      cnpj: academy.cnpj.replace(/\D/g, ''),
      inscricao_estadual: academy.inscricaoEstadual.trim(),
      inscricao_municipal: academy.inscricaoMunicipal.trim(),
      responsavel_legal: academy.responsavelLegal.trim(),
      telefone: formatPhone(academy.telefone),
      whatsapp: formatPhone(academy.whatsapp),
      email: academy.email.trim(),
      site: academy.site.trim(),
      cep: academy.cep.replace(/\D/g, ''),
      endereco: academy.endereco.trim(),
      numero: academy.numero.trim(),
      complemento: academy.complemento.trim(),
      bairro: academy.bairro.trim(),
      cidade: academy.cidade.trim(),
      estado: academy.estado.trim().toUpperCase().slice(0, 2),
      horario_semana: academy.horarioSemana.trim(),
      horario_sabado: academy.horarioSabado.trim(),
      horario_domingo: academy.horarioDomingo.trim(),
      observacoes: academy.observacoes.trim(),
      updated_at: new Date().toISOString(),
    }

    let query
    if (academy.id) {
      query = supabase.from('academies').update(row).eq('id', academy.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      query = supabase.from('academies').insert({ ...row, owner_id: user?.id ?? null })
    }
    const { data, error } = await query.select().single()
    if (error) throw new Error(error.message)
    return mapAcademy(data as Record<string, unknown>)
  },

  async deleteAcademy(academyId: string): Promise<void> {
    if (!academyId) throw new Error('Academia não encontrada.')
    const { error } = await supabase.rpc('delete_fitpro_academy', {
      p_academy_id: academyId,
    })
    if (error) throw new Error(error.message)
  },

  async listAdmins(): Promise<AcademyAdmin[]> {
    const { data, error } = await supabase
      .from('academy_admins')
      .select('*')
      .order('is_owner', { ascending: false })
      .order('nome')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapAdmin(row as Record<string, unknown>))
  },

  async createAdmin(payload: CreateAcademyAdminPayload): Promise<{ admin: AcademyAdmin; temporaryPassword: string }> {
    if (!payload.academyId) throw new Error('Selecione a academia do administrador.')
    if (!isValidCpf(payload.cpf)) throw new Error('Informe um CPF válido.')
    if (payload.telefone && !isValidPhone(payload.telefone)) {
      throw new Error('Informe um telefone com DDD e 10 ou 11 números.')
    }
    const cpf = onlyCpfDigits(payload.cpf)
    const { data: academy, error: academyError } = await supabase
      .from('academies')
      .select('id')
      .eq('id', payload.academyId)
      .maybeSingle()
    if (academyError) throw new Error(academyError.message)
    if (!academy) throw new Error('Salve as informações da academia antes de cadastrar um administrador.')

    const { data: existing, error: existingError } = await supabase
      .from('academy_admins')
      .select('id')
      .eq('cpf', cpf)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) throw new Error('Já existe um administrador cadastrado com este CPF.')

    const internalEmail = `admin.${cpf}@fitpro.internal`
    const temporaryPassword = generateTemporaryPassword()
    const tempClient = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: authResult, error: authError } = await tempClient.auth.signUp({
      email: internalEmail,
      password: temporaryPassword,
      options: { data: { role: 'admin', cpf, nome: payload.nome } },
    })
    if (authError) throw new Error(`Não foi possível criar o acesso: ${authError.message}`)
    if (!authResult.user || authResult.user.identities?.length === 0) {
      throw new Error('Já existe uma conta de acesso iniciada para este CPF. Revise o cadastro antes de tentar novamente.')
    }

    const { data, error } = await supabase.rpc('complete_academy_admin_registration', {
      p_user_id: authResult.user.id,
      p_nome: payload.nome.trim(),
      p_cpf: cpf,
      p_telefone: formatPhone(payload.telefone),
      p_email: payload.email.trim(),
      p_cargo: payload.cargo.trim() || 'Administrador',
      p_academy_id: payload.academyId,
    })
    if (error) throw new Error(`A conta foi iniciada, mas o perfil não pôde ser concluído: ${error.message}`)

    const { data: saved, error: loadError } = await supabase
      .from('academy_admins')
      .select('*')
      .eq('id', String(data))
      .single()
    if (loadError || !saved) throw new Error(loadError?.message ?? 'Administrador não encontrado após o cadastro.')
    return { admin: mapAdmin(saved as Record<string, unknown>), temporaryPassword }
  },

  async assignAdminToAcademy(adminId: string, academyId: string): Promise<AcademyAdmin> {
    if (!academyId) throw new Error('Selecione uma academia.')
    const { error } = await supabase.rpc('assign_academy_admin', {
      p_admin_id: adminId,
      p_academy_id: academyId,
    })
    if (error) throw new Error(error.message)

    const { data, error: loadError } = await supabase
      .from('academy_admins')
      .select('*')
      .eq('id', adminId)
      .single()
    if (loadError || !data) throw new Error(loadError?.message ?? 'Administrador não encontrado.')
    return mapAdmin(data as Record<string, unknown>)
  },

  async updateAdmin(payload: UpdateAcademyAdminPayload): Promise<AcademyAdmin> {
    if (!payload.nome.trim()) throw new Error('Informe o nome do administrador.')
    if (!payload.academyId) throw new Error('Selecione a academia do administrador.')
    if (payload.telefone && !isValidPhone(payload.telefone)) {
      throw new Error('Informe um telefone com DDD e 10 ou 11 números.')
    }

    const { error } = await supabase.rpc('update_academy_admin', {
      p_admin_id: payload.id,
      p_academy_id: payload.academyId,
      p_nome: payload.nome.trim(),
      p_telefone: formatPhone(payload.telefone),
      p_email: payload.email.trim(),
      p_cargo: payload.cargo.trim() || 'Administrador',
      p_status: payload.status,
    })
    if (error) throw new Error(error.message)

    const { data, error: loadError } = await supabase
      .from('academy_admins')
      .select('*')
      .eq('id', payload.id)
      .single()
    if (loadError || !data) throw new Error(loadError?.message ?? 'Administrador não encontrado.')
    return mapAdmin(data as Record<string, unknown>)
  },

  async resetAdminPassword(adminId: string): Promise<{ admin: AcademyAdmin; temporaryPassword: string }> {
    const temporaryPassword = generateTemporaryPassword()
    const { error } = await supabase.rpc('reset_academy_admin_password', {
      p_admin_id: adminId,
      p_temporary_password: temporaryPassword,
    })
    if (error) throw new Error(error.message)

    const { data, error: loadError } = await supabase
      .from('academy_admins')
      .select('*')
      .eq('id', adminId)
      .single()
    if (loadError || !data) throw new Error(loadError?.message ?? 'Administrador não encontrado.')
    return { admin: mapAdmin(data as Record<string, unknown>), temporaryPassword }
  },

  async deleteAdmin(adminId: string): Promise<void> {
    if (!adminId) throw new Error('Administrador não encontrado.')
    const { error } = await supabase.rpc('delete_academy_admin', {
      p_admin_id: adminId,
    })
    if (error) throw new Error(error.message)
  },
}
