/**
 * Referral Routes — "Giới thiệu bạn bè"
 *
 * v1 (legacy, GIỮ NGUYÊN cho backward compat):
 *   Referrer nhận 100 điểm. Referee nhận mã FIRSTORDER (giảm 20%), KHÔNG nhận điểm.
 *
 * v3 (NEW, từ 30/05/2026 — Anh Còn quyết):
 *   Referrer nhận 10.000đ CASHBACK vào ví khi friend mới có đơn đầu ≥ 20.000đ.
 *   Referee KHÔNG nhận gì.
 *   Both KHÔNG cộng điểm tier.
 *
 * Mounted under /api/loyalty/referral (via index.js)
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
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE email = ?'
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
// Apply a referral code — records as pending (reward awarded after first purchase)
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

  const REFERRER_CASHBACK_VND = 10000; // v3: 10k cashback (anh Còn quyết 30/5)
  const MIN_ORDER_REQUIRED = 20000; // friend phải có đơn ≥ 20k
  const now = new Date().toISOString();

  // Record referral as PENDING — referrer cashback awarded after referee's first purchase ≥ 20k
  const refId = genId('ref_');
  await db.prepare(
    `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(refId, referrer.id, cust.id, normalized, REFERRER_CASHBACK_VND, 'pending', now).run();

  // Update referral code usage counter
  await db.prepare(
    'UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?'
  ).bind(rc.id).run();

  return c.json({
    success: true,
    data: {
      referrer_cashback_pending: REFERRER_CASHBACK_VND,
      min_order_required: MIN_ORDER_REQUIRED,
      message: 'Đã ghi nhận! Người giới thiệu sẽ nhận 10.000đ vào ví khi bạn có đơn đầu ≥ 20.000đ.',
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

  // Cashback total earned (v3) + legacy points
  const { results: cashbackEarned } = await db.prepare(
    'SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ?'
  ).bind(cust.id, 'completed').all();

  return c.json({
    success: true,
    data: {
      referral_code: rc?.code || null,
      total_referrals: refCount[0]?.cnt || 0,
      total_cashback_earned_vnd: cashbackEarned[0]?.total || 0,
      total_points_earned_legacy: rc?.total_points_earned || 0,
      code_usage: rc?.times_used || 0,
      recent_referrals: recentRefs || [],
    },
  });
});

/**
 * Apply referral code for a newly registered customer.
 * Records as PENDING — reward awarded only after first purchase ≥ 20k.
 * Called externally (e.g. from auth/phone-auth) after customer creation.
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

  const REFERRER_CASHBACK_VND = 10000; // v3: 10k cashback (anh Còn quyết 30/5)
  const now = new Date().toISOString();

  const refId = genId('ref_');
  await db.prepare(
    `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(refId, referrer.id, newCustomerId, normalized, REFERRER_CASHBACK_VND, 'pending', now).run();

  await db.prepare(
    'UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?'
  ).bind(rc.id).run();

  return { success: true, referrer_cashback_pending: REFERRER_CASHBACK_VND };
}

/**
 * LEGACY (v1, GIỮ cho backward compat) — không gọi từ code mới nữa.
 * Process pending referrals when a customer completes their first order — grants 100 POINTS.
 */
export async function processReferralOnFirstOrder(db, customerId) {
  const pending = await db.prepare(
    'SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?'
  ).bind(customerId, 'pending').first();

  if (!pending) { return { success: false, reason: 'no_pending_referral' }; }

  const referrer = await db.prepare(
    'SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?'
  ).bind(pending.referrer_id).first();

  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const POINTS = pending.points_awarded || 100;
  const now = new Date().toISOString();
  const newPoints = (referrer.loyalty_points || 0) + POINTS;
  const newLifetimePoints = (referrer.lifetime_points || 0) + POINTS;

  await db.prepare(
    'UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?'
  ).bind(newPoints, newLifetimePoints, now, referrer.id).run();

  await db.prepare(
    'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    genId('ptl_'),
    referrer.id,
    POINTS,
    'referral',
    newPoints,
    `Giới thiệu bạn: +${POINTS} điểm (legacy)`,
    now
  ).run();

  await db.prepare(
    'UPDATE referrals SET status = ? WHERE id = ?'
  ).bind('completed', pending.id).run();

  await db.prepare(
    'UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ?'
  ).bind(POINTS, pending.referral_code).run();

  return { success: true, points_awarded: POINTS, new_balance: newPoints, new_lifetime_balance: newLifetimePoints };
}

/**
 * v3 — Process pending referrals when a customer completes their first order ≥ 20k.
 * Grants 10.000đ CASHBACK to the referrer's wallet (NOT points).
 * Referee does NOT get points/cashback.
 * Idempotent — only processes once per referral.
 *
 * @param {D1Database} db
 * @param {string} customerId — the referee (người được giới thiệu)
 * @param {string} orderId — first order ID (for tracking)
 * @param {number} orderAmount — total VND of first order (validation ≥ 20k)
 * @returns {Promise<{success, ...}>}
 */
export async function processReferralCashbackOnFirstOrder(db, customerId, orderId, orderAmount) {
  const MIN_ORDER_AMOUNT = 20000;
  const REFERRER_CASHBACK_VND = 10000;

  if (orderAmount < MIN_ORDER_AMOUNT) {
    return { success: false, reason: 'order_below_min', min_required: MIN_ORDER_AMOUNT };
  }

  const pending = await db.prepare(
    'SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?'
  ).bind(customerId, 'pending').first();

  if (!pending) { return { success: false, reason: 'no_pending_referral' }; }

  const referrer = await db.prepare(
    'SELECT id FROM customers WHERE id = ?'
  ).bind(pending.referrer_id).first();

  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const now = new Date().toISOString();

  // 1. Get or create referrer's wallet
  let wallet = await db.prepare(
    'SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?'
  ).bind(referrer.id).first();

  const batch = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(
      db.prepare(
        'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)'
      ).bind(walletId, referrer.id, now)
    );
    wallet = { id: walletId, balance: 0, total_earned: 0 };
  }

  const newBalance = (wallet.balance || 0) + REFERRER_CASHBACK_VND;
  const txId = genId('cbt_');

  // 2. Update wallet
  batch.push(
    db.prepare(
      'UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?'
    ).bind(REFERRER_CASHBACK_VND, REFERRER_CASHBACK_VND, now, wallet.id)
  );

  // 3. Cashback transaction (bonus type, 90-day expiry)
  batch.push(
    db.prepare(
      `INSERT INTO cashback_transactions
        (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
       VALUES (?, ?, ?, 'bonus', ?, ?, ?, datetime('now', '+90 days'), ?)`
    ).bind(
      txId, wallet.id, referrer.id, REFERRER_CASHBACK_VND, newBalance,
      `Giới thiệu bạn (referral_id=${pending.id}): +${REFERRER_CASHBACK_VND}đ cashback`,
      now
    )
  );

  // 4. Update referral status
  batch.push(
    db.prepare(
      `UPDATE referrals
       SET status = 'completed',
           cashback_awarded_vnd = ?,
           first_order_id = ?,
           first_order_amount = ?,
           reward_paid_at = ?
       WHERE id = ?`
    ).bind(REFERRER_CASHBACK_VND, orderId, orderAmount, now, pending.id)
  );

  // 5. Audit log
  batch.push(
    db.prepare(
      `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at)
       VALUES (?, 'referral_cashback', ?, ?, ?, ?)`
    ).bind(
      referrer.id, REFERRER_CASHBACK_VND, orderId,
      JSON.stringify({ referral_id: pending.id, referred_customer_id: customerId, order_amount: orderAmount }),
      now
    )
  );

  // 6. Execute batch atomically
  await db.batch(batch);

  return {
    success: true,
    referrer_id: referrer.id,
    cashback_awarded_vnd: REFERRER_CASHBACK_VND,
    new_balance: newBalance,
  };
}
