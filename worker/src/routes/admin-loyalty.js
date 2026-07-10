/**
 * Admin Loyalty Analytics Routes — /api/admin/loyalty
 * 8 dashboard widgets + CSV export
 * Auth: handled by /api/admin/* middleware in index.js (owner/staff only)
 */

import { Hono } from 'hono';

export const adminLoyaltyRouter = new Hono();

const db = (c) => c.env.AURA_DB;

function nowSqlTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ── Widget 1: Members total + by tier ──
adminLoyaltyRouter.get('/widget/members-by-tier', async (c) => {
  const { results } = await db(c).prepare(`
    SELECT COALESCE(loyalty_tier, 'bronze') as tier, COUNT(*) as count
    FROM customers
    GROUP BY loyalty_tier
    ORDER BY count DESC
  `).all();

  const total = results.reduce((s, r) => s + r.count, 0);
  return c.json({ ok: true, total, by_tier: results, last_updated: new Date().toISOString() });
});

// ── Widget 2 + 3: Cashback issued / redeemed by period + redemption rate ──
adminLoyaltyRouter.get('/widget/cashback-flow', async (c) => {
  const D = db(c);
  const periods = [
    { key: 'today', filter: 'date(created_at) = date(\'now\')' },
    { key: 'week', filter: 'created_at >= datetime(\'now\', \'-7 days\')' },
    { key: 'month', filter: 'created_at >= datetime(\'now\', \'-30 days\')' },
  ];

  const result = {};
  for (const { key, filter } of periods) {
    const issued = await D.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM cashback_transactions WHERE type IN ('earn', 'bonus') AND ${filter}`
    ).first();
    const redeemed = await D.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM cashback_transactions WHERE type IN ('spend', 'redeem') AND ${filter}`
    ).first();

    const it = issued?.total || 0;
    const rt = redeemed?.total || 0;
    result[key] = {
      issued:  { total: it, count: issued?.count || 0 },
      redeemed: { total: rt, count: redeemed?.count || 0 },
      redemption_rate: it > 0 ? +((rt / it) * 100).toFixed(1) : 0,
    };
  }

  return c.json({ ok: true, ...result, last_updated: new Date().toISOString() });
});

// ── Widget 4: Top 10 spenders ──
adminLoyaltyRouter.get('/widget/top-spenders', async (c) => {
  const { results } = await db(c).prepare(`
    SELECT c.id, c.name, c.phone, c.loyalty_tier, c.loyalty_points,
           COALESCE(w.total_spent, 0) as total_spent,
           COALESCE(w.balance, 0) as balance
    FROM customers c
    LEFT JOIN cashback_wallets w ON w.customer_id = c.id
    WHERE w.total_spent > 0
    ORDER BY w.total_spent DESC
    LIMIT 10
  `).all();

  return c.json({ ok: true, top: results, last_updated: new Date().toISOString() });
});

// ── Widget 5: Members with cashback expiring within 7 days ──
adminLoyaltyRouter.get('/widget/expiring-soon', async (c) => {
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();

  const { results } = await db(c).prepare(`
    SELECT c.id, c.name, c.phone, c.loyalty_tier,
           SUM(ct.amount) as expiring_amount,
           MIN(ct.expires_at) as earliest_expiry
    FROM customers c
    JOIN cashback_transactions ct ON ct.customer_id = c.id
    WHERE ct.type IN ('earn', 'bonus')
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= ?
      AND ct.expires_at > datetime('now')
    GROUP BY c.id
    HAVING expiring_amount > 1000
    ORDER BY earliest_expiry ASC
    LIMIT 20
  `).bind(sevenDays).all();

  return c.json({ ok: true, expiring: results, last_updated: new Date().toISOString() });
});

// ── Widget 6: New sign-ups by channel + 14-day trend ──
adminLoyaltyRouter.get('/widget/signups-trend', async (c) => {
  const D = db(c);
  const { results: byChannel } = await D.prepare(`
    SELECT COALESCE(source, 'unknown') as channel, COUNT(*) as count
    FROM customers
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY source
    ORDER BY count DESC
  `).all();

  const { results: byDay } = await D.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM customers
    WHERE created_at >= datetime('now', '-14 days')
    GROUP BY day
    ORDER BY day
  `).all();

  const totalMonth = byChannel.reduce((s, r) => s + r.count, 0);
  return c.json({ ok: true, by_channel: byChannel, by_day: byDay, total_month: totalMonth });
});

// ── Widget 7: Referral stats (graceful when table absent) ──
adminLoyaltyRouter.get('/widget/referrals', async (c) => {
  try {
    const D = db(c);
    const stats = await D.prepare(`
      SELECT
        COUNT(*) as total_pairs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM referrals
      WHERE created_at >= datetime('now', '-30 days')
    `).first();

    const { results: topReferrers } = await D.prepare(`
      SELECT c.name, c.phone, COUNT(r.id) as refer_count
      FROM referrals r
      JOIN customers c ON c.id = r.referrer_id
      WHERE r.status = 'completed'
      GROUP BY c.id
      ORDER BY refer_count DESC
      LIMIT 5
    `).all();

    return c.json({ ok: true, stats, top_referrers: topReferrers });
  } catch {
    return c.json({ ok: true, stats: { total_pairs: 0, completed: 0, pending: 0 }, top_referrers: [], note: 'Referral table not active yet' });
  }
});

// ── Widget 8: Active campaign progress ──
adminLoyaltyRouter.get('/widget/active-campaign', async (c) => {
  const D = db(c);
  const now = nowSqlTimestamp();
  const campaign = await D.prepare(
    'SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1'
  ).bind(now, now).first();

  if (!campaign) {return c.json({ ok: true, campaign: null });}

  const signupCount = await D.prepare(
    'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
  ).bind(campaign.id).first();

  const boosted = await D.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
     FROM cashback_transactions WHERE campaign_id = ? AND type = 'earn'`
  ).bind(campaign.id).first();

  return c.json({
    ok: true,
    campaign,
    progress: {
      signup_granted:         signupCount?.count || 0,
      signup_cap:             campaign.signup_bonus_cap,
      signup_remaining:       Math.max(0, (campaign.signup_bonus_cap || 0) - (signupCount?.count || 0)),
      cashback_boosted_count: boosted?.count || 0,
      cashback_boosted_total: boosted?.total || 0,
    },
  });
});

// ── Export CSV ──
const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/^([=+\-@|])/, '\'$1') + '"';

adminLoyaltyRouter.get('/export/:type', async (c) => {
  const type = c.req.param('type');
  const D = db(c);
  let csv = '';

  if (type === 'members') {
    const { results } = await D.prepare(`
      SELECT c.id, c.name, c.phone, c.loyalty_tier, c.loyalty_points,
             COALESCE(w.balance, 0) as cashback_balance,
             COALESCE(w.total_earned, 0) as total_earned,
             COALESCE(w.total_spent, 0) as total_spent,
             c.source, c.created_at
      FROM customers c
      LEFT JOIN cashback_wallets w ON w.customer_id = c.id
      ORDER BY c.created_at DESC
    `).all();

    csv = 'ID,Name,Phone,Tier,Points,Balance,TotalEarned,TotalSpent,Source,CreatedAt\n';
    csv += results.map(r =>
      [r.id, csvCell(r.name), csvCell(r.phone), csvCell(r.loyalty_tier), r.loyalty_points, r.cashback_balance, r.total_earned, r.total_spent, csvCell(r.source), csvCell(r.created_at)].join(',')
    ).join('\n');
  } else if (type === 'transactions') {
    const { results } = await D.prepare(`
      SELECT ct.id, ct.customer_id, c.phone, c.name,
             ct.type, ct.amount, ct.balance_after, ct.order_id,
             ct.campaign_id, ct.expires_at, ct.created_at
      FROM cashback_transactions ct
      JOIN customers c ON c.id = ct.customer_id
      WHERE ct.created_at >= datetime('now', '-30 days')
      ORDER BY ct.created_at DESC
    `).all();

    csv = 'ID,CustomerID,Phone,Name,Type,Amount,BalanceAfter,OrderID,CampaignID,ExpiresAt,CreatedAt\n';
    csv += results.map(r =>
      [r.id, r.customer_id, csvCell(r.phone), csvCell(r.name), csvCell(r.type), r.amount, r.balance_after, csvCell(r.order_id), csvCell(r.campaign_id), csvCell(r.expires_at), csvCell(r.created_at)].join(',')
    ).join('\n');
  } else {
    return c.json({ ok: false, error: 'Unknown export type' }, 400);
  }

  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="loyalty-${type}-${Date.now()}.csv"`,
    },
  });
});
