/**
 * Create MoMo Payment Link
 *
 * POST /api/payment/momo/create
 *
 * Generates a MoMo payment URL using HMAC-SHA256 signature.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { optionalAuth } from 'worker/src/middleware/auth';
import type { Env } from 'worker/src/types/env';

const momoCreateRouter = new Hono<{ Bindings: Env }>();

function randomOrderCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return `${Date.now()}${buf[0] % 1000}`;
}

function randomPaymentId(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `pay_${Date.now()}_${hex.slice(0, 5)}`;
}

const createSchema = z.object({
  order_id: z.string().min(1),
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
  const sig = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const handleMomoCreate = async(c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const locale = (c.req.query('locale') || 'vi') as 'vi' | 'en';
  const errMsg = {
    order_not_found: { vi: 'Không tìm thấy đơn hàng', en: 'Order not found' },
    forbidden: { vi: 'Từ chối — không phải đơn hàng của bạn', en: 'Forbidden — not your order' },
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

    const { order_id, description } = parsed.data;

    // Look up order
    const orderRow = await db
      .prepare('SELECT id, total, payment_status, customer_id FROM orders WHERE id = ?')
      .bind(order_id)
      .first<{ id: string; total: string; payment_status: string; customer_id?: string }>();

    if (!orderRow) {
      return c.json({ error: -1, message: errMsg.order_not_found[locale], message_en: errMsg.order_not_found.en }, 404);
    }

    const user = (c.get as any)('user') as { id?: string; role?: string } | undefined;
    const isStaffOrOwner =
      user?.role === 'owner' ||
      user?.role === 'manager' ||
      user?.role === 'staff' ||
      user?.role === 'admin' ||
      user?.role === 'cashier';
    if (orderRow.customer_id && user?.id && orderRow.customer_id !== user.id && !isStaffOrOwner) {
      return c.json({
        success: false,
        error: errMsg.forbidden[locale],
        error_en: errMsg.forbidden.en
      }, 403);
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

    let orderCode = randomOrderCode();
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
    const now = new Date().toISOString();
    let paymentId = randomPaymentId();
    let transId = String(orderCode || data.transId);

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
        // Colliding orderCode or paymentId — regenerate and retry
        orderCode = randomOrderCode();
        paymentId = randomPaymentId();
        transId = String(orderCode || data.transId);
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
  } catch {
    return c.json({ error: -1, message: errMsg.internal_error[locale], message_en: errMsg.internal_error.en }, 500);
  }
};

momoCreateRouter.post('/', optionalAuth() as any, handleMomoCreate);
momoCreateRouter.post('/create', optionalAuth() as any, handleMomoCreate);

export function momoCreate(app: Hono<{ Bindings: Env }>) {
  app.route('/momo/create', momoCreateRouter);
}
