/**
 * Create MoMo Payment Link
 *
 * POST /api/payment/momo/create
 *
 * Generates a MoMo payment URL using HMAC-SHA256 signature.
 */

import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/env';

// Auth fallback — no-op factory when middleware isn't loaded (test envs)
const requireAuth: undefined | ((allowedRoles?: string[]) => MiddlewareHandler<{ Bindings: Env }>) =
  (globalThis as Record<string, unknown>).requireAuth as
    undefined | ((allowedRoles?: string[]) => MiddlewareHandler<{ Bindings: Env }>) ??
  ((allowedRoles: string[] = []) =>
    (async(_c: Context, _next: () => Promise<void>): Promise<Response> =>
      new Response()) as unknown as MiddlewareHandler<{ Bindings: Env }>);

const momoCreateRouter = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  order_id: z.string().uuid(),
  description: z.string().max(25).optional(),
  customer_name: z.string().optional()
});

async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('sign', secretKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── POST /create ──
momoCreateRouter.post('/create', requireAuth(['customer', 'owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const locale = (c.req.query('locale') || 'vi') as 'vi' | 'en';
  const errMsg = {
    order_not_found: { vi: 'Không tìm thấy đơn hàng', en: 'Order not found' },
    momo_not_configured: { vi: 'MoMo chưa được cấu hình', en: 'MoMo env vars not configured' },
    momo_error: { vi: 'Lỗi MoMo', en: 'MoMo error' },
    insert_failed: { vi: 'Không thể tạo thanh toán MoMo', en: 'Failed to create MoMo payment' },
    internal_error: { vi: 'Lỗi hệ thống', en: 'Internal error' }
  };

  try {
    const body = await c.req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      return c.json({ error: -1, message, message_en: message }, 400);
    }

    const { order_id, description, customer_name } = parsed.data;

    // Look up order
    const orderRow = await db
      .prepare('SELECT id, total, payment_status, customer_id FROM orders WHERE id = ?')
      .bind(order_id)
      .first<{ id: string; total: string; payment_status: string; customer_id?: string }>();

    if (!orderRow) {
      return c.json({ error: -1, message: errMsg.order_not_found[locale], message_en: errMsg.order_not_found.en }, 404);
    }

    if (orderRow.payment_status === 'paid') {
      return c.json({
        success: false,
        error: locale === 'en' ? 'Order already paid' : 'Đơn hàng đã được thanh toán',
        error_en: 'Order already paid'
      }, 409);
    }

    const amount = Number(orderRow.total);
    if (!Number.isFinite(amount) || amount < 1000) {
      return c.json({
        success: false,
        error: locale === 'en' ? 'Invalid order total' : 'Tổng tiền không hợp lệ',
        error_en: 'Invalid order total'
      }, 400);
    }

    // Idempotency: return existing pending payment if present
    const existing = await db
      .prepare(
        'SELECT id, transaction_id, payment_url, status FROM payments WHERE order_id = ? AND method = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1'
      )
      .bind(order_id, 'momo', 'pending', 'completed')
      .first<{ id: string; transaction_id: string; payment_url: string; status: string }>();

    if (existing) {
      if (existing.status === 'completed') {
        return c.json({
          success: false,
          error: locale === 'en' ? 'Order already paid' : 'Đơn hàng đã được thanh toán',
          error_en: 'Order already paid'
        }, 409);
      }
      return c.json({ success: true, checkoutUrl: existing.payment_url, orderCode: existing.transaction_id, cached: true });
    }

    // Build MoMo v2 create-link request
    const partnerCode = String(c.env.MOMO_PARTNER_CODE ?? '');
    const accessKey = String(c.env.MOMO_ACCESS_KEY ?? '');
    const secretKey = String(c.env.MOMO_SECRET_KEY ?? '');
    const targetUrl = c.env.MOMO_TARGET_URL || 'https://test-payment.momo.vn';

    if (!partnerCode || !accessKey || !secretKey) {
      return c.json({ error: -1, message: errMsg.momo_not_configured[locale], message_en: errMsg.momo_not_configured.en }, 500);
    }

    let orderCode = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const requestId = crypto.randomUUID();
    const returnUrl = `${c.env.FE_BASE_URL || 'https://auraspace.cafe'}/order-success`;
    const ipnUrl = `${c.env.FE_BASE_URL || 'https://auraspace.cafe'}/api/webhook/momo`;
    const momoDescription = (description || 'AURA CAFE').slice(0, 25);

    // Signature: sorted fields -> key=value&...
    const signParams: Record<string, string> = {
      accessKey,
      amount: String(amount),
      extraData: '',
      ipnUrl,
      orderId: orderCode,
      orderInfo: momoDescription,
      partnerCode,
      redirectUrl: returnUrl,
      requestId
    };

    const signRaw = Object.keys(signParams)
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join('&');

    const signature = await hmacSha256(secretKey, signRaw);

    // MoMo v2 payload
    const payload: Record<string, unknown> = {
      partnerCode,
      partnerRefId: orderCode,
      amount,
      paymentCode: '',
      description: momoDescription,
      orderId: orderCode,
      orderInfo: momoDescription,
      redirectUrl: returnUrl,
      ipnUrl,
      requestId,
      extraData: '',
      orderGroupId: '',
      autoCapture: true,
      lang: 'vi',
      signature
    };

    const resp = await fetch(`${targetUrl}/v2/gateway/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json<{
      resultCode: number;
      message?: string;
      payUrl?: string;
      qrCodeUrl?: string;
      deeplink?: string;
      transId?: string;
    }>();

    if (data.resultCode !== 0) {
      return c.json({ error: data.resultCode, message: data.message, message_en: data.message }, 400);
    }

    // Persist payment record (retry on UNIQUE collision)
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const transId = String(data.transId || orderCode);

    let insertOk = false;
    for (let attempt = 0; attempt < 3 && !insertOk; attempt++) {
      try {
        await db
          .prepare(
            'INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(paymentId, order_id, 'momo', amount, 'pending', transId, data.payUrl || '', now)
          .run();
        insertOk = true;
      } catch {
        // Colliding orderCode — regenerate and retry
        orderCode = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      }
    }

    if (!insertOk) {
      return c.json({ error: -1, message: errMsg.insert_failed[locale], message_en: errMsg.insert_failed.en }, 500);
    }

    return c.json({
      success: true,
      checkoutUrl: data.payUrl,
      qrCodeUrl: data.qrCodeUrl,
      deeplink: data.deeplink,
      orderCode,
      requestId
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: -1, message, message_en: message }, 500);
  }
});

export function momoCreate(app: Hono<{ Bindings: Env }>) {
  app.route('/momo/create', momoCreateRouter);
}
