import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

// Cliente usado em toda a aplicação.
const testMode = import.meta.env.MODE === 'pix-test'
const testUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const testKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (Boolean(testUrl) !== Boolean(testKey)) {
  throw new Error('Informe a URL e a chave pública do mesmo ambiente Supabase.')
}
if (testMode && (!testUrl || !testKey)) {
  throw new Error('Configure .env.pix-test.local antes de iniciar o teste isolado do Pix.')
}
if (testMode && (new URL(testUrl!).hostname === `${projectId}.supabase.co` || testKey === publicAnonKey)) {
  throw new Error('O modo de teste Pix não pode usar o Supabase principal.')
}

export const supabase = createClient(
  testUrl || `https://${projectId}.supabase.co`,
  testKey || publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
