import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

// Cliente usado em toda a aplicação.
const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (Boolean(configuredUrl) !== Boolean(configuredKey)) {
  throw new Error('Informe a URL e a chave pública do mesmo ambiente Supabase.')
}

export const supabase = createClient(
  configuredUrl || `https://${projectId}.supabase.co`,
  configuredKey || publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
