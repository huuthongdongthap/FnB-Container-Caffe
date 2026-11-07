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
  tenantId: string = 'default'
): Promise<void> {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant !== 'default') {
    return;
  }
  const date = today();
  let activeSubs: { count: number; mrr: number; normalized_mrr?: number } | null = null;
  try {
    activeSubs = await db.prepare(
      "SELECT (SELECT COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(billing_cycle, 'monthly'))) = 'quarterly' THEN amount_vnd / 3.0 WHEN LOWER(TRIM(COALESCE(billing_cycle, 'monthly'))) IN ('annual', 'yearly') THEN amount_vnd / 12.0 ELSE amount_vnd END), 0) FROM subscriptions WHERE status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default') as normalized_mrr, count, mrr FROM (SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default')"
    ).first<{ count: number; mrr: number; normalized_mrr?: number }>();
  } catch {
    try {
      activeSubs = await db.prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'"
      ).first<{ count: number; mrr: number }>();
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

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();
  let churned: { count: number } | null = null;
  try {
    churned = await db.prepare(
      "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled' AND updated_at >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'"
    ).bind(monthStartIso).first<{ count: number }>();
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
      "SELECT COUNT(*) as count FROM subscriptions WHERE created_at >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'"
    ).bind(monthStartIso).first<{ count: number }>();
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
    date, mrr, mrr * 12, active,
    newSubs?.count || 0, churnCount,
    totalBase > 0 ? Math.round((churnCount / totalBase) * 1000) / 10 : 0,
    active > 0 ? Math.round(mrr / active) : 0,
    nowStr()
  ).run();
}
