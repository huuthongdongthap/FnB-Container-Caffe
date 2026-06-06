/**
 * Check-in Routes — "Khách check-in tại quán + post FB/Zalo"
 *
 * 2 phases trong tháng 6/2026:
 * - CHECKIN_WEEK_6_6 (6-13/6): khách nhận +20k cashback vào ví
 * - CHECKIN_DISCOUNT_THANG_6 (14-30/6): khách nhận -10% off direct trên đơn hiện tại
 *
 * Rules:
 * - 1 LẦN/KHÁCH duy nhất trong toàn tháng 6 (UNIQUE INDEX enforce DB layer)
 * - Trust-based: khách screenshot post → staff approve tại quầy
 * - Yêu cầu staff JWT để approve (chống khách self-grant)
 *
 * Mounted at /api/loyalty/checkin (via index.js)
 */

import { Hono } from 'hono';

export const checkinRouter = new Hono();

function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// M2: URL validation helper — blocks XSS/SSRF (javascript:, data:, vbscript:)
function validatePostUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 500) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (!/^https?:\/\//i.test(lower)) {
    return null;
  } // must start with http(s)
  if (/^javascript:/i.test(lower) || /^data:/i.test(lower) || /^vbscript:/i.test(lower)) {
    return null;
  }
  return trimmed;
}

// Staff auth — only owner/staff can approve check-in
async function requireStaff(c, next) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized — staff JWT required' }, 401);
  }
  const { verifyJWT } = await import('./auth.js');
  const payload = await verifyJWT(auth.substring(7), c.env.JWT_SECRET);
  if (!payload || !['owner', 'staff'].includes(payload.role)) {
    return c.json({ success: false, error: 'Chỉ staff/owner mới approve được check-in' }, 403);
  }
  c.set('staff', payload);
  await next();
}

// ─────────────────────────────────────────────────────────────────
// GET /api/loyalty/checkin/eligibility/:customer_id
// Public — check khách đã check-in tháng này chưa
// ─────────────────────────────────────────────────────────────────
checkinRouter.get('/eligibility/:customer_id', async (c) => {
  const customerId = c.req.param('customer_id');
  const db = c.env.AURA_DB;

  const today = new Date();
  const yyyy_mm = today.toISOString().slice(0, 7); // '2026-06'

  // Check trong cả 2 phase
  const existing = await db.prepare(
    `SELECT id, campaign_code, reward_type, reward_value, checkin_at
     FROM checkin_log
     WHERE customer_id = ?
     AND substr(checkin_at, 1, 7) = ?
     LIMIT 1`
  ).bind(customerId, yyyy_mm).first();

  if (existing) {
    return c.json({
      success: true,
      eligible: false,
      reason: 'already_checked_in_this_month',
      existing: {
        campaign_code: existing.campaign_code,
        reward_type: existing.reward_type,
        reward_value: existing.reward_value,
        checkin_at: existing.checkin_at,
      },
      message: 'Bạn đã check-in tháng này rồi 😊',
    });
  }

  // M1: Dynamic campaign lookup (replaces hardcoded codes CHECKIN_WEEK_6_6, CHECKIN_DISCOUNT_THANG_6)
  const todayStr = today.toISOString();
  const activeCampaign = await db.prepare(
    `SELECT code, name, start_date, end_date, max_cap_per_customer_vnd
     FROM bonus_campaigns
     WHERE type = 'checkin' AND active = 1 AND end_date >= ?
     ORDER BY start_date ASC
     LIMIT 1`
  ).bind(todayStr).first();

  if (!activeCampaign) {
    return c.json({
      success: true,
      eligible: false,
      reason: 'no_active_campaign',
      message: 'Hiện không có chương trình check-in nào hoạt động.',
    });
  }

  const rewardType = activeCampaign.code === 'CHECKIN_WEEK_6_6' ? 'POINTS_20K' : 'DISCOUNT_10PCT';
  const rewardValue = activeCampaign.code === 'CHECKIN_WEEK_6_6' ? 20000 : 10;

  return c.json({
    success: true,
    eligible: true,
    campaign: {
      code: activeCampaign.code,
      name: activeCampaign.name,
      reward_type: rewardType,
      reward_value: rewardValue,
    },
    message: rewardType === 'POINTS_20K'
      ? 'Đủ điều kiện check-in nhận 20k vào ví!'
      : 'Đủ điều kiện check-in giảm 10% đơn hiện tại!',
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/loyalty/checkin
// Staff approve check-in — grant reward
// Body: { customer_id, post_platform: 'FB'|'ZALO'|'IG'|'OTHER', post_url?, notes?, order_id? }
// Returns: { reward_type, reward_value, message }
// ─────────────────────────────────────────────────────────────────
checkinRouter.post('/', requireStaff, async (c) => {
  const staff = c.get('staff');
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const { customer_id, post_platform = 'OTHER', post_url, notes, order_id } = body;

  // M2: Validate post_url (XSS/SSRF protection)
  const urlValidation = validatePostUrl(post_url);
  if (post_url && urlValidation && !urlValidation.valid) {
    return c.json({ success: false, error: `post_url không hợp lệ: ${urlValidation.reason}` }, 400);
  }
  const safePostUrl = urlValidation ? urlValidation.url : null;

  if (!customer_id) {
    return c.json({ success: false, error: 'Thiếu customer_id' }, 400);
  }

  // 1. Verify customer exists
  const customer = await db.prepare(
    'SELECT id, name, phone, loyalty_tier FROM customers WHERE id = ?'
  ).bind(customer_id).first();

  if (!customer) {
    return c.json({ success: false, error: 'Customer không tồn tại' }, 404);
  }

  // 2. Check eligibility — duplicate db calls inline (tránh await endpoint)
  const today = new Date();
  const todayStr = today.toISOString();
  const yyyy_mm = todayStr.slice(0, 7);

  const existing = await db.prepare(
    `SELECT id, campaign_code, checkin_at FROM checkin_log
     WHERE customer_id = ?
     AND substr(checkin_at, 1, 7) = ?
     LIMIT 1`
  ).bind(customer_id, yyyy_mm).first();

  if (existing) {
    return c.json({
      success: false,
      error: 'already_checked_in_this_month',
      message: `Khách đã check-in tháng này (${existing.checkin_at}, campaign: ${existing.campaign_code})`,
    }, 409);
  }

  // M1: Dynamic campaign lookup (replaces hardcoded codes)
  const activeCampaign = await db.prepare(
    `SELECT code, name, start_date, end_date
     FROM bonus_campaigns
     WHERE type = 'checkin' AND active = 1 AND end_date >= ?
     ORDER BY start_date ASC
     LIMIT 1`
  ).bind(todayStr).first();

  if (!activeCampaign) {
    return c.json({
      success: false,
      error: 'no_active_campaign',
      message: 'Không có campaign check-in nào active hôm nay',
    }, 400);
  }

  const rewardType = activeCampaign.code === 'CHECKIN_WEEK_6_6' ? 'POINTS_20K' : 'DISCOUNT_10PCT';
  const rewardValue = activeCampaign.code === 'CHECKIN_WEEK_6_6' ? 20000 : 10;

  // 4. Insert checkin_log + grant reward (atomic batch)
  const checkinId = genId('chk_');
  const txId = genId('cbt_');
  const now = new Date().toISOString();

  const batch = [
    db.prepare(
      `INSERT INTO checkin_log
      (customer_id, campaign_code, reward_type, reward_value, post_platform, post_url, staff_id, order_id, notes, checkin_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      customer_id, activeCampaign.code, rewardType, rewardValue,
      post_platform, safePostUrl, staff.email, order_id || null, notes || null, now
    )
  ];

  // Phase 1: cộng 20k cashback vào ví
  if (rewardType === 'POINTS_20K') {
    // Lookup wallet
    let wallet = await db.prepare(
      'SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?'
    ).bind(customer_id).first();

    if (!wallet) {
      // Create wallet if missing
      const walletId = genId('cbw_');
      batch.push(
        db.prepare(
          'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 20000, 20000, 0, ?)'
        ).bind(walletId, customer_id, now)
      );
      wallet = { id: walletId, balance: 0, total_earned: 0 };
    } else {
      batch.push(
        db.prepare(
          'UPDATE cashback_wallets SET balance = balance + 20000, total_earned = total_earned + 20000, updated_at = ? WHERE id = ?'
        ).bind(now, wallet.id)
      );
    }

    const newBalance = (wallet.balance || 0) + 20000;
    // Tier-based expiry: Bronze=90, Silver=120, Gold=150, Platinum=180
    const tierExpiryDays = { bronze: 90, silver: 120, gold: 150, platinum: 180 };
    const expiryDays = tierExpiryDays[(customer.loyalty_tier || 'bronze').toLowerCase()] || 90;
    const expiresAtSql = `datetime('now', '+' || ${expiryDays} || ' days')`;

    // Cashback transaction (type='bonus' for check-in)
    batch.push(
      db.prepare(
        `INSERT INTO cashback_transactions
        (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, staff_id, created_at)
        VALUES (?, ?, ?, 'bonus', 20000, ?, ?, ${expiresAtSql}, ?, ?)`
      ).bind(txId, wallet.id, customer_id, newBalance,
        `Check-in: +20k (campaign ${activeCampaign.code})`,
        staff.email, now)
    );

    // Audit log
    batch.push(
      db.prepare(
        `INSERT INTO loyalty_audit_log (customer_id, staff_id, action, amount_vnd, metadata, created_at)
         VALUES (?, ?, 'checkin_bonus', 20000, ?, ?)`
      ).bind(customer_id, staff.email,
        JSON.stringify({ campaign: activeCampaign.code, post_platform, post_url: safePostUrl, checkin_id: checkinId }),
        now)
    );
  }
  // FIX H16: Phase 2 DISCOUNT_10PCT — persist discount to orders table
  else {
    let targetOrderId = order_id;

    // If no order_id provided, try to find the customer's most recent unpaid/confirmed order
    if (!targetOrderId) {
      const recentOrder = await db.prepare(
        `SELECT id FROM orders WHERE customer_phone = ? AND status IN ('pending', 'confirmed', 'Bep tiep nhan')
         ORDER BY created_at DESC LIMIT 1`
      ).bind(customer.phone).first();
      if (recentOrder) {
        targetOrderId = recentOrder.id;
      }
    }

    // Validate order_id belongs to this customer before applying discount
    if (targetOrderId) {
      const orderOwner = await db.prepare(
        'SELECT id, customer_phone FROM orders WHERE id = ?'
      ).bind(targetOrderId).first();
      if (!orderOwner || orderOwner.customer_phone !== customer.phone) {
        return c.json({ success: false, error: 'Đơn hàng không thuộc khách này' }, 403);
      }
      // Persist discount to orders table (H16 fix)
      batch.push(
        db.prepare(
          'UPDATE orders SET discount_applied = ?, updated_at = ? WHERE id = ?'
        ).bind(10, now, targetOrderId)
      );
    }

    // Audit log
    batch.push(
      db.prepare(
        `INSERT INTO loyalty_audit_log (customer_id, staff_id, action, metadata, created_at)
         VALUES (?, ?, 'checkin_discount', ?, ?)`
      ).bind(customer_id, staff.email,
        JSON.stringify({
          campaign: activeCampaign.code,
          discount_pct: 10,
          post_platform,
          post_url: safePostUrl,
          order_id: targetOrderId,
          checkin_id: checkinId
        }),
        now)
    );
  }

  // 5. Execute batch
  try {
    await db.batch(batch);
  } catch (err) {
    // UNIQUE INDEX violation = race condition (2 staff approve cùng lúc)
    if (err.message?.includes('UNIQUE') || err.message?.includes('constraint')) {
      return c.json({
        success: false,
        error: 'already_checked_in_this_month',
        message: 'Khách đã check-in tháng này (race condition).',
      }, 409);
    }
    throw err;
  }

  return c.json({
    success: true,
    data: {
      checkin_id: checkinId,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      campaign_code: activeCampaign.code,
      reward_type: rewardType,
      reward_value: rewardValue,
      message: rewardType === 'POINTS_20K'
        ? `✅ Đã cộng 20.000đ vào ví của ${customer.name}`
        : `✅ Áp dụng giảm 10% đơn hiện tại cho ${customer.name}`,
    },
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/loyalty/checkin/today
// Admin/staff — list check-in hôm nay
// ─────────────────────────────────────────────────────────────────
checkinRouter.get('/today', requireStaff, async (c) => {
  const db = c.env.AURA_DB;
  const today = new Date().toISOString().slice(0, 10);

  const { results } = await db.prepare(
    `SELECT cl.id, cl.customer_id, cl.campaign_code, cl.reward_type, cl.reward_value,
     cl.post_platform, cl.post_url, cl.staff_id, cl.notes, cl.checkin_at,
     c.name AS customer_name, c.phone AS customer_phone
     FROM checkin_log cl
     LEFT JOIN customers c ON c.id = cl.customer_id
     WHERE substr(cl.checkin_at, 1, 10) = ?
     ORDER BY cl.checkin_at DESC`
  ).bind(today).all();

  // Summary
  const summary = {
    total: results.length,
    points_20k_count: results.filter(r => r.reward_type === 'POINTS_20K').length,
    discount_10pct_count: results.filter(r => r.reward_type === 'DISCOUNT_10PCT').length,
    total_cashback_granted: results
      .filter(r => r.reward_type === 'POINTS_20K')
      .reduce((sum, r) => sum + (r.reward_value || 0), 0),
  };

  return c.json({ success: true, data: results, summary });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/loyalty/checkin/stats
// Admin — stats tháng hiện tại
// ─────────────────────────────────────────────────────────────────
checkinRouter.get('/stats', requireStaff, async (c) => {
  const db = c.env.AURA_DB;
  const yyyy_mm = new Date().toISOString().slice(0, 7);

  const { results } = await db.prepare(
    `SELECT campaign_code, reward_type, COUNT(*) AS count, SUM(reward_value) AS total_value
     FROM checkin_log
     WHERE substr(checkin_at, 1, 7) = ?
     GROUP BY campaign_code, reward_type`
  ).bind(yyyy_mm).all();

  return c.json({ success: true, month: yyyy_mm, data: results });
});
