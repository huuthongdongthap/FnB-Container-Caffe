/**
 * Referral Routes — "Giới thiệu bạn bè"
 * Referrer nhận 100 điểm. Referee nhận mã FIRSTORDER (giảm 20%), KHÔNG nhận điểm.
 * Mounted under /api/loyalty/referral (via loyalty router or directly)
 */

import { Hono } from 'hono';

export const referralRouter = new Hono();

function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function genReferralCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,0,O,1 confusion
  let code = 'FNB-';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Auth middleware — must be logged in for all referral endpoints
async function requireCustomer(c, next) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const { verifyJWT } = await import('./auth.js');
  const payload = await verifyJWT(auth.substring(7), c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  const customer = await c.env.AURA_DB.prepare(
    'SELECT id, email, name, phone, loyalty_points, loyalty_tier FROM customers WHERE email = ?'
  ).bind(payload.email).first();
  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }
  c.set('customer', customer);
  await next();
}

referralRouter.use('/*', requireCustomer);

// ─────────────────────────────────────────────────────
// GET /api/loyalty/referral/code
// Get or create referral code for current customer
// ─────────────────────────────────────────────────────
referralRouter.get('/code', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;

  let rc = await db.prepare(
    'SELECT * FROM referral_codes WHERE customer_id = ?'
  ).bind(cust.id).first();

  if (!rc) {
    // Generate unique code (retry on collision)
    let code, attempts = 0;
    do {
      code = genReferralCode();
      const exists = await db.prepare(
        'SELECT id FROM referral_codes WHERE code = ?'
      ).bind(code).first();
      if (!exists) { break; }
      attempts++;
    } while (attempts < 5);

    const id = genId('refc_');
    const now = new Date().toISOString();
    await db.prepare(
      'INSERT INTO referral_codes (id, customer_id, code, times_used, total_points_earned, created_at) VALUES (?, ?, ?, 0, 0, ?)'
    ).bind(id, cust.id, code, now).run();

    rc = { id, customer_id: cust.id, code, times_used: 0, total_points_earned: 0, created_at: now };
  }

  return c.json({
    success: true,
    data: {
      code: rc.code,
      times_used: rc.times_used,
      total_points_earned: rc.total_points_earned,
      created_at: rc.created_at,
    },
  });
});

// ─────────────────────────────────────────────────────
// POST /api/loyalty/referral/apply
// Apply a referral code — records as pending (points awarded after first purchase)
// Body: { code: "FNB-XXXXXX" }
// ─────────────────────────────────────────────────────
referralRouter.post('/apply', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;
  const { code } = await c.req.json();

  if (!code || typeof code !== 'string') {
    return c.json({ success: false, error: 'Thiếu mã giới thiệu' }, 400);
  }

  const normalized = code.trim().toUpperCase();

  const rc = await db.prepare(
    'SELECT * FROM referral_codes WHERE code = ?'
  ).bind(normalized).first();

  if (!rc) {
    return c.json({ success: false, error: 'Mã giới thiệu không tồn tại' }, 404);
  }

  if (rc.customer_id === cust.id) {
    return c.json({ success: false, error: 'Không thể tự giới thiệu chính mình' }, 400);
  }

  const existing = await db.prepare(
    'SELECT id FROM referrals WHERE referred_customer_id = ?'
  ).bind(cust.id).first();

  if (existing) {
    return c.json({ success: false, error: 'Bạn đã sử dụng mã giới thiệu trước đó' }, 409);
  }

  const referrer = await db.prepare(
    'SELECT id FROM customers WHERE id = ?'
  ).bind(rc.customer_id).first();

  if (!referrer) {
    return c.json({ success: false, error: 'Người giới thiệu không tồn tại' }, 404);
  }

  const REFERRER_POINTS = 100; // Referrer nhận 100 điểm (≈ 1 Espresso)
  const REFEREE_POINTS = 0; // Referee KHÔNG nhận điểm, chỉ nhận mã FIRSTORDER
  const now = new Date().toISOString();

  // Record referral as PENDING — referrer points awarded after referee's first purchase
  const refId = genId('ref_');
  await db.prepare(
    'INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(refId, referrer.id, cust.id, normalized, REFERRER_POINTS, 'pending', now).run();

  // Update referral code usage counter (but NOT points yet)
  await db.prepare(
    'UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?'
  ).bind(rc.id).run();

  return c.json({
    success: true,
    data: {
      referrer_points_pending: REFERRER_POINTS,
      referee_bonus: 'FIRSTORDER code (giảm 20% đơn đầu tiên)',
      message: `Mã giới thiệu đã được ghi nhận! Bạn bè nhận mã FIRSTORDER giảm 20%. Bạn nhận ${REFERRER_POINTS} điểm sau khi họ mua hàng lần đầu.`,
    },
  });
});

// ─────────────────────────────────────────────────────
// GET /api/loyalty/referral/stats
// Get referral stats for current customer
// ─────────────────────────────────────────────────────
referralRouter.get('/stats', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;

  // Get referral code
  const rc = await db.prepare(
    'SELECT * FROM referral_codes WHERE customer_id = ?'
  ).bind(cust.id).first();

  // Count total referrals
  const { results: refCount } = await db.prepare(
    'SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?'
  ).bind(cust.id).all();

  // Get recent referrals (last 20)
  const { results: recentRefs } = await db.prepare(
    `SELECT r.*, c.name as referred_name, c.phone as referred_phone
     FROM referrals r
     LEFT JOIN customers c ON r.referred_customer_id = c.id
     WHERE r.referrer_id = ?
     ORDER BY r.created_at DESC
     LIMIT 20`
  ).bind(cust.id).all();

  // Points earned from referrals — use tracked total from referral_codes
  const totalPoints = rc?.total_points_earned || 0;

  return c.json({
    success: true,
    data: {
      referral_code: rc?.code || null,
      total_referrals: refCount[0]?.cnt || 0,
      total_points_earned: totalPoints,
      code_usage: rc?.times_used || 0,
      recent_referrals: recentRefs || [],
    },
  });
});

/**
 * Apply referral code for a newly registered customer.
 * Records as PENDING — points awarded only after first purchase.
 * Called externally (e.g. from auth/phone-auth) after customer creation.
 * Returns { success } — does NOT throw.
 */
export async function applyReferralForNewCustomer(db, newCustomerId, referralCode) {
  if (!referralCode) { return { success: false, reason: 'no_code' }; }

  const normalized = referralCode.trim().toUpperCase();

  const rc = await db.prepare(
    'SELECT * FROM referral_codes WHERE code = ?'
  ).bind(normalized).first();

  if (!rc) { return { success: false, reason: 'invalid_code' }; }
  if (rc.customer_id === newCustomerId) { return { success: false, reason: 'self_referral' }; }

  const existing = await db.prepare(
    'SELECT id FROM referrals WHERE referred_customer_id = ?'
  ).bind(newCustomerId).first();

  if (existing) { return { success: false, reason: 'already_referred' }; }

  const referrer = await db.prepare(
    'SELECT id FROM customers WHERE id = ?'
  ).bind(rc.customer_id).first();

  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const REFERRER_POINTS = 100; // Referrer nhận 100 điểm
  const REFEREE_POINTS = 0; // Referee KHÔNG nhận điểm
  const now = new Date().toISOString();

  // Record as PENDING — referrer points awarded on first purchase
  const refId = genId('ref_');
  await db.prepare(
    'INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(refId, referrer.id, newCustomerId, normalized, REFERRER_POINTS, 'pending', now).run();

  await db.prepare(
    'UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?'
  ).bind(rc.id).run();

  return { success: true, referrer_points_pending: REFERRER_POINTS, referee_bonus: 'FIRSTORDER code only, no points' };
}

/**
 * Process pending referrals when a customer completes their first order.
 * Called from processOrderLoyalty after order → delivered/completed.
 * Awards 100 points to the referrer if a pending referral exists.
 * Referee does NOT get points — they already received FIRSTORDER code.
 * Idempotent — only processes once per referral.
 */
export async function processReferralOnFirstOrder(db, customerId) {
  // Find pending referral for this customer
  const pending = await db.prepare(
    'SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?'
  ).bind(customerId, 'pending').first();

  if (!pending) { return { success: false, reason: 'no_pending_referral' }; }

  const referrer = await db.prepare(
    'SELECT id, loyalty_points, loyalty_tier FROM customers WHERE id = ?'
  ).bind(pending.referrer_id).first();

  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const POINTS = pending.points_awarded || 100; // Default 100 (was 200, recalibrated 2026-05-07)
  const now = new Date().toISOString();
  const newPoints = (referrer.loyalty_points || 0) + POINTS;

  // 1. Award points
  await db.prepare(
    'UPDATE customers SET loyalty_points = ?, updated_at = ? WHERE id = ?'
  ).bind(newPoints, now, referrer.id).run();

  // 2. Log points
  await db.prepare(
    'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    genId('ptl_'),
    referrer.id,
    POINTS,
    'referral',
    newPoints,
    `Giới thiệu bạn: +${POINTS} điểm`,
    now
  ).run();

  // 3. Update referral to completed
  await db.prepare(
    'UPDATE referrals SET status = ? WHERE id = ?'
  ).bind('completed', pending.id).run();

  // 4. Update referral code total_points_earned
  await db.prepare(
    'UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ?'
  ).bind(POINTS, pending.referral_code).run();

  // 5. Tier upgrade check
  const nextTier = await db.prepare(
    'SELECT tier_name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1'
  ).bind(newPoints).first();

  if (nextTier && nextTier.tier_name !== referrer.loyalty_tier) {
    await db.prepare(
      'UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?'
    ).bind(nextTier.tier_name, now, referrer.id).run();
  }

  return { success: true, points_awarded: POINTS, new_balance: newPoints };
}
