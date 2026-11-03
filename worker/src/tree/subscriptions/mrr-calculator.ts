// Extracted MRR snapshot calculation from routes/subscriptions.ts

import { today, nowStr } from './helpers';

export async function updateMRRSnapshot(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string = 'default'
): Promise<void> {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant !== 'default' && normTenant !== '*') {
    return;
  }
  const date = today();
  let activeSubs: { count: number; mrr: number } | null = null;
  try {
    activeSubs = await db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = 'active' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'"
    ).first<{ count: number; mrr: number }>();
  } catch {
    activeSubs = await db.prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = \'active\''
    ).first<{ count: number; mrr: number }>();
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
    churned = await db.prepare(
      'SELECT COUNT(*) as count FROM subscriptions WHERE status = \'cancelled\' AND updated_at >= ?'
    ).bind(monthStartIso).first<{ count: number }>();
  }

  let newSubs: { count: number } | null = null;
  try {
    newSubs = await db.prepare(
      "SELECT COUNT(*) as count FROM subscriptions WHERE created_at >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'"
    ).bind(monthStartIso).first<{ count: number }>();
  } catch {
    newSubs = await db.prepare(
      'SELECT COUNT(*) as count FROM subscriptions WHERE created_at >= ?'
    ).bind(monthStartIso).first<{ count: number }>();
  }

  const mrr = activeSubs?.mrr || 0;
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
