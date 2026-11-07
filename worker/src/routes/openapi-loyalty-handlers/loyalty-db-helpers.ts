import { matchesTenantRow } from '../../lib/db';

export async function writeLoyaltyAuditLog(
  db: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId: string = '*'
): Promise<void> {
  const rawTenant = tenantId ? tenantId.trim() : '';
  const effectiveTenant = rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq' ? rawTenant : null;
  const writeTenant = effectiveTenant || 'default';
  let enrichedMeta = metadata;
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tenant_id === undefined) {
      enrichedMeta = JSON.stringify({ ...parsed, tenant_id: writeTenant });
    }
  } catch { /* non-JSON metadata */ }
  try {
    await db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, writeTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${crypto.randomUUID()}`, userId, action, entityType, entityId, enrichedMeta, writeTenant, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(`audit_${crypto.randomUUID()}`, userId, action, entityType, entityId, enrichedMeta, now).run();
        } catch {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, userId, action, entityType, entityId, enrichedMeta, now).run().catch(() => {});
        }
      }
    }
  }
  await db
    .prepare('UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?')
    .bind(writeTenant, entityId, entityId, action, now)
    .run()
    .catch(() => {});
}

export async function findExistingLoyaltyIdempotencyTx(
  db: any,
  idempotencyKey: string | null | undefined,
  optsOrTenantId:
    | {
        tenantId?: string;
        accountId?: string | null;
        customerId?: string | null;
      }
    | string = {},
  positionalCustomerId?: string | null,
  positionalAccountId?: string | null
): Promise<any | null> {
  const cleanKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!cleanKey) {
    try {
      return await db
        .prepare('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?')
        .bind(null)
        .first();
    } catch {
      return null;
    }
  }

  const opts =
    typeof optsOrTenantId === 'string'
      ? {
          tenantId: optsOrTenantId,
          customerId: positionalCustomerId,
          accountId: positionalAccountId,
        }
      : optsOrTenantId || {};
  const rawTenant = opts.tenantId ? opts.tenantId.trim() : '';
  const tenantId = !rawTenant || rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  const effectiveTenant = tenantId !== '*' ? tenantId : null;
  const targetAccountId = opts.accountId ? String(opts.accountId).trim() : '';
  const targetCustomerId = opts.customerId ? String(opts.customerId).trim() : '';

  const matchesTargetActor = (row: any): boolean => {
    if (!targetCustomerId && !targetAccountId) return true;
    const rowAccId = row?.account_id !== undefined && row?.account_id !== null ? String(row.account_id).trim() : '';
    const rowCustId = row?.customer_id !== undefined && row?.customer_id !== null ? String(row.customer_id).trim() : '';
    if (!rowAccId && !rowCustId) return true;
    return (
      (Boolean(targetAccountId) && rowAccId === targetAccountId) ||
      (Boolean(targetCustomerId) && (rowCustId === targetCustomerId || rowAccId === `la_${targetCustomerId}`))
    );
  };

  if (effectiveTenant) {
    try {
      const scopedRow = await db
        .prepare(
          "SELECT * FROM loyalty_transactions WHERE idempotency_key = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(cleanKey, effectiveTenant)
        .first();
      if (scopedRow && matchesLoyaltyTenant(scopedRow, tenantId) && matchesTargetActor(scopedRow)) {
        return scopedRow;
      }
    } catch {
      // Fallback when loyalty_transactions lacks tenant_id column
    }
  }

  let candidates: any[] = [];
  let firstRow: any = null;
  try {
    const stmt = db.prepare('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?').bind(cleanKey);
    if (typeof stmt.first === 'function') {
      firstRow = await stmt.first().catch(() => null);
      if (firstRow) {
        candidates = [firstRow];
      }
    }
    if (typeof stmt.all === 'function') {
      const needsAllScan =
        !firstRow ||
        ('tenant_id' in firstRow && firstRow.tenant_id !== undefined && !matchesLoyaltyTenant(firstRow, tenantId)) ||
        !matchesTargetActor(firstRow);
      if (firstRow && needsAllScan) {
        const allRes = (await stmt.all().catch(() => null)) as { results?: any[] } | null;
        if (Array.isArray(allRes?.results) && allRes.results.length > 0) {
          const matchingKeyRows = allRes.results.filter(
            (r) => r && (!('idempotency_key' in r) || r.idempotency_key === cleanKey)
          );
          if (matchingKeyRows.length > 0) {
            candidates = matchingKeyRows;
          }
        }
      }
    }
  } catch {
    return null;
  }

  if (tenantId === '*') {
    if (targetCustomerId || targetAccountId) {
      const matched = candidates.find((row) => row && typeof row === 'object' && matchesTargetActor(row));
      return matched ?? null;
    }
    return candidates[0] ?? null;
  }

  for (const row of candidates) {
    if (!row || typeof row !== 'object') continue;
    if ('tenant_id' in row && row.tenant_id !== undefined) {
      if (matchesLoyaltyTenant(row, tenantId) && matchesTargetActor(row)) {
        return row;
      }
      continue;
    }
    const rowAccId = row.account_id !== undefined && row.account_id !== null ? String(row.account_id).trim() : '';
    const rowCustId = row.customer_id !== undefined && row.customer_id !== null ? String(row.customer_id).trim() : '';
    if (!rowAccId && !rowCustId) {
      return row;
    }
    if (
      (targetAccountId && rowAccId === targetAccountId) ||
      (targetCustomerId && (rowCustId === targetCustomerId || rowAccId === `la_${targetCustomerId}`))
    ) {
      return row;
    }
    const lookupCustId = rowCustId || rowAccId.replace(/^la_/, '');
    if (lookupCustId) {
      const custOwner = await db
        .prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1')
        .bind(lookupCustId)
        .first()
        .catch(() => null);
      if (custOwner && 'tenant_id' in custOwner && custOwner.tenant_id !== undefined) {
        if (matchesLoyaltyTenant(custOwner, tenantId)) {
          return row;
        }
        continue;
      }
      const acctOwner = await db
        .prepare('SELECT tenant_id FROM loyalty_accounts WHERE id = ? OR customer_id = ? LIMIT 1')
        .bind(rowAccId || `la_${lookupCustId}`, lookupCustId)
        .first()
        .catch(() => null);
      if (acctOwner && 'tenant_id' in acctOwner && acctOwner.tenant_id !== undefined) {
        if (matchesLoyaltyTenant(acctOwner, tenantId)) {
          return row;
        }
        continue;
      }
      const userOwner = await db
        .prepare('SELECT tenant_id FROM users WHERE id = ? LIMIT 1')
        .bind(lookupCustId)
        .first()
        .catch(() => null);
      if (userOwner && 'tenant_id' in userOwner && userOwner.tenant_id !== undefined) {
        if (matchesLoyaltyTenant(userOwner, tenantId)) {
          return row;
        }
        continue;
      }
    }
    if (tenantId === 'default' && !targetAccountId && !targetCustomerId) {
      return row;
    }
  }

  return null;
}

export function matchesLoyaltyTenant(row: unknown, tenantId: string = '*'): boolean {
  if (!row || typeof row !== 'object') return false;
  const clean = tenantId ? tenantId.trim() : '';
  if (!clean || clean === '*' || clean.toLowerCase() === 'hq') return true;
  return matchesTenantRow(row as Record<string, unknown>, clean);
}

export function hasOpenApiLoyaltyTenantMismatch(c: any, resolvedTenantId?: string): boolean {
  const candidateOverrides = [
    typeof c?.req?.query === 'function' ? c.req.query('tenant_id') : '',
    typeof c?.req?.query === 'function' ? c.req.query('tenantId') : '',
    typeof c?.req?.query === 'function' ? c.req.query('store_id') : '',
    typeof c?.req?.query === 'function' ? c.req.query('storeId') : '',
    typeof c?.req?.header === 'function' ? c.req.header('x-tenant-id') : '',
    typeof c?.req?.header === 'function' ? c.req.header('X-Tenant-Id') : '',
    typeof c?.req?.header === 'function' ? c.req.header('X-Tenant-ID') : '',
    typeof c?.req?.header === 'function' ? c.req.header('x-store-id') : '',
    typeof c?.req?.header === 'function' ? c.req.header('X-Store-Id') : '',
    typeof c?.req?.header === 'function' ? c.req.header('X-Store-ID') : '',
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return true;
  }
  const user = typeof c?.get === 'function' ? c.get('user') : null;
  if (!user) return false;
  const rawUserTenant =
    typeof user?.tenantId === 'string'
      ? user.tenantId.trim()
      : typeof user?.tenant_id === 'string'
        ? user.tenant_id.trim()
        : '';
  const isHq =
    (user?.role === 'owner' || user?.role === 'admin') &&
    (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq');
  if (isHq) {
    return false;
  }
  if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') {
    return true;
  }
  const reqQueryTenant = typeof c?.req?.query === 'function'
    ? (
        c.req.query('tenant_id') ??
        c.req.query('tenantId') ??
        c.req.query('store_id') ??
        c.req.query('storeId') ??
        ''
      ).trim()
    : '';
  const reqHeaderTenant = typeof c?.req?.header === 'function'
    ? (
        c.req.header('x-tenant-id') ??
        c.req.header('X-Tenant-Id') ??
        c.req.header('X-Tenant-ID') ??
        c.req.header('x-store-id') ??
        c.req.header('X-Store-Id') ??
        c.req.header('X-Store-ID') ??
        ''
      ).trim()
    : '';
  if (
    reqQueryTenant === '*' ||
    reqQueryTenant.toLowerCase() === 'hq' ||
    reqHeaderTenant === '*' ||
    reqHeaderTenant.toLowerCase() === 'hq'
  ) {
    return true;
  }
  const boundTenant = rawUserTenant || 'default';
  const cleanResolved = typeof resolvedTenantId === 'string' ? resolvedTenantId.trim() : '';
  if (cleanResolved && cleanResolved !== '*' && cleanResolved.toLowerCase() !== 'hq' && cleanResolved !== boundTenant) {
    return true;
  }
  if (reqQueryTenant && reqQueryTenant !== boundTenant) {
    return true;
  }
  if (reqHeaderTenant && reqHeaderTenant !== boundTenant) {
    return true;
  }
  return false;
}

export function getVietnamMonthAndYear(nowDate: Date = new Date()): { currentMonth: number; currentYear: string } {
  const vnNow = new Date(nowDate.getTime() + 7 * 3600_000);
  return {
    currentMonth: vnNow.getUTCMonth() + 1,
    currentYear: String(vnNow.getUTCFullYear()),
  };
}

export async function checkRewardTenant(
  db: any,
  reward: Record<string, unknown> | null | undefined,
  tenantId: string = '*'
): Promise<boolean> {
  if (!reward || typeof reward !== 'object') return false;
  const cleanTenant = tenantId ? tenantId.trim() : '';
  if (!cleanTenant || cleanTenant === '*' || cleanTenant.toLowerCase() === 'hq') return true;
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

export async function resolveRewardTenantId(
  db: any,
  reward: Record<string, unknown> | null | undefined,
  tenantId: string = '*'
): Promise<string> {
  const cleanTenant = tenantId ? tenantId.trim() : '';
  if (cleanTenant && cleanTenant !== '*' && cleanTenant.toLowerCase() !== 'hq') return cleanTenant;
  if (!reward || typeof reward !== 'object') return 'default';
  if ('tenant_id' in reward && reward.tenant_id !== undefined && reward.tenant_id !== null) {
    const rawT = String(reward.tenant_id).trim();
    if (rawT && rawT !== '*' && rawT.toLowerCase() !== 'hq') return rawT;
  }
  const rewardId = reward.id ? String(reward.id) : '';
  if (rewardId) {
    try {
      const auditRow = await db
        .prepare(
          `SELECT user_id, actor_id, metadata, details, tenant_id FROM audit_logs
           WHERE (entity_id = ? OR resource_id = ?) AND action = 'loyalty_reward_create'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(rewardId, rewardId)
        .first();
      if (auditRow) {
        if (auditRow.tenant_id && String(auditRow.tenant_id).trim()) {
          return String(auditRow.tenant_id).trim();
        }
        const rawMeta = auditRow.metadata ?? auditRow.details;
        if (rawMeta) {
          try {
            const parsed = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
            const metaTenant = parsed?.tenant_id ?? parsed?.tenantId;
            if (metaTenant && String(metaTenant).trim() !== '') {
              return String(metaTenant).trim();
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
          if (creator && creator.tenant_id !== undefined && String(creator.tenant_id).trim()) {
            return String(creator.tenant_id).trim();
          }
        }
      }
    } catch {
      // Optional audit_logs table
    }
  }
  return 'default';
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
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  let account: any = null;
  let usingCustomersFallback = false;
  let loyaltyAccountsTableExists = true;

  try {
    if (effectiveTenant) {
      try {
        account = await db
          .prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(customerId, effectiveTenant)
          .first();
      } catch {
        if (effectiveTenant === 'default') {
          account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?').bind(customerId).first();
        }
      }
    } else {
      account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?').bind(customerId).first();
    }
  } catch {
    loyaltyAccountsTableExists = false;
    usingCustomersFallback = true;
  }

  if (account && tenantId && tenantId !== '*') {
    const custLookup = String(account.customer_id ?? customerId ?? '');
    let ownerRow: Record<string, unknown> | null = null;
    if (custLookup) {
      if (effectiveTenant) {
        ownerRow = (await db
          .prepare("SELECT * FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(custLookup, effectiveTenant)
          .first()
          .catch(() => null)) as Record<string, unknown> | null;
      }
      if (!ownerRow) {
        ownerRow = (await db.prepare('SELECT * FROM customers WHERE id = ?').bind(custLookup).first().catch(() => null)) as Record<string, unknown> | null;
      }
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
      let cust = effectiveTenant
        ? await db
            .prepare(
              "SELECT *, id as customer_id, loyalty_points as current_points, COALESCE(lifetime_points, loyalty_points, 0) as lifetime_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(customerId, effectiveTenant)
            .first()
            .catch(() => null)
        : null;
      if (!cust) {
        cust = await db.prepare(
          'SELECT *, id as customer_id, loyalty_points as current_points, COALESCE(lifetime_points, loyalty_points, 0) as lifetime_points, loyalty_tier as tier, updated_at as last_activity_at FROM customers WHERE id = ?'
        ).bind(customerId).first();
      }
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
          if (effectiveTenant) {
            try {
              account = await db
                .prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
                .bind(customerId, effectiveTenant)
                .first();
            } catch {
              if (effectiveTenant === 'default') {
                account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?').bind(customerId).first().catch(() => null);
              }
            }
          } else {
            account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?').bind(customerId).first().catch(() => null);
          }
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

export async function resolveTierForPoints(db: any, points: number, tenantId: string = '*'): Promise<string> {
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  const allowUnscopedTierFallback = !effectiveTenant || effectiveTenant === 'default';
  try {
    let res = effectiveTenant
      ? ((await db
          .prepare("SELECT tier_name, min_points FROM loyalty_tiers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY min_points DESC")
          .bind(effectiveTenant)
          .all()
          .catch(() => null)) as { results?: Array<{ tier_name: string; min_points: number }> } | null)
      : null;
    if ((!res?.results || res.results.length === 0) && effectiveTenant && effectiveTenant !== 'default') {
      res = (await db
        .prepare("SELECT tier_name, min_points FROM loyalty_tiers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default' ORDER BY min_points DESC")
        .all()
        .catch(() => null)) as { results?: Array<{ tier_name: string; min_points: number }> } | null;
    }
    if ((!res?.results || res.results.length === 0) && allowUnscopedTierFallback) {
      res = (await db
        .prepare('SELECT tier_name, min_points FROM loyalty_tiers ORDER BY min_points DESC')
        .all()) as { results?: Array<{ tier_name: string; min_points: number }> } | null;
    }
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
    let res = effectiveTenant
      ? ((await db
          .prepare("SELECT tier, min_points FROM loyalty_tier_configs WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY min_points DESC")
          .bind(effectiveTenant)
          .all()
          .catch(() => null)) as { results?: Array<{ tier: string; min_points: number }> } | null)
      : null;
    if ((!res?.results || res.results.length === 0) && effectiveTenant && effectiveTenant !== 'default') {
      res = (await db
        .prepare("SELECT tier, min_points FROM loyalty_tier_configs WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default' ORDER BY min_points DESC")
        .all()
        .catch(() => null)) as { results?: Array<{ tier: string; min_points: number }> } | null;
    }
    if ((!res?.results || res.results.length === 0) && allowUnscopedTierFallback) {
      res = (await db
        .prepare('SELECT tier, min_points FROM loyalty_tier_configs ORDER BY min_points DESC')
        .all()) as { results?: Array<{ tier: string; min_points: number }> } | null;
    }
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
): Promise<number | null> {
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
  const allowUnscopedFallback = !effectiveTenant || effectiveTenant === 'default';
  const lockKey = `${accountId}:${customerId}`;
  const prevLock = accountSyncLocks.get(lockKey) ?? Promise.resolve();

  const runSync = prevLock.then(async (): Promise<number | null> => {
    let resolvedBalance = newBalance;
    let effectiveLifetime = Math.max(0, newBalance);
    const isNegativeDelta = hasRelativeDelta && Number(pointsDelta) < 0;
    const requiredFloor = isNegativeDelta ? Math.abs(Number(pointsDelta)) : 0;
    const acctFloorClause = isNegativeDelta ? ' AND current_points >= ?' : '';
    const acctFloorBind = isNegativeDelta ? [requiredFloor] : [];
    const acctPointsExpr = hasRelativeDelta ? 'MAX(0, COALESCE(current_points, 0) + ?)' : '?';
    const acctPointsBind = hasRelativeDelta ? Number(pointsDelta) : newBalance;
    let acctUpdateRes: any = null;
    try {
      if (lifetimeDelta > 0) {
        if (effectiveTenant) {
          try {
            acctUpdateRes = await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?${acctFloorClause}`
            ).bind(acctPointsBind, lifetimeDelta, now, now, accountId, customerId, effectiveTenant, ...acctFloorBind).run();
          } catch (err) {
            if (!allowUnscopedFallback) {
              throw err;
            }
            acctUpdateRes = await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?)${acctFloorClause}`
            ).bind(acctPointsBind, lifetimeDelta, now, now, accountId, customerId, ...acctFloorBind).run();
          }
        } else {
          acctUpdateRes = await db.prepare(
            `UPDATE loyalty_accounts
             SET current_points = ${acctPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, last_activity_at = ?, updated_at = ?
             WHERE (id = ? OR customer_id = ?)${acctFloorClause}`
          ).bind(acctPointsBind, lifetimeDelta, now, now, accountId, customerId, ...acctFloorBind).run();
        }
      } else {
        if (effectiveTenant) {
          try {
            acctUpdateRes = await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?${acctFloorClause}`
            ).bind(acctPointsBind, now, now, accountId, customerId, effectiveTenant, ...acctFloorBind).run();
          } catch (err) {
            if (!allowUnscopedFallback) {
              throw err;
            }
            acctUpdateRes = await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = ${acctPointsExpr}, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?)${acctFloorClause}`
            ).bind(acctPointsBind, now, now, accountId, customerId, ...acctFloorBind).run();
          }
        } else {
          acctUpdateRes = await db.prepare(
            `UPDATE loyalty_accounts
             SET current_points = ${acctPointsExpr}, last_activity_at = ?, updated_at = ?
             WHERE (id = ? OR customer_id = ?)${acctFloorClause}`
          ).bind(acctPointsBind, now, now, accountId, customerId, ...acctFloorBind).run();
        }
      }
      let accRow: { current_points?: number; lifetime_points?: number } | null = null;
      if (effectiveTenant) {
        try {
          accRow = (await db
            .prepare("SELECT current_points, lifetime_points FROM loyalty_accounts WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(customerId, effectiveTenant)
            .first()) as { current_points?: number; lifetime_points?: number } | null;
        } catch {
          if (allowUnscopedFallback) {
            accRow = (await db
              .prepare('SELECT current_points, lifetime_points FROM loyalty_accounts WHERE customer_id = ?')
              .bind(customerId)
              .first()
              .catch(() => null)) as { current_points?: number; lifetime_points?: number } | null;
          }
        }
      } else {
        accRow = (await db
          .prepare('SELECT current_points, lifetime_points FROM loyalty_accounts WHERE customer_id = ?')
          .bind(customerId)
          .first()
          .catch(() => null)) as { current_points?: number; lifetime_points?: number } | null;
      }
      if (accRow) {
        if (isNegativeDelta && (acctUpdateRes?.meta?.changes === 0 || acctUpdateRes?.changes === 0)) {
          return null;
        }
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

    const custFloorClause = isNegativeDelta ? ' AND COALESCE(loyalty_points, 0) >= ?' : '';
    const custFloorBind = isNegativeDelta ? [requiredFloor] : [];
    const custPointsExpr = hasRelativeDelta ? 'MAX(0, COALESCE(loyalty_points, 0) + ?)' : '?';
    const custPointsBind = hasRelativeDelta ? Number(pointsDelta) : newBalance;
    let custUpdateRes: any = null;
    try {
      if (lifetimeDelta > 0) {
        if (effectiveTenant) {
          try {
            custUpdateRes = await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?${custFloorClause}`
            ).bind(custPointsBind, lifetimeDelta, now, customerId, effectiveTenant, ...custFloorBind).run();
          } catch (err) {
            if (!allowUnscopedFallback) {
              throw err;
            }
            custUpdateRes = await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
               WHERE id = ?${custFloorClause}`
            ).bind(custPointsBind, lifetimeDelta, now, customerId, ...custFloorBind).run();
          }
        } else {
          custUpdateRes = await db.prepare(
            `UPDATE customers
             SET loyalty_points = ${custPointsExpr}, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
             WHERE id = ?${custFloorClause}`
          ).bind(custPointsBind, lifetimeDelta, now, customerId, ...custFloorBind).run();
        }
      } else {
        if (effectiveTenant) {
          try {
            custUpdateRes = await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, updated_at = ?
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?${custFloorClause}`
            ).bind(custPointsBind, now, customerId, effectiveTenant, ...custFloorBind).run();
          } catch (err) {
            if (!allowUnscopedFallback) {
              throw err;
            }
            custUpdateRes = await db.prepare(
              `UPDATE customers
               SET loyalty_points = ${custPointsExpr}, updated_at = ?
               WHERE id = ?${custFloorClause}`
            ).bind(custPointsBind, now, customerId, ...custFloorBind).run();
          }
        } else {
          custUpdateRes = await db.prepare(
            `UPDATE customers
             SET loyalty_points = ${custPointsExpr}, updated_at = ?
             WHERE id = ?${custFloorClause}`
          ).bind(custPointsBind, now, customerId, ...custFloorBind).run();
        }
      }
      let custRow: { loyalty_points?: number; lifetime_points?: number } | null = null;
      if (effectiveTenant) {
        try {
          custRow = (await db
            .prepare("SELECT loyalty_points, lifetime_points FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(customerId, effectiveTenant)
            .first()) as { loyalty_points?: number; lifetime_points?: number } | null;
        } catch {
          if (allowUnscopedFallback) {
            custRow = (await db
              .prepare('SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?')
              .bind(customerId)
              .first()
              .catch(() => null)) as { loyalty_points?: number; lifetime_points?: number } | null;
          }
        }
      } else {
        custRow = (await db
          .prepare('SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?')
          .bind(customerId)
          .first()
          .catch(() => null)) as { loyalty_points?: number; lifetime_points?: number } | null;
      }
      if (custRow) {
        const acctNoChanges = !acctUpdateRes || acctUpdateRes?.meta?.changes === 0 || acctUpdateRes?.changes === 0;
        const custNoChanges = custUpdateRes?.meta?.changes === 0 || custUpdateRes?.changes === 0;
        if (isNegativeDelta && custNoChanges && acctNoChanges) {
          return null;
        }
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

    const newTier = await resolveTierForPoints(db, effectiveLifetime, tenantId);
    try {
      if (effectiveTenant) {
        try {
          await db
            .prepare("UPDATE loyalty_accounts SET tier = ?, updated_at = ? WHERE (id = ? OR customer_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(newTier, now, accountId, customerId, effectiveTenant)
            .run();
        } catch (err) {
          if (!allowUnscopedFallback) {
            throw err;
          }
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
        } catch (err) {
          if (!allowUnscopedFallback) {
            throw err;
          }
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
  const writeTenant = effectiveTenant || 'default';

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
  await db.prepare('UPDATE loyalty_transactions SET tenant_id = ? WHERE id = ?').bind(writeTenant, txId).run().catch(() => {});

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
    await db.prepare('UPDATE loyalty_point_logs SET tenant_id = ? WHERE id = ?').bind(writeTenant, txId).run().catch(() => {});
  } catch {
    // Ignore when loyalty_point_logs is absent in older migration snapshots
  }
}
