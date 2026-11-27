import type { OpenAPIHono, RouteConfig } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';
import {
  findExistingLoyaltyIdempotencyTx,
  getLoyaltyAccountWithFallback,
  hasOpenApiLoyaltyTenantMismatch,
  recordLoyaltyTransactionDualWrite,
  syncLoyaltyAccountAndCustomerBalance,
  writeLoyaltyAuditLog,
} from './loyalty-db-helpers';

const LOYALTY_ADMIN_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
const LOYALTY_POINT_ADJUST_ROLES = ['owner', 'manager', 'admin'];

interface LiveCustomerAggregates {
  cashbackByCustomer: Map<string, number>;
  ordersByCustomer: Map<string, { count: number; spent: number }>;
  anyOrdersByCustomer: Set<string>;
}

async function loadLiveCustomerAggregates(
  db: D1Database,
  tenantId: string
): Promise<LiveCustomerAggregates> {
  const cashbackByCustomer = new Map<string, number>();
  const ordersByCustomer = new Map<string, { count: number; spent: number }>();
  const anyOrdersByCustomer = new Set<string>();

  try {
    let walRows: Array<{ customer_id: string; balance: number; tenant_id?: string | null }> = [];
    if (tenantId === '*') {
      const walRes = await db.prepare('SELECT customer_id, balance, tenant_id FROM cashback_wallets LIMIT 5000').all<{ customer_id: string; balance: number; tenant_id?: string | null }>();
      walRows = walRes.results || [];
    } else {
      try {
        const walRes = await db
          .prepare("SELECT customer_id, balance, tenant_id FROM cashback_wallets WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 5000")
          .bind(tenantId)
          .all<{ customer_id: string; balance: number; tenant_id?: string | null }>();
        walRows = walRes.results || [];
      } catch {
        if (tenantId === 'default') {
          const walRes = await db.prepare('SELECT customer_id, balance FROM cashback_wallets LIMIT 5000').all<{ customer_id: string; balance: number }>();
          walRows = walRes.results || [];
        }
      }
    }
    for (const w of walRows) {
      if (w.customer_id && (!('tenant_id' in w) || w.tenant_id === undefined || matchesTenantRow(w as unknown as Record<string, unknown>, tenantId))) {
        const cid = String(w.customer_id);
        cashbackByCustomer.set(cid, (cashbackByCustomer.get(cid) || 0) + Number(w.balance || 0));
      }
    }
  } catch {
    // cashback_wallets absent in minimal test schemas
  }

  try {
    let ordRows: Array<{ customer_id?: string | null; total?: number | null; status?: string | null; payment_status?: string | null; tenant_id?: string | null }> = [];
    if (tenantId === '*') {
      const ordRes = await db.prepare('SELECT customer_id, total, status, payment_status, tenant_id FROM orders LIMIT 5000').all<{ customer_id?: string | null; total?: number | null; status?: string | null; payment_status?: string | null; tenant_id?: string | null }>();
      ordRows = ordRes.results || [];
    } else {
      try {
        const ordRes = await db
          .prepare("SELECT customer_id, total, status, payment_status, tenant_id FROM orders WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 5000")
          .bind(tenantId)
          .all<{ customer_id?: string | null; total?: number | null; status?: string | null; payment_status?: string | null; tenant_id?: string | null }>();
        ordRows = ordRes.results || [];
      } catch {
        if (tenantId === 'default') {
          const ordRes = await db.prepare('SELECT customer_id, total, status FROM orders LIMIT 5000').all<{ customer_id?: string | null; total?: number | null; status?: string | null }>();
          ordRows = ordRes.results || [];
        }
      }
    }
    for (const o of ordRows) {
      if (!o.customer_id) continue;
      if ('tenant_id' in o && o.tenant_id !== undefined && !matchesTenantRow(o as unknown as Record<string, unknown>, tenantId)) {
        continue;
      }
      const cid = String(o.customer_id);
      anyOrdersByCustomer.add(cid);
      const st = String(o.status ?? '').trim().toLowerCase();
      const pst = String((o as { payment_status?: string | null }).payment_status ?? '').trim().toLowerCase();
      if (
        ['cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired'].includes(st) ||
        ['refunded', 'failed', 'cancelled', 'canceled'].includes(pst)
      ) {
        continue;
      }
      const prev = ordersByCustomer.get(cid) || { count: 0, spent: 0 };
      ordersByCustomer.set(cid, {
        count: prev.count + 1,
        spent: prev.spent + Number(o.total || 0),
      });
    }
  } catch {
    // orders absent in minimal test schemas
  }

  return { cashbackByCustomer, ordersByCustomer, anyOrdersByCustomer };
}

async function loadCustomerTenantMap(db: D1Database, tenantId = '*'): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const allowUnscopedFallback = !tenantId || tenantId === 'default';
  try {
    let res: { results?: Array<Record<string, unknown>> } | null = null;
    let scopedMapFailed = false;
    if (tenantId && tenantId !== '*') {
      try {
        res = (await db
          .prepare("SELECT * FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1000")
          .bind(tenantId)
          .all()) as { results?: Array<Record<string, unknown>> } | null;
      } catch {
        scopedMapFailed = true;
        res = null;
      }
    }
    if (tenantId === '*' || (scopedMapFailed && allowUnscopedFallback)) {
      res = (await db.prepare('SELECT * FROM customers LIMIT 1000').all()) as {
        results?: Array<Record<string, unknown>>;
      } | null;
    }
    for (const c of res?.results || []) {
      if (c && c.id !== undefined && c.id !== null) {
        map.set(String(c.id), c);
      }
    }
  } catch {
    // Ignore when batch customer lookup is unavailable in minimal mocks
  }
  return map;
}

async function accountBelongsToTenant(
  db: D1Database,
  row: Record<string, unknown>,
  tenantId: string,
  customerMap?: Map<string, Record<string, unknown>>
): Promise<boolean> {
  if (tenantId === '*') return true;
  const rawAccountTenant = 'tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null
    ? String(row.tenant_id).trim()
    : '';
  if (rawAccountTenant !== '' && rawAccountTenant !== 'default') {
    return rawAccountTenant === tenantId;
  }
  const custId = String(row.customer_id ?? row.user_id ?? row.id ?? '').replace(/^la_/, '');
  if (custId) {
    const cachedCust = customerMap?.get(custId);
    if (cachedCust && 'tenant_id' in cachedCust && cachedCust.tenant_id !== undefined) {
      return matchesTenantRow(cachedCust, tenantId);
    }

    const custRow = (await db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .bind(custId)
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    if (custRow && 'tenant_id' in custRow && custRow.tenant_id !== undefined) {
      customerMap?.set(custId, custRow);
      return matchesTenantRow(custRow, tenantId);
    }

    const userRow = (await db
      .prepare('SELECT id, tenant_id FROM users WHERE id = ?')
      .bind(custId)
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    if (userRow && 'tenant_id' in userRow && userRow.tenant_id !== undefined) {
      return matchesTenantRow(userRow, tenantId);
    }
  }
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    return matchesTenantRow(row, tenantId);
  }

  return tenantId === 'default';
}

export function registerAdminHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  type OpenApiAdminCtx = Context<{ Bindings: Env; Variables: { user?: { id: string; role: string; tenantId?: string; tenant_id?: string }; tenantId?: string } }> & {
    req: { valid: (target: string) => Record<string, unknown> };
  };

  // POST /api/loyalty/admin/adjust-points - Adjust customer points (admin)
  app.openapi(LoyaltyRoutes.admin.adjustPoints as unknown as RouteConfig, async (rawCtx) => {
    const c = rawCtx as unknown as OpenApiAdminCtx;
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json') as { customerId: string; points: number; reason: string; idempotencyKey?: string };
    const now = new Date().toISOString();
    const tenantId = getTenantId(c);

    // Verify admin role
    const isAuthBearerSupervisor = user?.role === 'supervisor' && Boolean(c.req?.header?.('Authorization') || c.req?.header?.('authorization'));
    if (!user || (!LOYALTY_POINT_ADJUST_ROLES.includes(user.role) && !isAuthBearerSupervisor)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    if (hasOpenApiLoyaltyTenantMismatch(c, tenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }
    if (!Number.isFinite(body.points) || body.points === 0) {
      return c.json({ success: false, error: 'Points adjustment must be non-zero' }, 400);
    }

    if (tenantId !== '*') {
      const userRow = (await db
        .prepare('SELECT id, tenant_id FROM users WHERE id = ?')
        .bind(body.customerId)
        .first()
        .catch(() => null)) as Record<string, unknown> | null;
      if (userRow && !matchesTenantRow(userRow, tenantId)) {
        return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
      }
      const custRow = (await db
        .prepare('SELECT * FROM customers WHERE id = ?')
        .bind(body.customerId)
        .first()
        .catch(() => null)) as Record<string, unknown> | null;
      if (custRow && !matchesTenantRow(custRow, tenantId)) {
        return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
      }
      if (!userRow && !custRow && tenantId !== 'default') {
        return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
      }
    }

    const { account } = await getLoyaltyAccountWithFallback(db, body.customerId, now, tenantId);

    if (!account || !(await accountBelongsToTenant(db, account as Record<string, unknown>, tenantId))) {
      return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
    }

    const accountId = String(account.id);
    const customerId = String(account.customer_id ?? body.customerId);
    const effectiveAdjustTenant =
      tenantId === '*'
        ? (typeof account.tenant_id === 'string' && account.tenant_id.trim()) || 'default'
        : tenantId;

    // Check idempotency isolated by tenant and customer ownership
    const existing = await findExistingLoyaltyIdempotencyTx(db, body.idempotencyKey, {
      tenantId: effectiveAdjustTenant,
      customerId,
      accountId,
    });
    if (existing) {
      return c.json({ success: false, error: 'Duplicate adjustment request' }, 409);
    }

    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
    const expectedBalance = currentPoints + body.points;
    if (expectedBalance < 0) {
      return c.json({ success: false, error: 'Insufficient points for adjustment' }, 400);
    }

    const transactionId = crypto.randomUUID();

    const resolvedBalance = await syncLoyaltyAccountAndCustomerBalance(db, {
      accountId,
      customerId,
      newBalance: expectedBalance,
      pointsDelta: body.points,
      lifetimeDelta: Math.max(0, body.points),
      tenantId: effectiveAdjustTenant,
      now,
    });
    if (body.points < 0 && resolvedBalance === null) {
      return c.json({ success: false, error: 'Insufficient points for adjustment' }, 409);
    }
    const newBalance = typeof resolvedBalance === 'number' && Number.isFinite(resolvedBalance) ? resolvedBalance : expectedBalance;

    await recordLoyaltyTransactionDualWrite(db, {
      txId: transactionId,
      accountId,
      customerId,
      type: 'adjust',
      points: body.points,
      balanceAfter: newBalance,
      description: body.reason,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey ?? null,
      createdBy: user.id,
      tenantId: effectiveAdjustTenant,
      now,
    });

    await writeLoyaltyAuditLog(
      db,
      user.id,
      'loyalty_points_adjust',
      'loyalty_account',
      accountId,
      JSON.stringify({ points: body.points, reason: body.reason }),
      now,
      effectiveAdjustTenant
    );

    const transaction = (await db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').bind(transactionId).first()) as Record<string, unknown> | null;

    return c.json({
      success: true,
      data: {
        ...(transaction || {}),
        accountId: transaction?.account_id ?? transaction?.customer_id ?? account.id,
        description: transaction?.description ?? transaction?.reason ?? body.reason,
        rewardId: transaction?.reward_id ?? null,
        idempotencyKey: transaction?.idempotency_key ?? body.idempotencyKey ?? null,
        createdAt: transaction?.created_at ?? now,
      },
    });
  });

  // GET /api/loyalty/admin/accounts - List all loyalty accounts (admin)
  app.openapi(LoyaltyRoutes.admin.accounts as unknown as RouteConfig, async (rawCtx) => {
    const c = rawCtx as unknown as OpenApiAdminCtx;
    const db = getDatabase(c);
    const user = c.get('user');
    const query = c.req.valid('query') as { page?: number; limit?: number; tier?: string; search?: string };
    const tenantId = getTenantId(c);

    // Verify admin role
    if (!user || !LOYALTY_ADMIN_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    if (hasOpenApiLoyaltyTenantMismatch(c, tenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (query.tier) {
      whereClause += ' AND tier = ?';
      params.push(query.tier);
    }

    if (query.search) {
      whereClause += ' AND (customer_id IN (SELECT id FROM customers WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?) OR referral_code LIKE ?)';
      const searchParam = `%${query.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    let accountResults: Record<string, unknown>[] = [];
    try {
      try {
        await db.prepare(
          `INSERT OR IGNORE INTO loyalty_accounts (
            id, customer_id, current_points, lifetime_points, tier, order_count, total_spent, last_activity_at, tenant_id, created_at, updated_at
          )
          SELECT
            'la_' || c.id,
            c.id,
            COALESCE(c.loyalty_points, 0),
            COALESCE(c.lifetime_points, c.loyalty_points, 0),
            COALESCE(NULLIF(c.loyalty_tier, ''), 'bronze'),
            COALESCE((SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND COALESCE(o.status, '') NOT IN ('cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired')), c.visit_count, 0),
            COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.customer_id = c.id AND COALESCE(o.status, '') NOT IN ('cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired')), c.total_spent, 0),
            COALESCE(c.updated_at, c.created_at, datetime('now')),
            COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default'),
            COALESCE(c.created_at, datetime('now')),
            COALESCE(c.updated_at, datetime('now'))
          FROM customers c
          WHERE (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)`
        ).bind(tenantId, tenantId).run();
      } catch {
        try {
          await db.prepare(
            `INSERT OR IGNORE INTO loyalty_accounts (
              id, customer_id, current_points, lifetime_points, tier, order_count, total_spent, last_activity_at, tenant_id, created_at, updated_at
            )
            SELECT
              'la_' || id,
              id,
              COALESCE(loyalty_points, 0),
              COALESCE(lifetime_points, loyalty_points, 0),
              COALESCE(NULLIF(loyalty_tier, ''), 'bronze'),
              COALESCE(visit_count, 0),
              COALESCE(total_spent, 0),
              COALESCE(updated_at, created_at, datetime('now')),
              COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
              COALESCE(created_at, datetime('now')),
              COALESCE(updated_at, datetime('now'))
            FROM customers
            WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
          ).bind(tenantId, tenantId).run();
        } catch {
          if (tenantId === 'default') {
            await db.prepare(
              `INSERT OR IGNORE INTO loyalty_accounts (
                id, customer_id, current_points, lifetime_points, tier, order_count, total_spent, last_activity_at, created_at, updated_at
              )
              SELECT
                'la_' || id,
                id,
                COALESCE(loyalty_points, 0),
                COALESCE(lifetime_points, loyalty_points, 0),
                COALESCE(NULLIF(loyalty_tier, ''), 'bronze'),
                COALESCE(visit_count, 0),
                COALESCE(total_spent, 0),
                COALESCE(updated_at, created_at, datetime('now')),
                COALESCE(created_at, datetime('now')),
                COALESCE(updated_at, datetime('now'))
              FROM customers`
            ).run();
          }
        }
      }
      if (tenantId === '*') {
        const accounts = (await db.prepare(
          `SELECT * FROM loyalty_accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: Record<string, unknown>[] };
        accountResults = accounts.results || [];
      } else {
        let scopedQueryFailed = false;
        try {
          const scopedAccounts = (await db.prepare(
            `SELECT * FROM loyalty_accounts ${whereClause} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 1000`
          ).bind(...params, tenantId).all()) as { results: Record<string, unknown>[] };
          accountResults = scopedAccounts.results || [];
        } catch {
          scopedQueryFailed = true;
          accountResults = [];
        }
        if (scopedQueryFailed && tenantId === 'default') {
          const accounts = (await db.prepare(
            `SELECT * FROM loyalty_accounts ${whereClause} ORDER BY created_at DESC LIMIT 1000`
          ).bind(...params).all()) as { results: Record<string, unknown>[] };
          accountResults = accounts.results || [];
        }
      }
    } catch {
      let canonicalWhere = 'WHERE 1=1';
      const canonicalParams: (string | number)[] = [];
      if (query.tier) {
        canonicalWhere += ' AND loyalty_tier = ?';
        canonicalParams.push(query.tier);
      }
      if (query.search) {
        canonicalWhere += ' AND (name LIKE ? OR email LIKE ? OR referral_code LIKE ?)';
        const searchParam = `%${query.search}%`;
        canonicalParams.push(searchParam, searchParam, searchParam);
      }
      if (tenantId === '*') {
        const accounts = (await db.prepare(
          `SELECT *, id as customer_id, loyalty_points as current_points, loyalty_points as lifetime_points, loyalty_tier as tier, visit_count as order_count FROM customers ${canonicalWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...canonicalParams, limit, offset).all().catch(() => ({ results: [] }))) as { results: Record<string, unknown>[] };
        accountResults = accounts.results || [];
      } else {
        let scopedCustFailed = false;
        try {
          const scopedAccounts = (await db.prepare(
            `SELECT *, id as customer_id, loyalty_points as current_points, loyalty_points as lifetime_points, loyalty_tier as tier, visit_count as order_count FROM customers ${canonicalWhere} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 1000`
          ).bind(...canonicalParams, tenantId).all()) as { results: Record<string, unknown>[] };
          accountResults = scopedAccounts.results || [];
        } catch {
          scopedCustFailed = true;
          accountResults = [];
        }
        if (scopedCustFailed && tenantId === 'default') {
          const accounts = (await db.prepare(
            `SELECT *, id as customer_id, loyalty_points as current_points, loyalty_points as lifetime_points, loyalty_tier as tier, visit_count as order_count FROM customers ${canonicalWhere} ORDER BY created_at DESC LIMIT 1000`
          ).bind(...canonicalParams).all().catch(() => ({ results: [] }))) as { results: Record<string, unknown>[] };
          accountResults = accounts.results || [];
        }
      }
    }

    if (tenantId !== '*') {
      const customerMap = await loadCustomerTenantMap(db, tenantId);
      const filtered: Record<string, unknown>[] = [];
      for (const a of accountResults) {
        if (await accountBelongsToTenant(db, a, tenantId, customerMap)) {
          filtered.push(a);
        }
      }
      accountResults = filtered.slice(offset, offset + limit);
    }

    const liveAgg = await loadLiveCustomerAggregates(db, tenantId);

    return c.json({
      success: true,
      data: accountResults.map((a) => {
        const cid = String(a.customer_id ?? a.user_id ?? String(a.id ?? '').replace(/^la_/, ''));
        const ordStat = liveAgg.ordersByCustomer.get(cid);
        const hasOrdRows = liveAgg.anyOrdersByCustomer.has(cid);
        const resolvedOrderCount = hasOrdRows
          ? (ordStat?.count ?? 0)
          : Number(a.order_count ?? a.visit_count ?? 0);
        const resolvedTotalSpent = hasOrdRows
          ? (ordStat?.spent ?? 0)
          : Number(a.total_spent ?? 0);
        const resolvedCashbackBalance = liveAgg.cashbackByCustomer.has(cid)
          ? liveAgg.cashbackByCustomer.get(cid)!
          : Number(a.cashback_balance ?? 0);

        return {
          ...a,
          currentPoints: a.current_points ?? a.loyalty_points ?? 0,
          lifetimePoints: a.lifetime_points ?? a.loyalty_points ?? 0,
          tierProgress: a.tier_progress ?? 0,
          pointsToNextTier: a.points_to_next_tier ?? 0,
          cashbackBalance: resolvedCashbackBalance,
          cashback_balance: resolvedCashbackBalance,
          totalSpent: resolvedTotalSpent,
          total_spent: resolvedTotalSpent,
          orderCount: resolvedOrderCount,
          order_count: resolvedOrderCount,
          lastOrderAt: a.last_order_at ?? null,
          birthdayBonusClaimed: a.birthday_bonus_claimed ?? 0,
          referralCode: a.referral_code ?? null,
          referredBy: a.referred_by ?? null,
          referralCount: a.referral_count ?? 0,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        };
      }),
    });
  });

  // GET /api/loyalty/admin/summary - Get loyalty program summary (admin)
  app.openapi(LoyaltyRoutes.admin.summary as unknown as RouteConfig, async (rawCtx) => {
    const c = rawCtx as unknown as OpenApiAdminCtx;
    const db = getDatabase(c);
    const user = c.get('user');
    const tenantId = getTenantId(c);

    // Verify admin role
    if (!user || !LOYALTY_ADMIN_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    if (hasOpenApiLoyaltyTenantMismatch(c, tenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }

    if (tenantId !== '*') {
      let allAccounts: Record<string, unknown>[] = [];
      let scopedQuerySucceeded = false;
      try {
        try {
          await db.prepare(
            `INSERT OR IGNORE INTO loyalty_accounts (
              id, customer_id, current_points, lifetime_points, tier, order_count, total_spent, last_activity_at, tenant_id, created_at, updated_at
            )
            SELECT
              'la_' || id,
              id,
              COALESCE(loyalty_points, 0),
              COALESCE(lifetime_points, loyalty_points, 0),
              COALESCE(NULLIF(loyalty_tier, ''), 'bronze'),
              COALESCE(visit_count, 0),
              COALESCE(total_spent, 0),
              COALESCE(updated_at, created_at, datetime('now')),
              COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
              COALESCE(created_at, datetime('now')),
              COALESCE(updated_at, datetime('now'))
            FROM customers
            WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
          ).bind(tenantId, tenantId).run();
        } catch {
          if (tenantId === 'default') {
            await db.prepare(
              `INSERT OR IGNORE INTO loyalty_accounts (
                id, customer_id, current_points, lifetime_points, tier, order_count, total_spent, last_activity_at, created_at, updated_at
              )
              SELECT
                'la_' || id,
                id,
                COALESCE(loyalty_points, 0),
                COALESCE(lifetime_points, loyalty_points, 0),
                COALESCE(NULLIF(loyalty_tier, ''), 'bronze'),
                COALESCE(visit_count, 0),
                COALESCE(total_spent, 0),
                COALESCE(updated_at, created_at, datetime('now')),
                COALESCE(created_at, datetime('now')),
                COALESCE(updated_at, datetime('now'))
              FROM customers`
            ).run().catch(() => {});
          }
        }
        let scopedAcctFailed = false;
        try {
          const scopedRes = (await db
            .prepare("SELECT * FROM loyalty_accounts WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1000")
            .bind(tenantId)
            .all()) as { results?: Record<string, unknown>[] };
          allAccounts = scopedRes?.results || [];
        } catch {
          scopedAcctFailed = true;
          allAccounts = [];
        }
        if (scopedAcctFailed && tenantId === 'default') {
          const res = (await db.prepare('SELECT * FROM loyalty_accounts LIMIT 1000').all()) as { results?: Record<string, unknown>[] };
          allAccounts = res?.results || [];
        }
        scopedQuerySucceeded = true;
      } catch {
        let res: { results?: Record<string, unknown>[] } | null = null;
        try {
          res = (await db
            .prepare(
              "SELECT *, id as customer_id, loyalty_points as current_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1000"
            )
            .bind(tenantId)
            .all()) as { results?: Record<string, unknown>[] } | null;
        } catch {
          res = null;
        }
        if (!res && tenantId === 'default') {
          res = (await db
            .prepare(
              'SELECT *, id as customer_id, loyalty_points as current_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers LIMIT 1000'
            )
            .all()
            .catch(() => null)) as { results?: Record<string, unknown>[] } | null;
        }
        if (res) {
          allAccounts = res.results || [];
          scopedQuerySucceeded = true;
        }
      }

      if (scopedQuerySucceeded || tenantId !== 'default') {
        const customerMap = await loadCustomerTenantMap(db, tenantId);
        const scopedAccounts: Record<string, unknown>[] = [];
        const scopedAccountIds = new Set<string>();
        const scopedCustomerIds = new Set<string>();
        for (const a of allAccounts) {
          if (await accountBelongsToTenant(db, a, tenantId, customerMap)) {
            scopedAccounts.push(a);
            if (a.id !== undefined && a.id !== null) scopedAccountIds.add(String(a.id));
            if (a.customer_id !== undefined && a.customer_id !== null) scopedCustomerIds.add(String(a.customer_id));
            if (a.user_id !== undefined && a.user_id !== null) scopedCustomerIds.add(String(a.user_id));
          }
        }

        const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();
        const totalMembersCount = scopedAccounts.length;
        const activeMembersCount = scopedAccounts.filter((a) => {
          const ts = String(a.last_activity_at ?? a.updated_at ?? '');
          return ts >= thirtyDaysAgoIso;
        }).length;

        const tierGroups = new Map<string, { count: number; sumPoints: number }>();
        for (const a of scopedAccounts) {
          const tier = String(a.tier ?? a.loyalty_tier ?? 'bronze');
          const pts = Number(a.current_points ?? a.loyalty_points ?? 0);
          const prev = tierGroups.get(tier) || { count: 0, sumPoints: 0 };
          tierGroups.set(tier, { count: prev.count + 1, sumPoints: prev.sumPoints + pts });
        }
        const scopedByTier: Record<string, { count: number; avgPoints: number }> = {};
        for (const [tier, g] of tierGroups.entries()) {
          scopedByTier[tier] = {
            count: g.count,
            avgPoints: g.count > 0 ? g.sumPoints / g.count : 0,
          };
        }

        let allTxsRes = (await db
          .prepare("SELECT * FROM loyalty_transactions WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 1000")
          .bind(tenantId)
          .all()
          .catch(() => null)) as { results?: Record<string, unknown>[] } | null;
        if (!allTxsRes && tenantId === 'default') {
          allTxsRes = (await db
            .prepare('SELECT * FROM loyalty_transactions ORDER BY created_at DESC LIMIT 1000')
            .all()
            .catch(() => ({ results: [] }))) as { results?: Record<string, unknown>[] };
        }
        let totalIssued = 0;
        let totalRedeemed = 0;
        let totalExpired = 0;
        for (const tx of allTxsRes?.results || []) {
          const accId = tx.account_id !== undefined && tx.account_id !== null ? String(tx.account_id) : '';
          const custId = tx.customer_id !== undefined && tx.customer_id !== null
            ? String(tx.customer_id)
            : (tx.user_id !== undefined && tx.user_id !== null ? String(tx.user_id) : '');
          let belongs = false;
          if ((accId && scopedAccountIds.has(accId)) || (custId && scopedCustomerIds.has(custId))) {
            belongs = true;
          } else if (custId || accId) {
            belongs = await accountBelongsToTenant(db, { customer_id: custId || accId }, tenantId, customerMap);
          }
          if (!belongs) continue;
          const pts = Number(tx.points || 0);
          const txType = String(tx.type || '').trim().toLowerCase();
          if (pts > 0) totalIssued += pts;
          if (txType === 'redeem' || (pts < 0 && !txType)) totalRedeemed += Math.abs(pts);
          if (txType === 'expire') totalExpired += Math.abs(pts);
        }

        const liveAgg = await loadLiveCustomerAggregates(db, tenantId);
        let totalCashbackPool = 0;
        for (const cid of scopedCustomerIds) {
          totalCashbackPool += liveAgg.cashbackByCustomer.get(cid) || 0;
        }

        const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;
        const avgPointsPerMember = totalMembersCount > 0 ? totalIssued / totalMembersCount : 0;

        return c.json({
          success: true,
          data: {
            totalMembers: totalMembersCount,
            activeMembers: activeMembersCount,
            totalPointsIssued: totalIssued,
            totalPointsRedeemed: totalRedeemed,
            totalPointsExpired: totalExpired,
            totalCashbackPool,
            byTier: scopedByTier,
            redemptionRate,
            avgPointsPerMember,
          },
        });
      }
    }

    let totalMembers: { total?: number } | null = null;
    let activeMembers: { total?: number } | null = null;
    let pointsStats: { total_issued?: number; total_redeemed?: number; total_expired?: number } | null = null;
    let byTier: { results?: Array<{ tier: string; count: number; avg_points?: number }> } = { results: [] };

    try {
      totalMembers = await db.prepare('SELECT COUNT(*) as total FROM loyalty_accounts').first<{ total?: number }>();
      activeMembers = await db.prepare(
        'SELECT COUNT(*) as total FROM loyalty_accounts WHERE last_activity_at >= datetime(\'now\', \'-30 days\')'
      ).first<{ total?: number }>();
      pointsStats = await db.prepare(
        `SELECT
          SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_issued,
          SUM(CASE WHEN LOWER(COALESCE(type, '')) = 'redeem' OR (points < 0 AND (type IS NULL OR TRIM(type) = '')) THEN ABS(points) ELSE 0 END) as total_redeemed,
          SUM(CASE WHEN type = 'expire' THEN ABS(points) ELSE 0 END) as total_expired
         FROM loyalty_transactions`
      ).first<{ total_issued?: number; total_redeemed?: number; total_expired?: number }>();
      byTier = await db.prepare(
        'SELECT tier, COUNT(*) as count, AVG(current_points) as avg_points FROM loyalty_accounts GROUP BY tier'
      ).all<{ tier: string; count: number; avg_points?: number }>();
    } catch {
      totalMembers = await db.prepare('SELECT COUNT(*) as total FROM customers').first<{ total?: number }>().catch(() => ({ total: 0 }));
      activeMembers = await db.prepare(
        'SELECT COUNT(*) as total FROM customers WHERE updated_at >= datetime(\'now\', \'-30 days\')'
      ).first<{ total?: number }>().catch(() => ({ total: 0 }));
      pointsStats = await db.prepare(
        `SELECT
          SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_issued,
          SUM(CASE WHEN LOWER(COALESCE(type, '')) = 'redeem' OR (points < 0 AND (type IS NULL OR TRIM(type) = '')) THEN ABS(points) ELSE 0 END) as total_redeemed,
          SUM(CASE WHEN type = 'expire' THEN ABS(points) ELSE 0 END) as total_expired
         FROM loyalty_transactions`
      ).first<{ total_issued?: number; total_redeemed?: number; total_expired?: number }>().catch(() => ({ total_issued: 0, total_redeemed: 0, total_expired: 0 }));
      byTier = await db.prepare(
        'SELECT loyalty_tier as tier, COUNT(*) as count, AVG(loyalty_points) as avg_points FROM customers GROUP BY loyalty_tier'
      ).all<{ tier: string; count: number; avg_points?: number }>().catch(() => ({ results: [] }));
    }

    const byTierRecord: Record<string, { count: number; avgPoints: number }> = {};
    (byTier?.results || []).forEach((row) => {
      byTierRecord[row.tier] = {
        count: row.count,
        avgPoints: row.avg_points || 0,
      };
    });

    const totalIssued = pointsStats?.total_issued || 0;
    const totalRedeemed = pointsStats?.total_redeemed || 0;
    const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;
    const memberCount = totalMembers?.total || 0;
    const avgPointsPerMember = memberCount > 0 ? totalIssued / memberCount : 0;

    return c.json({
      success: true,
      data: {
        totalMembers: totalMembers?.total || 0,
        activeMembers: activeMembers?.total || 0,
        totalPointsIssued: totalIssued,
        totalPointsRedeemed: totalRedeemed,
        totalPointsExpired: pointsStats?.total_expired || 0,
        byTier: byTierRecord,
        redemptionRate,
        avgPointsPerMember,
      },
    });
  });
}

