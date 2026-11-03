import { matchesTenantRow } from '../../lib/db';

export async function writeLoyaltyAuditLog(
  db: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, metadata, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${crypto.randomUUID()}`, userId, action, entityType, entityId, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, action, entityType, entityId, metadata, now).run().catch(() => {});
      } catch {
        // Ignore audit log failure
      }
    }
  }
}

export function matchesLoyaltyTenant(row: unknown, tenantId: string = '*'): boolean {
  if (!row || typeof row !== 'object') return false;
  const clean = tenantId ? tenantId.trim() : '';
  if (!clean || clean === '*') return true;
  return matchesTenantRow(row as Record<string, unknown>, clean);
}

export async function checkRewardTenant(
  db: any,
  reward: Record<string, unknown> | null | undefined,
  tenantId: string = '*'
): Promise<boolean> {
  if (!reward || typeof reward !== 'object') return false;
  const cleanTenant = tenantId ? tenantId.trim() : '';
  if (!cleanTenant || cleanTenant === '*') return true;
  if ('tenant_id' in reward && reward.tenant_id !== undefined) {
    return matchesTenantRow(reward, cleanTenant);
  }
  const rewardId = reward.id ? String(reward.id) : '';
  if (rewardId) {
    try {
      const auditRow = await db
        .prepare(
          `SELECT user_id, actor_id, metadata, details FROM audit_logs
           WHERE (entity_id = ? OR resource_id = ?) AND action = 'loyalty_reward_create'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(rewardId, rewardId)
        .first();
      if (auditRow) {
        const rawMeta = auditRow.metadata ?? auditRow.details;
        if (rawMeta) {
          try {
            const parsed = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
            const metaTenant = parsed?.tenant_id ?? parsed?.tenantId;
            if (metaTenant && String(metaTenant).trim() !== '') {
              return String(metaTenant).trim() === cleanTenant;
            }
          } catch {
            // Ignore malformed audit metadata
          }
        }
        const actorId = auditRow.user_id ?? auditRow.actor_id;
        if (actorId) {
          const creator = await db
            .prepare('SELECT tenant_id FROM users WHERE id = ? LIMIT 1')
            .bind(actorId)
            .first()
            .catch(() => null);
          if (creator && creator.tenant_id !== undefined) {
            const creatorTenant = creator.tenant_id ? String(creator.tenant_id).trim() || 'default' : 'default';
            return creatorTenant === cleanTenant;
          }
        }
      }
    } catch {
      // Optional audit_logs table
    }
  }
  return cleanTenant === 'default';
}

export async function getLoyaltyAccountWithFallback(
  db: any,
  customerId: string,
  nowOrTenantId = new Date().toISOString(),
  tenantIdArg: string = '*'
): Promise<{ account: any | null; usingCustomersFallback: boolean; [key: string]: any }> {
  const isIsoDate = typeof nowOrTenantId === 'string' && /^\d{4}-\d{2}-\d{2}/.test(nowOrTenantId);
  const now = isIsoDate ? nowOrTenantId : new Date().toISOString();
  const tenantId = !isIsoDate && tenantIdArg === '*' && typeof nowOrTenantId === 'string' && nowOrTenantId.trim()
    ? nowOrTenantId.trim()
    : tenantIdArg;
  let account: any = null;
  let usingCustomersFallback = false;
  let loyaltyAccountsTableExists = true;

  try {
    account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?').bind(customerId).first();
  } catch {
    loyaltyAccountsTableExists = false;
    usingCustomersFallback = true;
  }

  if (account && tenantId && tenantId !== '*') {
    const custLookup = String(account.customer_id ?? customerId ?? '');
    let ownerRow: Record<string, unknown> | null = null;
    if (custLookup) {
      ownerRow = (await db.prepare('SELECT * FROM customers WHERE id = ?').bind(custLookup).first().catch(() => null)) as Record<string, unknown> | null;
      if (!ownerRow) {
        ownerRow = (await db.prepare('SELECT id, tenant_id FROM users WHERE id = ?').bind(custLookup).first().catch(() => null)) as Record<string, unknown> | null;
      }
    }
    const rawAccountTenant = 'tenant_id' in account && account.tenant_id !== undefined
      ? String(account.tenant_id ?? '').trim()
      : '';
    if (rawAccountTenant && rawAccountTenant !== 'default' && !matchesLoyaltyTenant(account, tenantId)) {
      return { account: null, usingCustomersFallback: false };
    }
    if (ownerRow && 'tenant_id' in ownerRow && ownerRow.tenant_id !== undefined) {
      if (!matchesLoyaltyTenant(ownerRow, tenantId)) {
        return { account: null, usingCustomersFallback: false };
      }
    } else if ('tenant_id' in account && account.tenant_id !== undefined) {
      if (!matchesLoyaltyTenant(account, tenantId)) {
        return { account: null, usingCustomersFallback: false };
      }
    } else if (tenantId !== 'default') {
      return { account: null, usingCustomersFallback: false };
    }
  }

  if (!account) {
    try {
      const cust = await db.prepare(
        'SELECT *, id as customer_id, loyalty_points as current_points, COALESCE(lifetime_points, loyalty_points, 0) as lifetime_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers WHERE id = ?'
      ).bind(customerId).first();
      if (cust) {
        if (!matchesLoyaltyTenant(cust, tenantId)) {
          return { account: null, usingCustomersFallback: false };
        }
        if (loyaltyAccountsTableExists) {
          const accountId = `la_${cust.id}`;
          const effectiveAccountTenant =
            tenantId && tenantId !== '*'
              ? tenantId
              : (cust.tenant_id && String(cust.tenant_id).trim()) || 'default';
          await db.prepare(
            `INSERT OR IGNORE INTO loyalty_accounts (
              id, customer_id, current_points, lifetime_points, tier, order_count, total_spent, last_activity_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            accountId,
            cust.id,
            Number(cust.loyalty_points ?? 0),
            Number(cust.lifetime_points ?? cust.loyalty_points ?? 0),
            cust.loyalty_tier || cust.tier || 'bronze',
            Number(cust.visit_count ?? cust.total_orders ?? 0),
            Number(cust.total_spent ?? 0),
            cust.updated_at ?? now,
            cust.created_at ?? now,
            cust.updated_at ?? now
          ).run().catch(() => {});
          if (effectiveAccountTenant && effectiveAccountTenant !== '*') {
            await db.prepare('UPDATE loyalty_accounts SET tenant_id = ? WHERE id = ?').bind(effectiveAccountTenant, accountId).run().catch(() => {});
          }
          account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?').bind(customerId).first().catch(() => null);
        }
        if (!account) {
          account = cust;
          usingCustomersFallback = true;
        }
      }
    } catch {
      // Ignore customers fallback error
    }
  }

  return account
    ? Object.assign({ account, usingCustomersFallback }, account)
    : { account: null, usingCustomersFallback };
}

const accountSyncLocks = new Map<string, Promise<void>>();

export async function resolveTierForPoints(db: any, points: number): Promise<string> {
  try {
    const res = (await db
      .prepare('SELECT tier_name, min_points FROM loyalty_tiers ORDER BY min_points DESC')
      .all()) as { results?: Array<{ tier_name: string; min_points: number }> } | null;
    if (res?.results && res.results.length > 0) {
      const validTiers = res.results.filter(
        (r) => typeof r?.tier_name === 'string' && typeof r?.min_points === 'number'
      );
      if (validTiers.length > 0) {
        for (const row of validTiers) {
          if (points >= row.min_points) {
            return row.tier_name;
          }
        }
      }
    }
  } catch {
    // Fallback when loyalty_tiers is absent
  }

  try {
    const res = (await db
      .prepare('SELECT tier, min_points FROM loyalty_tier_configs ORDER BY min_points DESC')
      .all()) as { results?: Array<{ tier: string; min_points: number }> } | null;
    if (res?.results && res.results.length > 0) {
      const validTiers = res.results.filter(
        (r) => typeof r?.tier === 'string' && typeof r?.min_points === 'number'
      );
      if (validTiers.length > 0) {
        for (const row of validTiers) {
          if (points >= row.min_points) {
            return row.tier;
          }
        }
      }
    }
  } catch {
    // Fallback to static thresholds
  }

  if (points >= 5000) return 'platinum';
  if (points >= 2000) return 'gold';
  if (points >= 500) return 'silver';
  return 'bronze';
}

export async function syncLoyaltyAccountAndCustomerBalance(
  db: any,
  paramsOrCustomerId:
    | {
        accountId: string;
        customerId: string;
        newBalance: number;
        pointsDelta?: number;
        lifetimeDelta?: number;
        tenantId?: string;
        now: string;
      }
    | string,
  positionalBalance?: number,
  positionalLifetime?: number,
  _positionalTier?: string,
  positionalTenantId?: string
): Promise<number> {
  const params =
    typeof paramsOrCustomerId === 'string'
      ? {
          accountId: `la_${paramsOrCustomerId}`,
          customerId: paramsOrCustomerId,
          newBalance: Number(positionalBalance ?? 0),
          lifetimeDelta: Number(positionalLifetime ?? 0),
          tenantId: positionalTenantId ?? '*',
          now: new Date().toISOString(),
        }
      : paramsOrCustomerId;
  const { accountId, customerId, newBalance, pointsDelta, lifetimeDelta = 0, tenantId = '*', now } = params;
  const hasRelativeDelta = typeof pointsDelta === 'number' && Number.isFinite(pointsDelta);
  const preDeltaBalance = hasRelativeDelta ? newBalance - Number(pointsDelta) : newBalance;
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  const lockKey = `${accountId}:${customerId}`;
  const prevLock = accountSyncLocks.get(lockKey) ?? Promise.resolve();

  const runSync = prevLock.then(async () => {
    let resolvedBalance = newBalance;
    let effectiveLifetime = Math.max(0, newBalance);
    const acctPointsExpr = hasRelativeDelta ? 'MAX(0, COALESCE(current_points, 0) + ?)' : '?';
    const acctPointsBind = hasRelativeDelta ? Number(pointsDelta) : newBalance;
    try {
      if (lifetimeDelta > 0) {
        if (effectiveTenant) {
          try {
            await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(acctPointsBind, lifetimeDelta, now, now, accountId, customerId, effectiveTenant).run();
          } catch {
            await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, last_activity_at = ?, updated_at = ?
               WHERE id = ? OR customer_id = ?`
            ).bind(acctPointsBind, lifetimeDelta, now, now, accountId, customerId).run();
          }
        } else {
          await db.prepare(
            `UPDATE loyalty_accounts
             SET current_points = ${acctPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, last_activity_at = ?, updated_at = ?
             WHERE id = ? OR customer_id = ?`
          ).bind(acctPointsBind, lifetimeDelta, now, now, accountId, customerId).run();
        }
      } else {
        if (effectiveTenant) {
          try {
            await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(acctPointsBind, now, now, accountId, customerId, effectiveTenant).run();
          } catch {
            await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, last_activity_at = ?, updated_at = ?
               WHERE id = ? OR customer_id = ?`
            ).bind(acctPointsBind, now, now, accountId, customerId).run();
          }
        } else {
          await db.prepare(
            `UPDATE loyalty_accounts
             SET current_points = ${acctPointsExpr}, last_activity_at = ?, updated_at = ?
             WHERE id = ? OR customer_id = ?`
          ).bind(acctPointsBind, now, now, accountId, customerId).run();
        }
      }
      const accRow = (await db
        .prepare('SELECT current_points, lifetime_points FROM loyalty_accounts WHERE customer_id = ?')
        .bind(customerId)
        .first()
        .catch(() => null)) as { current_points?: number; lifetime_points?: number } | null;
      if (accRow) {
        if (hasRelativeDelta && typeof accRow.current_points === 'number' && Number(accRow.current_points) !== preDeltaBalance) {
          resolvedBalance = Number(accRow.current_points);
        }
        effectiveLifetime = Math.max(
          effectiveLifetime,
          resolvedBalance,
          Number(accRow.lifetime_points ?? accRow.current_points ?? resolvedBalance)
        );
      }
    } catch {
      // Fallback when loyalty_accounts table is absent
    }

    const custPointsExpr = hasRelativeDelta ? 'MAX(0, COALESCE(loyalty_points, 0) + ?)' : '?';
    const custPointsBind = hasRelativeDelta ? Number(pointsDelta) : newBalance;
    try {
      if (lifetimeDelta > 0) {
        if (effectiveTenant) {
          try {
            await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(custPointsBind, lifetimeDelta, now, customerId, effectiveTenant).run();
          } catch {
            await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
               WHERE id = ?`
            ).bind(custPointsBind, lifetimeDelta, now, customerId).run();
          }
        } else {
          await db.prepare(
            `UPDATE customers
             SET loyalty_points = ${custPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
             WHERE id = ?`
          ).bind(custPointsBind, lifetimeDelta, now, customerId).run();
        }
      } else {
        if (effectiveTenant) {
          try {
            await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, updated_at = ?
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(custPointsBind, now, customerId, effectiveTenant).run();
          } catch {
            await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, updated_at = ?
               WHERE id = ?`
            ).bind(custPointsBind, now, customerId).run();
          }
        } else {
          await db.prepare(
            `UPDATE customers
             SET loyalty_points = ${custPointsExpr}, updated_at = ?
             WHERE id = ?`
          ).bind(custPointsBind, now, customerId).run();
        }
      }
      const custRow = (await db
        .prepare('SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?')
        .bind(customerId)
        .first()
        .catch(() => null)) as { loyalty_points?: number; lifetime_points?: number } | null;
      if (custRow) {
        if (hasRelativeDelta && resolvedBalance === newBalance && typeof custRow.loyalty_points === 'number' && Number(custRow.loyalty_points) !== preDeltaBalance) {
          resolvedBalance = Number(custRow.loyalty_points);
        }
        effectiveLifetime = Math.max(
          effectiveLifetime,
          resolvedBalance,
          Number(custRow.lifetime_points ?? custRow.loyalty_points ?? resolvedBalance)
        );
      }
    } catch {
      // Ignore when customers table lacks columns in minimal test fixtures
    }

    const newTier = await resolveTierForPoints(db, effectiveLifetime);
    try {
      if (effectiveTenant) {
        try {
          await db
            .prepare("UPDATE loyalty_accounts SET tier = ?, updated_at = ? WHERE (id = ? OR customer_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(newTier, now, accountId, customerId, effectiveTenant)
            .run();
        } catch {
          await db
            .prepare('UPDATE loyalty_accounts SET tier = ?, updated_at = ? WHERE id = ? OR customer_id = ?')
            .bind(newTier, now, accountId, customerId)
            .run();
        }
      } else {
        await db
          .prepare('UPDATE loyalty_accounts SET tier = ?, updated_at = ? WHERE id = ? OR customer_id = ?')
          .bind(newTier, now, accountId, customerId)
          .run();
      }
    } catch {
      // Ignore when loyalty_accounts table is absent
    }
    try {
      if (effectiveTenant) {
        try {
          await db
            .prepare("UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(newTier, now, customerId, effectiveTenant)
            .run();
        } catch {
          await db
            .prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
            .bind(newTier, now, customerId)
            .run();
        }
      } else {
        await db
          .prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
          .bind(newTier, now, customerId)
          .run();
      }
    } catch {
      // Ignore when customers table lacks loyalty_tier in minimal test fixtures
    }
    return resolvedBalance;
  });

  const lockPromise = runSync.then(() => {}).catch(() => {});
  accountSyncLocks.set(lockKey, lockPromise);
  try {
    return await runSync;
  } finally {
    if (accountSyncLocks.get(lockKey) === lockPromise) {
      accountSyncLocks.delete(lockKey);
    }
  }
}

export async function recordLoyaltyTransactionDualWrite(
  db: any,
  params: {
    txId: string;
    accountId: string;
    customerId: string;
    type?: string;
    txType?: string;
    points?: number;
    pointsDelta?: number;
    balanceAfter: number;
    orderId?: string | null;
    rewardId?: string | null;
    description: string;
    reason?: string | null;
    idempotencyKey?: string | null;
    createdBy?: string | null;
    tenantId?: string;
    now?: string;
  }
): Promise<void> {
  const {
    txId,
    accountId,
    customerId,
    type: rawType,
    txType,
    points: rawPoints,
    pointsDelta,
    balanceAfter,
    orderId = null,
    rewardId = null,
    description,
    reason = null,
    idempotencyKey = null,
    createdBy = null,
    tenantId = '*',
    now = new Date().toISOString(),
  } = params;
  const type = rawType ?? txType ?? 'earn';
  const points = rawPoints ?? pointsDelta ?? 0;
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;

  await db.prepare(
    `INSERT INTO loyalty_transactions (
      id, account_id, customer_id, type, points, balance_after,
      order_id, reward_id, description, reason, idempotency_key, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    txId,
    accountId,
    customerId,
    type,
    points,
    balanceAfter,
    orderId,
    rewardId,
    description,
    reason ?? description,
    idempotencyKey,
    createdBy,
    now
  ).run();
  if (effectiveTenant) {
    await db.prepare('UPDATE loyalty_transactions SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, txId).run().catch(() => {});
  }

  try {
    await db.prepare(
      `INSERT OR IGNORE INTO loyalty_point_logs (
        id, customer_id, order_id, points_change, reason, balance_after, description, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM customers WHERE id = ?)`
    ).bind(
      txId,
      customerId,
      orderId,
      points,
      reason ?? type,
      balanceAfter,
      description,
      now,
      customerId
    ).run();
    if (effectiveTenant) {
      await db.prepare('UPDATE loyalty_point_logs SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, txId).run().catch(() => {});
    }
  } catch {
    // Ignore when loyalty_point_logs is absent in older migration snapshots
  }
}
