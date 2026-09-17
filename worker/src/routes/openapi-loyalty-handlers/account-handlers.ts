import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';

export function registerAccountHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/account - Get current user's loyalty account
  app.openapi(LoyaltyRoutes.account.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');

    const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
      .bind(user.customerId || user.id).first();

    if (!account) {
      return c.json({ success: false, error: 'Account not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...account,
        currentPoints: account.current_points,
        lifetimePoints: account.lifetime_points,
        tierUpdatedAt: account.tier_updated_at,
        lastActivityAt: account.last_activity_at,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      },
    });
  });

  // GET /api/loyalty/account/transactions - Get loyalty transactions for current user
  app.openapi(LoyaltyRoutes.account.transactions, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const query = c.req.valid('query');

    const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
      .bind(user.customerId || user.id).first();

    if (!account) {
      return c.json({ success: false, error: 'Account not found' }, 404);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE account_id = ?';
    const params: (string | number)[] = [account.id];

    if (query.type) {
      whereClause += ' AND type = ?';
      params.push(query.type);
    }

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM loyalty_transactions ${whereClause}`).bind(...params).first();
    const total = countResult?.total || 0;

    const transactions = await db.prepare(
      `SELECT * FROM loyalty_transactions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: {
        transactions: transactions.results,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // POST /api/loyalty/account/birthday-bonus - Claim birthday bonus points
  app.openapi(LoyaltyRoutes.account.claimBirthdayBonus, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();
    const currentMonth = new Date().getMonth() + 1;

    const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
      .bind(user.customerId || user.id).first();

    if (!account) {
      return c.json({ success: false, error: 'No loyalty account found' }, 404);
    }

    // Check if already claimed this month
    const existingClaim = await db.prepare(
      `SELECT * FROM loyalty_transactions
       WHERE account_id = ? AND type = 'birthday' AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`
    ).bind(account.id, String(currentMonth).padStart(2, '0'), new Date().getFullYear()).first();

    if (existingClaim) {
      return c.json({ success: false, error: 'Birthday bonus already claimed this month' }, 400);
    }

    // Birthday bonus: configurable via tier config
    const tierConfig = await db.prepare('SELECT birthday_bonus FROM loyalty_tier_configs WHERE tier = ?')
      .bind(account.tier).first();
    const birthdayPoints = tierConfig?.birthday_bonus || 500;

    const transactionId = crypto.randomUUID();
    const idempotencyKey = body.idempotencyKey || `bday_${account.id}_${now.slice(0, 7)}`;

    await db.prepare(
      `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, description, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(transactionId, account.id, 'birthday', birthdayPoints, account.current_points + birthdayPoints, 'Birthday bonus', idempotencyKey, now).run();

    await db.prepare(
      'UPDATE loyalty_accounts SET current_points = current_points + ?, lifetime_points = lifetime_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
    ).bind(birthdayPoints, birthdayPoints, now, now, account.id).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'loyalty_birthday_claim', 'loyalty_account', account.id, JSON.stringify({ points: birthdayPoints }), now).run();

    return c.json({
      success: true,
      data: {
        points: birthdayPoints,
        newBalance: account.current_points + birthdayPoints,
      },
    });
  });
}
