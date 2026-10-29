/**
 * Admin Loyalty Routes — /api/admin-loyalty
 * Dashboard widgets + CSV export for loyalty program management.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';

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
adminLoyaltyRouter.use('*', requireAuth(['owner', 'admin', 'manager', 'staff']));

// GET /api/admin-loyalty/widgets — 8 KPI widgets
adminLoyaltyRouter.get('/widgets', async(c) => {
  const db = c.env.AURA_DB;

  let totalCustomers = 0;
  let activeThisMonth = 0;
  let totalCashback = 0;
  let totalSpent = 0;
  let avgVisits = 0;
  let topTier = 'bronze';
  let churnRisk = 0;
  let redemptionRate = { total: 0, redeemed: 0 };

  try {
    const custCount = await db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>();
    totalCustomers = custCount?.count || 0;
  } catch {}

  try {
    const act = await db.prepare('SELECT COUNT(*) as count FROM customers WHERE updated_at >= ?')
      .bind(new Date(Date.now() - 30 * 86400000).toISOString()).first<{ count: number }>();
    activeThisMonth = act?.count || 0;
  } catch {}

  try {
    const cb = await db.prepare('SELECT COALESCE(SUM(cashback_balance), 0) as total FROM customers').first<{ total: number }>();
    if (cb && typeof cb.total === 'number' && cb.total > 0) {
      totalCashback = cb.total;
    } else {
      const wal = await db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM cashback_wallets').first<{ total: number }>();
      totalCashback = wal?.total || cb?.total || 0;
    }
  } catch {
    try {
      const cb = await db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM cashback_wallets').first<{ total: number }>();
      totalCashback = cb?.total || 0;
    } catch {}
  }

  try {
    const sp = await db.prepare('SELECT COALESCE(SUM(total_spent), 0) as total FROM customers').first<{ total: number }>();
    if (sp && typeof sp.total === 'number' && sp.total > 0) {
      totalSpent = sp.total;
    } else {
      const ord = await db.prepare('SELECT COALESCE(SUM(total), 0) as total FROM orders').first<{ total: number }>();
      totalSpent = ord?.total || sp?.total || 0;
    }
  } catch {
    try {
      const sp = await db.prepare('SELECT COALESCE(SUM(total), 0) as total FROM orders').first<{ total: number }>();
      totalSpent = sp?.total || 0;
    } catch {}
  }

  try {
    const v = await db.prepare('SELECT COALESCE(AVG(visit_count), 0) as avg FROM customers').first<{ avg: number }>();
    if (v && typeof v.avg === 'number' && v.avg > 0) {
      avgVisits = Math.round(v.avg);
    } else {
      const ord = await db.prepare("SELECT COALESCE(AVG(cnt), 0) as avg FROM (SELECT COUNT(*) as cnt FROM orders WHERE status != 'cancelled' GROUP BY COALESCE(NULLIF(customer_id, ''), customer_phone))").first<{ avg: number }>();
      avgVisits = Math.round(ord?.avg || v?.avg || 0);
    }
  } catch {
    try {
      const ord = await db.prepare("SELECT COALESCE(AVG(cnt), 0) as avg FROM (SELECT COUNT(*) as cnt FROM orders WHERE status != 'cancelled' GROUP BY COALESCE(NULLIF(customer_id, ''), customer_phone))").first<{ avg: number }>();
      avgVisits = Math.round(ord?.avg || 0);
    } catch {}
  }

  try {
    const tt = await db.prepare('SELECT tier, COUNT(*) as count FROM customers GROUP BY tier ORDER BY count DESC LIMIT 1').first<{ tier: string; count: number }>();
    if (tt && tt.tier) {
      topTier = tt.tier;
    } else {
      const ttLoyalty = await db.prepare('SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC LIMIT 1').first<{ tier: string; count: number }>();
      topTier = ttLoyalty?.tier || 'N/A';
    }
  } catch {
    try {
      const tt = await db.prepare('SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC LIMIT 1').first<{ tier: string; count: number }>();
      topTier = tt?.tier || 'N/A';
    } catch {}
  }

  try {
    const cr = await db.prepare('SELECT COUNT(*) as count FROM customers WHERE updated_at < ?')
      .bind(new Date(Date.now() - 90 * 86400000).toISOString()).first<{ count: number }>();
    churnRisk = cr?.count || 0;
  } catch {}

  try {
    const rr = await db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as redeemed FROM checkins')
      .bind('approved').first<{ total: number; redeemed: number }>();
    if (rr) {
      redemptionRate = { total: rr.total || 0, redeemed: rr.redeemed || 0 };
    }
  } catch {}

  const widgets: LoyaltyWidget[] = [
    { title: 'Total Members', value: totalCustomers, icon: 'users' },
    { title: 'Active (30d)', value: activeThisMonth, icon: 'activity' },
    { title: 'Cashback Pool', value: totalCashback, icon: 'gift' },
    { title: 'Total Spend', value: totalSpent, icon: 'dollar' },
    { title: 'Avg Visits', value: avgVisits, icon: 'repeat' },
    { title: 'Top Tier', value: topTier, icon: 'star' },
    { title: 'Churn Risk (90d)', value: churnRisk, icon: 'alert' },
    {
      title: 'Redemption Rate',
      value: redemptionRate.total ? `${Math.round((redemptionRate.redeemed / redemptionRate.total) * 100)}%` : '0%',
      icon: 'check'
    }
  ];

  return c.json({ success: true, data: widgets });
});

// GET /api/admin-loyalty/tiers — tier distribution
adminLoyaltyRouter.get('/tiers', async(c) => {
  const db = c.env.AURA_DB;

  let rawTiers: Array<{ tier: string; count: number }> = [];
  try {
    const { results } = await db.prepare(
      'SELECT tier, COUNT(*) as count FROM customers GROUP BY tier ORDER BY count DESC'
    ).all<{ tier: string; count: number }>();
    if (results && results.length > 0) {
      rawTiers = results;
    } else {
      const res = await db.prepare(
        'SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC'
      ).all<{ tier: string; count: number }>();
      rawTiers = res.results || [];
    }
  } catch {
    try {
      const { results } = await db.prepare(
        'SELECT loyalty_tier as tier, COUNT(*) as count FROM customers GROUP BY loyalty_tier ORDER BY count DESC'
      ).all<{ tier: string; count: number }>();
      rawTiers = results || [];
    } catch {
      rawTiers = [];
    }
  }

  const total = rawTiers.reduce((sum, r) => sum + r.count, 0);

  const distribution: TierDistribution[] = rawTiers.map(r => ({
    tier: r.tier || 'bronze',
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0
  }));

  return c.json({ success: true, data: { distribution, total } });
});

// GET /api/admin-loyalty/top-customers — top 20 by spend
adminLoyaltyRouter.get('/top-customers', async(c) => {
  const db = c.env.AURA_DB;
  const limit = parseInt(c.req.query('limit') || '20', 10);

  let results: TopCustomer[] = [];
  try {
    const res = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.loyalty_tier as tier,
             COALESCE(cw.total_spent, 0) as total_spent,
             (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled') as visit_count
      FROM customers c
      LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
      ORDER BY total_spent DESC
      LIMIT ?
    `).bind(limit).all<TopCustomer>();
    results = res.results || [];
  } catch {
    try {
      const res = await db.prepare(
        'SELECT id, name, phone, tier, total_spent, visit_count FROM customers ORDER BY total_spent DESC LIMIT ?'
      ).bind(limit).all<TopCustomer>();
      results = res.results || [];
    } catch {
      results = [];
    }
  }

  return c.json({ success: true, data: results });
});

// GET /api/admin-loyalty/export — CSV export
adminLoyaltyRouter.get('/export', async(c) => {
  const db = c.env.AURA_DB;

  let results: CustomerExportRow[] = [];
  try {
    const res = await db.prepare(
      'SELECT id, name, phone, email, date_of_birth AS birthday, loyalty_tier AS tier, cashback_balance, total_spent, visit_count, created_at FROM customers ORDER BY created_at DESC'
    ).all<CustomerExportRow>();
    if (res.results && res.results.length > 0) {
      results = res.results;
    } else {
      const liveRes = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email,
               c.date_of_birth AS birthday,
               c.loyalty_tier AS tier,
               COALESCE(cw.balance, 0) AS cashback_balance,
               COALESCE(cw.total_spent, 0) AS total_spent,
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled') AS visit_count,
               c.created_at
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
        ORDER BY c.created_at DESC
      `).all<CustomerExportRow>();
      results = liveRes.results || [];
    }
  } catch {
    try {
      const liveRes = await db.prepare(`
        SELECT c.id, c.name, c.phone, c.email,
               c.date_of_birth AS birthday,
               c.loyalty_tier AS tier,
               COALESCE(cw.balance, 0) AS cashback_balance,
               COALESCE(cw.total_spent, 0) AS total_spent,
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled') AS visit_count,
               c.created_at
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
        ORDER BY c.created_at DESC
      `).all<CustomerExportRow>();
      results = liveRes.results || [];
    } catch {
      try {
        const res = await db.prepare(
          'SELECT id, name, phone, email, birthday, tier, cashback_balance, total_spent, visit_count, created_at FROM customers ORDER BY created_at DESC'
        ).all<CustomerExportRow>();
        results = res.results || [];
      } catch {
        try {
          const canonicalRes = await db.prepare(`
            SELECT c.id, c.name, c.phone, c.email,
                   '' AS birthday,
                   c.loyalty_tier AS tier,
                   COALESCE(cw.balance, 0) AS cashback_balance,
                   COALESCE(cw.total_spent, 0) AS total_spent,
                   (SELECT COUNT(*) FROM orders o WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled') AS visit_count,
                   c.created_at
            FROM customers c
            LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
            ORDER BY c.created_at DESC
          `).all<CustomerExportRow>();
          results = canonicalRes.results || [];
        } catch {
          results = [];
        }
      }
    }
  }

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
      row.created_at || ''
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
