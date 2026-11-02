import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';
import {
  getLoyaltyAccountWithFallback,
  recordLoyaltyTransactionDualWrite,
  syncLoyaltyAccountAndCustomerBalance,
  writeLoyaltyAuditLog,
} from './loyalty-db-helpers';

const LOYALTY_ADMIN_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

async function accountBelongsToTenant(
  db: any,
  row: Record<string, unknown>,
  tenantId: string
): Promise<boolean> {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    return matchesTenantRow(row, tenantId);
  }
  const custId = String(row.customer_id ?? row.id ?? '').replace(/^la_/, '');
  if (!custId) return tenantId === 'default';

  const custRow = (await db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .bind(custId)
    .first()
    .catch(() => null)) as Record<string, unknown> | null;
  if (custRow) {
    return matchesTenantRow(custRow, tenantId);
  }

  const userRow = (await db
    .prepare('SELECT id, tenant_id FROM users WHERE id = ?')
    .bind(custId)
    .first()
    .catch(() => null)) as Record<string, unknown> | null;
  if (userRow) {
    return matchesTenantRow(userRow, tenantId);
  }

  return tenantId === 'default';
}

export function registerAdminHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/loyalty/admin/adjust-points - Adjust customer points (admin)
  app.openapi(LoyaltyRoutes.admin.adjustPoints as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();
    const tenantId = getTenantId(c);

    // Verify admin role
    if (!user || !LOYALTY_ADMIN_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
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

    // Check idempotency
    let existing: any = null;
    try {
      existing = await db.prepare('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?')
        .bind(body.idempotencyKey ?? null).first();
    } catch {
      existing = null;
    }
    if (existing) {
      return c.json({ success: false, error: 'Duplicate adjustment request' }, 409);
    }

    const { account } = await getLoyaltyAccountWithFallback(db, body.customerId, now, tenantId);

    if (!account) {
      return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
    }
    if ('tenant_id' in account && account.tenant_id !== undefined && !matchesTenantRow(account as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
    }

    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
    const newBalance = currentPoints + body.points;
    if (newBalance < 0) {
      return c.json({ success: false, error: 'Insufficient points for adjustment' }, 400);
    }

    const transactionId = crypto.randomUUID();
    const accountId = String(account.id);
    const customerId = String(account.customer_id ?? body.customerId);

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
      now,
    });

    await syncLoyaltyAccountAndCustomerBalance(db, {
      accountId,
      customerId,
      newBalance,
      lifetimeDelta: Math.max(0, body.points),
      now,
    });

    await writeLoyaltyAuditLog(
      db,
      user.id,
      'loyalty_points_adjust',
      'loyalty_account',
      accountId,
      JSON.stringify({ points: body.points, reason: body.reason }),
      now
    );

    const transaction = (await db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').bind(transactionId).first()) as any;

    return c.json({
      success: true,
      data: {
        ...transaction,
        accountId: transaction?.account_id ?? transaction?.customer_id ?? account.id,
        description: transaction?.description ?? transaction?.reason ?? body.reason,
        rewardId: transaction?.reward_id ?? null,
        idempotencyKey: transaction?.idempotency_key ?? body.idempotencyKey ?? null,
        createdAt: transaction?.created_at ?? now,
      },
    });
  });

  // GET /api/loyalty/admin/accounts - List all loyalty accounts (admin)
  app.openapi(LoyaltyRoutes.admin.accounts as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const query = c.req.valid('query');
    const tenantId = getTenantId(c);

    // Verify admin role
    if (!user || !LOYALTY_ADMIN_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
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
      whereClause += ' AND (customer_id IN (SELECT id FROM customers WHERE name LIKE ? OR email LIKE ?) OR referral_code LIKE ?)';
      const searchParam = `%${query.search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    let accountResults: any[] = [];
    try {
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
      if (tenantId === '*') {
        const accounts = (await db.prepare(
          `SELECT * FROM loyalty_accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: any[] };
        accountResults = accounts.results || [];
      } else {
        const accounts = (await db.prepare(
          `SELECT * FROM loyalty_accounts ${whereClause} ORDER BY created_at DESC`
        ).bind(...params).all()) as { results: any[] };
        accountResults = accounts.results || [];
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
        ).bind(...canonicalParams, limit, offset).all().catch(() => ({ results: [] }))) as { results: any[] };
        accountResults = accounts.results || [];
      } else {
        const accounts = (await db.prepare(
          `SELECT *, id as customer_id, loyalty_points as current_points, loyalty_points as lifetime_points, loyalty_tier as tier, visit_count as order_count FROM customers ${canonicalWhere} ORDER BY created_at DESC`
        ).bind(...canonicalParams).all().catch(() => ({ results: [] }))) as { results: any[] };
        accountResults = accounts.results || [];
      }
    }

    if (tenantId !== '*') {
      const filtered: any[] = [];
      for (const a of accountResults) {
        if (await accountBelongsToTenant(db, a as Record<string, unknown>, tenantId)) {
          filtered.push(a);
        }
      }
      accountResults = filtered.slice(offset, offset + limit);
    }

    return c.json({
      success: true,
      data: accountResults.map((a: any) => ({
        ...a,
        currentPoints: a.current_points ?? a.loyalty_points ?? 0,
        lifetimePoints: a.lifetime_points ?? a.loyalty_points ?? 0,
        tierProgress: a.tier_progress ?? 0,
        pointsToNextTier: a.points_to_next_tier ?? 0,
        totalSpent: a.total_spent ?? 0,
        orderCount: a.order_count ?? a.visit_count ?? 0,
        lastOrderAt: a.last_order_at ?? null,
        birthdayBonusClaimed: a.birthday_bonus_claimed ?? 0,
        referralCode: a.referral_code ?? null,
        referredBy: a.referred_by ?? null,
        referralCount: a.referral_count ?? 0,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      })),
    });
  });

  // GET /api/loyalty/admin/summary - Get loyalty program summary (admin)
  app.openapi(LoyaltyRoutes.admin.summary as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const tenantId = getTenantId(c);

    // Verify admin role
    if (!user || !LOYALTY_ADMIN_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    if (tenantId !== '*') {
      let allAccounts: any[] = [];
      try {
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
        const res = (await db.prepare('SELECT * FROM loyalty_accounts').all()) as { results?: any[] };
        allAccounts = res?.results || [];
      } catch {
        const res = (await db
          .prepare(
            'SELECT *, id as customer_id, loyalty_points as current_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers'
          )
          .all()
          .catch(() => ({ results: [] }))) as { results?: any[] };
        allAccounts = res?.results || [];
      }

      if (tenantId !== 'default' || allAccounts.length > 0) {
        const scopedAccounts: any[] = [];
        const scopedAccountIds = new Set<string>();
        const scopedCustomerIds = new Set<string>();
        for (const a of allAccounts) {
          if (await accountBelongsToTenant(db, a as Record<string, unknown>, tenantId)) {
            scopedAccounts.push(a);
            if (a.id !== undefined && a.id !== null) scopedAccountIds.add(String(a.id));
            if (a.customer_id !== undefined && a.customer_id !== null) scopedCustomerIds.add(String(a.customer_id));
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

        const allTxsRes = (await db
          .prepare('SELECT * FROM loyalty_transactions')
          .all()
          .catch(() => ({ results: [] }))) as { results?: any[] };
        let totalIssued = 0;
        let totalRedeemed = 0;
        let totalExpired = 0;
        for (const tx of allTxsRes?.results || []) {
          const accId = tx.account_id !== undefined && tx.account_id !== null ? String(tx.account_id) : '';
          const custId = tx.customer_id !== undefined && tx.customer_id !== null ? String(tx.customer_id) : '';
          let belongs = false;
          if ((accId && scopedAccountIds.has(accId)) || (custId && scopedCustomerIds.has(custId))) {
            belongs = true;
          } else if (custId || accId) {
            belongs = await accountBelongsToTenant(db, { customer_id: custId || accId }, tenantId);
          }
          if (!belongs) continue;
          const pts = Number(tx.points || 0);
          if (pts > 0) totalIssued += pts;
          if (pts < 0) totalRedeemed += -pts;
          if (tx.type === 'expire') totalExpired += -pts;
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
            byTier: scopedByTier,
            redemptionRate,
            avgPointsPerMember,
          },
        });
      }
    }

    let totalMembers: any = null;
    let activeMembers: any = null;
    let pointsStats: any = null;
    let byTier: any = { results: [] };

    try {
      totalMembers = await db.prepare('SELECT COUNT(*) as total FROM loyalty_accounts').first();
      activeMembers = await db.prepare(
        'SELECT COUNT(*) as total FROM loyalty_accounts WHERE last_activity_at >= datetime(\'now\', \'-30 days\')'
      ).first();
      pointsStats = await db.prepare(
        `SELECT
          SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_issued,
          SUM(CASE WHEN points < 0 THEN -points ELSE 0 END) as total_redeemed,
          SUM(CASE WHEN type = 'expire' THEN -points ELSE 0 END) as total_expired
         FROM loyalty_transactions`
      ).first();
      byTier = await db.prepare(
        'SELECT tier, COUNT(*) as count, AVG(current_points) as avg_points FROM loyalty_accounts GROUP BY tier'
      ).all();
    } catch {
      totalMembers = await db.prepare('SELECT COUNT(*) as total FROM customers').first().catch(() => ({ total: 0 }));
      activeMembers = await db.prepare(
        'SELECT COUNT(*) as total FROM customers WHERE updated_at >= datetime(\'now\', \'-30 days\')'
      ).first().catch(() => ({ total: 0 }));
      pointsStats = await db.prepare(
        `SELECT
          SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_issued,
          SUM(CASE WHEN points < 0 THEN -points ELSE 0 END) as total_redeemed,
          SUM(CASE WHEN type = 'expire' THEN -points ELSE 0 END) as total_expired
         FROM loyalty_transactions`
      ).first().catch(() => ({ total_issued: 0, total_redeemed: 0, total_expired: 0 }));
      byTier = await db.prepare(
        'SELECT loyalty_tier as tier, COUNT(*) as count, AVG(loyalty_points) as avg_points FROM customers GROUP BY loyalty_tier'
      ).all().catch(() => ({ results: [] }));
    }

    const byTierRecord: Record<string, { count: number; avgPoints: number }> = {};
    (byTier?.results || []).forEach((row: any) => {
      byTierRecord[row.tier] = {
        count: row.count,
        avgPoints: row.avg_points || 0,
      };
    });

    const totalIssued = pointsStats?.total_issued || 0;
    const totalRedeemed = pointsStats?.total_redeemed || 0;
    const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;
    const avgPointsPerMember = (totalMembers?.total || 0) > 0 ? totalIssued / totalMembers.total : 0;

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

