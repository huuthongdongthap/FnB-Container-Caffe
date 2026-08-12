/** NowPayments integration — invoice creation + IPN verification */

const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1';

export interface NowPaymentsInvoicePayload {
  price_amount: number;
  price_currency: string;
  order_id: string;
  order_description: string;
  ipn_callback_url?: string;
}

export interface NowPaymentsInvoiceResponse {
  id: string;
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: string;
  price_currency: string;
  pay_amount: string;
  pay_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: string;
  created_at: string;
  updated_at: string;
  checkout_url: string;
  status_url: string;
}

/** Create a NowPayments invoice for a D1-backed invoice record.
  * Returns the reservation payload on success, or null if the gateway is not configured.
  */
export async function createNowPaymentsInvoice(
  env: { NOWPAYMENTS_API_KEY?: string; APP_URL?: string },
  invoiceId: string,
  amountVnd: number,
  orderDescription = 'AURA CAFE Container Rental'
): Promise<{ paymentId: string; checkoutUrl: string; paymentRef: string } | null> {
  if (!env.NOWPAYMENTS_API_KEY) {
    return null;
  }

  const ipnUrl = `${env.APP_URL || 'http://localhost:3000'}/api/webhooks/nowpayments`;

  const payload: NowPaymentsInvoicePayload = {
    price_amount: amountVnd / 25000, // VND approximation (NOWPayments supports VND approximate rate)
    price_currency: 'vnd',
    order_id: `invoice_${invoiceId}`,
    order_description: orderDescription,
    ipn_callback_url: ipnUrl,
  };

  const res = await fetch(`${NOWPAYMENTS_API}/invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.NOWPAYMENTS_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`NowPayments invoice creation failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as NowPaymentsInvoiceResponse;
  return {
    paymentId: data.payment_id,
    checkoutUrl: data.checkout_url,
    paymentRef: data.id,
  };
}
