/** PayOS checkout: authorize the linked order and reserve before contacting PayOS. */
import { Hono } from 'hono';
import { optionalAuth } from 'worker/src/middleware/auth';
import { createLogger } from 'worker/src/middleware/logger';
import { payOSCreateLinkSchema } from 'worker/src/lib/validators';
import { canAccessPaymentOrder, PAYMENT_ROLES, resolvePaymentCustomerOwnerIds, resolvePaymentTenantScope, verifyPaymentOrderToken } from '../policies/payment-access';
import { getOrCreatePayOSAttempt } from './payos-attempt';
import { resolveMerchantPaymentConfig } from '../../../../worker/src/lib/merchant-payment';
import { PAYOS_ERROR_MESSAGES as errMsg } from './payos-helpers';
import type { Env } from 'worker/src/types/env';

const log = createLogger({ route: 'payment' });
export const paymentRouter = new Hono<{ Bindings: Env }>();

const PAYOS_REGEN_COOLDOWN_MS = 30_000;
const PAYOS_REGEN_MAX_ATTEMPTS = 3;
const PAYOS_REGEN_TTL_SECONDS = 3600;

interface PayOSRegenRecord {
  count: number;
  lastAt: number;
}

const fallbackRegenByDb = new WeakMap<object, Map<string, PayOSRegenRecord>>();

async function checkAndRecordGuestRegenerate(
  db: object,
  kv: import('@cloudflare/workers-types').KVNamespace | null | undefined,
  tenantId: string,
  orderId: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number; reason: 'cooldown' | 'max_attempts' }> {
  const key = `payos:regen:${tenantId}:${orderId}`;
  const now = Date.now();
  let record: PayOSRegenRecord | null = null;

  if (kv) {
    try {
      const raw = await kv.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PayOSRegenRecord>;
        if (typeof parsed.count === 'number' && typeof parsed.lastAt === 'number') {
          record = { count: parsed.count, lastAt: parsed.lastAt };
        }
      }
    } catch {
      // Fall back to per-DB memory tracker if KV read fails
    }
  }
  if (!record) {
    record = fallbackRegenByDb.get(db)?.get(key) ?? null;
  }

  if (record) {
    if (record.count >= PAYOS_REGEN_MAX_ATTEMPTS) {
      return { allowed: false, retryAfterSeconds: PAYOS_REGEN_TTL_SECONDS, reason: 'max_attempts' };
    }
    const elapsed = now - record.lastAt;
    if (elapsed < PAYOS_REGEN_COOLDOWN_MS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((PAYOS_REGEN_COOLDOWN_MS - elapsed) / 1000));
      return { allowed: false, retryAfterSeconds, reason: 'cooldown' };
    }
  }

  const nextRecord: PayOSRegenRecord = {
    count: (record?.count ?? 0) + 1,
    lastAt: now,
  };
  let map = fallbackRegenByDb.get(db);
  if (!map) {
    map = new Map<string, PayOSRegenRecord>();
    fallbackRegenByDb.set(db, map);
  }
  map.set(key, nextRecord);

  if (kv) {
    try {
      await kv.put(key, JSON.stringify(nextRecord), { expirationTtl: PAYOS_REGEN_TTL_SECONDS });
    } catch {
      // Non-fatal KV write failure
    }
  }

  return { allowed: true };
}

function resolveSafePosRedirectUrl(rawUrl: unknown, baseUrl: string): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('\\') || /(?:^|\/)\.\.(?:\/|$)|%2e/i.test(trimmed)) return null;
  try {
    const trustedBase = new URL(baseUrl);
    const parsed = new URL(trimmed, trustedBase.origin);
    if (parsed.origin !== trustedBase.origin) return null;
    if (parsed.username || parsed.password) return null;
    const allowedPrefixes = ['/admin/pos', '/admin/orders', '/admin/tables'];
    const isAllowedPath = allowedPrefixes.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    );
    if (!isAllowedPath) return null;
    return `${trustedBase.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

/** Shared by legacy checkout aliases and the authenticated OpenAPI create route. */
export const handleCreateLink = async (c: any, input?: unknown, openApi = false) => {
  const db = (c.env.AURA_DB ?? c.env.DB) as import('@cloudflare/workers-types').D1Database;
  const locale = c.req.query('locale') === 'en' ? 'en' : 'vi';
  try {
    const scope = resolvePaymentTenantScope(c, true);
    if (!scope) return c.json({ success: false, error: errMsg.forbidden[locale] }, 403);
    const parsed = payOSCreateLinkSchema.safeParse(input ?? await c.req.json());
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const { order_id, description, customer_name, return_url: requestedReturnUrl, cancel_url: requestedCancelUrl } = parsed.data;
    type Order = {
      id: string;
      total: number;
      status: string;
      payment_status: string;
      payment_method: string;
      customer_id: string | null;
      tenant_id?: string | null;
      order_token?: string | null;
      guest_token_hash?: string | null;
      orderTokenVerified?: boolean;
    };
    let order: Order | null = null;
    try {
      order = await db
        .prepare(
          'SELECT id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method, customer_id, tenant_id, guest_token_hash FROM orders WHERE id = ?'
        )
        .bind(order_id)
        .first<Order>();
    } catch {
      try {
        order = await db
          .prepare(
            'SELECT id, total, status, payment_status, payment_method, customer_id, tenant_id, guest_token_hash FROM orders WHERE id = ?'
          )
          .bind(order_id)
          .first<Order>();
      } catch {
        try {
          order = await db
            .prepare(
              'SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id, tenant_id, guest_token_hash FROM orders WHERE id = ?'
            )
            .bind(order_id)
            .first<Order>();
        } catch {
          try {
            order = await db
              .prepare(
                'SELECT id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method, customer_id, tenant_id, order_token FROM orders WHERE id = ?'
              )
              .bind(order_id)
              .first<Order>();
      } catch {
        try {
          order = await db
            .prepare('SELECT id, total, status, payment_status, payment_method, customer_id, tenant_id, order_token FROM orders WHERE id = ?')
            .bind(order_id)
            .first<Order>();
        } catch {
          try {
            order = await db
              .prepare('SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id, tenant_id, order_token FROM orders WHERE id = ?')
              .bind(order_id)
              .first<Order>();
          } catch {
            try {
              order = await db
                .prepare('SELECT id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
                .bind(order_id)
                .first<Order>();
            } catch {
              try {
                order = await db
                  .prepare('SELECT id, total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
                  .bind(order_id)
                  .first<Order>();
              } catch {
                try {
                  order = await db
                    .prepare('SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
                    .bind(order_id)
                    .first<Order>();
                } catch {
                  if (scope.tenantId === 'default' || scope.wildcard) {
                    try {
                      order = await db
                        .prepare(
                          'SELECT id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method, customer_id, order_token FROM orders WHERE id = ?'
                        )
                        .bind(order_id)
                        .first<Order>();
                    } catch {
                      try {
                        order = await db
                          .prepare('SELECT id, total, status, payment_status, payment_method, customer_id FROM orders WHERE id = ?')
                          .bind(order_id)
                          .first<Order>();
                      } catch {
                        order = await db
                          .prepare('SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id FROM orders WHERE id = ?')
                          .bind(order_id)
                          .first<Order>();
                      }
                    }
                  }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (!order) return c.json({ success: false, error: errMsg.order_not_found[locale] }, 404);
    const orderTenant =
      (order.tenant_id &&
      String(order.tenant_id).trim() &&
      String(order.tenant_id).trim() !== '*' &&
      String(order.tenant_id).trim().toLowerCase() !== 'hq')
        ? String(order.tenant_id).trim()
        : (scope.wildcard ? 'default' : scope.tenantId);
    const orderTokenVerified = await verifyPaymentOrderToken(c, order);
    let effectiveOrderForAccess: Order = { ...order, orderTokenVerified };
    const user = c?.get?.('user') as Record<string, any> | undefined;
    if (user && String(user.role || '').trim().toLowerCase() === 'customer' && order.customer_id) {
      const ownerIds = await resolvePaymentCustomerOwnerIds(db, user, orderTenant);
      try { c.set?.('customerOwnerIds', ownerIds); } catch { /* optional on mock context */ }
      const ordCustId = String(order.customer_id).trim();
      if (ownerIds.includes(ordCustId)) {
        const canonicalActorId = String(user.id ?? user.sub ?? ordCustId).trim() || ordCustId;
        effectiveOrderForAccess = { ...effectiveOrderForAccess, customer_id: canonicalActorId };
      }
    }
    if (!canAccessPaymentOrder(c, effectiveOrderForAccess, true)) return c.json({ success: false, error: errMsg.forbidden[locale] }, 403);
    const normalizedOrderStatus = String(order.status || '').trim().toLowerCase();
    if (['cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired'].includes(normalizedOrderStatus)) {
      return c.json({ success: false, error: `Cannot pay for ${order.status} order` }, 409);
    }
    if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return c.json({
        success: false,
        error: errMsg.already_paid[locale],
        ...(order.payment_status === 'paid' ? { code: 'ORDER_ALREADY_PAID', orderId: order.id } : {}),
      }, 409);
    }
    if (order.payment_method !== 'payos') {
      return c.json({ success: false, error: 'PayOS payment links are only available for PayOS orders' }, 409);
    }
    const amount = Number(order.total);
    if (!Number.isSafeInteger(amount) || amount < 1000) return c.json({ success: false, error: errMsg.invalid_total[locale] }, 400);
    if (parsed.data.amount !== undefined && parsed.data.amount !== amount) {
      return c.json({ success: false, error: 'Tampered amount: does not match order total' }, 400);
    }
    const merchantConfig = await resolveMerchantPaymentConfig(db, c.env as any, orderTenant);
    const clientId = merchantConfig.payos?.clientId;
    const apiKey = merchantConfig.payos?.apiKey;
    const checksumKey = merchantConfig.payos?.checksumKey;
    if (!clientId || !apiKey || !checksumKey) {
      return c.json(
        {
          success: false,
          code: 'merchant_payos_not_configured',
          error:
            orderTenant === 'default'
              ? errMsg.payos_not_configured[locale]
              : 'Quán chưa cấu hình cổng thanh toán PayOS riêng. Vui lòng thiết lập PayOS trong Cài đặt Thanh toán hoặc dùng VietQR.',
        },
        orderTenant === 'default' ? 500 : 400
      );
    }
    const baseUrl = c.env.FE_BASE_URL || 'https://auraspace.cafe';
    const callerRole = String(user?.role || '').trim().toLowerCase();
    const canOverridePosRedirect = Boolean(user) && (callerRole === 'super_admin' || PAYMENT_ROLES.includes(callerRole));
    if (parsed.data.regenerate === true && !canOverridePosRedirect) {
      const regenGate = await checkAndRecordGuestRegenerate(db, c.env.AUTH_KV ?? null, orderTenant, order_id);
      if (!regenGate.allowed) {
        c.header('Retry-After', String(regenGate.retryAfterSeconds));
        return c.json(
          {
            success: false,
            code: 'PAYOS_REGENERATE_RATE_LIMITED',
            error:
              locale === 'en'
                ? 'Too many QR regeneration requests. Please wait before trying again.'
                : 'Bạn đã yêu cầu tạo lại mã QR quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.',
            retryable: regenGate.reason === 'cooldown',
            retryAfter: regenGate.retryAfterSeconds,
          },
          429,
        );
      }
    }
    const safePosReturnUrl = canOverridePosRedirect ? resolveSafePosRedirectUrl(requestedReturnUrl, baseUrl) : null;
    const safePosCancelUrl = canOverridePosRedirect ? resolveSafePosRedirectUrl(requestedCancelUrl, baseUrl) : null;
    // Resolve a trusted storefront slug for non-default tenants so redirect URLs never
    // leak flagship or cross-tenant paths. Default tenant keeps flagship URLs unchanged.
    let returnUrl: string;
    let cancelUrl: string;
    if (orderTenant === 'default') {
      returnUrl = safePosReturnUrl ?? `${baseUrl}/order-success?order_id=${encodeURIComponent(order_id)}`;
      cancelUrl = safePosCancelUrl ?? `${baseUrl}/checkout?cancelled=true&order_id=${encodeURIComponent(order_id)}`;
    } else {
      let slug: string | null = null;
      try {
        const row = await db
          .prepare(`SELECT slug FROM saas_tenants WHERE id = ? LIMIT 1`)
          .bind(orderTenant)
          .first<{ slug: string }>();
        const candidate = typeof row?.slug === 'string' ? row.slug.trim().toLowerCase() : '';
        slug = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(candidate) ? candidate : null;
      } catch {
        slug = null;
      }
      if (!slug) {
        return c.json(
          {
            success: false,
            code: 'tenant_slug_not_found',
            error: 'Không tìm thấy slug cửa hàng để quay lại sau thanh toán.',
          },
          404
        );
      }
      const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, '');
      const orderIdParam = encodeURIComponent(order_id);
      returnUrl = safePosReturnUrl ?? `${normalizedBaseUrl}/s/${encodeURIComponent(slug)}?order_id=${orderIdParam}&payment=success`;
      cancelUrl = safePosCancelUrl ?? `${normalizedBaseUrl}/s/${encodeURIComponent(slug)}?order_id=${orderIdParam}&payment=cancelled`;
    }
    const result = await getOrCreatePayOSAttempt({ db, kv: c.env.AUTH_KV ?? null, env: c.env as unknown as Record<string, unknown>, orderId: order_id, amount, clientId, apiKey, checksumKey,
      description: (description || `Order #${order_id}`).slice(0, 25), buyerName: customer_name || 'Khách hàng',
      returnUrl,
      cancelUrl,
      tenantId: orderTenant,
      regenerate: parsed.data.regenerate === true,
      locale,
    });
    if (result.ok === false) {
      if (result.status === 202) c.header('Retry-After', '2');
      return c.json({
        success: false,
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.orderId ? { orderId: result.orderId } : {}),
        orderCode: result.payment?.transaction_id,
        retryable: result.status === 202 || result.status === 502,
      }, result.status);
    }
    const { payment, cached, qrCode } = result;
    const resolvedQrCode = qrCode ?? null;
    if (openApi) return c.json({ success: true, data: {
      paymentId: payment.id, paymentUrl: payment.payment_url, qrCodeUrl: resolvedQrCode, qrCode: resolvedQrCode, deeplink: null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), status: 'pending',
    } }, 201);
    return c.json({
      success: true,
      checkoutUrl: payment.payment_url,
      checkout_url: payment.payment_url,
      qrCode: resolvedQrCode,
      qr_code: resolvedQrCode,
      qrCodeUrl: resolvedQrCode,
      orderCode: Number(payment.transaction_id),
      paymentId: payment.id,
      cached,
    });
  } catch (err) {
    log.error('PayOS create-link error:', { message: (err as Error).message });
    return c.json({ success: false, error: errMsg.internal_error[locale] }, 500);
  }
};

paymentRouter.post('/create-link', optionalAuth() as any, (c) => handleCreateLink(c));
paymentRouter.post('/payos/create', optionalAuth() as any, (c) => handleCreateLink(c));
