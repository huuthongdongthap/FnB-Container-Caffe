/**
 * Self-Serve SaaS Commercial Routes (v3).
 *
 * Mounts under `/api/saas`:
 * - Public:
 *   - GET  /plans                    -> Canonical Starter/Pro/Chain catalog (monthly + annual 20% off)
 *   - GET  /templates                -> 4 F&B storefront templates
 *   - GET  /check-slug               -> Slug availability check
 *   - POST /signup                   -> Atomic D1 batch tenant provisioning + owner JWT issuance
 *   - GET  /storefront/:slug         -> Clean tenant storefront branding + public catalog (no AURA fallback)
 * - Authenticated Tenant Owner/Admin:
 *   - GET  /me                       -> Current tenant profile, entitlement, usage, branding, payment summary
 *   - PATCH /branding                -> Update tenant branding (displayName, tagline, colors, logo, receiptFooter)
 *   - GET  /payment-config           -> Masked view of merchant payment config (never leaks raw secrets)
 *   - PUT  /payment-config           -> Save VietQR or AES-256-GCM encrypted PayOS credentials
 *   - POST /payment-config/test      -> Verify merchant PayOS/VietQR configuration
 *   - GET  /domains                  -> List custom domains for tenant
 *   - POST /domains                  -> Register custom domain & generate DNS TXT token (Pro/Chain)
 *   - POST /domains/:id/verify       -> Verify DNS TXT record via Cloudflare DoH
 *   - DELETE /domains/:id            -> Remove custom domain
 *   - GET  /billing/status           -> Subscription status, lifecycle, invoices
 *   - POST /billing/checkout         -> Create platform SaaS subscription invoice + PayOS link / VietQR
 *   - GET  /export                   -> Download tenant data export (always allowed even in readonly!)
 */

import { Hono, type Context } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId, isHQSuperAdmin, tenantMiddleware } from '../middleware/tenant';
import { issueStaffSession, loadStaffAccount } from '../lib/staff-session';
import {
  SAAS_PLAN_LIST,
  SAAS_PLANS,
  calculatePlanAmountVnd,
  normalizeBillingCycle,
  normalizeSaasPlanId,
} from '../lib/saas-plans';
import { SAAS_TEMPLATE_LIST } from '../lib/saas-templates';
import {
  assertTenantFeature,
  getTenantEntitlement,
} from '../lib/saas-entitlement';
import {
  ProvisionError,
  isSlugAvailable,
  provisionSelfServeTenant,
} from '../lib/saas-provisioning';
import {
  computeHmacSha256Hex,
  encryptTenantSecret,
  maskSecretValue,
  verifyPayosSignature,
} from '../lib/tenant-secrets';
import { buildVietQrImageUrl, resolveMerchantPaymentConfig } from '../lib/merchant-payment';
import { buildMerchantPayosWebhookUrls } from '../lib/saas-webhook-url';
import { updateMRRSnapshot } from '../tree/subscriptions/mrr-calculator';
import { settleSubscriptionInvoiceByPayOS } from '../tree/subscriptions/saas-payos-subscription-settlement';

const PAYOS_API_URL = 'https://api-merchant.payos.vn/v2/payment-requests';
const PENDING_DOMAIN_CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

function isValidDomain(domain: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain);
}

function isAllowedCustomDomain(domain: string, platformDomainRaw?: string): boolean {
  if (!isValidDomain(domain)) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) return false;
  if (
    domain === 'localhost' ||
    domain.endsWith('.localhost') ||
    domain.endsWith('.local') ||
    domain.endsWith('.internal') ||
    domain.endsWith('.workers.dev') ||
    domain.endsWith('.pages.dev')
  ) {
    return false;
  }
  const blockedBases = new Set<string>(['auraspace.cafe']);
  const cleanPlatform = String(platformDomainRaw || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
  if (cleanPlatform) blockedBases.add(cleanPlatform);
  for (const base of blockedBases) {
    if (domain === base || domain.endsWith(`.${base}`)) {
      return false;
    }
  }
  return true;
}

function isSafeLogoUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function verifyDnsTxtRecord(domain: string, expectedToken: string): Promise<{ verified: boolean; records: string[]; error?: string }> {
  const txtHost = `_aura-verify.${domain}`;
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(txtHost)}&type=TXT`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(5000) : undefined,
      }
    );
    if (!res.ok) {
      return { verified: false, records: [], error: `DNS lookup HTTP ${res.status}` };
    }
    const json = (await res.json()) as { Answer?: Array<{ data?: string }> };
    const records = (json.Answer || [])
      .map((a) => String(a.data || '').replace(/"\s+"/g, '').replace(/^"|"$/g, '').trim())
      .filter(Boolean);
    const matched = records.some((r) => r === expectedToken);
    return { verified: matched, records };
  } catch (err) {
    return {
      verified: false,
      records: [],
      error: err instanceof Error ? err.message : 'DNS lookup failed',
    };
  }
}

type SaasRouterEnv = {
  Bindings: Env;
  Variables: {
    tenantId?: string;
    user?: { id: string; email: string; role: string; tenantId?: string; name?: string };
  };
};

export function createSaasCommercialRoutes() {
  const router = new Hono<SaasRouterEnv>();

  // =====================================================
  // PUBLIC ROUTES
  // =====================================================

  router.get('/plans', (c) => {
    return c.json({
      success: true,
      data: {
        trialDays: 14,
        graceDays: 3,
        annualDiscountPercent: 20,
        plans: SAAS_PLAN_LIST,
      },
    });
  });

  router.get('/templates', (c) => {
    return c.json({
      success: true,
      data: {
        templates: SAAS_TEMPLATE_LIST.map((t) => ({
          id: t.id,
          nameVi: t.nameVi,
          descriptionVi: t.descriptionVi,
          defaultTagline: t.defaultTagline,
          primaryColor: t.primaryColor,
          accentColor: t.accentColor,
          counts: {
            categories: t.categories.length,
            products: t.products.length,
            tables: t.tables.length,
            shifts: t.shifts.length,
          },
        })),
      },
    });
  });

  router.get('/check-slug', async (c) => {
    const raw = c.req.query('slug') || '';
    const result = await isSlugAvailable(c.env.AURA_DB, raw);
    return c.json({ success: true, data: result });
  });

  router.post('/signup', async (c) => {
    try {
      const kv = c.env.AUTH_KV;
      const isProd = c.env.ENVIRONMENT === 'production';
      const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '';
      if (kv && clientIp && (isProd || (clientIp !== '127.0.0.1' && clientIp !== 'localhost'))) {
        const rateKey = `rate:saas-signup:${clientIp}`;
        try {
          const count = Number((await kv.get(rateKey)) || 0);
          if (count >= 10) {
            return c.json(
              { success: false, code: 'rate_limited', error: 'Quá nhiều lượt đăng ký từ IP này. Vui lòng thử lại sau 15 phút.' },
              429
            );
          }
          await kv.put(rateKey, String(count + 1), { expirationTtl: 900 });
        } catch {
          // Fail open on transient KV errors
        }
      }

      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const rawLogoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : undefined;
      if (rawLogoUrl && !isSafeLogoUrl(rawLogoUrl)) {
        return c.json(
          { success: false, code: 'invalid_logo_url', error: 'URL logo không hợp lệ (chỉ chấp nhận https://, http:// hoặc đường dẫn tương đối /...).' },
          400
        );
      }

      const result = await provisionSelfServeTenant(c.env.AURA_DB, {
        shopName: String(body.shopName || body.shop_name || ''),
        slug: String(body.slug || ''),
        ownerName: String(body.ownerName || body.owner_name || ''),
        ownerEmail: String(body.ownerEmail || body.owner_email || body.email || ''),
        ownerPhone: String(body.ownerPhone || body.owner_phone || body.phone || ''),
        password: String(body.password || ''),
        templateId: typeof body.templateId === 'string' ? body.templateId : (body.template_id as string | undefined),
        planId: typeof body.planId === 'string' ? body.planId : (body.plan_id as string | undefined),
        address: typeof body.address === 'string' ? body.address : '',
        primaryColor: typeof body.primaryColor === 'string' ? body.primaryColor : undefined,
        accentColor: typeof body.accentColor === 'string' ? body.accentColor : undefined,
        logoUrl: rawLogoUrl,
        attribution: body.attribution && typeof body.attribution === 'object'
          ? (body.attribution as Record<string, string>)
          : undefined,
      });

      let token: string | null = null;
      if (c.env.JWT_SECRET) {
        const accountRes = await loadStaffAccount(c.env.AURA_DB, result.ownerId);
        if (accountRes.ok) {
          const issued = await issueStaffSession(c.env, accountRes.account, {
            email: result.ownerEmail,
            sessionType: 'staff-web',
          });
          token = issued.token;
        }
      }

      return c.json(
        {
          success: true,
          data: {
            ...result,
            seeded: result.seededCounts,
            storefrontPath: `/s/${result.slug}`,
            token,
          },
        },
        201
      );
    } catch (err) {
      if (err instanceof ProvisionError) {
        return c.json({ success: false, code: err.code, error: err.message }, err.status);
      }
      return c.json(
        { success: false, code: 'signup_error', error: 'Không thể khởi tạo quán lúc này. Vui lòng thử lại sau.' },
        500
      );
    }
  });

  /**
   * Public Storefront Payload for `/s/:slug` — strictly isolated to that tenant.
   * Never falls back to flagship AURA branding, menu, or tables.
   */
  router.get('/storefront/:slug', async (c) => {
    const slug = String(c.req.param('slug') || '').trim().toLowerCase();
    const db = c.env.AURA_DB;

    const tenant = await db
      .prepare(
        `SELECT id, slug, name, tier, status, template_id, subdomain, trial_ends_at, current_period_end
         FROM saas_tenants
         WHERE LOWER(slug) = ? OR id = ?
         LIMIT 1`
      )
      .bind(slug, slug)
      .first<Record<string, unknown>>();

    if (!tenant) {
      return c.json({ success: false, code: 'store_not_found', error: 'Không tìm thấy cửa hàng.' }, 404);
    }

    const tenantId = String(tenant.id);
    const [branding, entitlement, categoriesRes, productsRes, tablesRes, paymentConfig] = await Promise.all([
      db.prepare('SELECT * FROM tenant_branding WHERE tenant_id = ? LIMIT 1').bind(tenantId).first<Record<string, unknown>>(),
      getTenantEntitlement(db, tenantId),
      db
        .prepare('SELECT id, name, slug, description, sort_order FROM categories WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1 ORDER BY sort_order ASC, name ASC')
        .bind(tenantId)
        .all(),
      db
        .prepare('SELECT id, category_id, name, slug, price, description, image_url, available, is_available, sort_order FROM products WHERE tenant_id = ? AND COALESCE(is_available, 1) = 1 ORDER BY sort_order ASC, name ASC')
        .bind(tenantId)
        .all(),
      db
        .prepare('SELECT id, code, name, zone, capacity, status FROM cafe_tables WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1 ORDER BY sort_order ASC, code ASC')
        .bind(tenantId)
        .all(),
      db
        .prepare(
          `SELECT provider, bank_bin, bank_account_no, bank_account_name, bank_name,
                  CASE
                    WHEN provider = 'payos'
                      AND payos_client_id_enc IS NOT NULL
                      AND payos_api_key_enc IS NOT NULL
                      AND payos_checksum_key_enc IS NOT NULL
                    THEN 1 ELSE 0
                  END AS has_payos_credentials
           FROM tenant_payment_configs
           WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1
           LIMIT 1`
        )
        .bind(tenantId)
        .first<Record<string, unknown>>(),
    ]);

    const hasBankTransfer = Boolean(paymentConfig?.bank_bin && paymentConfig?.bank_account_no);
    const hasPayos = Boolean(Number(paymentConfig?.has_payos_credentials || 0) === 1);

    return c.json({
      success: true,
      data: {
        tenant: {
          id: tenantId,
          slug: String(tenant.slug),
          name: String(tenant.name || branding?.display_name || slug),
          templateId: tenant.template_id || branding?.template_id || null,
          lifecycleState: entitlement.lifecycleState,
          isReadOnly: entitlement.isReadOnly,
        },
        branding: {
          displayName: String(branding?.display_name || tenant.name || slug),
          tagline: String(branding?.tagline || ''),
          logoUrl: String(branding?.logo_url || ''),
          primaryColor: String(branding?.primary_color || '#1F2937'),
          accentColor: String(branding?.accent_color || '#D97706'),
          address: String(branding?.address || ''),
          phone: String(branding?.phone || ''),
          receiptFooter: String(branding?.receipt_footer || ''),
        },
        payment: {
          provider: hasPayos ? 'payos' : 'vietqr',
          hasPayos,
          hasBankTransfer,
          bankName: paymentConfig?.bank_name ? String(paymentConfig.bank_name) : null,
          bankBin: hasBankTransfer ? String(paymentConfig?.bank_bin) : null,
          bankAccountNo: hasBankTransfer ? String(paymentConfig?.bank_account_no) : null,
          bankAccountName: hasBankTransfer && paymentConfig?.bank_account_name
            ? String(paymentConfig.bank_account_name)
            : null,
        },
        categories: categoriesRes.results || [],
        products: productsRes.results || [],
        tables: tablesRes.results || [],
      },
    });
  });

  // =====================================================
  // PLATFORM SAAS BILLING WEBHOOK (Platform PayOS -> activates subscription)
  // =====================================================

  router.post('/billing/webhook/payos', async (c) => {
    const db = c.env.AURA_DB;
    // STRICT ISOLATION: Platform SaaS billing NEVER falls back to flagship PAYOS_* credentials.
    const checksumKey = c.env.SAAS_PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      return c.json(
        {
          error: 1,
          code: 'saas_billing_not_configured',
          message: 'SAAS_PAYOS_CHECKSUM_KEY is not configured for platform SaaS billing',
        },
        503
      );
    }

    const payload = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data || !Object.keys(data).length) {
      return c.json({ error: 0, message: 'SaaS billing webhook alive', data: null });
    }

    const signature = String(payload.signature || c.req.header('x-payos-signature') || '');
    const validSig = await verifyPayosSignature(data, signature, checksumKey);
    if (!validSig) {
      return c.json({ error: 1, message: 'Invalid signature' }, 401);
    }

    const orderCode = String(data.orderCode || '');
    const amountPaid = Number(data.amount ?? NaN);
    const isPaid = payload.success === true && String(data.code || '') === '00';

    // Merchant subscription invoices (`subscription_invoices`) settle first: they share the
    // platform PayOS account and are identified by `payos:<orderCode>` in payment_ref.
    const subscriptionSettlement = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode,
      amountPaid,
      isPaid,
      nowIso: new Date().toISOString(),
    }).catch(() => null);
    if (subscriptionSettlement?.handled) {
      if (subscriptionSettlement.subscriptionAdvanced && subscriptionSettlement.tenantId) {
        await updateMRRSnapshot(db, subscriptionSettlement.tenantId).catch(() => {});
      }
      if (subscriptionSettlement.amountMismatch) {
        return c.json(
          { error: 1, code: 'amount_mismatch', message: subscriptionSettlement.message },
          409
        );
      }
      return c.json({ error: 0, message: subscriptionSettlement.message, data: null });
    }

    const invoice = await db
      .prepare('SELECT * FROM tenant_invoices WHERE payos_order_code = ? LIMIT 1')
      .bind(orderCode)
      .first<Record<string, unknown>>();

    if (!invoice) {
      return c.json({ error: 0, message: 'Unknown SaaS invoice, acknowledged', data: null });
    }

    if (String(invoice.status) === 'paid') {
      return c.json({ error: 0, message: 'Already processed', data: null });
    }

    if (!isPaid) {
      await db
        .prepare("UPDATE tenant_invoices SET status = 'failed', updated_at = ? WHERE id = ? AND status NOT IN ('paid', 'failed')")
        .bind(new Date().toISOString(), String(invoice.id))
        .run();
      return c.json({ error: 0, message: 'Marked failed', data: null });
    }

    const expectedAmountVnd = Number(invoice.amount_vnd);
    if (!Number.isFinite(amountPaid) || amountPaid !== expectedAmountVnd) {
      return c.json(
        {
          error: 1,
          code: 'amount_mismatch',
          message: `Amount mismatch: expected ${expectedAmountVnd}, received ${amountPaid}`,
        },
        409
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const invoiceId = String(invoice.id);
    const cycle = normalizeBillingCycle(String(invoice.billing_cycle || 'monthly'));
    const periodDays = cycle === 'annual' ? 365 : 30;
    const graceDays = periodDays + 3;
    const tenantId = String(invoice.tenant_id);
    const planId = normalizeSaasPlanId(String(invoice.tier));
    const auditId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // Execute all 4 state mutations in ONE atomic D1 batch transaction:
    // 1. Compute new period inside SQL from current DB state: max(now, current_period_end) + periodDays
    //    so concurrent valid invoices for the same tenant stack cleanly without lost updates.
    // 2. Gate every statement on `tenant_invoices.status != 'paid'` and mark `paid` as the final
    //    statement so duplicate deliveries are strict no-ops and any mid-batch failure rolls back
    //    the invoice back to `pending` for safe webhook retry.
    const batchResults = await db.batch([
      db
        .prepare(
          `WITH existing AS (
             SELECT COALESCE(
               (SELECT current_period_end FROM tenant_subscriptions WHERE tenant_id = ? LIMIT 1),
               (SELECT current_period_end FROM saas_tenants WHERE id = ? LIMIT 1)
             ) AS current_end
           ),
           calc AS (
             SELECT
               CASE
                 WHEN current_end IS NOT NULL AND julianday(current_end) > julianday(?)
                   THEN current_end
                 ELSE ?
               END AS base_ts
             FROM existing
           )
           INSERT INTO tenant_subscriptions (
             id, tenant_id, tier, billing_cycle, status,
             current_period_start, current_period_end, grace_ends_at, price_vnd, updated_at
           )
           SELECT
             ?, ?, ?, ?, 'active',
             ?,
             strftime('%Y-%m-%dT%H:%M:%fZ', calc.base_ts, ?),
             strftime('%Y-%m-%dT%H:%M:%fZ', calc.base_ts, ?),
             ?, ?
           FROM calc
           WHERE EXISTS (SELECT 1 FROM tenant_invoices WHERE id = ? AND status != 'paid')
           ON CONFLICT(tenant_id) DO UPDATE SET
             tier = excluded.tier,
             billing_cycle = excluded.billing_cycle,
             status = 'active',
             current_period_start = excluded.current_period_start,
             current_period_end = excluded.current_period_end,
             grace_ends_at = excluded.grace_ends_at,
             price_vnd = excluded.price_vnd,
             updated_at = excluded.updated_at`
        )
        .bind(
          tenantId,
          tenantId,
          nowIso,
          nowIso,
          `sub_${tenantId}`,
          tenantId,
          planId,
          cycle,
          nowIso,
          `+${periodDays} days`,
          `+${graceDays} days`,
          expectedAmountVnd,
          nowIso,
          invoiceId
        ),
      db
        .prepare(
          `UPDATE saas_tenants
           SET tier = ?,
               status = 'active',
               current_period_end = (SELECT current_period_end FROM tenant_subscriptions WHERE tenant_id = ? LIMIT 1),
               updated_at = ?
           WHERE id = ?
             AND EXISTS (SELECT 1 FROM tenant_invoices WHERE id = ? AND status != 'paid')`
        )
        .bind(planId, tenantId, nowIso, tenantId, invoiceId),
      db
        .prepare(
          `INSERT INTO saas_audit_logs (
             id, tenant_id, actor_user_id, actor_role, action, after_json, reason, created_at
           )
           SELECT
             ?, ?, 'payos-webhook', 'system', 'subscription_activated',
             json_object(
               'invoiceId', ?,
               'planId', ?,
               'cycle', ?,
               'amountVnd', ?,
               'periodEnd', (SELECT current_period_end FROM tenant_subscriptions WHERE tenant_id = ? LIMIT 1)
             ),
             ?, ?
           WHERE EXISTS (SELECT 1 FROM tenant_invoices WHERE id = ? AND status != 'paid')`
        )
        .bind(
          auditId,
          tenantId,
          invoiceId,
          planId,
          cycle,
          expectedAmountVnd,
          tenantId,
          'PayOS SaaS billing webhook confirmed',
          nowIso,
          invoiceId
        ),
      db
        .prepare(
          `UPDATE tenant_invoices
           SET status = 'paid', paid_at = ?, updated_at = ?
           WHERE id = ? AND status != 'paid'`
        )
        .bind(nowIso, nowIso, invoiceId),
    ]);

    const claimed = Number(batchResults[3]?.meta?.changes ?? 0);
    if (claimed !== 1) {
      return c.json({ error: 0, message: 'Already processed', data: null });
    }

    return c.json({ error: 0, message: 'SaaS subscription activated', data: null });
  });

  // =====================================================
  // AUTHENTICATED TENANT OWNER/ADMIN ROUTES
  // =====================================================

  router.use('/me', requireAuth(), tenantMiddleware);
  router.use('/branding', requireAuth(), tenantMiddleware);
  router.use('/payment-config/*', requireAuth(), tenantMiddleware);
  router.use('/payment-config', requireAuth(), tenantMiddleware);
  router.use('/payment-info', requireAuth(), tenantMiddleware);
  router.use('/domains/*', requireAuth(), tenantMiddleware);
  router.use('/domains', requireAuth(), tenantMiddleware);
  router.use('/billing/status', requireAuth(), tenantMiddleware);
  router.use('/billing/checkout', requireAuth(), tenantMiddleware);
  router.use('/export', requireAuth(), tenantMiddleware);

  function resolveScopedTenant(c: Context<SaasRouterEnv>): string {
    const user = c.get('user');
    if (user && !isHQSuperAdmin(user)) {
      const userTenant = String(user.tenantId || 'default').trim();
      return userTenant === '*' ? 'default' : userTenant || 'default';
    }
    const t = getTenantId(c as unknown as Context<{ Bindings: Env }>);
    return t === '*' ? 'default' : t;
  }

  function requireOwnerOrAdmin(c: Context<SaasRouterEnv>): Response | null {
    const user = c.get('user');
    const role = String(user?.role || '').toLowerCase();
    if (!['owner', 'admin', 'manager'].includes(role) && !isHQSuperAdmin(user)) {
      return c.json({ success: false, error: 'Chỉ chủ quán hoặc quản trị viên mới có quyền truy cập.' }, 403);
    }
    return null;
  }

  router.get('/me', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);

    const [tenant, entitlement, branding, tableCountRow, staffCountRow, paymentRow, domainsRes] =
      await Promise.all([
        db.prepare('SELECT * FROM saas_tenants WHERE id = ? LIMIT 1').bind(tenantId).first<Record<string, unknown>>(),
        getTenantEntitlement(db, tenantId),
        db.prepare('SELECT * FROM tenant_branding WHERE tenant_id = ? LIMIT 1').bind(tenantId).first<Record<string, unknown>>(),
        db
          .prepare('SELECT COUNT(*) AS cnt FROM cafe_tables WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1')
          .bind(tenantId)
          .first<{ cnt: number }>(),
        db
          .prepare('SELECT COUNT(*) AS cnt FROM users WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1')
          .bind(tenantId)
          .first<{ cnt: number }>(),
        db
          .prepare('SELECT provider, payos_client_id_enc, bank_bin, bank_account_no, bank_account_name, bank_name, is_active FROM tenant_payment_configs WHERE tenant_id = ? LIMIT 1')
          .bind(tenantId)
          .first<Record<string, unknown>>(),
        db
          .prepare('SELECT id, domain, status, verification_token, verified_at, created_at FROM tenant_domains WHERE tenant_id = ? ORDER BY created_at DESC')
          .bind(tenantId)
          .all(),
      ]);

    return c.json({
      success: true,
      data: {
        tenantId,
        tenant: tenant || { id: tenantId, slug: tenantId, name: tenantId === 'default' ? 'AURA Flagship' : tenantId },
        entitlement,
        usage: {
          tables: Number(tableCountRow?.cnt || 0),
          maxTables: entitlement.maxTables,
          staff: Number(staffCountRow?.cnt || 0),
          maxStaff: entitlement.maxStaff,
        },
        branding: branding || null,
        paymentSummary: {
          provider: paymentRow?.provider || 'vietqr',
          payosConfigured: Boolean(paymentRow?.payos_client_id_enc),
          vietqrConfigured: Boolean(paymentRow?.bank_bin && paymentRow?.bank_account_no),
          bankName: paymentRow?.bank_name || null,
          bankAccountNoMasked: maskSecretValue(paymentRow?.bank_account_no as string | null),
        },
        domains: domainsRes.results || [],
      },
    });
  });

  router.patch('/branding', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const nowIso = new Date().toISOString();

    const [existingBranding, existingTenant] = await Promise.all([
      db
        .prepare('SELECT display_name, tagline, logo_url, primary_color, accent_color, address, phone, receipt_footer FROM tenant_branding WHERE tenant_id = ? LIMIT 1')
        .bind(tenantId)
        .first<Record<string, unknown>>(),
      db
        .prepare('SELECT name FROM saas_tenants WHERE id = ? LIMIT 1')
        .bind(tenantId)
        .first<{ name?: string }>(),
    ]);

    const hasDisplayName = 'displayName' in body || 'display_name' in body || 'brandName' in body;
    const displayName = hasDisplayName
      ? String(body.displayName ?? body.display_name ?? body.brandName ?? '').trim()
      : String(existingBranding?.display_name ?? existingTenant?.name ?? '').trim();

    if (!displayName || displayName.length < 2) {
      return c.json({ success: false, error: 'Tên hiển thị quán phải có ít nhất 2 ký tự.' }, 400);
    }

    const tagline = 'tagline' in body
      ? String(body.tagline ?? '').trim()
      : String(existingBranding?.tagline ?? '');
    const hasLogoUrl = 'logoUrl' in body || 'logo_url' in body;
    const logoUrl = hasLogoUrl
      ? String(body.logoUrl ?? body.logo_url ?? '').trim()
      : String(existingBranding?.logo_url ?? '');
    if (logoUrl && !isSafeLogoUrl(logoUrl)) {
      return c.json(
        { success: false, code: 'invalid_logo_url', error: 'URL logo không hợp lệ (chỉ chấp nhận https://, http:// hoặc đường dẫn tương đối /...).' },
        400
      );
    }

    const existingPrimary = String(existingBranding?.primary_color ?? '#1F2937');
    const existingAccent = String(existingBranding?.accent_color ?? '#D97706');
    const rawPrimary = body.primaryColor ?? body.primary_color;
    const rawAccent = body.accentColor ?? body.accent_color;
    const primaryColor = typeof rawPrimary === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawPrimary)
      ? rawPrimary
      : existingPrimary;
    const accentColor = typeof rawAccent === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawAccent)
      ? rawAccent
      : existingAccent;

    const address = 'address' in body
      ? String(body.address ?? '').trim()
      : String(existingBranding?.address ?? '');
    const phone = 'phone' in body
      ? String(body.phone ?? '').trim()
      : String(existingBranding?.phone ?? '');
    const hasReceiptFooter = 'receiptFooter' in body || 'receipt_footer' in body;
    const receiptFooter = hasReceiptFooter
      ? String(body.receiptFooter ?? body.receipt_footer ?? '').trim()
      : String(existingBranding?.receipt_footer ?? '');

    await db
      .prepare(
        `INSERT INTO tenant_branding (
          tenant_id, display_name, tagline, logo_url, primary_color, accent_color,
          address, phone, receipt_footer, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          display_name = excluded.display_name,
          tagline = excluded.tagline,
          logo_url = excluded.logo_url,
          primary_color = excluded.primary_color,
          accent_color = excluded.accent_color,
          address = excluded.address,
          phone = excluded.phone,
          receipt_footer = excluded.receipt_footer,
          updated_at = excluded.updated_at`
      )
      .bind(tenantId, displayName, tagline, logoUrl, primaryColor, accentColor, address, phone, receiptFooter, nowIso, nowIso)
      .run();

    await db
      .prepare('UPDATE saas_tenants SET name = ?, updated_at = ? WHERE id = ?')
      .bind(displayName, nowIso, tenantId)
      .run();

    return c.json({ success: true, data: { tenantId, displayName, tagline, logoUrl, primaryColor, accentColor, address, phone, receiptFooter } });
  });

  // =====================================================
  // PER-TENANT MERCHANT PAYMENT CONFIG (AES-256-GCM)
  // =====================================================

  // Public merchant payment info for staff (cashier/waiter/manager/owner) — NO secrets
  router.get('/payment-info', async (c) => {
    const user = c.get('user');
    const role = String(user?.role || '').trim().toLowerCase();
    const allowedRoles = ['owner', 'admin', 'super_admin', 'manager', 'supervisor', 'cashier', 'waiter', 'staff'];
    if (!user || !allowedRoles.includes(role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);

    let row: Record<string, unknown> | null = null;
    try {
      row = await db
        .prepare(
          `SELECT provider, payos_client_id_enc, payos_api_key_enc, payos_checksum_key_enc,
                  bank_bin, bank_account_no, bank_account_name, bank_name
           FROM tenant_payment_configs
           WHERE tenant_id = ?
           LIMIT 1`
        )
        .bind(tenantId)
        .first<Record<string, unknown>>();
    } catch {
      row = null;
    }

    const hasFlagshipPayos =
      tenantId === 'default' &&
      Boolean(c.env.PAYOS_CLIENT_ID && c.env.PAYOS_API_KEY && c.env.PAYOS_CHECKSUM_KEY);
    const hasTenantPayos = Boolean(
      row?.payos_client_id_enc && row?.payos_api_key_enc && row?.payos_checksum_key_enc
    );
    const hasPayos = hasTenantPayos || hasFlagshipPayos;
    const provider = row?.provider
      ? String(row.provider)
      : hasFlagshipPayos
        ? 'payos'
        : 'vietqr';

    return c.json({
      success: true,
      data: {
        provider,
        hasPayos,
        bankBin: String(row?.bank_bin || ''),
        bankAccountNo: String(row?.bank_account_no || ''),
        bankAccountName: String(row?.bank_account_name || ''),
        bankName: String(row?.bank_name || ''),
      },
    });
  });

  router.get('/payment-config', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);

    const row = await db
      .prepare(
        `SELECT tenant_id, provider, payos_client_id_enc, payos_api_key_enc, payos_checksum_key_enc,
                key_version, bank_bin, bank_account_no, bank_account_name, bank_name, is_active, updated_at
         FROM tenant_payment_configs
         WHERE tenant_id = ?
         LIMIT 1`
      )
      .bind(tenantId)
      .first<Record<string, unknown>>();

    const tenantRow = await db
      .prepare('SELECT slug FROM saas_tenants WHERE id = ? LIMIT 1')
      .bind(tenantId)
      .first<{ slug: string }>();

    const webhookSlug = tenantRow?.slug || tenantId;
    const { webhookUrl, webhookUrlPath } = buildMerchantPayosWebhookUrls(c.env, webhookSlug);
    return c.json({
      success: true,
      data: {
        provider: row?.provider || 'vietqr',
        hasPayosCredentials: Boolean(
          row?.payos_client_id_enc && row?.payos_api_key_enc && row?.payos_checksum_key_enc
        ),
        keyVersion: Number(row?.key_version || 1),
        bankBin: row?.bank_bin || '',
        bankAccountNo: row?.bank_account_no || '',
        bankAccountName: row?.bank_account_name || '',
        bankName: row?.bank_name || '',
        webhookUrl,
        webhookUrlPath,
        updatedAt: row?.updated_at || null,
      },
    });
  });

  router.put('/payment-config', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);
    const user = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const provider = String(body.provider || 'vietqr').toLowerCase() === 'payos' ? 'payos' : 'vietqr';

    if (provider === 'payos') {
      const featureCheck = await assertTenantFeature(db, tenantId, 'payos');
      if (!featureCheck.allowed) {
        return c.json(
          { success: false, code: featureCheck.code, error: featureCheck.message },
          featureCheck.status || 403
        );
      }
    }

    const bankBin = String(body.bankBin || body.bank_bin || '').trim();
    const bankAccountNo = String(body.bankAccountNo || body.bank_account_no || '').trim();
    const bankAccountName = String(body.bankAccountName || body.bank_account_name || '').trim();
    const bankName = String(body.bankName || body.bank_name || '').trim();

    const payosClientId = String(body.payosClientId || body.payos_client_id || '').trim();
    const payosApiKey = String(body.payosApiKey || body.payos_api_key || '').trim();
    const payosChecksumKey = String(body.payosChecksumKey || body.payos_checksum_key || '').trim();

    let clientIdEnc: string | null = null;
    let apiKeyEnc: string | null = null;
    let checksumKeyEnc: string | null = null;

    if (payosClientId || payosApiKey || payosChecksumKey) {
      if (!payosClientId || !payosApiKey || !payosChecksumKey) {
        return c.json(
          { success: false, error: 'Vui lòng nhập đầy đủ PayOS Client ID, API Key và Checksum Key.' },
          400
        );
      }
      if (!c.env.TENANT_SECRETS_KEY) {
        return c.json(
          { success: false, error: 'Hệ thống chưa cấu hình TENANT_SECRETS_KEY để mã hóa khóa thanh toán.' },
          500
        );
      }
      [clientIdEnc, apiKeyEnc, checksumKeyEnc] = await Promise.all([
        encryptTenantSecret(payosClientId, c.env.TENANT_SECRETS_KEY, 1, `${tenantId}:payos_client_id`),
        encryptTenantSecret(payosApiKey, c.env.TENANT_SECRETS_KEY, 1, `${tenantId}:payos_api_key`),
        encryptTenantSecret(payosChecksumKey, c.env.TENANT_SECRETS_KEY, 1, `${tenantId}:payos_checksum_key`),
      ]);
    }

    const nowIso = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO tenant_payment_configs (
          tenant_id, provider, payos_client_id_enc, payos_api_key_enc, payos_checksum_key_enc,
          key_version, bank_bin, bank_account_no, bank_account_name, bank_name, is_active, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          provider = excluded.provider,
          payos_client_id_enc = COALESCE(excluded.payos_client_id_enc, tenant_payment_configs.payos_client_id_enc),
          payos_api_key_enc = COALESCE(excluded.payos_api_key_enc, tenant_payment_configs.payos_api_key_enc),
          payos_checksum_key_enc = COALESCE(excluded.payos_checksum_key_enc, tenant_payment_configs.payos_checksum_key_enc),
          bank_bin = excluded.bank_bin,
          bank_account_no = excluded.bank_account_no,
          bank_account_name = excluded.bank_account_name,
          bank_name = excluded.bank_name,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at`
      )
      .bind(
        tenantId,
        provider,
        clientIdEnc,
        apiKeyEnc,
        checksumKeyEnc,
        bankBin || null,
        bankAccountNo || null,
        bankAccountName || null,
        bankName || null,
        user?.id || null,
        nowIso,
        nowIso
      )
      .run();

    return c.json({
      success: true,
      data: {
        provider,
        payosSaved: Boolean(clientIdEnc),
        vietqrSaved: Boolean(bankBin && bankAccountNo),
      },
    });
  });

  router.post('/payment-config/test', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const tenantId = resolveScopedTenant(c);
    const resolved = await resolveMerchantPaymentConfig(c.env.AURA_DB, c.env, tenantId);

    if (resolved.provider === 'unconfigured') {
      return c.json({
        success: false,
        error: 'Chưa cấu hình tài khoản ngân hàng VietQR hoặc khóa PayOS.',
      }, 400);
    }

    if (resolved.provider === 'vietqr' && resolved.vietqr) {
      const sampleQr = buildVietQrImageUrl({
        bankBin: resolved.vietqr.bankBin,
        bankAccountNo: resolved.vietqr.bankAccountNo,
        bankAccountName: resolved.vietqr.bankAccountName,
        amountVnd: 10_000,
        description: `TEST ${tenantId.slice(0, 10)}`,
      });
      return c.json({
        success: true,
        data: {
          provider: 'vietqr',
          verified: true,
          sampleQrUrl: sampleQr,
          message: 'Cấu hình VietQR hợp lệ. Tiền khách chuyển sẽ về trực tiếp tài khoản của quán.',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        provider: 'payos',
        verified: Boolean(resolved.payos?.clientId && resolved.payos?.apiKey && resolved.payos?.checksumKey),
        clientIdMasked: maskSecretValue(resolved.payos?.clientId),
        message: 'Đã giải mã và xác thực cấu trúc khóa PayOS riêng của quán thành công.',
      },
    });
  });

  // =====================================================
  // CUSTOM DOMAINS + DNS TXT VERIFICATION
  // =====================================================

  router.get('/domains', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const tenantId = resolveScopedTenant(c);
    const rows = await c.env.AURA_DB
      .prepare('SELECT id, domain, verification_token, status, verified_at, created_at FROM tenant_domains WHERE tenant_id = ? ORDER BY created_at DESC')
      .bind(tenantId)
      .all();
    return c.json({ success: true, data: { domains: rows.results || [] } });
  });

  router.post('/domains', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);

    const featureCheck = await assertTenantFeature(db, tenantId, 'custom_domain');
    if (!featureCheck.allowed) {
      return c.json({ success: false, code: featureCheck.code, error: featureCheck.message }, featureCheck.status || 403);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const domain = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!isAllowedCustomDomain(domain, c.env.SAAS_PLATFORM_DOMAIN)) {
      return c.json(
        { success: false, code: 'invalid_or_reserved_domain', error: 'Tên miền không hợp lệ hoặc thuộc miền dành riêng của nền tảng (ví dụ hợp lệ: order.quancuaban.vn).' },
        400
      );
    }

    const existing = await db
      .prepare('SELECT id, tenant_id, status, created_at FROM tenant_domains WHERE LOWER(domain) = ? LIMIT 1')
      .bind(domain)
      .first<{ id: string; tenant_id: string; status: string; created_at: string }>();
    if (existing) {
      const isStaleOtherTenantClaim =
        existing.tenant_id !== tenantId &&
        existing.status !== 'verified' &&
        Number.isFinite(Date.parse(existing.created_at)) &&
        Date.now() - Date.parse(existing.created_at) > PENDING_DOMAIN_CLAIM_TTL_MS;
      if (isStaleOtherTenantClaim) {
        await db.prepare("DELETE FROM tenant_domains WHERE id = ? AND status != 'verified'").bind(existing.id).run();
      } else {
        return c.json({ success: false, error: 'Tên miền này đã được đăng ký.' }, 409);
      }
    }

    const id = `dom_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const token = `aura-verify=${crypto.randomUUID().replace(/-/g, '')}`;
    const nowIso = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO tenant_domains (id, tenant_id, domain, verification_token, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`
      )
      .bind(id, tenantId, domain, token, nowIso, nowIso)
      .run();

    return c.json(
      {
        success: true,
        data: {
          id,
          domain,
          status: 'pending',
          verificationToken: token,
          dnsInstruction: {
            recordType: 'TXT',
            host: `_aura-verify.${domain}`,
            value: token,
          },
        },
      },
      201
    );
  });

  router.post('/domains/:id/verify', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);
    const id = c.req.param('id');

    const featureCheck = await assertTenantFeature(db, tenantId, 'custom_domain');
    if (!featureCheck.allowed) {
      return c.json({ success: false, code: featureCheck.code, error: featureCheck.message }, featureCheck.status || 403);
    }

    const row = await db
      .prepare('SELECT id, domain, verification_token, status FROM tenant_domains WHERE id = ? AND tenant_id = ? LIMIT 1')
      .bind(id, tenantId)
      .first<{ id: string; domain: string; verification_token: string; status: string }>();

    if (!row) {
      return c.json({ success: false, error: 'Không tìm thấy tên miền.' }, 404);
    }

    const dnsResult = await verifyDnsTxtRecord(row.domain, row.verification_token);
    const nowIso = new Date().toISOString();
    if (dnsResult.verified) {
      await db
        .prepare("UPDATE tenant_domains SET status = 'verified', verified_at = ?, updated_at = ? WHERE id = ?")
        .bind(nowIso, nowIso, row.id)
        .run();
      return c.json({
        success: true,
        data: { id: row.id, domain: row.domain, status: 'verified', verifiedAt: nowIso },
      });
    }

    return c.json(
      {
        success: false,
        code: 'dns_txt_not_found',
        error: `Chưa tìm thấy bản ghi TXT "${row.verification_token}" tại _aura-verify.${row.domain}.`,
        recordsFound: dnsResult.records,
      },
      422
    );
  });

  router.delete('/domains/:id', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const tenantId = resolveScopedTenant(c);
    const id = c.req.param('id');
    await c.env.AURA_DB
      .prepare('DELETE FROM tenant_domains WHERE id = ? AND tenant_id = ?')
      .bind(id, tenantId)
      .run();
    return c.json({ success: true });
  });

  // =====================================================
  // SAAS BILLING & CHECKOUT (Platform subscription fees)
  // =====================================================

  router.get('/billing/status', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);

    const [entitlement, invoicesRes] = await Promise.all([
      getTenantEntitlement(db, tenantId),
      db
        .prepare('SELECT id, tier, billing_cycle, amount_vnd, status, payos_order_code, checkout_url, paid_at, created_at FROM tenant_invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20')
        .bind(tenantId)
        .all(),
    ]);

    return c.json({
      success: true,
      data: {
        entitlement,
        plans: SAAS_PLAN_LIST,
        invoices: invoicesRes.results || [],
      },
    });
  });

  router.post('/billing/checkout', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

    const planId = normalizeSaasPlanId(String(body.planId || body.tier || 'pro'));
    const cycle = normalizeBillingCycle(String(body.billingCycle || body.billing_cycle || 'monthly'));
    // STRICT SERVER-SIDE PRICING: client-sent amount is ignored.
    const amountVnd = calculatePlanAmountVnd(planId, cycle);

    // STRICT ISOLATION: Platform SaaS checkout NEVER falls back to flagship PAYOS_* credentials.
    const saasClientId = c.env.SAAS_PAYOS_CLIENT_ID;
    const saasApiKey = c.env.SAAS_PAYOS_API_KEY;
    const saasChecksumKey = c.env.SAAS_PAYOS_CHECKSUM_KEY;

    if (!saasClientId || !saasApiKey || !saasChecksumKey) {
      return c.json(
        {
          success: false,
          code: 'saas_billing_not_configured',
          error: 'Cổng thanh toán phí SaaS nền tảng (SAAS_PAYOS_*) chưa được cấu hình.',
        },
        503
      );
    }

    const invoiceId = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const randBuf = new Uint32Array(1);
    crypto.getRandomValues(randBuf);
    const randomSuffix = String(10000 + (randBuf[0] % 90000));
    const payosOrderCode = Number(`${Date.now().toString().slice(-8)}${randomSuffix}`);
    const nowIso = new Date().toISOString();
    let checkoutUrl: string | null = null;
    let qrCode: string | null = null;

    // Persist pending invoice before invoking PayOS so rapid payment webhooks never race ahead of the DB row.
    await db
      .prepare(
        `INSERT INTO tenant_invoices (
          id, tenant_id, tier, billing_cycle, amount_vnd, status, payos_order_code, checkout_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?)`
      )
      .bind(invoiceId, tenantId, planId, cycle, amountVnd, String(payosOrderCode), nowIso, nowIso)
      .run();

    const cleanupPendingInvoice = async () => {
      await db
        .prepare("DELETE FROM tenant_invoices WHERE id = ? AND status = 'pending'")
        .bind(invoiceId)
        .run()
        .catch(() => {});
    };

    {
      const baseUrl = c.env.FE_BASE_URL || 'https://auraspace.cafe';
      const returnUrl = `${baseUrl}/admin/saas-settings?tab=billing&invoice=${invoiceId}&status=paid`;
      const cancelUrl = `${baseUrl}/admin/saas-settings?tab=billing&invoice=${invoiceId}&status=cancelled`;
      const description = `SAAS ${planId.toUpperCase()} ${cycle === 'annual' ? '1Y' : '1M'}`.slice(0, 25);
      const rawSig = `amount=${amountVnd}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${payosOrderCode}&returnUrl=${returnUrl}`;
      const signature = await computeHmacSha256Hex(saasChecksumKey, rawSig);

      try {
        const res = await fetch(PAYOS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': saasClientId,
            'x-api-key': saasApiKey,
          },
          body: JSON.stringify({
            orderCode: payosOrderCode,
            amount: amountVnd,
            description,
            returnUrl,
            cancelUrl,
            signature,
          }),
        });
        if (!res.ok) {
          await cleanupPendingInvoice();
          return c.json(
            {
              success: false,
              code: 'saas_payos_gateway_error',
              error: `Không thể tạo liên kết thanh toán PayOS (HTTP ${res.status}). Vui lòng thử lại.`,
            },
            502
          );
        }
        const json = (await res.json()) as { code?: string; desc?: string; data?: { checkoutUrl?: string; qrCode?: string } };
        if (json.code !== '00' || !json.data?.checkoutUrl) {
          await cleanupPendingInvoice();
          return c.json(
            {
              success: false,
              code: 'saas_payos_gateway_error',
              error: json.desc || 'Cổng thanh toán PayOS từ chối tạo liên kết thanh toán. Vui lòng thử lại.',
            },
            502
          );
        }
        checkoutUrl = json.data.checkoutUrl;
        qrCode = json.data.qrCode || null;
      } catch {
        await cleanupPendingInvoice();
        return c.json(
          {
            success: false,
            code: 'saas_payos_gateway_unreachable',
            error: 'Không thể kết nối cổng thanh toán PayOS. Vui lòng thử lại sau ít phút.',
          },
          502
        );
      }
    }

    await db
      .prepare('UPDATE tenant_invoices SET checkout_url = ?, updated_at = ? WHERE id = ?')
      .bind(checkoutUrl, new Date().toISOString(), invoiceId)
      .run();

    return c.json(
      {
        success: true,
        data: {
          invoiceId,
          planId,
          planName: SAAS_PLANS[planId].name,
          billingCycle: cycle,
          amountVnd,
          payosOrderCode: String(payosOrderCode),
          checkoutUrl,
          qrCode,
        },
      },
      201
    );
  });

  // =====================================================
  // TENANT DATA EXPORT (Always allowed even in readonly!)
  // =====================================================

  router.get('/export', async (c) => {
    const denied = requireOwnerOrAdmin(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantId = resolveScopedTenant(c);

    const [categories, products, tables, orders, customers] = await Promise.all([
      db.prepare('SELECT * FROM categories WHERE tenant_id = ?').bind(tenantId).all(),
      db.prepare('SELECT * FROM products WHERE tenant_id = ?').bind(tenantId).all(),
      db.prepare('SELECT * FROM cafe_tables WHERE tenant_id = ?').bind(tenantId).all(),
      db.prepare('SELECT id, order_number, table_number, status, total, payment_method, payment_status, created_at FROM orders WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1000').bind(tenantId).all(),
      db.prepare('SELECT id, name, phone, email, loyalty_points, tier, created_at FROM customers WHERE tenant_id = ? LIMIT 1000').bind(tenantId).all(),
    ]);

    return c.json({
      success: true,
      exportedAt: new Date().toISOString(),
      tenantId,
      data: {
        categories: categories.results || [],
        products: products.results || [],
        tables: tables.results || [],
        orders: orders.results || [],
        customers: customers.results || [],
      },
    });
  });

  return router;
}
