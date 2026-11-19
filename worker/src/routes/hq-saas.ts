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
    const rows = await db
      .prepare(
        `SELECT t.id, t.slug, t.name, t.tier, t.status, t.trial_ends_at, t.current_period_end,
                s.tier AS sub_tier, s.billing_cycle, s.status AS sub_status,
                s.trial_ends_at AS sub_trial_ends_at, s.current_period_end AS sub_period_end,
                s.grace_ends_at, s.price_vnd
         FROM saas_tenants t
         LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id`
      )
      .all<Record<string, unknown>>();

    const tenants = rows.results || [];
    let activePaid = 0;
    let inTrial = 0;
    let inGrace = 0;
    let inReadOnly = 0;
    let suspended = 0;
    let mrrVnd = 0;

    for (const row of tenants) {
      const state = resolveTenantLifecycle(
        {
          tenant_id: String(row.id),
          tier: String(row.sub_tier || row.tier || 'starter'),
          billing_cycle: String(row.billing_cycle || 'monthly'),
          status: String(row.sub_status || row.status || 'trial'),
          trial_ends_at: (row.sub_trial_ends_at as string | null) ?? (row.trial_ends_at as string | null),
          current_period_end: (row.sub_period_end as string | null) ?? (row.current_period_end as string | null),
          grace_ends_at: row.grace_ends_at as string | null,
        },
        now
      ).lifecycleState;

      if (state === 'active') {
        activePaid++;
        const plan = SAAS_PLANS[normalizeSaasPlanId(String(row.sub_tier || row.tier || 'starter'))];
        mrrVnd += row.billing_cycle === 'annual' ? Math.round(plan.annualPriceVnd / 12) : plan.monthlyPriceVnd;
      } else if (state === 'trial') {
        inTrial++;
      } else if (state === 'grace') {
        inGrace++;
      } else if (state === 'readonly') {
        inReadOnly++;
      } else if (state === 'suspended') {
        suspended++;
      }
    }

    const totalRevenueRow = await db
      .prepare("SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM tenant_invoices WHERE status = 'paid'")
      .first<{ total: number }>()
      .catch(() => ({ total: 0 }));

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
      },
    });
  });

  router.get('/tenants', async (c) => {
    const db = c.env.AURA_DB;
    const search = String(c.req.query('search') || '').trim().toLowerCase();
    const rows = await db
      .prepare(
        `SELECT t.id, t.slug, t.name, t.tier, t.status, t.template_id, t.subdomain,
                t.owner_email, t.owner_name, t.owner_phone, t.trial_ends_at, t.current_period_end, t.created_at,
                s.tier AS sub_tier, s.billing_cycle, s.status AS sub_status,
                s.trial_ends_at AS sub_trial_ends_at, s.current_period_end AS sub_period_end,
                s.grace_ends_at,
                (SELECT COUNT(*) FROM cafe_tables ct WHERE ct.tenant_id = t.id AND COALESCE(ct.is_active, 1) = 1) AS table_count,
                (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND COALESCE(u.is_active, 1) = 1) AS staff_count,
                (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id) AS order_count
         FROM saas_tenants t
         LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id
         ORDER BY t.created_at DESC
         LIMIT 200`
      )
      .all<Record<string, unknown>>();

    const now = new Date();
    const list = (rows.results || [])
      .map((r) => {
        const lifecycleState = resolveTenantLifecycle(
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
        ).lifecycleState;
        return {
          id: String(r.id),
          slug: String(r.slug),
          name: String(r.name || r.slug),
          planId: normalizeSaasPlanId(String(r.sub_tier || r.tier || 'starter')),
          billingCycle: String(r.billing_cycle || 'monthly'),
          lifecycleState,
          templateId: r.template_id || null,
          ownerEmail: r.owner_email || null,
          ownerName: r.owner_name || null,
          ownerPhone: r.owner_phone || null,
          trialEndsAt: r.sub_trial_ends_at || r.trial_ends_at || null,
          currentPeriodEnd: r.sub_period_end || r.current_period_end || null,
          createdAt: r.created_at,
          usage: {
            tables: Number(r.table_count || 0),
            staff: Number(r.staff_count || 0),
            orders: Number(r.order_count || 0),
          },
        };
      })
      .filter((t) => {
        if (!search) return true;
        return (
          t.name.toLowerCase().includes(search) ||
          t.slug.toLowerCase().includes(search) ||
          String(t.ownerEmail || '').toLowerCase().includes(search)
        );
      });

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
    if (!(await tenantExists(db, tenantId))) {
      return c.json({ success: false, error: 'Tenant not found' }, 404);
    }
    const actor = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const days = Math.min(90, Math.max(1, Number(body.days || 14)));
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
    const durationDays = Math.min(730, Math.max(1, Number(body.durationDays || 30)));
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
    if (!(await tenantExists(db, tenantId))) {
      return c.json({ success: false, error: 'Tenant not found' }, 404);
    }
    const actor = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const suspend = body.suspend !== false;
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
