/**
 * /api/reports — D+1 post-launch analytics endpoints
 * Auth: requireAuth(['owner', 'staff']) applied at route level in index.js
 */

import { Hono } from 'hono';

export const reportsRouter = new Hono();

// Helper: parse date param, default to yesterday
function resolveDate(param) {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {return param;}
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/reports/signups?date=YYYY-MM-DD
 * Signup stats for a given date, broken down by source channel.
 */
reportsRouter.get('/signups', async (c) => {
  const date = resolveDate(c.req.query('date'));
  const db = c.env.AURA_DB;

  const [total, bySource, bonusGranted, campaignCap] = await Promise.all([
    db.prepare(
      'SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = ?'
    ).bind(date).first(),

    db.prepare(
      'SELECT COALESCE(source, \'unknown\') as source, COUNT(*) as count FROM customers WHERE DATE(created_at) = ? GROUP BY source ORDER BY count DESC'
    ).bind(date).all(),

    db.prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(bonus_vnd), 0) as total_vnd FROM signup_bonus_log WHERE DATE(granted_at) = ?'
    ).bind(date).first(),

    db.prepare(
      'SELECT id, signup_bonus_cap, (SELECT COUNT(*) FROM signup_bonus_log WHERE campaign_id = bonus_campaigns.id) as used FROM bonus_campaigns WHERE code = \'GRAND_OPENING_6_6_2026\''
    ).first(),
  ]);

  return c.json({
    ok: true,
    date,
    signups: {
      total: total?.count || 0,
      by_source: bySource?.results || [],
      signup_bonus: {
        granted: bonusGranted?.count || 0,
        total_vnd: bonusGranted?.total_vnd || 0,
        cap: campaignCap?.signup_bonus_cap || 0,
        remaining: Math.max(0, (campaignCap?.signup_bonus_cap || 0) - (campaignCap?.used || 0)),
        cap_used_pct: campaignCap?.signup_bonus_cap
          ? Math.round(((campaignCap?.used || 0) / campaignCap.signup_bonus_cap) * 100)
          : 0,
      },
    },
  });
});

/**
 * GET /api/reports/cashback?date=YYYY-MM-DD
 * Cashback issued/spent on a given date.
 */
reportsRouter.get('/cashback', async (c) => {
  const date = resolveDate(c.req.query('date'));
  const db = c.env.AURA_DB;

  const [byType, topEarners, walletStats] = await Promise.all([
    db.prepare(
      'SELECT type, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_vnd FROM cashback_transactions WHERE DATE(created_at) = ? GROUP BY type ORDER BY total_vnd DESC'
    ).bind(date).all(),

    db.prepare(
      `SELECT c.name, c.phone, c.loyalty_tier,
              COALESCE(SUM(CASE WHEN ct.type IN ('earn','bonus') THEN ct.amount ELSE 0 END), 0) as earned,
              COALESCE(SUM(CASE WHEN ct.type IN ('spend','redeem') THEN ct.amount ELSE 0 END), 0) as spent
       FROM cashback_transactions ct
       JOIN customers c ON c.id = ct.customer_id
       WHERE DATE(ct.created_at) = ?
       GROUP BY c.id ORDER BY earned DESC LIMIT 10`
    ).bind(date).all(),

    db.prepare(
      'SELECT COUNT(*) as wallets, COALESCE(SUM(balance), 0) as total_balance, COALESCE(SUM(total_earned), 0) as total_earned FROM cashback_wallets'
    ).first(),
  ]);

  const rows = byType?.results || [];
  const earned = rows.filter(r => ['earn', 'bonus'].includes(r.type)).reduce((s, r) => s + r.total_vnd, 0);
  const spent = rows.filter(r => ['spend', 'redeem'].includes(r.type)).reduce((s, r) => s + r.total_vnd, 0);

  return c.json({
    ok: true,
    date,
    cashback: {
      issued_vnd: earned,
      spent_vnd: spent,
      net_liability_vnd: earned - spent,
      by_type: rows,
      top_earners: topEarners?.results || [],
      wallet_totals: walletStats || {},
    },
  });
});

/**
 * GET /api/reports/orders?date=YYYY-MM-DD
 * Order volume + revenue for a given date.
 */
reportsRouter.get('/orders', async (c) => {
  const date = resolveDate(c.req.query('date'));
  const db = c.env.AURA_DB;

  const [byStatus, byPayment, revenue, hourly] = await Promise.all([
    db.prepare(
      'SELECT status, COUNT(*) as count FROM orders WHERE DATE(created_at) = ? GROUP BY status ORDER BY count DESC'
    ).bind(date).all(),

    db.prepare(
      'SELECT payment_method, payment_status, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE DATE(created_at) = ? GROUP BY payment_method, payment_status'
    ).bind(date).all(),

    db.prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue, COALESCE(SUM(cashback_earned), 0) as cashback_earned FROM orders WHERE DATE(created_at) = ?'
    ).bind(date).first(),

    db.prepare(
      'SELECT STRFTIME(\'%H\', created_at) as hour, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE DATE(created_at) = ? GROUP BY hour ORDER BY hour'
    ).bind(date).all(),
  ]);

  return c.json({
    ok: true,
    date,
    orders: {
      total: revenue?.count || 0,
      revenue_vnd: revenue?.revenue || 0,
      cashback_earned_vnd: revenue?.cashback_earned || 0,
      by_status: byStatus?.results || [],
      by_payment: byPayment?.results || [],
      hourly: hourly?.results || [],
    },
  });
});

/**
 * GET /api/reports/summary?date=YYYY-MM-DD
 * Full D+1 summary: signups + cashback + orders + campaign KPIs in one call.
 */
reportsRouter.get('/summary', async (c) => {
  const date = resolveDate(c.req.query('date'));
  const db = c.env.AURA_DB;

  const [signups, orders, cashbackRows, bonusGranted, campaignCap, tiers] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = ?').bind(date).first(),
    db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE DATE(created_at) = ? AND status NOT IN (\'cancelled\')').bind(date).first(),
    db.prepare('SELECT type, COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE DATE(created_at) = ? GROUP BY type').bind(date).all(),
    db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(bonus_vnd), 0) as total_vnd FROM signup_bonus_log WHERE DATE(granted_at) = ?').bind(date).first(),
    db.prepare('SELECT id, signup_bonus_cap, (SELECT COUNT(*) FROM signup_bonus_log WHERE campaign_id = bonus_campaigns.id) as used FROM bonus_campaigns WHERE code = \'GRAND_OPENING_6_6_2026\'').first(),
    db.prepare('SELECT loyalty_tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC').all(),
  ]);

  const cbRows = cashbackRows?.results || [];
  const cbEarned = cbRows.filter(r => ['earn','bonus'].includes(r.type)).reduce((s,r) => s + r.total, 0);
  const cbSpent = cbRows.filter(r => ['spend','redeem'].includes(r.type)).reduce((s,r) => s + r.total, 0);

  // KPI targets
  const KPI = { signups: 100, orders: 150, cashback_vnd: 5000000 };
  const actual = {
    signups: signups?.count || 0,
    orders: orders?.count || 0,
    revenue: orders?.revenue || 0,
    cashback_issued: cbEarned,
    bonus_granted_count: bonusGranted?.count || 0,
    bonus_granted_vnd: bonusGranted?.total_vnd || 0,
    cap_used: campaignCap?.used || 0,
    cap_total: campaignCap?.signup_bonus_cap || 0,
  };

  return c.json({
    ok: true,
    date,
    campaign: 'GRAND_OPENING_6_6_2026',
    kpi: {
      signups:   { target: KPI.signups, actual: actual.signups, pct: Math.round(actual.signups / KPI.signups * 100) },
      orders:    { target: KPI.orders, actual: actual.orders, pct: Math.round(actual.orders / KPI.orders * 100) },
      cashback:  { target: KPI.cashback_vnd, actual: actual.cashback_issued, pct: Math.round(actual.cashback_issued / KPI.cashback_vnd * 100) },
    },
    signups: actual.signups,
    orders: actual.orders,
    revenue_vnd: actual.revenue,
    cashback_issued_vnd: actual.cashback_issued,
    cashback_spent_vnd: cbSpent,
    signup_bonus: {
      granted: actual.bonus_granted_count,
      vnd: actual.bonus_granted_vnd,
      cap_used: actual.cap_used,
      cap_total: actual.cap_total,
      cap_pct: Math.round(actual.cap_used / actual.cap_total * 100),
    },
    member_tiers: tiers?.results || [],
  });
});
