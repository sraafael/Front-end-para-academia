import { supabase } from '../lib/supabase'

export interface AuditLog {
  id: number
  actorEmail: string
  action: 'insert' | 'update' | 'delete' | 'reset' | 'seed' | 'password_reset'
  entity: string
  entityId?: string
  label?: string
  details: Record<string, unknown>
  createdAt: string
}

function mapAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: Number(row.id),
    actorEmail: String(row.actor_email ?? 'sistema'),
    action: row.action as AuditLog['action'],
    entity: String(row.entity),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    label: row.label ? String(row.label) : undefined,
    details: (row.details as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export const auditApi = {
  async list(limit = 80): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_email, action, entity, entity_id, label, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapAuditLog(row as Record<string, unknown>))
  },
}
