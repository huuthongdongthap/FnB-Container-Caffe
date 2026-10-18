import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';

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

    let account: any = null;
    let usingCanonical = false;
    try {
      account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
        .bind(body.customerId).first();
    } catch {
      usingCanonical = true;
      account = await db.prepare('SELECT *, id as customer_id, loyalty_points as current_points FROM customers WHERE id = ?')
        .bind(body.customerId).first().catch(() => null);
    }

    if (!account) {
      return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
    }

    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
    const newBalance = currentPoints + body.points;
    if (newBalance < 0) {
      return c.json({ success: false, error: 'Insufficient points for adjustment' }, 400);
    }

    const transactionId = crypto.randomUUID();

    try {
      await db.prepare(
        `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, description, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(transactionId, account.id, 'adjust', body.points, newBalance, body.reason, body.idempotencyKey ?? null, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO loyalty_transactions (id, customer_id, points, type, reason, balance_after, created_by, created_at)
         VALUES (?, ?, ?, 'adjust', ?, ?, ?, ?)`
      ).bind(transactionId, account.id, body.points, body.reason, newBalance, user.id, now).run();
    }

    if (!usingCanonical) {
      await db.prepare(
        'UPDATE loyalty_accounts SET current_points = ?, lifetime_points = lifetime_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
      ).bind(newBalance, Math.max(0, body.points), now, now, account.id).run();
    } else {
      await db.prepare(
        'UPDATE customers SET loyalty_points = ?, updated_at = ? WHERE id = ?'
      ).bind(newBalance, now, account.id).run();
    }

    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, user.id, 'loyalty_points_adjust', 'loyalty_account', account.id, JSON.stringify({ points: body.points, reason: body.reason }), now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(user.id, user.id, 'loyalty_points_adjust', 'loyalty_account', account.id, JSON.stringify({ points: body.points, reason: body.reason }), now).run().catch(() => {});
      } catch {
        // Ignore audit log error
      }
    }

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
      // Get total members
      totalMembers = await db.prepare('SELECT COUNT(*) as total FROM loyalty_accounts').first();

      // Get active members (had activity in last 30 days)
      activeMembers = await db.prepare(
        'SELECT COUNT(*) as total FROM loyalty_accounts WHERE last_activity_at >= datetime(\'now\', \'-30 days\')'
      ).first();

      // Get total points issued/redeemed/expired
      pointsStats = await db.prepare(
        `SELECT
          SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_issued,
          SUM(CASE WHEN points < 0 THEN -points ELSE 0 END) as total_redeemed,
          SUM(CASE WHEN type = 'expire' THEN -points ELSE 0 END) as total_expired
         FROM loyalty_transactions`
      ).first();

      // Get by tier breakdown
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

    // Calculate redemption rate
    const totalIssued = pointsStats?.total_issued || 0;
    const totalRedeemed = pointsStats?.total_redeemed || 0;
    const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;

    // Average points per member
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

