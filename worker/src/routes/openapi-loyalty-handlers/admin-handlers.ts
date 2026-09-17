import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';

export function registerAdminHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/loyalty/admin/adjust-points - Adjust customer points (admin)
  app.openapi(LoyaltyRoutes.admin.adjustPoints, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    // Verify admin role
    if (user.role !== 'owner' && user.role !== 'manager') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    // Check idempotency
    const existing = await db.prepare('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?')
      .bind(body.idempotencyKey).first();
    if (existing) {
      return c.json({ success: false, error: 'Duplicate adjustment request' }, 409);
    }

    const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
      .bind(body.customerId).first();

    if (!account) {
      return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
    }

    const newBalance = account.current_points + body.points;
    if (newBalance < 0) {
      return c.json({ success: false, error: 'Insufficient points for adjustment' }, 400);
    }

    const transactionId = crypto.randomUUID();

    await db.prepare(
      `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, description, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(transactionId, account.id, 'adjust', body.points, newBalance, body.reason, body.idempotencyKey, now).run();

    await db.prepare(
      'UPDATE loyalty_accounts SET current_points = ?, lifetime_points = lifetime_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
    ).bind(newBalance, Math.max(0, body.points), now, now, account.id).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'loyalty_points_adjust', 'loyalty_account', account.id, JSON.stringify({ points: body.points, reason: body.reason }), now).run();

    const transaction = await db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').bind(transactionId).first();

    return c.json({
      success: true,
      data: {
        ...transaction!,
        accountId: transaction!.account_id,
        rewardId: transaction!.reward_id,
        idempotencyKey: transaction!.idempotency_key,
        createdAt: transaction!.created_at,
      },
    });
  });

  // GET /api/loyalty/admin/accounts - List all loyalty accounts (admin)
  app.openapi(LoyaltyRoutes.admin.accounts, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const query = c.req.valid('query');

    // Verify admin role
    if (user.role !== 'owner' && user.role !== 'manager') {
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

    const accounts = await db.prepare(
      `SELECT * FROM loyalty_accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: accounts.results.map(a => ({
        ...a,
        currentPoints: a.current_points,
        lifetimePoints: a.lifetime_points,
        tierProgress: a.tier_progress,
        pointsToNextTier: a.points_to_next_tier,
        totalSpent: a.total_spent,
        orderCount: a.order_count,
        lastOrderAt: a.last_order_at,
        birthdayBonusClaimed: a.birthday_bonus_claimed,
        referralCode: a.referral_code,
        referredBy: a.referred_by,
        referralCount: a.referral_count,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      })),
    });
  });

  // GET /api/loyalty/admin/summary - Get loyalty program summary (admin)
  app.openapi(LoyaltyRoutes.admin.summary, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');

    // Verify admin role
    if (user.role !== 'owner' && user.role !== 'manager') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    // Get total members
    const totalMembers = await db.prepare('SELECT COUNT(*) as total FROM loyalty_accounts').first();

    // Get active members (had activity in last 30 days)
    const activeMembers = await db.prepare(
      'SELECT COUNT(*) as total FROM loyalty_accounts WHERE last_activity_at >= datetime(\'now\', \'-30 days\')'
    ).first();

    // Get total points issued/redeemed/expired
    const pointsStats = await db.prepare(
      `SELECT
        SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_issued,
        SUM(CASE WHEN points < 0 THEN -points ELSE 0 END) as total_redeemed,
        SUM(CASE WHEN type = 'expire' THEN -points ELSE 0 END) as total_expired
       FROM loyalty_transactions`
    ).first();

    // Get by tier breakdown
    const byTier = await db.prepare(
      'SELECT tier, COUNT(*) as count, AVG(current_points) as avg_points FROM loyalty_accounts GROUP BY tier'
    ).all();

    const byTierRecord: Record<string, { count: number; avgPoints: number }> = {};
    byTier.results.forEach(row => {
      byTierRecord[row.tier] = {
        count: row.count,
        avgPoints: row.avg_points || 0,
      };
    });

    // Calculate redemption rate
    const totalIssued = pointsStats.total_issued || 0;
    const totalRedeemed = pointsStats.total_redeemed || 0;
    const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;

    // Average points per member
    const avgPointsPerMember = totalMembers?.total > 0 ? totalIssued / totalMembers.total : 0;

    return c.json({
      success: true,
      data: {
        totalMembers: totalMembers?.total || 0,
        activeMembers: activeMembers?.total || 0,
        totalPointsIssued: totalIssued,
        totalPointsRedeemed: totalRedeemed,
        totalPointsExpired: pointsStats.total_expired || 0,
        byTier: byTierRecord,
        redemptionRate,
        avgPointsPerMember,
      },
    });
  });
}
