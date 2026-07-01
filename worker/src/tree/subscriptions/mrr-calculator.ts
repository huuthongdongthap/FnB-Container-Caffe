// Extracted MRR snapshot calculation from routes/subscriptions.ts

import { today, nowStr } from './helpers';

export async function updateMRRSnapshot(db: import('@cloudflare/workers-types').D1Database): Promise<void> {
  const date = today();
  const activeSubs = await db.prepare(
    "SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = 'active'"
  ).first<{ count: number; mrr: number }>();

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const churned = await db.prepare(
    "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled' AND updated_at >= ?"
  ).bind(monthStart.toISOString()).first<{ count: number }>();

  const newSubs = await db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE created_at >= ?'
  ).bind(monthStart.toISOString()).first<{ count: number }>();

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
    'snap_' + date.replace(/-/g, ''),
    date, mrr, mrr * 12, active,
    newSubs?.count || 0, churnCount,
    totalBase > 0 ? Math.round((churnCount / totalBase) * 1000) / 10 : 0,
    active > 0 ? Math.round(mrr / active) : 0,
    nowStr()
  ).run();
}
