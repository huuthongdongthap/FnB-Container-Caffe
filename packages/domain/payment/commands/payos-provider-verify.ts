import { verifyPayOSSignature } from '../policies/payos-signature';

export const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';
const PAYOS_CHECKOUT_ORIGIN = 'https://pay.payos.vn';
const LINK_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ORDER_CODE_PATTERN = /^\d+$/;

export type VerifyFailureReason =
  | 'timeout'
  | 'rate_limited'
  | 'not_found'
  | 'server_error'
  | 'bad_signature'
  | 'mismatch'
  | 'invalid_link';

export type VerifyPayOSResult =
  | {
      ok: true;
      status: string;
      orderCode: string;
      amount: number;
      amountPaid: number;
      amountRemaining: number;
      linkId: string | null;
      checkoutUrl: string | null;
    }
  | {
      ok: false;
      reason: VerifyFailureReason;
    };

export interface VerifyPayOSInput {
  transactionId: string | null | undefined;
  expectedAmount: number;
  expectedLinkId?: string | null;
  checksumKey: string;
  clientId: string;
  apiKey: string;
  timeoutMs?: number;
}

export function extractPayOSLinkId(paymentUrl: string | null | undefined): string | null {
  if (!paymentUrl) return null;
  try {
    const parsed = new URL(paymentUrl);
    if (parsed.origin !== PAYOS_CHECKOUT_ORIGIN) return null;
    const match = parsed.pathname.match(/^\/web\/([A-Za-z0-9_-]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function buildCheckoutUrl(data: Record<string, unknown>, fromGet = false): string | null {
  const id = String(fromGet ? data.id ?? data.paymentLinkId ?? '' : data.paymentLinkId ?? data.id ?? '');
  if (!LINK_ID_PATTERN.test(id)) return null;
  if (fromGet) return `${PAYOS_CHECKOUT_ORIGIN}/web/${id}`;
  try {
    const parsed = new URL(String(data.checkoutUrl ?? ''));
    return parsed.origin === PAYOS_CHECKOUT_ORIGIN && parsed.pathname === `/web/${id}` ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function verifyPayOSPaymentRequest(input: VerifyPayOSInput): Promise<VerifyPayOSResult> {
  const txId = String(input.transactionId ?? '').trim();
  if (!ORDER_CODE_PATTERN.test(txId)) {
    return { ok: false, reason: 'mismatch' };
  }

  let res: Response;
  try {
    res = await fetch(`${PAYOS_API}/${txId}`, {
      headers: {
        'x-client-id': input.clientId,
        'x-api-key': input.apiKey,
      },
      signal: AbortSignal.timeout(input.timeoutMs ?? 5000),
    });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(String(err))) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'server_error' };
  }

  if (res.status === 429) return { ok: false, reason: 'rate_limited' };
  if (res.status === 404) return { ok: false, reason: 'not_found' };
  if (!res.ok) return { ok: false, reason: 'server_error' };

  let result: { code?: string; signature?: string; data?: Record<string, unknown> };
  try {
    result = await res.json() as { code?: string; signature?: string; data?: Record<string, unknown> };
  } catch {
    return { ok: false, reason: 'server_error' };
  }

  if (result.code === 'not-found' || result.code === '404') return { ok: false, reason: 'not_found' };
  if (result.code !== '00' || !result.data || typeof result.data !== 'object') {
    return { ok: false, reason: 'server_error' };
  }

  if (!await verifyPayOSSignature(result.data, result.signature, input.checksumKey)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const data = result.data;
  const orderCode = String(data.orderCode ?? '');
  const amount = Number(data.amount);
  if (orderCode !== txId || !Number.isFinite(amount) || amount !== input.expectedAmount) {
    return { ok: false, reason: 'mismatch' };
  }

  const rawLinkId = data.id ?? data.paymentLinkId;
  const linkId = rawLinkId !== undefined && rawLinkId !== null ? String(rawLinkId) : null;
  if (linkId !== null && !LINK_ID_PATTERN.test(linkId)) {
    return { ok: false, reason: 'mismatch' };
  }
  if (input.expectedLinkId && linkId && linkId !== input.expectedLinkId) {
    return { ok: false, reason: 'mismatch' };
  }

  const status = String(data.status ?? '').toUpperCase();
  const amountPaid = data.amountPaid !== undefined
    ? Number(data.amountPaid)
    : (data.amountRemaining !== undefined ? amount - Number(data.amountRemaining) : (status === 'PAID' ? amount : 0));
  const amountRemaining = data.amountRemaining !== undefined
    ? Number(data.amountRemaining)
    : (data.amountPaid !== undefined ? Math.max(0, amount - Number(data.amountPaid)) : (status === 'PAID' ? 0 : amount));

  return {
    ok: true,
    status,
    orderCode,
    amount,
    amountPaid,
    amountRemaining,
    linkId,
    checkoutUrl: buildCheckoutUrl(data, true),
  };
}
