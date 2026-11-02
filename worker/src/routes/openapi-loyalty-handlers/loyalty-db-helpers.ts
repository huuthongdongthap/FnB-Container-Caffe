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
  if (!tenantId || tenantId === '*') return true;
  const r = row as Record<string, unknown>;
  if ('tenant_id' in r && r.tenant_id !== undefined) {
    const rowTenant = r.tenant_id ? String(r.tenant_id).trim() || 'default' : 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

export async function checkRewardTenant(
  db: any,
  reward: Record<string, unknown> | null | undefined,
  tenantId: string = '*'
): Promise<boolean> {
  if (!reward || typeof reward !== 'object') return false;
  if (!tenantId || tenantId === '*') return true;
  if ('tenant_id' in reward && reward.tenant_id !== undefined) {
    const rowTenant = reward.tenant_id ? String(reward.tenant_id).trim() || 'default' : 'default';
    return rowTenant === tenantId;
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
              return String(metaTenant).trim() === tenantId;
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
            return creatorTenant === tenantId;
          }
        }
      }
    } catch {
      // Optional audit_logs table
    }
  }
  return tenantId === 'default';
}

export async function getLoyaltyAccountWithFallback(
  db: any,
  customerId: string,
  now = new Date().toISOString(),
  tenantId: string = '*'
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
          if (tenantId !== '*' && tenantId !== 'default') {
            await db.prepare('UPDATE loyalty_accounts SET tenant_id = ? WHERE id = ?').bind(tenantId, accountId).run().catch(() => {});
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
