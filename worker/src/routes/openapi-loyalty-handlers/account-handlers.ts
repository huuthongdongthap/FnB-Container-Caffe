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
    const customerId = String(user.customerId || user.id);

    const { account } = await getLoyaltyAccountWithFallback(db, customerId);

    if (!account) {
      return c.json({ success: false, error: 'Account not found' }, 404);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const accountCustomerId = String(account.customer_id ?? customerId);

    let whereClause = 'WHERE (account_id = ? OR customer_id = ?)';
    const params: (string | number)[] = [account.id, accountCustomerId];

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
      const canonicalWhere = query.type ? 'WHERE customer_id = ? AND type = ?' : 'WHERE customer_id = ?';
      const canonicalParams = query.type ? [accountCustomerId, query.type] : [accountCustomerId];
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM loyalty_transactions ${canonicalWhere}`).bind(...canonicalParams).first().catch(() => null)) as { total: number } | null;
      total = countResult?.total || 0;

      const transactions = (await db.prepare(
        `SELECT *, customer_id as account_id, reason as description FROM loyalty_transactions ${canonicalWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...canonicalParams, limit, offset).all().catch(() => ({ results: [] }))) as { results: any[] };
      transactionsResults = transactions.results || [];
    }

    if (transactionsResults.length === 0 && !query.type) {
      try {
        const logCount = (await db.prepare('SELECT COUNT(*) as total FROM loyalty_point_logs WHERE customer_id = ?').bind(accountCustomerId).first()) as { total: number } | null;
        total = logCount?.total || 0;
        if (total > 0) {
          const logs = (await db.prepare(
            `SELECT id, customer_id as account_id, customer_id, COALESCE(reason, 'earn') as type, points_change as points, balance_after, order_id, COALESCE(description, reason) as description, reason, created_at
             FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(accountCustomerId, limit, offset).all()) as { results: any[] };
          transactionsResults = logs.results || [];
        }
      } catch {
        // Ignore when loyalty_point_logs is unavailable
      }
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
    const customerId = String(user.customerId || user.id);

    const { account } = await getLoyaltyAccountWithFallback(db, customerId, now);

    if (!account) {
      return c.json({ success: false, error: 'No loyalty account found' }, 404);
    }

    const accountCustomerId = String(account.customer_id ?? customerId);

    // Check if already claimed this month
    let existingClaim: any = null;
    try {
      existingClaim = await db.prepare(
        `SELECT * FROM loyalty_transactions
         WHERE (account_id = ? OR customer_id = ?) AND type = 'birthday' AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`
      ).bind(account.id, accountCustomerId, String(currentMonth).padStart(2, '0'), currentYear).first();
    } catch {
      existingClaim = await db.prepare(
        `SELECT * FROM loyalty_transactions
         WHERE customer_id = ? AND (type = 'birthday' OR reason = 'Birthday bonus') AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`
      ).bind(accountCustomerId, String(currentMonth).padStart(2, '0'), currentYear).first().catch(() => null);
    }

    if (existingClaim) {
      return c.json({ success: false, error: 'Birthday bonus already claimed this month' }, 400);
    }

    // Birthday bonus: configurable via tier config with null-fallback to tier_configs
    let tierConfig: any = null;
    try {
      tierConfig = await db.prepare('SELECT birthday_bonus FROM loyalty_tier_configs WHERE tier = ?')
        .bind(account.tier).first();
    } catch {
      tierConfig = null;
    }
    if (!tierConfig) {
      tierConfig = await db.prepare('SELECT birthday_discount as birthday_bonus FROM tier_configs WHERE tier = ?')
        .bind(account.tier).first().catch(() => null);
    }
    const birthdayPoints = Number(tierConfig?.birthday_bonus || 500);

    const transactionId = crypto.randomUUID();
    const idempotencyKey = body.idempotencyKey || `bday_${account.id}_${now.slice(0, 7)}`;
    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
    const newBalance = currentPoints + birthdayPoints;

    await recordLoyaltyTransactionDualWrite(db, {
      txId: transactionId,
      accountId: String(account.id),
      customerId: accountCustomerId,
      type: 'birthday',
      points: birthdayPoints,
      balanceAfter: newBalance,
      description: 'Birthday bonus',
      reason: 'Birthday bonus',
      idempotencyKey,
      now,
    });

    await syncLoyaltyAccountAndCustomerBalance(db, {
      accountId: String(account.id),
      customerId: accountCustomerId,
      newBalance,
      lifetimeDelta: birthdayPoints,
      now,
    });

    await writeLoyaltyAuditLog(
      db,
      user.id,
      'loyalty_birthday_claim',
      'loyalty_account',
      String(account.id),
      JSON.stringify({ points: birthdayPoints }),
      now
    );

    return c.json({
      success: true,
      data: {
        points: birthdayPoints,
        newBalance,
      },
    });
  });
}

