import { invokeProtectedFunction } from './functions'

export interface PixSettings {
  configured: boolean
  connected: boolean
  enabled: boolean
  testMode: boolean
  sellerId: string | null
  reviewCharges: Array<{ id: string; amount: number; paidAt: string | null; studentName: string | null }>
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

export const pixApi = {
  settings: () => invokeProtectedFunction<PixSettings>('pix-connect', { action: 'status' }),
  beginConnection: () => invokeProtectedFunction<{ url: string }>('pix-connect', { action: 'connect' }),
  setEnabled: (enabled: boolean) => invokeProtectedFunction<{ enabled: boolean }>('pix-connect', { action: 'toggle', enabled }),
  myStatus: () => invokeProtectedFunction<MyPixStatus>('pix-charge', { action: 'status' }),
  createCharge: () => invokeProtectedFunction<MyPixStatus>('pix-charge', { action: 'create' }),
}
