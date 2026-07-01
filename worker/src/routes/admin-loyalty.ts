/**
 * Admin Loyalty Routes — /api/admin-loyalty
 * Dashboard widgets + CSV export for loyalty program management.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth.js';

interface LoyaltyWidget {
  title: string;
  value: number | string;
  change?: string;
  icon?: string;
}

interface TierDistribution {
  tier: string;
  count: number;
  percentage: number;
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  tier: string;
  total_spent: number;
  visit_count: number;
}

export const adminLoyaltyRouter = new Hono<{ Bindings: Env }>();

// All routes require auth
adminLoyaltyRouter.use('*', requireAuth(['owner', 'admin', 'staff']));

// GET /api/admin-loyalty/widgets — 8 KPI widgets
adminLoyaltyRouter.get('/widgets', async (c) => {
  const db = c.env.AURA_DB;

  const [
    totalCustomers,
    activeThisMonth,
    totalCashback,
    totalSpent,
    avgVisits,
    topTier,
    churnRisk,
    redemptionRate,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>(),
    db.prepare(
      "SELECT COUNT(*) as count FROM customers WHERE updated_at >= ?"
    ).bind(new Date(Date.now() - 30 * 86400000).toISOString()).first<{ count: number }>(),
    db.prepare('SELECT COALESCE(SUM(cashback_balance), 0) as total FROM customers').first<{ total: number }>(),
    db.prepare('SELECT COALESCE(SUM(total_spent), 0) as total FROM customers').first<{ total: number }>(),
    db.prepare('SELECT COALESCE(AVG(visit_count), 0) as avg FROM customers').first<{ avg: number }>(),
    db.prepare(
      "SELECT tier, COUNT(*) as count FROM customers GROUP BY tier ORDER BY count DESC LIMIT 1"
    ).first<{ tier: string; count: number }>(),
    db.prepare(
      "SELECT COUNT(*) as count FROM customers WHERE updated_at < ?"
    ).bind(new Date(Date.now() - 90 * 86400000).toISOString()).first<{ count: number }>(),
    db.prepare(
      'SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as redeemed FROM checkins'
    ).bind('approved').first<{ total: number; redeemed: number }>(),
  ]);

  const widgets: LoyaltyWidget[] = [
    { title: 'Total Members', value: totalCustomers?.count || 0, icon: 'users' },
    { title: 'Active (30d)', value: activeThisMonth?.count || 0, icon: 'activity' },
    { title: 'Cashback Pool', value: totalCashback?.total || 0, icon: 'gift' },
    { title: 'Total Spend', value: totalSpent?.total || 0, icon: 'dollar' },
    { title: 'Avg Visits', value: Math.round(avgVisits?.avg || 0), icon: 'repeat' },
    { title: 'Top Tier', value: topTier?.tier || 'N/A', icon: 'star' },
    { title: 'Churn Risk (90d)', value: churnRisk?.count || 0, icon: 'alert' },
    {
      title: 'Redemption Rate',
      value: redemptionRate?.total ? Math.round((redemptionRate.redeemed / redemptionRate.total) * 100) + '%' : '0%',
      icon: 'check',
    },
  ];

  return c.json({ success: true, data: widgets });
});

// GET /api/admin-loyalty/tiers — tier distribution
adminLoyaltyRouter.get('/tiers', async (c) => {
  const db = c.env.AURA_DB;

  const { results } = await db.prepare(
    'SELECT tier, COUNT(*) as count FROM customers GROUP BY tier ORDER BY count DESC'
  ).all<{ tier: string; count: number }>();

  const total = (results || []).reduce((sum, r) => sum + r.count, 0);

  const distribution: TierDistribution[] = (results || []).map(r => ({
    tier: r.tier,
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
  }));

  return c.json({ success: true, data: { distribution, total } });
});

// GET /api/admin-loyalty/top-customers — top 20 by spend
adminLoyaltyRouter.get('/top-customers', async (c) => {
  const db = c.env.AURA_DB;
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const { results } = await db.prepare(
    'SELECT id, name, phone, tier, total_spent, visit_count FROM customers ORDER BY total_spent DESC LIMIT ?'
  ).bind(limit).all<TopCustomer>();

  return c.json({ success: true, data: results || [] });
});

// GET /api/admin-loyalty/export — CSV export
adminLoyaltyRouter.get('/export', async (c) => {
  const db = c.env.AURA_DB;

  const { results } = await db.prepare(
    'SELECT id, name, phone, email, birthday, tier, cashback_balance, total_spent, visit_count, created_at FROM customers ORDER BY created_at DESC'
  ).all<CustomerExportRow>();

  const headers = ['ID', 'Name', 'Phone', 'Email', 'Birthday', 'Tier', 'Cashback', 'Total Spent', 'Visits', 'Created'];
  const csvRows = [headers.join(',')];

  for (const row of results || []) {
    csvRows.push([
      row.id,
      `"${(row.name || '').replace(/"/g, '""')}"`,
      row.phone || '',
      row.email || '',
      row.birthday || '',
      row.tier || '',
      row.cashback_balance || 0,
      row.total_spent || 0,
      row.visit_count || 0,
      row.created_at || '',
    ].join(','));
  }

  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`);
  return c.body(csvRows.join('\n'));
});

interface CustomerExportRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  tier: string;
  cashback_balance: number;
  total_spent: number;
  visit_count: number;
  created_at: string;
}
