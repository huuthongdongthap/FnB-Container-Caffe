# 📊 TASK 12 — Admin Loyalty Dashboard 8 Widgets

> **Branch:** `feat/admin-loyalty-dashboard`
> **Depends on:** Tasks 08, 09, 11 merged
> **Estimated:** 3h
> **Priority:** P1 (POST-LAUNCH — làm sau 6/6)

---

## 🎯 Goals

1. Tạo `admin/loyalty-dashboard.html` — real-time monitor cho owner/manager
2. 8 widgets:
   - Members total + by tier
   - Cashback issued today / week / month
   - Cashback redeemed today / week / month
   - Redemption rate (%)
   - Top 10 spenders
   - Members expiring soon (<7d)
   - New sign-ups by channel (at-store / QR / Zalo)
   - Referral pairs converted
3. Export CSV button cho mỗi widget
4. Real-time refresh (5s polling hoặc SSE)
5. Brand v6 styling (mineral + cobalt)

---

## 📋 Implementation

### Step 1: Setup
```bash
git checkout -b feat/admin-loyalty-dashboard
```

### Step 2: Create aggregate endpoints `worker/src/routes/admin-loyalty.js`

```js
import { Hono } from 'hono';
import { verifyJWT } from '../utils/jwt.js';

const app = new Hono();

// Middleware: verify admin JWT
app.use('*', async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ ok: false }, 401);
  const payload = await verifyJWT(auth.slice(7), c.env.JWT_SECRET);
  if (!payload || payload.role !== 'admin') return c.json({ ok: false }, 403);
  c.set('user', payload);
  await next();
});

// ────────────────────────────────────────────
// Widget 1: Members total + by tier
// ────────────────────────────────────────────
app.get('/widget/members-by-tier', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT loyalty_tier, COUNT(*) as count
    FROM customers
    WHERE loyalty_tier IS NOT NULL
    GROUP BY loyalty_tier
  `).all();

  const total = result.results.reduce((sum, r) => sum + r.count, 0);

  return c.json({
    ok: true,
    total,
    by_tier: result.results,
    last_updated: new Date().toISOString()
  });
});

// ────────────────────────────────────────────
// Widget 2 & 3: Cashback issued / redeemed (today/week/month)
// ────────────────────────────────────────────
app.get('/widget/cashback-flow', async (c) => {
  const periods = ['today', 'week', 'month'];
  const result = {};

  for (const period of periods) {
    let dateFilter;
    if (period === 'today') dateFilter = "date(created_at) = date('now')";
    else if (period === 'week') dateFilter = "created_at >= datetime('now', '-7 days')";
    else dateFilter = "created_at >= datetime('now', '-30 days')";

    const issued = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(amount_vnd), 0) as total, COUNT(*) as count
      FROM cashback_transactions
      WHERE type IN ('earn', 'bonus') AND ${dateFilter}
    `).first();

    const redeemed = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(amount_vnd), 0) as total, COUNT(*) as count
      FROM cashback_transactions
      WHERE type = 'redeem' AND ${dateFilter}
    `).first();

    result[period] = {
      issued: { total: issued.total, count: issued.count },
      redeemed: { total: redeemed.total, count: redeemed.count },
      redemption_rate: issued.total > 0 ? +(redeemed.total / issued.total * 100).toFixed(1) : 0
    };
  }

  return c.json({ ok: true, ...result, last_updated: new Date().toISOString() });
});

// ────────────────────────────────────────────
// Widget 4: Top 10 spenders
// ────────────────────────────────────────────
app.get('/widget/top-spenders', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT id, name, phone, loyalty_tier,
           COALESCE(total_spent_vnd, 0) as total_spent,
           COALESCE(cashback_balance_vnd, 0) as balance
    FROM customers
    WHERE total_spent_vnd > 0
    ORDER BY total_spent_vnd DESC
    LIMIT 10
  `).all();

  return c.json({ ok: true, top: result.results, last_updated: new Date().toISOString() });
});

// ────────────────────────────────────────────
// Widget 5: Members expiring soon (<7d)
// ────────────────────────────────────────────
app.get('/widget/expiring-soon', async (c) => {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();

  const result = await c.env.DB.prepare(`
    SELECT c.id, c.name, c.phone, c.loyalty_tier,
           SUM(ct.amount_vnd) as expiring_amount,
           MIN(ct.expires_at) as earliest_expiry
    FROM customers c
    JOIN cashback_transactions ct ON ct.customer_id = c.id
    WHERE ct.type = 'earn'
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= ?
      AND ct.expires_at > datetime('now')
    GROUP BY c.id
    HAVING expiring_amount > 1000
    ORDER BY earliest_expiry ASC
    LIMIT 20
  `).bind(sevenDaysFromNow).all();

  return c.json({ ok: true, expiring: result.results });
});

// ────────────────────────────────────────────
// Widget 6: New sign-ups by channel + by day
// ────────────────────────────────────────────
app.get('/widget/signups-trend', async (c) => {
  const byChannel = await c.env.DB.prepare(`
    SELECT COALESCE(source, 'unknown') as channel, COUNT(*) as count
    FROM customers
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY source
  `).all();

  const byDay = await c.env.DB.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM customers
    WHERE created_at >= datetime('now', '-14 days')
    GROUP BY day
    ORDER BY day
  `).all();

  return c.json({ ok: true, by_channel: byChannel.results, by_day: byDay.results });
});

// ────────────────────────────────────────────
// Widget 7: Referral pairs converted
// ────────────────────────────────────────────
app.get('/widget/referrals', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_pairs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      AVG(CASE WHEN status = 'completed' THEN
        julianday(completed_at) - julianday(created_at) ELSE NULL END) as avg_days_to_convert
    FROM referrals
    WHERE created_at >= datetime('now', '-30 days')
  `).first();

  const topReferrers = await c.env.DB.prepare(`
    SELECT c.name, c.phone, COUNT(r.id) as refer_count
    FROM referrals r
    JOIN customers c ON c.id = r.referrer_id
    WHERE r.status = 'completed'
    GROUP BY c.id
    ORDER BY refer_count DESC
    LIMIT 5
  `).all();

  return c.json({ ok: true, stats: result, top_referrers: topReferrers.results });
});

// ────────────────────────────────────────────
// Widget 8: Active campaign progress
// ────────────────────────────────────────────
app.get('/widget/active-campaign', async (c) => {
  const campaign = await c.env.DB.prepare(`
    SELECT * FROM bonus_campaigns
    WHERE active = 1 AND start_date <= datetime('now') AND end_date >= datetime('now')
    ORDER BY id DESC LIMIT 1
  `).first();

  if (!campaign) return c.json({ ok: true, campaign: null });

  // Signup bonus progress
  const signupCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?
  `).bind(campaign.id).first();

  // Total cashback boosted
  const boosted = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as count,
      SUM(amount_vnd) as total
    FROM cashback_transactions
    WHERE campaign_id = ? AND type = 'earn'
  `).bind(campaign.id).first();

  // Refer pairs
  const referPairs = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM referrals
    WHERE created_at >= ? AND status = 'completed'
  `).bind(campaign.start_date).first();

  return c.json({
    ok: true,
    campaign,
    progress: {
      signup_granted: signupCount.count,
      signup_cap: campaign.signup_bonus_cap,
      cashback_boosted_count: boosted.count,
      cashback_boosted_total: boosted.total,
      refer_pairs_in_campaign: referPairs.count
    }
  });
});

// ────────────────────────────────────────────
// Export CSV
// ────────────────────────────────────────────
app.get('/export/:type', async (c) => {
  const type = c.req.param('type');
  let csv = '';

  if (type === 'members') {
    const result = await c.env.DB.prepare(`
      SELECT id, name, phone, loyalty_tier,
             total_spent_vnd, cashback_balance_vnd, created_at
      FROM customers ORDER BY id
    `).all();

    csv = 'ID,Name,Phone,Tier,TotalSpent,Balance,CreatedAt\n';
    csv += result.results.map(r =>
      `${r.id},"${r.name||''}",${r.phone},${r.loyalty_tier},${r.total_spent_vnd||0},${r.cashback_balance_vnd||0},${r.created_at}`
    ).join('\n');
  } else if (type === 'transactions') {
    const result = await c.env.DB.prepare(`
      SELECT ct.id, ct.customer_id, c.phone, c.name,
             ct.type, ct.amount_vnd, ct.balance_after, ct.order_id, ct.created_at
      FROM cashback_transactions ct
      JOIN customers c ON c.id = ct.customer_id
      WHERE ct.created_at >= datetime('now', '-30 days')
      ORDER BY ct.id DESC
    `).all();

    csv = 'ID,CustomerID,Phone,Name,Type,Amount,Balance,OrderID,CreatedAt\n';
    csv += result.results.map(r =>
      `${r.id},${r.customer_id},${r.phone},"${r.name||''}",${r.type},${r.amount_vnd},${r.balance_after},${r.order_id||''},${r.created_at}`
    ).join('\n');
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="loyalty-${type}-${Date.now()}.csv"`
    }
  });
});

export default app;
```

### Step 3: Create `admin/loyalty-dashboard.html`

(Full HTML page với 8 widgets, brand v6 styling, real-time refresh — em sẽ viết template chi tiết khi dispatch task. Approximately 400 lines.)

Key features:
- Grid layout responsive 4-col desktop / 2-col tablet / 1-col mobile
- Each widget: title + main stat + breakdown chart (Chart.js)
- Refresh button + auto-refresh 30s
- Export CSV buttons
- Real-time campaign progress bar
- Brand mineral + cobalt styling

### Step 4: Mount route trong `worker/src/index.js`
```js
import adminLoyaltyRoutes from './routes/admin-loyalty.js';
app.route('/api/admin/loyalty', adminLoyaltyRoutes);
```

### Step 5: Update `admin/dashboard.html` link
```html
<!-- Trong nav menu admin -->
<a href="/admin/loyalty-dashboard.html">📊 Loyalty Analytics</a>
```

### Step 6: Test + Commit + PR

```bash
# Local test
curl http://localhost:8787/api/admin/loyalty/widget/members-by-tier \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Open admin/loyalty-dashboard.html → verify 8 widgets load
```

```bash
git add admin/loyalty-dashboard.html admin/dashboard.html \
        worker/src/routes/admin-loyalty.js worker/src/index.js

git commit -m "feat(admin): loyalty dashboard 8 widgets + CSV export

Widgets:
1. Members total + breakdown by tier (Bronze/Silver/Gold/Platinum)
2. Cashback issued today/week/month
3. Cashback redeemed today/week/month + redemption rate %
4. Top 10 spenders
5. Members with cashback expiring soon (<7 days)
6. New sign-ups by channel (at-store/QR/Zalo) + 14-day trend
7. Referral pairs converted + top 5 referrers
8. Active campaign progress (signup slots, boosted txns)

Features:
- Brand v6 mineral + cobalt styling
- Real-time refresh 30s
- Chart.js visualizations
- CSV export (members + transactions)
- Admin JWT auth
- Mobile responsive

Post-launch nice-to-have, không blocking 6/6."

git push -u origin feat/admin-loyalty-dashboard
gh pr create
```

---

## ✅ Acceptance criteria

- [ ] 8 endpoint admin-loyalty.js return correct data
- [ ] admin/loyalty-dashboard.html load 8 widgets
- [ ] Chart.js render đẹp
- [ ] CSV export works
- [ ] Auto-refresh 30s
- [ ] Admin JWT auth enforced
- [ ] Mobile responsive
- [ ] PR merged

---

## 🎯 Priority note

Task này **POST-LAUNCH** — không cần xong trước 6/6. Owner check data tạm qua:
- Direct D1 query (`wrangler d1 execute`)
- Telegram bot stats (existing)

Sau 6/6 dispatch task này khi anh có thời gian (ngày 8/6 hoặc 1/6).
