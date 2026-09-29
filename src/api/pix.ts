import { invokeProtectedFunction } from './functions'

// Tipos retornados pelas Edge Functions de integração com o Mercado Pago.
export interface PixSettings {
  configured: boolean
  connected: boolean
  enabled: boolean
  testMode: boolean
  sellerId: string | null
  reviewCharges: Array<{ id: string; amount: number; paidAt: string | null; studentName: string | null }>
}

export interface PixHistoryItem {
  id: string
  studentName: string | null
  planName: string | null
  amount: number
  status: 'creating' | 'pending' | 'paid' | 'expired' | 'failed' | 'review'
  periodDue: string
  createdAt: string
  paidAt: string | null
  providerOrderId: string | null
  providerPaymentId: string | null
  testMode: boolean
}

export interface PixCharge {
  id: string
  amount: number
  status: 'creating' | 'pending' | 'paid' | 'expired' | 'failed' | 'review'
  periodDue: string
  qrCode: string | null
  qrCodeBase64: string | null
  ticketUrl: string | null
  expiresAt: string | null
  testMode: boolean
}

export interface MyPixStatus {
  available: boolean
  testMode: boolean
  charge: PixCharge | null
}

// Toda operação Pix fica no servidor; o navegador nunca recebe tokens do
// Mercado Pago nem decide sozinho se uma mensalidade foi quitada.
export const pixApi = {
  settings: () => invokeProtectedFunction<PixSettings>('pix-connect', { action: 'status' }),
  history: () => invokeProtectedFunction<{ charges: PixHistoryItem[] }>('pix-connect', { action: 'history' }),
  ownerSettings: (academyId: string) => invokeProtectedFunction<PixSettings>('pix-connect', { action: 'status', academyId }),
  ownerBeginConnection: (academyId: string) => invokeProtectedFunction<{ url: string }>('pix-connect', { action: 'connect', academyId }),
  ownerSetEnabled: (academyId: string, enabled: boolean) => invokeProtectedFunction<{ enabled: boolean }>('pix-connect', { action: 'toggle', academyId, enabled }),
  myStatus: () => invokeProtectedFunction<MyPixStatus>('pix-charge', { action: 'status' }),
  createCharge: () => invokeProtectedFunction<MyPixStatus>('pix-charge', { action: 'create' }),
}
