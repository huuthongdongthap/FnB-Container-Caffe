/**
 * HQ SaaS Platform Admin Routes (`/api/hq/saas`).
 *
 * Strictly restricted to HQ Super-Admins (`isHQSuperAdmin(user)`).
 * Provides:
 * - GET  /overview                      -> KPIs: active tenants, MRR, trial conversion, grace/readonly counts
 * - GET  /tenants                       -> Filterable list of all tenants with usage & subscription state
 * - POST /tenants/:id/extend-trial      -> Extend trial by N days + audit log
 * - POST /tenants/:id/override-tier     -> Change plan/status manually + audit log
 * - POST /tenants/:id/suspend           -> Toggle suspension / readonly + audit log
 * - GET  /audit-logs                    -> Recent SaaS commercial audit trail
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { isHQSuperAdmin } from '../middleware/tenant';
import { addDaysIso, resolveTenantLifecycle } from '../lib/saas-entitlement';
import { normalizeSaasPlanId, SAAS_PLANS } from '../lib/saas-plans';

export interface TenantAttributionSummary {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string | null;
  captured_at: string | null;
}

const ACTIVATION_MIN_PRODUCTS = 5;
const ACTIVATION_MIN_ORDERS_7D = 3;
const MS_PER_24H = 24 * 60 * 60 * 1000;

function parseTenantAttribution(configJson: unknown): TenantAttributionSummary | null {
  if (typeof configJson !== 'string' || !configJson.trim()) return null;
  try {
    const parsed = JSON.parse(configJson) as { attribution?: Record<string, unknown> };
    const attr = parsed?.attribution;
    if (!attr || typeof attr !== 'object' || Array.isArray(attr)) return null;
    const pick = (key: string): string | null => {
      const val = attr[key];
      return typeof val === 'string' && val.trim() ? val.trim() : null;
    };
    const summary: TenantAttributionSummary = {
      utm_source: pick('utm_source'),
      utm_medium: pick('utm_medium'),
      utm_campaign: pick('utm_campaign'),
      utm_content: pick('utm_content'),
      utm_term: pick('utm_term'),
      landing_path: pick('landing_path'),
      captured_at: pick('captured_at'),
    };
    if (!Object.values(summary).some(Boolean)) return null;
    return summary;
  } catch {
    return null;
  }
}

function isPlatformControlTenant(id: string): boolean {
  const clean = id.trim().toLowerCase();
  return clean === 'default' || clean === 'hq' || clean === '*';
}

export function createHqSaasRoutes() {
  const router = new Hono<{
    Bindings: Env;
    Variables: {
      user?: { id: string; email: string; role: string; tenantId?: string };
    };
  }>();

  router.use('/*', requireAuth());
  router.use('/*', async (c, next) => {
    if (!isHQSuperAdmin(c.get('user'))) {
      return c.json({ success: false, error: 'HQ Super-Admin access required' }, 403);
    }
    return next();
  });

  router.get('/overview', async (c) => {
    const db = c.env.AURA_DB;
    const now = new Date();
    const nowMs = now.getTime();
    const rows = await db
      .prepare(
        `SELECT t.id, t.slug, t.name, t.tier, t.status, t.trial_ends_at, t.current_period_end,
                t.config_json, t.created_at,
                s.tier AS sub_tier, s.billing_cycle, s.status AS sub_status,
                s.trial_ends_at AS sub_trial_ends_at, s.current_period_end AS sub_period_end,
                s.grace_ends_at, s.price_vnd,
                (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id AND COALESCE(p.is_available, 1) = 1) AS product_count,
                (SELECT COUNT(*) FROM orders o
                 WHERE o.tenant_id = t.id
                   AND (t.created_at IS NULL OR (julianday(o.created_at) - julianday(t.created_at)) BETWEEN 0 AND 7)) AS order_count_7d
         FROM saas_tenants t
         LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id`
      )
      .all<Record<string, unknown>>();

    const tenants = (rows.results || []).filter((row) => !isPlatformControlTenant(String(row.id)));
    let activePaid = 0;
    let inTrial = 0;
    let inGrace = 0;
    let inReadOnly = 0;
    let suspended = 0;
    let mrrVnd = 0;

    let totalMerchants = 0;
    let activated7dCount = 0;
    let unactivatedOver24hCount = 0;
    const utmBuckets = new Map<
      string,
      {
        source: string;
        campaign: string;
        medium: string;
        content: string;
        signups: number;
        activated7d: number;
        paid: number;
      }
    >();

    for (const row of tenants) {
      const tenantId = String(row.id);
      const lifecycle = resolveTenantLifecycle(
        {
          tenant_id: tenantId,
          tier: String(row.sub_tier || row.tier || 'starter'),
          billing_cycle: String(row.billing_cycle || 'monthly'),
          status: String(row.sub_status || row.status || 'trial'),
          trial_ends_at: (row.sub_trial_ends_at as string | null) ?? (row.trial_ends_at as string | null),
          current_period_end: (row.sub_period_end as string | null) ?? (row.current_period_end as string | null),
          grace_ends_at: row.grace_ends_at as string | null,
        },
        now
      );
      const state = lifecycle.lifecycleState;

      if (lifecycle.rawStatus === 'suspended') {
        suspended++;
      } else if (state === 'active') {
        activePaid++;
        const plan = SAAS_PLANS[normalizeSaasPlanId(String(row.sub_tier || row.tier || 'starter'))];
        mrrVnd += row.billing_cycle === 'annual' ? Math.round(plan.annualPriceVnd / 12) : plan.monthlyPriceVnd;
      } else if (state === 'trial') {
        inTrial++;
      } else if (state === 'grace') {
        inGrace++;
      } else if (state === 'readonly') {
        inReadOnly++;
      }

      if (!isPlatformControlTenant(tenantId)) {
        totalMerchants++;
        const productCount = Number(row.product_count || 0);
        const ordersFirst7d = Number(row.order_count_7d || 0);
        const activated7d = productCount >= ACTIVATION_MIN_PRODUCTS && ordersFirst7d >= ACTIVATION_MIN_ORDERS_7D;
        if (activated7d) {
          activated7dCount++;
        } else {
          const createdMs = typeof row.created_at === 'string' ? Date.parse(row.created_at) : NaN;
          if (Number.isFinite(createdMs) && nowMs - createdMs >= MS_PER_24H) {
            unactivatedOver24hCount++;
          }
        }

        const attr = parseTenantAttribution(row.config_json);
        const source = attr?.utm_source || 'direct';
        const campaign = attr?.utm_campaign || '(none)';
        const medium = attr?.utm_medium || '';
        const content = attr?.utm_content || '';
        const bucketKey = `${source}|${campaign}|${medium}|${content}`;
        const existing = utmBuckets.get(bucketKey) ?? {
          source,
          campaign,
          medium,
          content,
          signups: 0,
          activated7d: 0,
          paid: 0,
        };
        existing.signups++;
        if (activated7d) existing.activated7d++;
        if (lifecycle.rawStatus !== 'suspended' && state === 'active') existing.paid++;
        utmBuckets.set(bucketKey, existing);
      }
    }

    const totalRevenueRow = await db
      .prepare("SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM tenant_invoices WHERE status = 'paid'")
      .first<{ total: number }>()
      .catch(() => ({ total: 0 }));

    const utmBreakdown = Array.from(utmBuckets.values()).sort(
      (a, b) => b.signups - a.signups || b.activated7d - a.activated7d || a.source.localeCompare(b.source)
    );

    return c.json({
      success: true,
      data: {
        totalTenants: tenants.length,
        activePaid,
        inTrial,
        inGrace,
        inReadOnly,
        suspended,
        mrrVnd,
        totalCollectedVnd: Number(totalRevenueRow?.total || 0),
        trialConversionPercent:
          activePaid + inTrial > 0 ? Math.round((activePaid / (activePaid + inTrial)) * 100) : 0,
        activationFunnel: {
          totalMerchants,
          activated7dCount,
          activationRatePercent: totalMerchants > 0 ? Math.round((activated7dCount / totalMerchants) * 100) : 0,
          unactivatedOver24hCount,
          thresholds: {
            minProducts: ACTIVATION_MIN_PRODUCTS,
            minOrders7d: ACTIVATION_MIN_ORDERS_7D,
          },
        },
        utmBreakdown,
      },
    });
  });

  router.get('/tenants', async (c) => {
    const db = c.env.AURA_DB;
    const search = String(c.req.query('search') || '').trim().toLowerCase();
    const utmSourceFilter = String(c.req.query('utm_source') || '').trim().toLowerCase();
    const utmCampaignFilter = String(c.req.query('utm_campaign') || '').trim().toLowerCase();
    const activatedFilter = String(c.req.query('activated') || '').trim().toLowerCase();

    const rows = await db
      .prepare(
        `SELECT t.id, t.slug, t.name, t.tier, t.status, t.template_id, t.subdomain,
                t.owner_email, t.owner_name, t.owner_phone, t.trial_ends_at, t.current_period_end,
                t.config_json, t.created_at,
                s.tier AS sub_tier, s.billing_cycle, s.status AS sub_status,
                s.trial_ends_at AS sub_trial_ends_at, s.current_period_end AS sub_period_end,
                s.grace_ends_at,
                (SELECT COUNT(*) FROM cafe_tables ct WHERE ct.tenant_id = t.id AND COALESCE(ct.is_active, 1) = 1) AS table_count,
                (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND COALESCE(u.is_active, 1) = 1) AS staff_count,
                (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id AND COALESCE(p.is_available, 1) = 1) AS product_count,
                (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id) AS order_count,
                (SELECT COUNT(*) FROM orders o
                 WHERE o.tenant_id = t.id
                   AND (t.created_at IS NULL OR (julianday(o.created_at) - julianday(t.created_at)) BETWEEN 0 AND 7)) AS order_count_7d
         FROM saas_tenants t
         LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id
         WHERE LOWER(t.id) NOT IN ('default', 'hq', '*')
         ORDER BY t.created_at DESC`
      )
      .all<Record<string, unknown>>();

    const now = new Date();
    const list = (rows.results || [])
      .map((r) => {
        const lifecycle = resolveTenantLifecycle(
          {
            tenant_id: String(r.id),
            tier: String(r.sub_tier || r.tier || 'starter'),
            billing_cycle: String(r.billing_cycle || 'monthly'),
            status: String(r.sub_status || r.status || 'trial'),
            trial_ends_at: (r.sub_trial_ends_at as string | null) ?? (r.trial_ends_at as string | null),
            current_period_end: (r.sub_period_end as string | null) ?? (r.current_period_end as string | null),
            grace_ends_at: r.grace_ends_at as string | null,
          },
          now
        );
        const products = Number(r.product_count || 0);
        const ordersFirst7d = Number(r.order_count_7d || 0);
        const activated7d = products >= ACTIVATION_MIN_PRODUCTS && ordersFirst7d >= ACTIVATION_MIN_ORDERS_7D;
        const attribution = parseTenantAttribution(r.config_json);
        return {
          id: String(r.id),
          slug: String(r.slug),
          name: String(r.name || r.slug),
          planId: normalizeSaasPlanId(String(r.sub_tier || r.tier || 'starter')),
          billingCycle: String(r.billing_cycle || 'monthly'),
          rawStatus: lifecycle.rawStatus,
          lifecycleState: lifecycle.lifecycleState,
          templateId: r.template_id || null,
          ownerEmail: r.owner_email || null,
          ownerName: r.owner_name || null,
          ownerPhone: r.owner_phone || null,
          trialEndsAt: r.sub_trial_ends_at || r.trial_ends_at || null,
          currentPeriodEnd: r.sub_period_end || r.current_period_end || null,
          createdAt: r.created_at,
          activated7d,
          ordersFirst7d,
          attribution,
          usage: {
            tables: Number(r.table_count || 0),
            staff: Number(r.staff_count || 0),
            products,
            orders: Number(r.order_count || 0),
          },
        };
      })
      .filter((t) => {
        if (search) {
          const matchesSearch =
            t.name.toLowerCase().includes(search) ||
            t.slug.toLowerCase().includes(search) ||
            String(t.ownerEmail || '').toLowerCase().includes(search) ||
            String(t.attribution?.utm_source || '').toLowerCase().includes(search) ||
            String(t.attribution?.utm_campaign || '').toLowerCase().includes(search);
          if (!matchesSearch) return false;
        }
        if (utmSourceFilter) {
          const src = (t.attribution?.utm_source || 'direct').toLowerCase();
          if (src !== utmSourceFilter) return false;
        }
        if (utmCampaignFilter) {
          const camp = (t.attribution?.utm_campaign || '').toLowerCase();
          if (camp !== utmCampaignFilter) return false;
        }
        if (activatedFilter === 'true' && !t.activated7d) return false;
        if (activatedFilter === 'false' && t.activated7d) return false;
        return true;
      })
      .slice(0, 200);

    return c.json({ success: true, data: { tenants: list } });
  });

  const ALLOWED_OVERRIDE_STATUSES = new Set(['active', 'trial', 'grace', 'readonly', 'suspended', 'cancelled']);

  async function tenantExists(db: D1Database, tenantId: string): Promise<boolean> {
    const row = await db
      .prepare('SELECT id FROM saas_tenants WHERE id = ? LIMIT 1')
      .bind(tenantId)
      .first<{ id: string }>()
      .catch(() => null);
    return Boolean(row?.id);
  }

  router.post('/tenants/:id/extend-trial', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = c.req.param('id');
    if (isPlatformControlTenant(tenantId)) {
      return c.json({ success: false, error: 'Platform control tenants cannot be modified' }, 403);
    }
    if (!(await tenantExists(db, tenantId))) {
      return c.json({ success: false, error: 'Tenant not found' }, 404);
    }
    const actor = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const requestedDays = body.days === undefined ? 14 : Number(body.days);
    if (!Number.isFinite(requestedDays) || requestedDays < 1) {
      return c.json({ success: false, error: 'Invalid trial duration' }, 400);
    }
    const days = Math.min(90, Math.trunc(requestedDays));
    const reason = String(body.reason || `HQ extended trial by ${days} days`).trim();

    const now = new Date();
    const newTrialEnd = addDaysIso(now, days);
    const newGraceEnd = addDaysIso(now, days + 3);
    const nowIso = now.toISOString();

    await db.batch([
      db
        .prepare("UPDATE saas_tenants SET status = 'trial', trial_ends_at = ?, current_period_end = ?, updated_at = ? WHERE id = ?")
        .bind(newTrialEnd, newTrialEnd, nowIso, tenantId),
      db
        .prepare(
          `INSERT INTO tenant_subscriptions (
             id, tenant_id, tier, billing_cycle, status, trial_ends_at, current_period_end, grace_ends_at, updated_at
           ) VALUES (?, ?, 'pro', 'monthly', 'trial', ?, ?, ?, ?)
           ON CONFLICT(tenant_id) DO UPDATE SET
             status = 'trial',
             trial_ends_at = excluded.trial_ends_at,
             current_period_end = excluded.current_period_end,
             grace_ends_at = excluded.grace_ends_at,
             updated_at = excluded.updated_at`
        )
        .bind(`sub_${tenantId}`, tenantId, newTrialEnd, newTrialEnd, newGraceEnd, nowIso),
      db
        .prepare(
          `INSERT INTO saas_audit_logs (id, tenant_id, actor_user_id, actor_role, action, after_json, reason, created_at)
           VALUES (?, ?, ?, ?, 'extend_trial', ?, ?, ?)`
        )
        .bind(
          `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
          tenantId,
          actor?.id || 'hq',
          actor?.role || 'admin',
          JSON.stringify({ days, newTrialEnd }),
          reason,
          nowIso
        ),
    ]);

    return c.json({ success: true, data: { tenantId, trialEndsAt: newTrialEnd } });
  });

  router.post('/tenants/:id/override-tier', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = c.req.param('id');
    if (isPlatformControlTenant(tenantId)) {
      return c.json({ success: false, error: 'Platform control tenants cannot be modified' }, 403);
    }
    if (!(await tenantExists(db, tenantId))) {
      return c.json({ success: false, error: 'Tenant not found' }, 404);
    }
    const actor = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const planId = normalizeSaasPlanId(String(body.planId || body.tier || 'pro'));
    const status = String(body.status || 'active').toLowerCase().trim();
    if (!ALLOWED_OVERRIDE_STATUSES.has(status)) {
      return c.json({ success: false, error: 'Invalid subscription status' }, 400);
    }
    const requestedDuration = body.durationDays === undefined ? 30 : Number(body.durationDays);
    if (!Number.isFinite(requestedDuration) || requestedDuration < 1) {
      return c.json({ success: false, error: 'Invalid subscription duration' }, 400);
    }
    const durationDays = Math.min(730, Math.trunc(requestedDuration));
    const reason = String(body.reason || 'HQ manual tier override').trim();

    const now = new Date();
    const periodEnd = addDaysIso(now, durationDays);
    const graceEnd = addDaysIso(now, durationDays + 3);
    const nowIso = now.toISOString();

    await db.batch([
      db
        .prepare('UPDATE saas_tenants SET tier = ?, status = ?, current_period_end = ?, updated_at = ? WHERE id = ?')
        .bind(planId, status, periodEnd, nowIso, tenantId),
      db
        .prepare(
          `INSERT INTO tenant_subscriptions (
             id, tenant_id, tier, billing_cycle, status, current_period_start, current_period_end, grace_ends_at, updated_at
           ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id) DO UPDATE SET
             tier = excluded.tier,
             status = excluded.status,
             current_period_start = excluded.current_period_start,
             current_period_end = excluded.current_period_end,
             grace_ends_at = excluded.grace_ends_at,
             updated_at = excluded.updated_at`
        )
        .bind(`sub_${tenantId}`, tenantId, planId, status, nowIso, periodEnd, graceEnd, nowIso),
      db
        .prepare(
          `INSERT INTO saas_audit_logs (id, tenant_id, actor_user_id, actor_role, action, after_json, reason, created_at)
           VALUES (?, ?, ?, ?, 'override_tier', ?, ?, ?)`
        )
        .bind(
          `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
          tenantId,
          actor?.id || 'hq',
          actor?.role || 'admin',
          JSON.stringify({ planId, status, periodEnd }),
          reason,
          nowIso
        ),
    ]);

    return c.json({ success: true, data: { tenantId, planId, status, currentPeriodEnd: periodEnd } });
  });

  router.post('/tenants/:id/suspend', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = c.req.param('id');
    if (isPlatformControlTenant(tenantId)) {
      return c.json({ success: false, error: 'Platform control tenants cannot be modified' }, 403);
    }
    if (!(await tenantExists(db, tenantId))) {
      return c.json({ success: false, error: 'Tenant not found' }, 404);
    }
    const actor = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const suspend = body.suspend !== false && body.suspended !== false;
    const nextStatus = suspend ? 'suspended' : 'active';
    const reason = String(body.reason || (suspend ? 'HQ suspended tenant' : 'HQ reactivated tenant')).trim();
    const nowIso = new Date().toISOString();

    await db.batch([
      db.prepare('UPDATE saas_tenants SET status = ?, updated_at = ? WHERE id = ?').bind(nextStatus, nowIso, tenantId),
      db
        .prepare('UPDATE tenant_subscriptions SET status = ?, updated_at = ? WHERE tenant_id = ?')
        .bind(nextStatus, nowIso, tenantId),
      db
        .prepare(
          `INSERT INTO saas_audit_logs (id, tenant_id, actor_user_id, actor_role, action, after_json, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
          tenantId,
          actor?.id || 'hq',
          actor?.role || 'admin',
          suspend ? 'suspend_tenant' : 'unsuspend_tenant',
          JSON.stringify({ status: nextStatus }),
          reason,
          nowIso
        ),
    ]);

    return c.json({ success: true, data: { tenantId, status: nextStatus } });
  });

  router.get('/audit-logs', async (c) => {
    const rows = await c.env.AURA_DB
      .prepare('SELECT * FROM saas_audit_logs ORDER BY created_at DESC LIMIT 100')
      .all();
    return c.json({ success: true, data: { logs: rows.results || [] } });
  });

  return router;
}
