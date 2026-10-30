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
      ).bind(`audit_${Date.now()}`, userId, action, entityType, entityId, metadata, now).run();
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

export async function getLoyaltyAccountWithFallback(
  db: any,
  customerId: string,
  now = new Date().toISOString()
): Promise<{ account: any | null; usingCustomersFallback: boolean }> {
  let account: any = null;
  let usingCustomersFallback = false;
  let loyaltyAccountsTableExists = true;

  try {
    account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?').bind(customerId).first();
  } catch {
    loyaltyAccountsTableExists = false;
    usingCustomersFallback = true;
  }

  if (!account) {
    try {
      const cust = await db.prepare(
        'SELECT *, id as customer_id, loyalty_points as current_points, COALESCE(lifetime_points, loyalty_points, 0) as lifetime_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers WHERE id = ?'
      ).bind(customerId).first();
      if (cust) {
        if (loyaltyAccountsTableExists) {
          const accountId = `la_${cust.id}`;
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

  return { account, usingCustomersFallback };
}

export async function syncLoyaltyAccountAndCustomerBalance(
  db: any,
  params: {
    accountId: string;
    customerId: string;
    newBalance: number;
    lifetimeDelta?: number;
    now: string;
  }
): Promise<void> {
  const { accountId, customerId, newBalance, lifetimeDelta = 0, now } = params;
  try {
    if (lifetimeDelta > 0) {
      await db.prepare(
        `UPDATE loyalty_accounts
         SET current_points = ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, last_activity_at = ?, updated_at = ?
         WHERE id = ? OR customer_id = ?`
      ).bind(newBalance, lifetimeDelta, now, now, accountId, customerId).run();
    } else {
      await db.prepare(
        `UPDATE loyalty_accounts
         SET current_points = ?, last_activity_at = ?, updated_at = ?
         WHERE id = ? OR customer_id = ?`
      ).bind(newBalance, now, now, accountId, customerId).run();
    }
  } catch {
    // Fallback when loyalty_accounts table is absent
  }

  try {
    if (lifetimeDelta > 0) {
      await db.prepare(
        `UPDATE customers
         SET loyalty_points = ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
         WHERE id = ?`
      ).bind(newBalance, lifetimeDelta, now, customerId).run();
    } else {
      await db.prepare(
        `UPDATE customers
         SET loyalty_points = ?, updated_at = ?
         WHERE id = ?`
      ).bind(newBalance, now, customerId).run();
    }
  } catch {
    // Ignore when customers table lacks columns in minimal test fixtures
  }
}

export async function recordLoyaltyTransactionDualWrite(
  db: any,
  params: {
    txId: string;
    accountId: string;
    customerId: string;
    type: string;
    points: number;
    balanceAfter: number;
    orderId?: string | null;
    rewardId?: string | null;
    description: string;
    reason?: string | null;
    idempotencyKey?: string | null;
    createdBy?: string | null;
    now: string;
  }
): Promise<void> {
  const {
    txId,
    accountId,
    customerId,
    type,
    points,
    balanceAfter,
    orderId = null,
    rewardId = null,
    description,
    reason = null,
    idempotencyKey = null,
    createdBy = null,
    now,
  } = params;

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
  } catch {
    // Ignore when loyalty_point_logs is absent in older migration snapshots
  }
}
