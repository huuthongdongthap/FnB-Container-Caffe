/**
 * Admin Loyalty Routes — /api/admin-loyalty
 * Dashboard widgets + CSV export for loyalty program management.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId, matchesTenantRow } from '../middleware/tenant';

function escapeCsvCell(val: unknown, alwaysQuote = false): string {
  const raw = String(val ?? '');
  const prefixed = /^[\t\r\n ]*[=+\-@|]/.test(raw) ? `'${raw}` : raw;
  const safe = prefixed.replace(/([\r\n]+)(\s*[=+\-@|])/g, "$1'$2");
  if (alwaysQuote || safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

interface LoyaltyWidget {
  title: string;
  value: number | string;
  change?: string;
  icon?: string;
}

interface TierDistribution {
  tier: string;
  count: number;
  percentage: number;
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  tier: string;
  total_spent: number;
  visit_count: number;
}

export const adminLoyaltyRouter = new Hono<{ Bindings: Env }>();

const CRM_MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor']);
const CRM_EXPORT_ROLES = new Set(['owner', 'admin', 'manager']);

function hasAdminLoyaltyTenantMismatch(c: {
  get?: (_k: string) => unknown;
  req?: { query?: (_k: string) => string | undefined; header?: (_k: string) => string | undefined };
}): boolean {
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-store-id'),
    c.req?.header?.('X-Store-ID'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) return true;
  const user = (typeof c.get === 'function' ? c.get('user') : undefined) as {
    role?: string;
    tenantId?: string;
    tenant_id?: string;
  } | undefined;
  if (!user) return false;
  const userTenant = (user.tenantId ?? user.tenant_id ?? '').trim();
  const isHq = (user.role === 'owner' || user.role === 'admin') && (userTenant === '*' || userTenant === 'hq' || userTenant.toLowerCase() === 'hq');
  if (isHq) return false;
  if (userTenant === '*' || userTenant.toLowerCase() === 'hq') return true;
  const requestedTenant = candidateOverrides[0] || '';
  if (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq') return true;
  if (!userTenant) {
    return Boolean(requestedTenant && requestedTenant !== 'default');
  }
  const resolvedTenant = getTenantId(c as Parameters<typeof getTenantId>[0]);
  if (resolvedTenant !== userTenant) return true;
  const ctxTenant = typeof c.get === 'function' ? String(c.get('tenantId') ?? '').trim() : '';
  if (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant)) return true;
  if (requestedTenant && requestedTenant !== userTenant) return true;
  return false;
}

function resolveAdminLoyaltyTenant(c: Parameters<typeof getTenantId>[0]): string {
  const user = (typeof c.get === 'function' ? c.get('user' as never) : undefined) as {
    role?: string;
    tenantId?: string;
    tenant_id?: string;
  } | undefined;
  const userTenant = (user?.tenantId ?? user?.tenant_id ?? '').trim();
  const isHq = Boolean(user && (user.role === 'owner' || user.role === 'admin') && (userTenant === '*' || userTenant === 'hq' || userTenant.toLowerCase() === 'hq'));
  if (isHq) {
    const requested = (
      c.req?.query?.('tenant_id') ||
      c.req?.query?.('tenantId') ||
      c.req?.query?.('store_id') ||
      c.req?.query?.('storeId') ||
      c.req?.header?.('x-tenant-id') ||
      c.req?.header?.('X-Tenant-ID') ||
      c.req?.header?.('x-store-id') ||
      c.req?.header?.('X-Store-ID') ||
      ''
    ).trim();
    if (requested) {
      return requested === '*' || requested.toLowerCase() === 'hq' ? '*' : requested;
    }
    const ctxTenant = typeof c.get === 'function' ? String(c.get('tenantId' as never) ?? '').trim() : '';
    if (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' && ctxTenant !== 'default') {
      return ctxTenant;
    }
    return '*';
  }
  const resolved = getTenantId(c);
  return resolved.toLowerCase() === 'hq' ? '*' : resolved;
}

// All routes require management auth
adminLoyaltyRouter.use('*', requireAuth(['owner', 'admin', 'manager', 'supervisor']));
adminLoyaltyRouter.use('*', async (c, next) => {
  const user = c.get('user');
  if (user?.role && !CRM_MANAGEMENT_ROLES.has(user.role)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (hasAdminLoyaltyTenantMismatch(c)) {
    return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
  }
  await next();
});

// GET /api/admin-loyalty/widgets — 8 KPI widgets
adminLoyaltyRouter.get('/widgets', async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveAdminLoyaltyTenant(c);

  let allCustRes: { results?: Record<string, unknown>[] } | null = null;
  if (tenantId !== '*') {
    allCustRes = await db
      .prepare("SELECT id, name, phone, email, loyalty_tier, loyalty_points, cashback_balance, total_spent, visit_count, created_at, tenant_id, date_of_birth, updated_at, tier FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(tenantId)
      .all<Record<string, unknown>>()
      .catch(() => null);
    if (!allCustRes && tenantId !== 'default') {
      allCustRes = await db
        .prepare("SELECT id, name, phone, email, loyalty_tier, loyalty_points, total_spent, created_at, tenant_id FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(tenantId)
        .all<Record<string, unknown>>()
        .catch(() =>
          db
            .prepare("SELECT id, name, phone, loyalty_tier, tenant_id FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(tenantId)
            .all<Record<string, unknown>>()
            .catch(() => ({ results: [] as Record<string, unknown>[] }))
        );
    }
  }
  if (tenantId === '*' || (!allCustRes && tenantId === 'default')) {
    allCustRes = await db
      .prepare('SELECT id, name, phone, email, loyalty_tier, loyalty_points, cashback_balance, total_spent, visit_count, created_at, tenant_id, date_of_birth, updated_at, tier FROM customers')
      .all<Record<string, unknown>>()
      .catch(() => ({ results: [] as Record<string, unknown>[] }));
  }
  const allCustomers = allCustRes?.results || [];
  if (tenantId !== 'default' || allCustomers.some((r) => r && typeof r === 'object' && 'tenant_id' in r)) {
      const scopedCustomers = allCustomers.filter((r) => matchesTenantRow(r, tenantId));
      const scopedIds = new Set(scopedCustomers.map((r) => String(r.id)));
      const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();
      const ninetyDaysAgoIso = new Date(Date.now() - 90 * 86400000).toISOString();

      const totalCustomersScoped = scopedCustomers.length;
      const activeScoped = scopedCustomers.filter((r) => String(r.updated_at || '') >= thirtyDaysAgoIso).length;
      const churnScoped = scopedCustomers.filter((r) => r.updated_at && String(r.updated_at) < ninetyDaysAgoIso).length;

      let cashbackScoped = scopedCustomers.reduce((sum, r) => sum + Number(r.cashback_balance || 0), 0);
      if (cashbackScoped === 0 && scopedIds.size > 0) {
        const walRes = await db
          .prepare("SELECT customer_id, balance, tenant_id FROM cashback_wallets WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
          .bind(tenantId, tenantId)
          .all<{ customer_id: string; balance: number; tenant_id?: string | null }>()
          .catch(() =>
            tenantId === 'default'
              ? db
                  .prepare('SELECT customer_id, balance FROM cashback_wallets')
                  .all<{ customer_id: string; balance: number }>()
                  .catch(() => ({ results: [] as Array<{ customer_id: string; balance: number }> }))
              : ({ results: [] as Array<{ customer_id: string; balance: number; tenant_id?: string | null }> })
          );
        cashbackScoped = (walRes.results || [])
          .filter(
            (w) =>
              scopedIds.has(String(w.customer_id)) &&
              (!('tenant_id' in w) || w.tenant_id === undefined || matchesTenantRow(w, tenantId))
          )
          .reduce((sum, w) => sum + Number(w.balance || 0), 0);
      }

      let spentScoped = scopedCustomers.reduce((sum, r) => sum + Number(r.total_spent || 0), 0);
      if (spentScoped === 0 && scopedIds.size > 0) {
        const walSpentRes = await db
          .prepare("SELECT customer_id, total_spent, tenant_id FROM cashback_wallets WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
          .bind(tenantId, tenantId)
          .all<{ customer_id: string; total_spent: number; tenant_id?: string | null }>()
          .catch(() =>
            tenantId === 'default'
              ? db
                  .prepare('SELECT customer_id, total_spent FROM cashback_wallets')
                  .all<{ customer_id: string; total_spent: number }>()
                  .catch(() => ({ results: [] as Array<{ customer_id: string; total_spent: number }> }))
              : ({ results: [] as Array<{ customer_id: string; total_spent: number; tenant_id?: string | null }> })
          );
        spentScoped = (walSpentRes.results || [])
          .filter(
            (w) =>
              scopedIds.has(String(w.customer_id)) &&
              (!('tenant_id' in w) || w.tenant_id === undefined || matchesTenantRow(w, tenantId))
          )
          .reduce((sum, w) => sum + Number(w.total_spent || 0), 0);
      }
      if (spentScoped === 0) {
        const ordRes = await db
          .prepare("SELECT customer_id, total, tenant_id, status, payment_status FROM orders WHERE status != 'cancelled' AND COALESCE(status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(payment_status, '') NOT IN ('refunded', 'failed') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
          .bind(tenantId, tenantId)
          .all<{ customer_id?: string; total?: number; tenant_id?: string | null; status?: string | null; payment_status?: string | null }>()
          .catch(() =>
            db
              .prepare("SELECT customer_id, total, tenant_id FROM orders WHERE status != 'cancelled' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
              .bind(tenantId, tenantId)
              .all<{ customer_id?: string; total?: number; tenant_id?: string | null }>()
              .catch(() => ({ results: [] as Array<{ customer_id?: string; total?: number; tenant_id?: string | null }> }))
          );
        spentScoped = (ordRes.results || [])
          .filter((o) => {
            const st = String((o as { status?: string | null }).status ?? '').trim().toLowerCase();
            const pst = String((o as { payment_status?: string | null }).payment_status ?? '').trim().toLowerCase();
            if (
              ['cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired'].includes(st) ||
              ['refunded', 'failed', 'cancelled', 'canceled'].includes(pst)
            ) {
              return false;
            }
            return 'tenant_id' in o && o.tenant_id !== undefined
              ? matchesTenantRow(o, tenantId)
              : Boolean(o.customer_id && scopedIds.has(String(o.customer_id)));
          })
          .reduce((sum, o) => sum + Number(o.total || 0), 0);
      }

      let avgVisitsScoped =
        totalCustomersScoped > 0
          ? Math.round(
              scopedCustomers.reduce((sum, r) => sum + Number(r.visit_count || 0), 0) / totalCustomersScoped
            )
          : 0;
      if (avgVisitsScoped === 0 && scopedIds.size > 0) {
        const ordRes = await db
          .prepare("SELECT customer_id, customer_phone, tenant_id, status, payment_status FROM orders WHERE status != 'cancelled' AND COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired') AND COALESCE(payment_status, '') NOT IN ('refunded', 'failed', 'cancelled', 'canceled') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
          .bind(tenantId, tenantId)
          .all<{ customer_id?: string; customer_phone?: string; tenant_id?: string | null; status?: string | null; payment_status?: string | null }>()
          .catch(() =>
            db
              .prepare("SELECT customer_id, customer_phone, tenant_id FROM orders WHERE status != 'cancelled' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
              .bind(tenantId, tenantId)
              .all<{ customer_id?: string; customer_phone?: string; tenant_id?: string | null }>()
              .catch(() => ({ results: [] as Array<{ customer_id?: string; customer_phone?: string; tenant_id?: string | null }> }))
          );
        const validOrders = (ordRes.results || []).filter((o) => {
          const st = String((o as { status?: string | null }).status ?? '').trim().toLowerCase();
          const pst = String((o as { payment_status?: string | null }).payment_status ?? '').trim().toLowerCase();
          if (
            ['cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired'].includes(st) ||
            ['refunded', 'failed', 'cancelled', 'canceled'].includes(pst)
          ) {
            return false;
          }
          return 'tenant_id' in o && o.tenant_id !== undefined
            ? matchesTenantRow(o, tenantId)
            : Boolean(o.customer_id && scopedIds.has(String(o.customer_id)));
        });
        const byCust = new Map<string, number>();
        for (const o of validOrders) {
          const key = String(o.customer_id || o.customer_phone || '');
          if (key) byCust.set(key, (byCust.get(key) || 0) + 1);
        }
        if (byCust.size > 0) {
          const sumCnt = Array.from(byCust.values()).reduce((a, b) => a + b, 0);
          avgVisitsScoped = Math.round(sumCnt / byCust.size);
        }
      }

      const tierCounts = new Map<string, number>();
      for (const r of scopedCustomers) {
        const t = String(r.tier || r.loyalty_tier || '').trim();
        if (t) tierCounts.set(t, (tierCounts.get(t) || 0) + 1);
      }
      let topTierScoped = totalCustomersScoped > 0 ? 'bronze' : 'N/A';
      let maxTierCount = 0;
      for (const [tier, cnt] of tierCounts.entries()) {
        if (cnt > maxTierCount) {
          maxTierCount = cnt;
          topTierScoped = tier;
        }
      }

      const checkinRes = await db
        .prepare("SELECT customer_id, status, tenant_id FROM checkins WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
        .bind(tenantId, tenantId)
        .all<{ customer_id: string; status: string; tenant_id?: string | null }>()
        .catch(() =>
          tenantId === 'default'
            ? db
                .prepare('SELECT customer_id, status FROM checkins')
                .all<{ customer_id: string; status: string }>()
                .catch(() => ({ results: [] as Array<{ customer_id: string; status: string }> }))
            : ({ results: [] as Array<{ customer_id: string; status: string; tenant_id?: string | null }> })
        );
      const scopedCheckins = (checkinRes.results || []).filter(
        (ci) =>
          scopedIds.has(String(ci.customer_id)) &&
          (!('tenant_id' in ci) || ci.tenant_id === undefined || matchesTenantRow(ci, tenantId))
      );
      const redeemedCheckins = scopedCheckins.filter((ci) => ci.status === 'approved').length;

      const scopedWidgets: LoyaltyWidget[] = [
        { title: 'Total Members', value: totalCustomersScoped, icon: 'users' },
        { title: 'Active (30d)', value: activeScoped, icon: 'activity' },
        { title: 'Cashback Pool', value: cashbackScoped, icon: 'gift' },
        { title: 'Total Spend', value: spentScoped, icon: 'dollar' },
        { title: 'Avg Visits', value: avgVisitsScoped, icon: 'repeat' },
        { title: 'Top Tier', value: topTierScoped, icon: 'star' },
        { title: 'Churn Risk (90d)', value: churnScoped, icon: 'alert' },
        {
          title: 'Redemption Rate',
          value: scopedCheckins.length ? `${Math.round((redeemedCheckins / scopedCheckins.length) * 100)}%` : '0%',
          icon: 'check',
        },
      ];
      return c.json({ success: true, data: scopedWidgets });
  }

  let totalCustomers = 0;
  let activeThisMonth = 0;
  let totalCashback = 0;
  let totalSpent = 0;
  let avgVisits = 0;
  let topTier = 'bronze';
  let churnRisk = 0;
  let redemptionRate = { total: 0, redeemed: 0 };

  try {
    const custCount = await db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>();
    totalCustomers = custCount?.count || 0;
  } catch {}

  try {
    const act = await db.prepare('SELECT COUNT(*) as count FROM customers WHERE updated_at >= ?')
      .bind(new Date(Date.now() - 30 * 86400000).toISOString()).first<{ count: number }>();
    activeThisMonth = act?.count || 0;
  } catch {}

  try {
    const cb = await db.prepare('SELECT COALESCE(SUM(cashback_balance), 0) as total FROM customers').first<{ total: number }>();
    if (cb && typeof cb.total === 'number' && cb.total > 0) {
      totalCashback = cb.total;
    } else {
      const wal = await db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM cashback_wallets').first<{ total: number }>();
      totalCashback = wal?.total || cb?.total || 0;
    }
  } catch {
    try {
      const cb = await db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM cashback_wallets').first<{ total: number }>();
      totalCashback = cb?.total || 0;
    } catch {}
  }

  try {
    const sp = await db.prepare('SELECT COALESCE(SUM(total_spent), 0) as total FROM customers').first<{ total: number }>();
    if (sp && typeof sp.total === 'number' && sp.total > 0) {
      totalSpent = sp.total;
    } else {
      const ord = await db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE COALESCE(status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(payment_status, '') NOT IN ('refunded', 'failed')").first<{ total: number }>();
      totalSpent = ord?.total || sp?.total || 0;
    }
  } catch {
    try {
      const sp = await db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE COALESCE(status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(payment_status, '') NOT IN ('refunded', 'failed')").first<{ total: number }>();
      totalSpent = sp?.total || 0;
    } catch {}
  }

  try {
    const v = await db.prepare('SELECT COALESCE(AVG(visit_count), 0) as avg FROM customers').first<{ avg: number }>();
    if (v && typeof v.avg === 'number' && v.avg > 0) {
      avgVisits = Math.round(v.avg);
    } else {
      const ord = await db.prepare("SELECT COALESCE(AVG(cnt), 0) as avg FROM (SELECT COUNT(*) as cnt FROM orders WHERE status != 'cancelled' AND COALESCE(status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(payment_status, '') NOT IN ('refunded', 'failed') GROUP BY COALESCE(NULLIF(customer_id, ''), customer_phone))").first<{ avg: number }>();
      avgVisits = Math.round(ord?.avg || v?.avg || 0);
    }
  } catch {
    try {
      const ord = await db.prepare("SELECT COALESCE(AVG(cnt), 0) as avg FROM (SELECT COUNT(*) as cnt FROM orders WHERE status != 'cancelled' AND COALESCE(status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(payment_status, '') NOT IN ('refunded', 'failed') GROUP BY COALESCE(NULLIF(customer_id, ''), customer_phone))").first<{ avg: number }>();
      avgVisits = Math.round(ord?.avg || 0);
    } catch {}
  }

  try {
    const tt = await db.prepare('SELECT tier, COUNT(*) as count FROM customers GROUP BY tier ORDER BY count DESC LIMIT 1').first<{ tier: string; count: number }>();
    if (tt && tt.tier) {
      topTier = tt.tier;
    } else {
      const ttLoyalty = await db.prepare('SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC LIMIT 1').first<{ tier: string; count: number }>();
      topTier = ttLoyalty?.tier || 'N/A';
    }
  } catch {
    try {
      const tt = await db.prepare('SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC LIMIT 1').first<{ tier: string; count: number }>();
      topTier = tt?.tier || 'N/A';
    } catch {}
  }

  try {
    const cr = await db.prepare('SELECT COUNT(*) as count FROM customers WHERE updated_at < ?')
      .bind(new Date(Date.now() - 90 * 86400000).toISOString()).first<{ count: number }>();
    churnRisk = cr?.count || 0;
  } catch {}

  try {
    const rr = await db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as redeemed FROM checkins')
      .bind('approved').first<{ total: number; redeemed: number }>();
    if (rr) {
      redemptionRate = { total: rr.total || 0, redeemed: rr.redeemed || 0 };
    }
  } catch {}

  const widgets: LoyaltyWidget[] = [
    { title: 'Total Members', value: totalCustomers, icon: 'users' },
    { title: 'Active (30d)', value: activeThisMonth, icon: 'activity' },
    { title: 'Cashback Pool', value: totalCashback, icon: 'gift' },
    { title: 'Total Spend', value: totalSpent, icon: 'dollar' },
    { title: 'Avg Visits', value: avgVisits, icon: 'repeat' },
    { title: 'Top Tier', value: topTier, icon: 'star' },
    { title: 'Churn Risk (90d)', value: churnRisk, icon: 'alert' },
    {
      title: 'Redemption Rate',
      value: redemptionRate.total ? `${Math.round((redemptionRate.redeemed / redemptionRate.total) * 100)}%` : '0%',
      icon: 'check'
    }
  ];

  return c.json({ success: true, data: widgets });
});

// GET /api/admin-loyalty/tiers — tier distribution
adminLoyaltyRouter.get('/tiers', async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveAdminLoyaltyTenant(c);

  let allCustRes: { results?: Record<string, unknown>[] } | null = null;
  if (tenantId !== '*') {
    allCustRes = await db
      .prepare("SELECT id, name, phone, email, loyalty_tier, loyalty_points, cashback_balance, total_spent, visit_count, created_at, tenant_id, date_of_birth, updated_at, tier FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(tenantId)
      .all<Record<string, unknown>>()
      .catch(() => null);
    if (!allCustRes && tenantId !== 'default') {
      allCustRes = await db
        .prepare("SELECT id, name, phone, email, loyalty_tier, loyalty_points, total_spent, created_at, tenant_id FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(tenantId)
        .all<Record<string, unknown>>()
        .catch(() =>
          db
            .prepare("SELECT id, name, phone, loyalty_tier, tenant_id FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(tenantId)
            .all<Record<string, unknown>>()
            .catch(() => ({ results: [] as Record<string, unknown>[] }))
        );
    }
  }
  if (tenantId === '*' || (!allCustRes && tenantId === 'default')) {
    allCustRes = await db
      .prepare('SELECT id, name, phone, email, loyalty_tier, loyalty_points, cashback_balance, total_spent, visit_count, created_at, tenant_id, date_of_birth, updated_at, tier FROM customers')
      .all<Record<string, unknown>>()
      .catch(() => ({ results: [] as Record<string, unknown>[] }));
  }
  const allCustomers = allCustRes?.results || [];
  if (tenantId !== 'default' || allCustomers.some((r) => r && typeof r === 'object' && 'tenant_id' in r)) {
      const scopedCustomers = allCustomers.filter((r) => matchesTenantRow(r, tenantId));
      const counts = new Map<string, number>();
      for (const r of scopedCustomers) {
        const tier = String(r.tier || r.loyalty_tier || 'bronze');
        counts.set(tier, (counts.get(tier) || 0) + 1);
      }
      const totalScoped = scopedCustomers.length;
      const distributionScoped: TierDistribution[] = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tier, count]) => ({
          tier,
          count,
          percentage: totalScoped > 0 ? Math.round((count / totalScoped) * 1000) / 10 : 0,
        }));
      return c.json({ success: true, data: { distribution: distributionScoped, total: totalScoped } });
  }

  let rawTiers: Array<{ tier: string; count: number }> = [];
  try {
    const { results } = await db.prepare(
      'SELECT tier, COUNT(*) as count FROM customers GROUP BY tier ORDER BY count DESC'
    ).all<{ tier: string; count: number }>();
    if (results && results.length > 0) {
      rawTiers = results;
    } else {
      const res = await db.prepare(
        'SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC'
      ).all<{ tier: string; count: number }>();
      rawTiers = res.results || [];
    }
  } catch {
    try {
      const { results } = await db.prepare(
        'SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC'
      ).all<{ tier: string; count: number }>();
      rawTiers = results || [];
    } catch {
      rawTiers = [];
    }
  }

  const total = rawTiers.reduce((sum, r) => sum + r.count, 0);

  const distribution: TierDistribution[] = rawTiers.map(r => ({
    tier: r.tier || 'bronze',
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0
  }));

  return c.json({ success: true, data: { distribution, total } });
});

// GET /api/admin-loyalty/top-customers — top 20 by spend
adminLoyaltyRouter.get('/top-customers', async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveAdminLoyaltyTenant(c);
  const parsedLimit = parseInt(c.req.query('limit') || '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 100);

  let results: TopCustomer[] = [];
  try {
    let res: { results?: TopCustomer[] } | null = null;
    if (tenantId !== '*') {
      res = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.tenant_id,
               COALESCE(cw.total_spent, c.total_spent, 0) as total_spent,
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(o.payment_status, '') NOT IN ('refunded', 'failed') AND COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')) as visit_count
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')
        WHERE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
        ORDER BY total_spent DESC
        LIMIT ?
      `).bind(tenantId, limit).all<TopCustomer>().catch(() => null);
    }
    if (tenantId === '*' || (!res && tenantId === 'default')) {
      res = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.tenant_id,
               COALESCE(cw.total_spent, c.total_spent, 0) as total_spent,
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(o.payment_status, '') NOT IN ('refunded', 'failed') AND COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')) as visit_count
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')
        ORDER BY total_spent DESC
        LIMIT 5000
      `).all<TopCustomer>();
    }
    if (!res) {
      throw new Error('Scoped top-customers query failed');
    }
    results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
  } catch {
    try {
      let res: { results?: TopCustomer[] } | null = null;
      if (tenantId !== '*') {
        res = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.tenant_id,
                 COALESCE(cw.total_spent, c.total_spent, 0) as total_spent,
                 (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')) as visit_count
          FROM customers c
          LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
          WHERE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          ORDER BY total_spent DESC
          LIMIT ?
        `).bind(tenantId, limit).all<TopCustomer>().catch(() => null);
      }
      if (tenantId === '*' || (!res && tenantId === 'default')) {
        res = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.tenant_id,
                 COALESCE(cw.total_spent, c.total_spent, 0) as total_spent,
                 (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')) as visit_count
          FROM customers c
          LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
          ORDER BY total_spent DESC
          LIMIT 5000
        `).all<TopCustomer>();
      }
      if (!res) {
        throw new Error('Scoped canonical top-customers query failed');
      }
      results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
    } catch {
      try {
        let res: { results?: TopCustomer[] } | null = null;
        if (tenantId !== '*') {
          res = await db.prepare(
            "SELECT id, name, phone, loyalty_tier as tier, total_spent, visit_count, tenant_id FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY total_spent DESC LIMIT ?"
          ).bind(tenantId, limit).all<TopCustomer>().catch(() => null);
        }
        if (tenantId === '*' || (!res && tenantId === 'default')) {
          res = await db.prepare(
            'SELECT id, name, phone, loyalty_tier as tier, total_spent, visit_count, tenant_id FROM customers ORDER BY total_spent DESC LIMIT 5000'
          ).all<TopCustomer>();
        }
        results = (res?.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
      } catch {
        results = [];
      }
    }
  }

  return c.json({ success: true, data: results });
});

// GET /api/admin-loyalty/export — CSV export
adminLoyaltyRouter.get('/export', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async(c) => {
  const user = (typeof c.get === 'function' ? c.get('user' as never) : undefined) as { role?: string } | undefined;
  if (user?.role && !CRM_EXPORT_ROLES.has(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = resolveAdminLoyaltyTenant(c);

  let results: CustomerExportRow[] = [];
  try {
    let res: { results?: CustomerExportRow[] } | null = null;
    if (tenantId !== '*') {
      res = await db.prepare(
        "SELECT id, name, phone, email, date_of_birth AS birthday, loyalty_tier AS tier, cashback_balance, total_spent, visit_count, created_at, tenant_id FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 5000"
      ).bind(tenantId).all<CustomerExportRow>().catch(() => null);
    }
    if (tenantId === '*' || (!res && tenantId === 'default')) {
      res = await db.prepare(
        'SELECT id, name, phone, email, date_of_birth AS birthday, loyalty_tier AS tier, cashback_balance, total_spent, visit_count, created_at, tenant_id FROM customers ORDER BY created_at DESC LIMIT 5000'
      ).all<CustomerExportRow>();
    }
    if (!res) {
      throw new Error('Scoped export query failed');
    }
    if (res.results && res.results.length > 0) {
      results = res.results;
    } else if (tenantId === '*' || tenantId === 'default') {
      const liveRes = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.date_of_birth AS birthday,
               c.loyalty_tier AS tier,
               COALESCE(cw.balance, 0) AS cashback_balance,
               COALESCE(cw.total_spent, 0) AS total_spent,
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(o.payment_status, '') NOT IN ('refunded', 'failed') AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')) AS visit_count,
               c.created_at, c.tenant_id
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')
        WHERE (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
        ORDER BY c.created_at DESC
        LIMIT 5000
      `).bind(tenantId, tenantId).all<CustomerExportRow>();
      results = liveRes.results || [];
    }
  } catch {
    try {
      let liveRes: { results?: CustomerExportRow[] } | null = null;
      if (tenantId !== '*') {
        liveRes = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.date_of_birth AS birthday,
                 c.loyalty_tier AS tier,
                 COALESCE(cw.balance, 0) AS cashback_balance,
                 COALESCE(cw.total_spent, 0) AS total_spent,
                 (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(o.payment_status, '') NOT IN ('refunded', 'failed') AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')) AS visit_count,
                 c.created_at, c.tenant_id
          FROM customers c
          LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
          WHERE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          ORDER BY c.created_at DESC
          LIMIT 5000
        `).bind(tenantId).all<CustomerExportRow>().catch(() => null);
      }
      if (tenantId === '*' || (!liveRes && tenantId === 'default')) {
        liveRes = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.date_of_birth AS birthday,
                 c.loyalty_tier AS tier,
                 COALESCE(cw.balance, 0) AS cashback_balance,
                 COALESCE(cw.total_spent, 0) AS total_spent,
                 (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(o.payment_status, '') NOT IN ('refunded', 'failed') AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')) AS visit_count,
                 c.created_at, c.tenant_id
          FROM customers c
          LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')
          ORDER BY c.created_at DESC
          LIMIT 5000
        `).all<CustomerExportRow>();
      }
      if (!liveRes) {
        throw new Error('Scoped live export query failed');
      }
      results = liveRes.results || [];
    } catch {
      try {
        if (tenantId !== '*' && tenantId !== 'default') {
          throw new Error('Skip unscoped customer export for non-default tenant');
        }
        const res = await db.prepare(
          'SELECT id, name, phone, email, date_of_birth AS birthday, loyalty_tier AS tier, cashback_balance, total_spent, visit_count, created_at, tenant_id FROM customers ORDER BY created_at DESC LIMIT 5000'
        ).all<CustomerExportRow>();
        results = res.results || [];
      } catch {
        try {
          if (tenantId !== '*' && tenantId !== 'default') {
            const scopedCanonical = await db.prepare(`
              SELECT c.id, c.name, c.phone, c.email, '' AS birthday,
                     c.loyalty_tier AS tier,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired')) AS visit_count,
                     c.created_at, c.tenant_id
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
              ORDER BY c.created_at DESC
              LIMIT 5000
            `).bind(tenantId).all<CustomerExportRow>();
            results = scopedCanonical.results || [];
          } else {
            const canonicalRes = await db.prepare(`
              SELECT c.id, c.name, c.phone, c.email, '' AS birthday,
                     c.loyalty_tier AS tier,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled' AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'failed', 'expired') AND COALESCE(o.payment_status, '') NOT IN ('refunded', 'failed')) AS visit_count,
                     c.created_at, c.tenant_id
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              ORDER BY c.created_at DESC
              LIMIT 5000
            `).all<CustomerExportRow>();
            results = canonicalRes.results || [];
          }
        } catch {
          results = [];
        }
      }
    }
  }

  results = (results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, 5000);

  const headers = ['ID', 'Name', 'Phone', 'Email', 'Birthday', 'Tier', 'Cashback', 'Total Spent', 'Visits', 'Created'];
  const csvRows = [headers.join(',')];

  for (const row of results) {
    csvRows.push([
      escapeCsvCell(row.id),
      escapeCsvCell(row.name || '', true),
      escapeCsvCell(row.phone || ''),
      escapeCsvCell(row.email || ''),
      escapeCsvCell(row.birthday || ''),
      escapeCsvCell(row.tier || ''),
      row.cashback_balance || 0,
      row.total_spent || 0,
      row.visit_count || 0,
      escapeCsvCell(row.created_at || '')
    ].join(','));
  }

  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`);
  return c.body(csvRows.join('\n'));
});

interface CustomerExportRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  tier: string;
  cashback_balance: number;
  total_spent: number;
  visit_count: number;
  created_at: string;
}
