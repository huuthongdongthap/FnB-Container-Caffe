/**
 * PayOS Helper utilities
 * Signature generation & payment persistence with collision retries.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'payos-helpers' });
export const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

export const PAYOS_ERROR_MESSAGES = {
  order_not_found: { vi: 'Không tìm thấy đơn hàng', en: 'Order not found' },
  forbidden: { vi: 'Từ chối — không phải đơn hàng của bạn', en: 'Forbidden — not your order' },
  already_paid: { vi: 'Đơn hàng đã được thanh toán', en: 'Order already paid' },
  invalid_total: { vi: 'Tổng tiền không hợp lệ', en: 'Invalid order total' },
  payos_not_configured: { vi: 'PayOS chưa được cấu hình', en: 'PayOS env vars not configured' },
  payos_error: { vi: 'Lỗi PayOS', en: 'PayOS error' },
  insert_failed: { vi: 'Không thể tạo thanh toán sau 3 lần thử', en: 'Failed to create payment after 3 retries' },
  internal_error: { vi: 'Lỗi hệ thống', en: 'Internal error' },
};

export interface PayOSSignatureParams {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}

export async function buildPayOSSignature(
  params: PayOSSignatureParams,
  checksumKey: string
): Promise<string> {
  const canonical = [
    `amount=${params.amount}`,
    `cancelUrl=${params.cancelUrl}`,
    `description=${params.description}`,
    `orderCode=${params.orderCode}`,
    `returnUrl=${params.returnUrl}`
  ].join('&');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(checksumKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateOrderCode(): number {
  return (Date.now() * 1000) + Math.floor(Math.random() * 1000);
}

export interface PayOSOrderValidation {
  id: string;
  total: number;
  payment_status: string;
  customer_id: string | null;
  is_cod: number;
}

export function validatePayOSAccess(
  orderRow: PayOSOrderValidation,
  customerId: string | null,
  role?: string
): { allowed: boolean; reason?: 'forbidden' | 'already_paid' | 'invalid_total' } {
  const isStaffOrOwner = role === 'owner' || role === 'staff';
  if (orderRow.customer_id && customerId && orderRow.customer_id !== customerId && !isStaffOrOwner) {
    return { allowed: false, reason: 'forbidden' };
  }
  if (orderRow.payment_status === 'paid') {
    return { allowed: false, reason: 'already_paid' };
  }
  const amount = parseInt(String(orderRow.total), 10);
  if (!Number.isFinite(amount) || amount < 1000) {
    return { allowed: false, reason: 'invalid_total' };
  }
  return { allowed: true };
}

export interface SavePaymentParams {
  db: D1Database;
  orderId: string;
  amount: number;
  initialOrderCode: number;
  checkoutUrl: string;
  payosPayload: Record<string, unknown>;
  checksumKey: string;
  clientId: string;
  apiKey: string;
  cancelUrl: string;
  description: string;
  returnUrl: string;
}

export async function persistPaymentWithRetries(
  params: SavePaymentParams
): Promise<{ ok: boolean; finalOrderCode: number; checkoutUrl: string }> {
  const {
    db, orderId, amount, initialOrderCode, checkoutUrl, payosPayload,
    checksumKey, clientId, apiKey, cancelUrl, description, returnUrl,
  } = params;

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  let orderCode = initialOrderCode;
  let activeCheckoutUrl = checkoutUrl;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const attemptCode = attempt === 0 ? orderCode : generateOrderCode();
      await db.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at)
        VALUES (?, ?, 'payos', ?, 'pending', ?, ?, ?)
      `).bind(paymentId, orderId, amount, String(attemptCode), activeCheckoutUrl, now).run();

      return { ok: true, finalOrderCode: attemptCode, checkoutUrl: activeCheckoutUrl };
    } catch (insertErr) {
      const insertErrMsg = (insertErr as Error).message || '';
      if (!insertErrMsg.includes('UNIQUE constraint')) throw insertErr;
      log.warn('PayOS orderCode collision', { attempt: attempt + 1 });
      orderCode = generateOrderCode();
      const newSig = await buildPayOSSignature(
        { amount, cancelUrl, description, orderCode, returnUrl },
        checksumKey
      );
      payosPayload.orderCode = orderCode;
      payosPayload.signature = newSig;
      const retryRes = await fetch(PAYOS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
        body: JSON.stringify(payosPayload)
      });
      const retryData = await retryRes.json() as { code: string; desc?: string; data?: { checkoutUrl: string } };
      if (retryData.code !== '00') return { ok: false, finalOrderCode: orderCode, checkoutUrl: '' };
      activeCheckoutUrl = retryData.data?.checkoutUrl || activeCheckoutUrl;
    }
  }

  return { ok: false, finalOrderCode: orderCode, checkoutUrl: activeCheckoutUrl };
}
