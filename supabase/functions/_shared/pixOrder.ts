export type MercadoPagoOrder = {
  id?: string
  status?: string
  status_detail?: string
  external_reference?: string
  total_amount?: string
  total_paid_amount?: string
  transactions?: {
    payments?: Array<{
      id?: string
      amount?: string
      paid_amount?: string
      status?: string
      status_detail?: string
      payment_method?: {
        id?: string
        qr_code?: string
        qr_code_base64?: string
        ticket_url?: string
      }
    }>
  }
}

export type StoredPixCharge = {
  id: string
  academy_id: string
  amount: number
  status: string
  provider_order_id: string | null
}

// Só uma order Pix quitada, com ID e valor corretos, pode baixar a mensalidade.
export function verifyPixOrder(
  charge: StoredPixCharge,
  order: MercadoPagoOrder,
) {
  if (
    !charge.provider_order_id ||
    order.id !== charge.provider_order_id ||
    order.external_reference !== charge.id ||
    Number(order.total_amount) !== Number(charge.amount)
  ) {
    throw new Error("Dados da cobrança não conferem com o Mercado Pago.")
  }

  const payment = order.transactions?.payments?.find(
    (item) => item.payment_method?.id === "pix",
  )
  if (!payment) throw new Error("O pagamento da cobrança não é Pix.")

  const accredited =
    order.status === "processed" &&
    order.status_detail === "accredited" &&
    payment.status === "processed" &&
    payment.status_detail === "accredited" &&
    Number(payment.paid_amount ?? payment.amount) === Number(charge.amount) &&
    Number(order.total_paid_amount) === Number(charge.amount)

  return { payment, accredited }
}
