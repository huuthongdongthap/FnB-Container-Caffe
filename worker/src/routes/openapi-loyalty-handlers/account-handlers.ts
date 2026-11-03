import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';
import {
  getLoyaltyAccountWithFallback,
  matchesLoyaltyTenant,
  recordLoyaltyTransactionDualWrite,
  syncLoyaltyAccountAndCustomerBalance,
  writeLoyaltyAuditLog,
} from './loyalty-db-helpers';

const inFlightBirthdayClaims = new Set<string>();

export function registerAccountHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/account - Get current user's loyalty account
  app.openapi(LoyaltyRoutes.account.get as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const tenantId = getTenantId(c);

    const { account } = await getLoyaltyAccountWithFallback(db, user.customerId || user.id, new Date().toISOString(), tenantId);

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
    const tenantId = getTenantId(c);
    const query = c.req.valid('query');
    const customerId = String(user.customerId || user.id);

    const { account } = await getLoyaltyAccountWithFallback(db, customerId, new Date().toISOString(), tenantId);

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
    const scopedWhereClause = `${whereClause} AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`;
    const scopedParams: (string | number)[] = [...params, tenantId, tenantId];
    try {
      let countResult: { total: number } | null = null;
      let transactions: { results: any[] } = { results: [] };
      try {
        countResult = (await db.prepare(`SELECT COUNT(*) as total FROM loyalty_transactions ${scopedWhereClause}`).bind(...scopedParams).first()) as { total: number } | null;
        transactions = (await db.prepare(
          `SELECT * FROM loyalty_transactions ${scopedWhereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...scopedParams, limit, offset).all()) as { results: any[] };
      } catch {
        countResult = (await db.prepare(`SELECT COUNT(*) as total FROM loyalty_transactions ${whereClause}`).bind(...params).first()) as { total: number } | null;
        transactions = (await db.prepare(
          `SELECT * FROM loyalty_transactions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: any[] };
      }
      total = countResult?.total || 0;
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
        let logCount: { total: number } | null = null;
        try {
          logCount = (await db.prepare(
            "SELECT COUNT(*) as total FROM loyalty_point_logs WHERE customer_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
          ).bind(accountCustomerId, tenantId, tenantId).first()) as { total: number } | null;
        } catch {
          logCount = (await db.prepare('SELECT COUNT(*) as total FROM loyalty_point_logs WHERE customer_id = ?').bind(accountCustomerId).first()) as { total: number } | null;
        }
        total = logCount?.total || 0;
        if (total > 0) {
          let logs: { results: any[] } = { results: [] };
          try {
            logs = (await db.prepare(
              `SELECT id, customer_id as account_id, customer_id, COALESCE(reason, 'earn') as type, points_change as points, balance_after, order_id, COALESCE(description, reason) as description, reason, tenant_id, created_at
               FROM loyalty_point_logs WHERE customer_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY created_at DESC LIMIT ? OFFSET ?`
            ).bind(accountCustomerId, tenantId, tenantId, limit, offset).all()) as { results: any[] };
          } catch {
            logs = (await db.prepare(
              `SELECT id, customer_id as account_id, customer_id, COALESCE(reason, 'earn') as type, points_change as points, balance_after, order_id, COALESCE(description, reason) as description, reason, created_at
               FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
            ).bind(accountCustomerId, limit, offset).all()) as { results: any[] };
          }
          transactionsResults = logs.results || [];
        }
      } catch {
        // Ignore when loyalty_point_logs is unavailable
      }
    }

    if (tenantId !== '*') {
      const beforeFilterCount = transactionsResults.length;
      transactionsResults = transactionsResults.filter(
        (r: any) => !('tenant_id' in r) || r.tenant_id === undefined || ((String(r.tenant_id ?? '').trim() || 'default') === tenantId)
      );
      if (transactionsResults.length < beforeFilterCount) {
        total = Math.max(0, total - (beforeFilterCount - transactionsResults.length));
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
    const tenantId = getTenantId(c);
    c.req.valid('json');
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const currentMonth = nowDate.getUTCMonth() + 1;
    const currentYear = String(nowDate.getUTCFullYear());
    const customerId = String(user.customerId || user.id);

    const { account } = await getLoyaltyAccountWithFallback(db, customerId, now, tenantId);

    if (!account) {
      return c.json({ success: false, error: 'No loyalty account found' }, 404);
    }

    const accountCustomerId = String(account.customer_id ?? customerId);

    // Require a valid customer birth date and verify birth month matches current month
    let birthDateRaw = account.birthday || account.date_of_birth || null;
    if (!birthDateRaw) {
      const custRow = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(accountCustomerId).first().catch(() => null);
      if (custRow && tenantId !== '*' && 'tenant_id' in custRow && custRow.tenant_id !== undefined) {
        const custTenant = (custRow.tenant_id && String(custRow.tenant_id).trim()) || 'default';
        if (custTenant !== tenantId) {
          return c.json({ success: false, error: 'No loyalty account found' }, 404);
        }
      }
      birthDateRaw = custRow?.birthday || custRow?.date_of_birth || null;
    }
    if (!birthDateRaw || typeof birthDateRaw !== 'string' || !birthDateRaw.trim()) {
      return c.json({ success: false, error: 'Customer birthday is not configured' }, 400);
    }
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDateRaw.trim());
    const parsedBirthDate = isoMatch ? null : new Date(birthDateRaw.trim());
    const birthMonth = isoMatch
      ? parseInt(isoMatch[2], 10)
      : (parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime()) ? parsedBirthDate.getUTCMonth() + 1 : NaN);
    if (!Number.isFinite(birthMonth) || birthMonth < 1 || birthMonth > 12) {
      return c.json({ success: false, error: 'Invalid customer birthday' }, 400);
    }
    if (birthMonth !== currentMonth) {
      return c.json({ success: false, error: 'Birthday bonus is only available during your birth month' }, 400);
    }

    const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : 'default';
    const idempotencyKey =
      effectiveTenant === 'default'
        ? `birthday_bonus:${accountCustomerId}:${currentYear}`
        : `birthday_bonus:${effectiveTenant}:${accountCustomerId}:${currentYear}`;
    if (inFlightBirthdayClaims.has(idempotencyKey)) {
      return c.json({ success: false, error: 'Birthday bonus already claimed this year' }, 409);
    }
    inFlightBirthdayClaims.add(idempotencyKey);

    try {
      // Check if already claimed this year within the active tenant scope
      let existingClaim: any = null;
      try {
        existingClaim = await db.prepare(
          `SELECT * FROM loyalty_transactions
           WHERE (account_id = ? OR customer_id = ?)
             AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
             AND (
               idempotency_key = ?
               OR (
                 (type = 'birthday' OR (type = 'bonus' AND description LIKE '%Birthday%') OR reason = 'Birthday bonus')
                 AND strftime('%Y', created_at) = ?
               )
             )`
        ).bind(account.id, accountCustomerId, tenantId, effectiveTenant, idempotencyKey, currentYear).first();
      } catch {
        try {
          existingClaim = await db.prepare(
            `SELECT * FROM loyalty_transactions
             WHERE (account_id = ? OR customer_id = ?)
               AND (
                 idempotency_key = ?
                 OR (
                   (type = 'birthday' OR (type = 'bonus' AND description LIKE '%Birthday%') OR reason = 'Birthday bonus')
                   AND strftime('%Y', created_at) = ?
                 )
               )`
          ).bind(account.id, accountCustomerId, idempotencyKey, currentYear).first();
        } catch {
          existingClaim = await db.prepare(
            `SELECT * FROM loyalty_transactions
             WHERE customer_id = ? AND (type = 'birthday' OR reason = 'Birthday bonus' OR description LIKE '%Birthday%') AND strftime('%Y', created_at) = ?`
          ).bind(accountCustomerId, currentYear).first().catch(() => null);
        }
      }
      if (existingClaim && tenantId !== '*' && 'tenant_id' in existingClaim && existingClaim.tenant_id !== undefined) {
        if (!matchesLoyaltyTenant(existingClaim, tenantId)) {
          existingClaim = null;
        }
      }

      if (existingClaim) {
        return c.json({ success: false, error: 'Birthday bonus already claimed this year' }, 400);
      }

      // Birthday bonus: configurable via tier config without aliasing percentage discount as points
      let tierConfig: any = null;
      try {
        tierConfig = await db.prepare('SELECT birthday_bonus FROM loyalty_tier_configs WHERE tier = ?')
          .bind(account.tier).first();
      } catch {
        tierConfig = null;
      }
      if (!tierConfig) {
        tierConfig = await db.prepare('SELECT birthday_bonus FROM loyalty_tiers WHERE tier_name = ? OR tier = ?')
          .bind(account.tier, account.tier).first().catch(() => null);
      }
      if (!tierConfig) {
        tierConfig = await db.prepare('SELECT birthday_bonus FROM tier_configs WHERE tier = ?')
          .bind(account.tier).first().catch(() => null);
      }
      const rawBonus = tierConfig?.birthday_bonus;
      const birthdayPoints =
        rawBonus !== undefined && rawBonus !== null && Number.isFinite(Number(rawBonus)) && Number(rawBonus) >= 0
          ? Number(rawBonus)
          : 500;
      if (birthdayPoints <= 0) {
        return c.json({ success: false, error: 'Birthday bonus is not available for your current tier' }, 400);
      }

      const transactionId = crypto.randomUUID();
      const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
      const expectedBalance = currentPoints + birthdayPoints;

      const resolvedBalance = await syncLoyaltyAccountAndCustomerBalance(db, {
        accountId: String(account.id),
        customerId: accountCustomerId,
        newBalance: expectedBalance,
        pointsDelta: birthdayPoints,
        lifetimeDelta: birthdayPoints,
        tenantId,
        now,
      });
      const newBalance = typeof resolvedBalance === 'number' && Number.isFinite(resolvedBalance) ? resolvedBalance : expectedBalance;

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
        tenantId,
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
    } finally {
      inFlightBirthdayClaims.delete(idempotencyKey);
    }
  });
}

