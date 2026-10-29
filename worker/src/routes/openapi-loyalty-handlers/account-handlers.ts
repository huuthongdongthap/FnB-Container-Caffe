import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';

async function getLoyaltyAccountWithFallback(db: any, customerId: string): Promise<{ account: any; usingCanonical: boolean }> {
  try {
    const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
      .bind(customerId).first();
    return { account, usingCanonical: false };
  } catch {
    const cust = (await db.prepare(
      'SELECT *, id as customer_id, loyalty_points as current_points, loyalty_points as lifetime_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers WHERE id = ?'
    ).bind(customerId).first().catch(() => null)) as any;
    return { account: cust, usingCanonical: true };
  }
}

export function registerAccountHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/account - Get current user's loyalty account
  app.openapi(LoyaltyRoutes.account.get as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');

    const { account } = await getLoyaltyAccountWithFallback(db, user.customerId || user.id);

    if (!account) {
      return c.json({ success: false, error: 'Account not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...account,
        currentPoints: account.current_points ?? account.loyalty_points ?? 0,
        lifetimePoints: account.lifetime_points ?? account.loyalty_points ?? 0,
        tierUpdatedAt: account.tier_updated_at ?? account.updated_at ?? null,
        lastActivityAt: account.last_activity_at ?? account.updated_at ?? null,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      },
    });
  });

  // GET /api/loyalty/account/transactions - Get loyalty transactions for current user
  app.openapi(LoyaltyRoutes.account.transactions as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const query = c.req.valid('query');

    const { account } = await getLoyaltyAccountWithFallback(db, user.customerId || user.id);

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

    let total = 0;
    let transactionsResults: any[] = [];
    try {
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM loyalty_transactions ${whereClause}`).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const transactions = (await db.prepare(
        `SELECT * FROM loyalty_transactions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      transactionsResults = transactions.results || [];
    } catch {
      const canonicalWhere = whereClause.replace('account_id = ?', 'customer_id = ?');
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM loyalty_transactions ${canonicalWhere}`).bind(...params).first().catch(() => null)) as { total: number } | null;
      total = countResult?.total || 0;

      const transactions = (await db.prepare(
        `SELECT *, customer_id as account_id, reason as description FROM loyalty_transactions ${canonicalWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all().catch(() => ({ results: [] }))) as { results: any[] };
      transactionsResults = transactions.results || [];
    }

    return c.json({
      success: true,
      data: {
        transactions: transactionsResults,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // POST /api/loyalty/account/birthday-bonus - Claim birthday bonus points
  app.openapi(LoyaltyRoutes.account.claimBirthdayBonus as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = String(new Date().getFullYear());

    const { account, usingCanonical } = await getLoyaltyAccountWithFallback(db, user.customerId || user.id);

    if (!account) {
      return c.json({ success: false, error: 'No loyalty account found' }, 404);
    }

    // Check if already claimed this month
    let existingClaim: any = null;
    try {
      existingClaim = await db.prepare(
        `SELECT * FROM loyalty_transactions
         WHERE account_id = ? AND type = 'birthday' AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`
      ).bind(account.id, String(currentMonth).padStart(2, '0'), currentYear).first();
    } catch {
      existingClaim = await db.prepare(
        `SELECT * FROM loyalty_transactions
         WHERE customer_id = ? AND (type = 'birthday' OR reason = 'Birthday bonus') AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`
      ).bind(account.id, String(currentMonth).padStart(2, '0'), currentYear).first().catch(() => null);
    }

    if (existingClaim) {
      return c.json({ success: false, error: 'Birthday bonus already claimed this month' }, 400);
    }

    // Birthday bonus: configurable via tier config
    let tierConfig: any = null;
    try {
      tierConfig = await db.prepare('SELECT birthday_bonus FROM loyalty_tier_configs WHERE tier = ?')
        .bind(account.tier).first();
    } catch {
      tierConfig = await db.prepare('SELECT * FROM tier_configs WHERE tier = ?')
        .bind(account.tier).first().catch(() => null);
    }
    const birthdayPoints = tierConfig?.birthday_bonus || 500;

    const transactionId = crypto.randomUUID();
    const idempotencyKey = body.idempotencyKey || `bday_${account.id}_${now.slice(0, 7)}`;
    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);

    try {
      await db.prepare(
        `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, description, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(transactionId, account.id, 'birthday', birthdayPoints, currentPoints + birthdayPoints, 'Birthday bonus', idempotencyKey, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO loyalty_transactions (id, customer_id, type, points, balance_after, reason, created_at)
         VALUES (?, ?, 'bonus', ?, ?, 'Birthday bonus', ?)`
      ).bind(transactionId, account.id, birthdayPoints, currentPoints + birthdayPoints, now).run();
    }

    if (!usingCanonical) {
      await db.prepare(
        'UPDATE loyalty_accounts SET current_points = current_points + ?, lifetime_points = lifetime_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
      ).bind(birthdayPoints, birthdayPoints, now, now, account.id).run();
    } else {
      await db.prepare(
        'UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = ? WHERE id = ?'
      ).bind(birthdayPoints, now, account.id).run();
    }

    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${Date.now()}`, user.id, 'loyalty_birthday_claim', 'loyalty_account', account.id, JSON.stringify({ points: birthdayPoints }), now).run();
    } catch {
      const metaStr = JSON.stringify({ points: birthdayPoints });
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(user.id, user.id, user.id, 'loyalty_birthday_claim', 'loyalty_account', account.id, 'loyalty_account', account.id, metaStr, metaStr, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(user.id, user.id, 'loyalty_birthday_claim', 'loyalty_account', account.id, metaStr, now).run().catch(() => {});
        } catch {
          // Ignore audit log error
        }
      }
    }

    return c.json({
      success: true,
      data: {
        points: birthdayPoints,
        newBalance: currentPoints + birthdayPoints,
      },
    });
  });
}

