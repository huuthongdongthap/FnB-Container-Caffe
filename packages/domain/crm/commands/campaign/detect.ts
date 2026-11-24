/**
 * Campaign Trigger Detectors — find candidate customers for each campaign type.
 * Pure-ish: D1 query + filter, returns CampaignCustomer[] ready for send.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { CampaignChannel, CampaignCustomer } from './types';

export type ConsentChannelInput = CampaignChannel | CampaignChannel[];

const CANONICAL_MARKETING_CHANNELS = ['sms', 'email', 'zalo', 'push'] as const;

export function normalizeConsentChannel(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value || value === 'all') return 'all';
  if (value === 'zns' || value === 'zalo_zns' || value === 'zalo') return 'zalo';
  return value;
}

function normalizeCampaignTenant(tenantId?: string): string | undefined {
  if (!tenantId || !tenantId.trim()) return undefined;
  const trimmed = tenantId.trim();
  return trimmed === '*' || trimmed.toLowerCase() === 'hq' ? '*' : trimmed;
}

function rowMatchesTenant(row: unknown, tenantId?: string): boolean {
  const normTenant = normalizeCampaignTenant(tenantId);
  if (!normTenant || normTenant === '*') return true;
  if (!row || typeof row !== 'object' || !('tenant_id' in row) || (row as { tenant_id?: unknown }).tenant_id === undefined) {
    return normTenant === 'default';
  }
  const raw = (row as { tenant_id?: unknown }).tenant_id;
  const normalized = typeof raw === 'string' && raw.trim() ? raw.trim() : 'default';
  return normalized === normTenant;
}

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /no such table/i.test(msg);
}

function isMissingColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /no such column/i.test(msg);
}

function isMissingSchemaError(err: unknown): boolean {
  return isMissingTableError(err) || isMissingColumnError(err);
}

interface ConsentQueryRow {
  customer_id: string;
  channel?: string | null;
  granted?: number | boolean | null;
  revoked_at?: string | null;
  granted_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

interface CustomerConsentState {
  globalGranted: boolean;
  channels: Map<string, boolean>;
}

function evaluateCustomerMarketingConsent(rows: ConsentQueryRow[]): CustomerConsentState {
  const state: CustomerConsentState = {
    globalGranted: false,
    channels: new Map<string, boolean>(),
  };
  for (const row of rows) {
    const ch = normalizeConsentChannel(row.channel);
    const activeGrant = Boolean(row.granted) && !row.revoked_at;
    if (ch === 'all') {
      // Chronological global grant or revocation overrides prior per-channel entries
      state.globalGranted = activeGrant;
      state.channels.clear();
    } else {
      state.channels.set(ch, activeGrant);
    }
  }
  return state;
}

function isConsentAllowedForChannel(state: CustomerConsentState, channel?: ConsentChannelInput): boolean {
  if (!channel) {
    for (const ch of CANONICAL_MARKETING_CHANNELS) {
      if (state.channels.get(ch) ?? state.globalGranted) return true;
    }
    for (const allowed of state.channels.values()) {
      if (allowed) return true;
    }
    return false;
  }
  const requested = Array.isArray(channel) ? channel : [channel];
  if (requested.length === 0) {
    return isConsentAllowedForChannel(state, undefined);
  }
  for (const rawCh of requested) {
    const ch = normalizeConsentChannel(rawCh);
    if (ch === 'all') {
      if (isConsentAllowedForChannel(state, undefined)) return true;
      continue;
    }
    const explicit = state.channels.get(ch);
    if (explicit !== undefined) {
      if (explicit) return true;
    } else if (state.globalGranted) {
      return true;
    }
  }
  return false;
}

async function queryMarketingConsentRows(
  db: D1Database,
  batch: string[],
  hasScopedTenant: boolean,
  normTenant?: string
): Promise<ConsentQueryRow[]> {
  const placeholders = batch.map(() => '?').join(', ');
  const runSelect = async (cols: string, orderBy: string, withTenantFilter: boolean) => {
    const tenantClause = withTenantFilter
      ? " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      : '';
    const sql = `SELECT ${cols} FROM consents
      WHERE customer_id IN (${placeholders})
        AND purpose = 'marketing'${tenantClause}
      ORDER BY ${orderBy}`;
    const args = withTenantFilter && normTenant ? [...batch, normTenant] : batch;
    const res = await db.prepare(sql).bind(...args).all<ConsentQueryRow>();
    return res.results || [];
  };

  const attempts: Array<{ cols: string; orderBy: string }> = [
    {
      cols: 'customer_id, channel, granted, revoked_at, granted_at, updated_at, created_at',
      orderBy: "COALESCE(updated_at, revoked_at, granted_at, created_at, '') ASC, rowid ASC",
    },
    {
      cols: 'customer_id, channel, granted, revoked_at',
      orderBy: 'rowid ASC',
    },
    {
      cols: 'customer_id, granted, revoked_at, granted_at, updated_at, created_at',
      orderBy: "COALESCE(updated_at, revoked_at, granted_at, created_at, '') ASC, rowid ASC",
    },
    {
      cols: 'customer_id, granted, revoked_at',
      orderBy: 'rowid ASC',
    },
  ];

  const tryScope = async (withTenantFilter: boolean): Promise<ConsentQueryRow[]> => {
    let lastErr: unknown;
    for (const attempt of attempts) {
      try {
        return await runSelect(attempt.cols, attempt.orderBy, withTenantFilter);
      } catch (err) {
        lastErr = err;
        if (!isMissingColumnError(err)) {
          throw err;
        }
      }
    }
    throw lastErr;
  };

  if (hasScopedTenant && normTenant) {
    try {
      return await tryScope(true);
    } catch (err) {
      if (isMissingColumnError(err) && normTenant === 'default') {
        return await tryScope(false);
      }
      throw err;
    }
  }

  return await tryScope(false);
}

/**
 * Exclude erased/anonymized customers and require explicit active PDPA
 * marketing opt-in (either global `'all'` or matching channel). Fails closed
 * on missing `consents` table, missing `tenant_id` on non-default tenants,
 * or unexpected DB errors.
 */
export async function filterEligibleMarketingCandidates(
  db: D1Database,
  candidates: CampaignCustomer[],
  tenantId?: string,
  channel?: ConsentChannelInput
): Promise<CampaignCustomer[]> {
  if (candidates.length === 0) return [];
  const ids = Array.from(new Set(candidates.map((c) => c.id).filter(Boolean)));
  if (ids.length === 0) return [];

  const excludedIds = new Set<string>();
  const BATCH_SIZE = 50;
  const normTenant = normalizeCampaignTenant(tenantId);
  const hasScopedTenant = Boolean(normTenant && normTenant !== '*');

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(', ');

    // 1. Exclude anonymized / erased customers
    try {
      const res = await db
        .prepare(`SELECT id FROM customers WHERE id IN (${placeholders}) AND anonymized_at IS NOT NULL`)
        .bind(...batch)
        .all<{ id: string }>();
      for (const r of res.results || []) {
        if (r.id) excludedIds.add(r.id);
      }
    } catch (err) {
      if (!isMissingSchemaError(err)) {
        for (const id of batch) excludedIds.add(id);
        continue;
      }
    }

    // 2. Require explicit PDPA marketing consent (opt-in required, fails closed)
    try {
      const consentRows = await queryMarketingConsentRows(db, batch, hasScopedTenant, normTenant);
      const byCustomer = new Map<string, ConsentQueryRow[]>();
      for (const row of consentRows) {
        if (!row.customer_id) continue;
        const list = byCustomer.get(row.customer_id) ?? [];
        list.push(row);
        byCustomer.set(row.customer_id, list);
      }
      for (const cid of batch) {
        const rows = byCustomer.get(cid);
        if (!rows || rows.length === 0) {
          excludedIds.add(cid);
          continue;
        }
        const state = evaluateCustomerMarketingConsent(rows);
        if (!isConsentAllowedForChannel(state, channel)) {
          excludedIds.add(cid);
        }
      }
    } catch {
      for (const id of batch) excludedIds.add(id);
    }
  }

  return candidates.filter((c) => !excludedIds.has(c.id));
}

export async function hasMarketingConsentForChannel(
  db: D1Database,
  customerId: string,
  channel: CampaignChannel,
  tenantId?: string
): Promise<boolean> {
  if (!customerId) return false;
  const eligible = await filterEligibleMarketingCandidates(
    db,
    [{ id: customerId, name: '', tenant_id: tenantId }],
    tenantId,
    channel
  );
  return eligible.length > 0;
}

/**
 * Welcome — new customers in last 24h who haven't received welcome message.
 */
export async function detectWelcomeCandidates(
  db: D1Database,
  tenantId?: string,
  channel?: ConsentChannelInput
): Promise<CampaignCustomer[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');
  if (scoped && normTenant) {
    tenantId = normTenant;
    try {
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at, c.tenant_id
        FROM customers c
        WHERE c.created_at > ?
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
              AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
          )
      `).bind(cutoff, tenantId, tenantId).all<CampaignCustomer>();
      return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
    } catch {
      try {
        const { results } = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at, c.tenant_id
          FROM customers c
          WHERE c.created_at > ?
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
            AND NOT EXISTS (
              SELECT 1 FROM campaign_logs cl
              WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
            )
        `).bind(cutoff, tenantId).all<CampaignCustomer>();
        return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
      } catch {
        if (tenantId !== 'default') {
          return [];
        }
      }
    }
  }
  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at, c.tenant_id
      FROM customers c
      WHERE c.created_at > ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
        )
    `).bind(cutoff).all<CampaignCustomer>();
    results = res.results;
  } catch {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.created_at
      FROM customers c
      WHERE c.created_at > ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id AND cl.trigger = 'welcome'
        )
    `).bind(cutoff).all<CampaignCustomer>();
    results = res.results;
  }
  return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
}

/**
 * Birthday — customers whose birth month matches current month, not sent this year.
 */
export async function detectBirthdayCandidates(
  db: D1Database,
  tenantId?: string,
  channel?: ConsentChannelInput
): Promise<CampaignCustomer[]> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearStart = `${now.getFullYear()}-01-01`;
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');

  if (scoped && normTenant) {
    tenantId = normTenant;
    try {
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth, c.tenant_id
        FROM customers c
        WHERE c.date_of_birth IS NOT NULL
          AND substr(c.date_of_birth, 6, 2) = ?
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger = 'birthday'
              AND cl.sent_at >= ?
              AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
          )
      `).bind(month, tenantId, yearStart, tenantId).all<CampaignCustomer>();
      return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
    } catch {
      try {
        const { results } = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth, c.tenant_id
          FROM customers c
          WHERE c.date_of_birth IS NOT NULL
            AND substr(c.date_of_birth, 6, 2) = ?
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
            AND NOT EXISTS (
              SELECT 1 FROM campaign_logs cl
              WHERE cl.customer_id = c.id
                AND cl.trigger = 'birthday'
                AND cl.sent_at >= ?
            )
        `).bind(month, tenantId, yearStart).all<CampaignCustomer>();
        return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
      } catch {
        if (tenantId !== 'default') {
          return [];
        }
      }
    }
  }

  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth, c.tenant_id
      FROM customers c
      WHERE c.date_of_birth IS NOT NULL
        AND substr(c.date_of_birth, 6, 2) = ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'birthday'
            AND cl.sent_at >= ?
        )
    `).bind(month, yearStart).all<CampaignCustomer>();
    results = res.results;
  } catch {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth
      FROM customers c
      WHERE c.date_of_birth IS NOT NULL
        AND substr(c.date_of_birth, 6, 2) = ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'birthday'
            AND cl.sent_at >= ?
        )
    `).bind(month, yearStart).all<CampaignCustomer>();
    results = res.results;
  }
  return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
}

/**
 * Winback — customers inactive for 30+ days.
 */
export async function detectWinbackCandidates(
  db: D1Database,
  tenantIdOrDays?: string | number,
  maybeTenantIdOrChannel?: string | ConsentChannelInput,
  maybeChannel?: ConsentChannelInput,
): Promise<CampaignCustomer[]> {
  const inactiveDays = typeof tenantIdOrDays === 'number' ? tenantIdOrDays : 30;
  const rawTenantId =
    typeof tenantIdOrDays === 'string'
      ? tenantIdOrDays
      : typeof maybeTenantIdOrChannel === 'string'
        ? maybeTenantIdOrChannel
        : undefined;
  const channel: ConsentChannelInput | undefined =
    typeof tenantIdOrDays === 'string'
      ? (maybeTenantIdOrChannel as ConsentChannelInput | undefined) ?? maybeChannel
      : maybeChannel;
  const tenantId = normalizeCampaignTenant(rawTenantId);
  const cutoff = new Date(Date.now() - inactiveDays * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  const scoped = Boolean(tenantId && tenantId !== '*');

  const validOrderClause =
    "AND LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(COALESCE(o.payment_status, '')) NOT IN ('failed', 'expired', 'cancelled', 'canceled', 'refunded')";
  if (scoped && tenantId) {
    try {
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause} AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) as last_order_date
        FROM customers c
        WHERE c.phone IS NOT NULL
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (
            SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause} AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
          ) < ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger = 'winback'
              AND cl.sent_at > ?
              AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
          )
      `).bind(tenantId, tenantId, tenantId, cutoff, sixtyDaysAgo, tenantId).all<CampaignCustomer>();
      return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
    } catch {
      try {
        const { results } = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) as last_order_date
          FROM customers c
          WHERE c.phone IS NOT NULL
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            AND (
              SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
            ) < ?
            AND NOT EXISTS (
              SELECT 1 FROM campaign_logs cl
              WHERE cl.customer_id = c.id
                AND cl.trigger = 'winback'
                AND cl.sent_at > ?
            )
        `).bind(tenantId, tenantId, tenantId, cutoff, sixtyDaysAgo).all<CampaignCustomer>();
        return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
      } catch {
        try {
          const { results } = await db.prepare(`
            SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
              (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date
            FROM customers c
            WHERE c.phone IS NOT NULL
              AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
              AND (
                SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id
              ) < ?
              AND NOT EXISTS (
                SELECT 1 FROM campaign_logs cl
                WHERE cl.customer_id = c.id
                  AND cl.trigger = 'winback'
                  AND cl.sent_at > ?
              )
          `).bind(tenantId, cutoff, sixtyDaysAgo).all<CampaignCustomer>();
          return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
        } catch {
          if (tenantId !== 'default') {
            return [];
          }
        }
      }
    }
  }

  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}) as last_order_date
      FROM customers c
      WHERE c.phone IS NOT NULL
        AND (
          SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}
        ) < ?
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'winback'
            AND cl.sent_at > ?
        )
    `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();
    results = res.results;
  } catch {
    try {
      const res = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}) as last_order_date
        FROM customers c
        WHERE c.phone IS NOT NULL
          AND (
            SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id ${validOrderClause}
          ) < ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger = 'winback'
              AND cl.sent_at > ?
          )
      `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();
      results = res.results;
    } catch {
      const res = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date
        FROM customers c
        WHERE c.phone IS NOT NULL
          AND (
            SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id
          ) < ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger = 'winback'
              AND cl.sent_at > ?
          )
      `).bind(cutoff, sixtyDaysAgo).all<CampaignCustomer>();
      results = res.results;
    }
  }
  return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
}

/**
 * Post-Visit — send review request 24-48h after completed order.
 */
export async function detectPostVisitCandidates(
  db: D1Database,
  tenantId?: string,
  channel?: ConsentChannelInput
): Promise<CampaignCustomer[]> {
  const now = Date.now();
  const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const until = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');

  if (scoped && normTenant) {
    tenantId = normTenant;
    try {
      const { results } = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, c.tenant_id,
          o.id as order_id, o.created_at as last_order_date
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.status = 'completed'
          AND o.created_at BETWEEN ? AND ?
          AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM campaign_logs cl
            WHERE cl.customer_id = c.id
              AND cl.trigger = 'post_visit'
              AND cl.sent_at > ?
              AND COALESCE(NULLIF(TRIM(cl.tenant_id), ''), 'default') = ?
          )
      `).bind(since, until, tenantId, tenantId, since, tenantId).all<CampaignCustomer>();
      return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
    } catch {
      try {
        const { results } = await db.prepare(`
          SELECT c.id, c.name, c.phone, c.email, c.tenant_id,
            o.id as order_id, o.created_at as last_order_date
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          WHERE o.status = 'completed'
            AND o.created_at BETWEEN ? AND ?
            AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
            AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
            AND NOT EXISTS (
              SELECT 1 FROM campaign_logs cl
              WHERE cl.customer_id = c.id
                AND cl.trigger = 'post_visit'
                AND cl.sent_at > ?
            )
        `).bind(since, until, tenantId, tenantId, since).all<CampaignCustomer>();
        return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
      } catch {
        try {
          const { results } = await db.prepare(`
            SELECT c.id, c.name, c.phone, c.email, c.tenant_id,
              o.id as order_id, o.created_at as last_order_date
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.status = 'completed'
              AND o.created_at BETWEEN ? AND ?
              AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
              AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
              AND NOT EXISTS (
                SELECT 1 FROM campaign_logs cl
                WHERE cl.customer_id = c.id
                  AND cl.trigger = 'post_visit'
                  AND cl.sent_at > ?
              )
          `).bind(since, until, tenantId, since).all<CampaignCustomer>();
          return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
        } catch {
          if (tenantId !== 'default') {
            return [];
          }
        }
      }
    }
  }

  let results: CampaignCustomer[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.tenant_id,
        o.id as order_id, o.created_at as last_order_date
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.status = 'completed'
        AND o.created_at BETWEEN ? AND ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'post_visit'
            AND cl.sent_at > ?
        )
    `).bind(since, until, since).all<CampaignCustomer>();
    results = res.results;
  } catch {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email,
        o.id as order_id, o.created_at as last_order_date
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.status = 'completed'
        AND o.created_at BETWEEN ? AND ?
        AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_logs cl
          WHERE cl.customer_id = c.id
            AND cl.trigger = 'post_visit'
            AND cl.sent_at > ?
        )
    `).bind(since, until, since).all<CampaignCustomer>();
    results = res.results;
  }
  return filterEligibleMarketingCandidates(db, (results || []).filter((r) => rowMatchesTenant(r, tenantId)), tenantId, channel);
}

interface ExpiringRow {
  customer_id: string;
  phone: string | null;
  name: string | null;
  total_expiring: number;
  wallet_balance?: number | null;
  tenant_id?: string | null;
}

/**
 * Cashback Expiry — customers with cashback expiring within 7 days.
 */
export async function detectCashbackExpiry(
  db: D1Database,
  tenantId?: string,
  channel?: ConsentChannelInput
): Promise<CampaignCustomer[]> {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const normTenant = normalizeCampaignTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');

  let results: ExpiringRow[] = [];
  if (scoped && normTenant) {
    tenantId = normTenant;
    try {
      const scopedRes = await db.prepare(`
        SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, cw.balance as wallet_balance, c.tenant_id as tenant_id
        FROM cashback_transactions ct
        JOIN cashback_wallets cw ON ct.wallet_id = cw.id
        JOIN customers c ON cw.customer_id = c.id
        WHERE ct.type IN ('earn', 'bonus')
          AND ct.expires_at IS NOT NULL
          AND ct.expires_at <= ?
          AND ct.expires_at > datetime('now')
          AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?
          AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
        GROUP BY cw.customer_id
      `).bind(sevenDaysFromNow, tenantId, tenantId, sevenDaysAgo).all<ExpiringRow>();
      results = (scopedRes.results || []).filter((r) => rowMatchesTenant(r, tenantId));
      const candidates = results
        .map((row) => {
          const cappedAmount = row.wallet_balance != null
            ? Math.max(0, Math.min(Number(row.total_expiring || 0), Number(row.wallet_balance)))
            : row.total_expiring;
          const resolvedTenant = (row.tenant_id && String(row.tenant_id).trim()) || tenantId;
          return {
            id: row.customer_id,
            name: row.name || '',
            phone: row.phone || undefined,
            email: undefined,
            loyalty_tier: undefined,
            total_spent: cappedAmount,
            tenant_id: resolvedTenant,
          };
        })
        .filter((c) => (c.total_spent ?? 0) > 0);
      return filterEligibleMarketingCandidates(db, candidates, tenantId, channel);
    } catch {
      try {
        const scopedFallback = await db.prepare(`
          SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, c.tenant_id as tenant_id
          FROM cashback_transactions ct
          JOIN cashback_wallets cw ON ct.wallet_id = cw.id
          JOIN customers c ON cw.customer_id = c.id
          WHERE ct.type IN ('earn', 'bonus')
            AND ct.expires_at IS NOT NULL
            AND ct.expires_at <= ?
            AND ct.expires_at > datetime('now')
            AND COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?
            AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
          GROUP BY cw.customer_id
        `).bind(sevenDaysFromNow, tenantId, tenantId).all<ExpiringRow>();
        results = (scopedFallback.results || []).filter((r) => rowMatchesTenant(r, tenantId));
        return filterEligibleMarketingCandidates(
          db,
          results.map((row) => ({
            id: row.customer_id,
            name: row.name || '',
            phone: row.phone || undefined,
            email: undefined,
            loyalty_tier: undefined,
            total_spent: row.total_expiring,
            tenant_id: (row.tenant_id && String(row.tenant_id).trim()) || tenantId,
          })),
          tenantId,
          channel,
        );
      } catch {
        if (tenantId !== 'default') {
          return [];
        }
      }
    }
  }
  try {
    const primary = await db.prepare(`
      SELECT ct.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, c.tenant_id as tenant_id
      FROM cashback_transactions ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.type IN ('earn', 'bonus')
        AND ct.expires_at IS NOT NULL
        AND ct.expires_at <= ?
        AND ct.expires_at > datetime('now')
        AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
      GROUP BY ct.customer_id
    `).bind(sevenDaysFromNow, sevenDaysAgo).all<ExpiringRow>();
    results = primary.results || [];
  } catch {
    try {
      const primaryLegacy = await db.prepare(`
        SELECT ct.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring
        FROM cashback_transactions ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.type IN ('earn', 'bonus')
          AND ct.expires_at IS NOT NULL
          AND ct.expires_at <= ?
          AND ct.expires_at > datetime('now')
          AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
        GROUP BY ct.customer_id
      `).bind(sevenDaysFromNow, sevenDaysAgo).all<ExpiringRow>();
      results = primaryLegacy.results || [];
    } catch {
      try {
        const fallback = await db.prepare(`
          SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring, c.tenant_id as tenant_id
          FROM cashback_transactions ct
          JOIN cashback_wallets cw ON ct.wallet_id = cw.id
          JOIN customers c ON cw.customer_id = c.id
          WHERE ct.type IN ('earn', 'bonus')
            AND ct.expires_at IS NOT NULL
            AND ct.expires_at <= ?
            AND ct.expires_at > datetime('now')
          GROUP BY cw.customer_id
        `).bind(sevenDaysFromNow).all<ExpiringRow>();
        results = fallback.results || [];
      } catch {
        try {
          const fallbackLegacy = await db.prepare(`
            SELECT cw.customer_id, c.phone, c.name, SUM(ct.amount) as total_expiring
            FROM cashback_transactions ct
            JOIN cashback_wallets cw ON ct.wallet_id = cw.id
            JOIN customers c ON cw.customer_id = c.id
            WHERE ct.type IN ('earn', 'bonus')
              AND ct.expires_at IS NOT NULL
              AND ct.expires_at <= ?
              AND ct.expires_at > datetime('now')
            GROUP BY cw.customer_id
          `).bind(sevenDaysFromNow).all<ExpiringRow>();
          results = fallbackLegacy.results || [];
        } catch {
          results = [];
        }
      }
    }
  }

  const candidates = results
    .filter((r) => rowMatchesTenant(r, normTenant))
    .map((row) => ({
      id: row.customer_id,
      name: row.name || '',
      phone: row.phone || undefined,
      email: undefined,
      loyalty_tier: undefined,
      total_spent: row.total_expiring,
      tenant_id: (row.tenant_id && String(row.tenant_id).trim()) || (normTenant && normTenant !== '*' ? normTenant : 'default'),
    }));
  return filterEligibleMarketingCandidates(db, candidates, normTenant, channel);
}

/**
 * Mark customers as notified for expiry warning (idempotent).
 * Returns number updated.
 */
export async function markExpiryNotified(
  db: D1Database,
  customerIds: string[],
  tenantId?: string,
): Promise<number> {
  if (customerIds.length === 0) return 0;

  const now = new Date().toISOString();
  const normTenant = normalizeCampaignTenant(tenantId);
  if (normTenant && normTenant !== '*') {
    try {
      const scopedStmts = customerIds.map((id) =>
        db.prepare("UPDATE customers SET last_expiry_warning_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(now, id, normTenant)
      );
      await db.batch(scopedStmts);
      return customerIds.length;
    } catch {
      if (normTenant !== 'default') {
        return 0;
      }
    }
  }
  const stmts = customerIds.map((id) =>
    db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, id)
  );
  try {
    await db.batch(stmts);
  } catch {
    // Graceful fallback when last_expiry_warning_at column is absent
  }
  return customerIds.length;
}
