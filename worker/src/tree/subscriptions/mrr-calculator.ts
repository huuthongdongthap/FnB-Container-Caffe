// Extracted MRR snapshot calculation from routes/subscriptions.ts

import { today, nowStr } from './helpers';

export function normalizeSubscriptionMonthlyVnd(
  amountVnd: number,
  billingCycle?: string | null
): number {
  if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
    return 0;
  }
  const cycle = String(billingCycle ?? 'monthly').trim().toLowerCase();
  if (cycle === 'quarterly') {
    return Math.round(amountVnd / 3);
  }
  if (cycle === 'annual' || cycle === 'yearly') {
    return Math.round(amountVnd / 12);
  }
  return Math.round(amountVnd);
}

export async function updateMRRSnapshot(
  db: import('@cloudflare/workers-types').D1Database,
  tenantOrDate: string = 'default',
  explicitTenant?: string
): Promise<void> {
  const isDateArg = /^\d{4}-\d{2}-\d{2}$/.test(String(tenantOrDate || '').trim());
  const rawTenant = explicitTenant !== undefined
    ? explicitTenant
    : isDateArg
      ? 'default'
      : tenantOrDate;
  const normTenant = (rawTenant || '').trim() || 'default';
  if (normTenant === '*' || normTenant.toLowerCase() === 'hq') {
    return;
  }

  const date = isDateArg ? String(tenantOrDate).trim() : today();
  let activeSubs: { count: number; mrr: number; normalized_mrr?: number } | null = null;
  try {
    activeSubs = await db.prepare(
      "SELECT (SELECT COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(billing_cycle, 'monthly'))) = 'quarterly' THEN amount_vnd / 3.0 WHEN LOWER(TRIM(COALESCE(billing_cycle, 'monthly'))) IN ('annual', 'yearly') THEN amount_vnd / 12.0 ELSE amount_vnd END), 0) FROM subscriptions WHERE status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) as normalized_mrr, count, mrr FROM (SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
    ).bind(normTenant, normTenant).first<{ count: number; mrr: number; normalized_mrr?: number }>();
  } catch {
    try {
      activeSubs = await db.prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(normTenant).first<{ count: number; mrr: number }>();
    } catch {
      if (normTenant === 'default') {
        try {
          activeSubs = await db.prepare(
            "SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(billing_cycle, 'monthly'))) = 'quarterly' THEN amount_vnd / 3.0 WHEN LOWER(TRIM(COALESCE(billing_cycle, 'monthly'))) IN ('annual', 'yearly') THEN amount_vnd / 12.0 ELSE amount_vnd END), 0) as mrr FROM subscriptions WHERE status = 'active'"
          ).first<{ count: number; mrr: number }>();
        } catch {
          activeSubs = await db.prepare(
            'SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = \'active\''
          ).first<{ count: number; mrr: number }>();
        }
      }
    }
  }

  const ICT_OFFSET_MS = 7 * 3600_000;
  const nowIct = new Date(Date.now() + ICT_OFFSET_MS);
  const monthStartIso = new Date(
    Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), 1) - ICT_OFFSET_MS
  ).toISOString();
  let churned: { count: number } | null = null;
  try {
    churned = await db.prepare(
      "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled' AND updated_at >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(monthStartIso, normTenant).first<{ count: number }>();
  } catch {
    if (normTenant === 'default') {
      churned = await db.prepare(
        'SELECT COUNT(*) as count FROM subscriptions WHERE status = \'cancelled\' AND updated_at >= ?'
      ).bind(monthStartIso).first<{ count: number }>();
    }
  }

  let newSubs: { count: number } | null = null;
  try {
    newSubs = await db.prepare(
      "SELECT COUNT(*) as count FROM subscriptions WHERE created_at >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(monthStartIso, normTenant).first<{ count: number }>();
  } catch {
    if (normTenant === 'default') {
      newSubs = await db.prepare(
        'SELECT COUNT(*) as count FROM subscriptions WHERE created_at >= ?'
      ).bind(monthStartIso).first<{ count: number }>();
    }
  }

  const rawMrr =
    activeSubs?.normalized_mrr !== undefined && activeSubs?.normalized_mrr !== null
      ? Number(activeSubs.normalized_mrr)
      : Number(activeSubs?.mrr || 0);
  const mrr = Math.round(Number.isFinite(rawMrr) ? rawMrr : 0);
  const active = activeSubs?.count || 0;
  const churnCount = churned?.count || 0;
  const totalBase = active + churnCount;
  const newSubsCount = newSubs?.count || 0;
  const churnRatePct = totalBase > 0 ? Math.round((churnCount / totalBase) * 1000) / 10 : 0;
  const avgContractValue = active > 0 ? Math.round(mrr / active) : 0;
  const createdAt = nowStr();

  if (normTenant !== 'default') {
    try {
      const colsRes = await db
        .prepare('PRAGMA table_info(mrr_snapshots)')
        .all<{ name?: string }>();
      const cols = colsRes.results || [];
      if (cols.length === 0 || !cols.some((col) => col.name === 'tenant_id')) {
        return;
      }
    } catch {
      return;
    }
  }

  const snapId = normTenant === 'default'
    ? `snap_${date.replace(/-/g, '')}`
    : `mrr_${normTenant}_${date}`;

  try {
    await db.prepare(
      `INSERT INTO mrr_snapshots (id, tenant_id, snapshot_date, mrr_vnd, arr_vnd, active_subscriptions,
       new_subscriptions_month, churned_subscriptions_month, churn_rate_pct, avg_contract_value_vnd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, snapshot_date) DO UPDATE SET
       mrr_vnd = excluded.mrr_vnd, arr_vnd = excluded.arr_vnd,
       active_subscriptions = excluded.active_subscriptions,
       new_subscriptions_month = excluded.new_subscriptions_month,
       churned_subscriptions_month = excluded.churned_subscriptions_month,
       churn_rate_pct = excluded.churn_rate_pct,
       avg_contract_value_vnd = excluded.avg_contract_value_vnd`
    ).bind(
      snapId,
      normTenant,
      date,
      mrr,
      mrr * 12,
      active,
      newSubsCount,
      churnCount,
      churnRatePct,
      avgContractValue,
      createdAt
    ).run();
  } catch {
    if (normTenant === 'default') {
      await db.prepare(
        `INSERT INTO mrr_snapshots (id, snapshot_date, mrr_vnd, arr_vnd, active_subscriptions,
         new_subscriptions_month, churned_subscriptions_month, churn_rate_pct, avg_contract_value_vnd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(snapshot_date) DO UPDATE SET
         mrr_vnd = excluded.mrr_vnd, arr_vnd = excluded.arr_vnd,
         active_subscriptions = excluded.active_subscriptions,
         new_subscriptions_month = excluded.new_subscriptions_month,
         churned_subscriptions_month = excluded.churned_subscriptions_month,
         churn_rate_pct = excluded.churn_rate_pct,
         avg_contract_value_vnd = excluded.avg_contract_value_vnd`
      ).bind(
        `snap_${date.replace(/-/g, '')}`,
        date,
        mrr,
        mrr * 12,
        active,
        newSubsCount,
        churnCount,
        churnRatePct,
        avgContractValue,
        createdAt
      ).run();
    }
  }
}
