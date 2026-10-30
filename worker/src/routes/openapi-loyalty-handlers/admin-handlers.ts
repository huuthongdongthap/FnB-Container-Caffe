import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';
import {
  getLoyaltyAccountWithFallback,
  recordLoyaltyTransactionDualWrite,
  syncLoyaltyAccountAndCustomerBalance,
  writeLoyaltyAuditLog,
} from './loyalty-db-helpers';

export function registerAdminHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/loyalty/admin/adjust-points - Adjust customer points (admin)
  app.openapi(LoyaltyRoutes.admin.adjustPoints as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    // Verify admin role
    if (user.role !== 'owner' && user.role !== 'manager' && user.role !== 'admin') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
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

    const { account } = await getLoyaltyAccountWithFallback(db, body.customerId, now);

    if (!account) {
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

    // Verify admin role
    if (user.role !== 'owner' && user.role !== 'manager' && user.role !== 'admin') {
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
      const accounts = (await db.prepare(
        `SELECT * FROM loyalty_accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      accountResults = accounts.results || [];
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
      const accounts = (await db.prepare(
        `SELECT *, id as customer_id, loyalty_points as current_points, loyalty_points as lifetime_points, loyalty_tier as tier, visit_count as order_count FROM customers ${canonicalWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...canonicalParams, limit, offset).all().catch(() => ({ results: [] }))) as { results: any[] };
      accountResults = accounts.results || [];
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

    // Verify admin role
    if (user.role !== 'owner' && user.role !== 'manager' && user.role !== 'admin') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
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

