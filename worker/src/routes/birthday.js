/**
 * Birthday Discount Routes
 *
 * v3.1 rules (anh Còn quyết 01/6):
 *   - CHỈ 1 ĐƠN trong tháng sinh nhật (không phải cả tháng)
 *   - Discount % theo tier: Bronze 5%, Silver 10%, Gold 15%, Platinum 20%
 *   - KHÔNG cộng với voucher khác (POS layer enforce)
 *   - KHÔNG còn free 1 ly birthday (đã bỏ)
 *
 * Tracking 1 đơn/tháng qua loyalty_audit_log:
 *   - action='birthday_discount_used'
 *   - metadata: { month: 'YYYY-MM', order_id, discount_pct, amount_off }
 *   - GET /:customer_id check audit log trước khi trả eligible
 *   - POST /redeem/:customer_id ghi audit log khi POS apply
 *
 * Mounted at /api/loyalty/birthday (via index.js)
 */

import { Hono } from 'hono';

export const birthdayRouter = new Hono();

// Helper: check khách đã dùng birthday discount tháng này chưa
async function hasUsedBirthdayThisMonth(db, customerId) {
  const yyyy_mm = new Date().toISOString().slice(0, 7);
  const row = await db.prepare(
    `SELECT id FROM loyalty_audit_log
     WHERE customer_id = ?
       AND action = 'birthday_discount_used'
       AND substr(created_at, 1, 7) = ?
     LIMIT 1`
  ).bind(customerId, yyyy_mm).first();
  return !!row;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/loyalty/birthday/:customer_id
// Trả thông tin birthday discount cho POS lookup
// Public — POS gọi khi lookup customer
// ─────────────────────────────────────────────────────────────────
birthdayRouter.get('/:customer_id', async (c) => {
  const customerId = c.req.param('customer_id');
  const db = c.env.AURA_DB;

  // 1. Lookup customer + tier
  const customer = await db.prepare(
    `SELECT c.id, c.name, c.date_of_birth AS birthday, c.loyalty_tier, lt.birthday_discount, lt.display_name_vi
     FROM customers c
     LEFT JOIN loyalty_tiers lt ON lt.tier_name = c.loyalty_tier
     WHERE c.id = ?`
  ).bind(customerId).first();

  if (!customer) {
    return c.json({ success: false, error: 'Customer không tồn tại' }, 404);
  }

  if (!customer.birthday) {
    return c.json({
      success: true,
      eligible: false,
      reason: 'no_birthday_on_file',
      message: 'Khách chưa có ngày sinh trong hệ thống',
    });
  }

  // 2. Parse birthday (format: YYYY-MM-DD hoặc DD/MM/YYYY)
  let birthMonth;
  try {
    if (customer.birthday.includes('-')) {
      birthMonth = parseInt(customer.birthday.split('-')[1]);
    } else if (customer.birthday.includes('/')) {
      birthMonth = parseInt(customer.birthday.split('/')[1]);
    } else {
      return c.json({
        success: true,
        eligible: false,
        reason: 'invalid_birthday_format',
        message: 'Format ngày sinh không hợp lệ',
      });
    }
  } catch {
    return c.json({
      success: true,
      eligible: false,
      reason: 'invalid_birthday_format',
    });
  }

  // 3. Check current month vs birth month
  const currentMonth = new Date().getMonth() + 1;

  if (birthMonth !== currentMonth) {
    return c.json({
      success: true,
      eligible: false,
      reason: 'not_birthday_month',
      birth_month: birthMonth,
      current_month: currentMonth,
    });
  }

  // 4. NEW v3.1: Check đã dùng tháng này chưa
  const used = await hasUsedBirthdayThisMonth(db, customerId);
  if (used) {
    return c.json({
      success: true,
      eligible: false,
      reason: 'already_used_this_month',
      message: `Khách ${customer.name} đã dùng birthday discount tháng này rồi`,
    });
  }

  // 5. Eligible — trả discount %
  const discountPct = customer.birthday_discount || 0;

  return c.json({
    success: true,
    eligible: true,
    customer: {
      id: customer.id,
      name: customer.name,
      loyalty_tier: customer.loyalty_tier,
      tier_display: customer.display_name_vi,
    },
    discount_pct: discountPct,
    birth_month: birthMonth,
    one_time_per_month: true,
    message: `🎂 Chúc mừng sinh nhật ${customer.name}! Tặng giảm ${discountPct}% cho 1 đơn (tier ${customer.display_name_vi})`,
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/loyalty/birthday/redeem/:customer_id
// POS gọi khi apply birthday discount trên 1 đơn → ghi audit log
// Body: { order_id, discount_pct, amount_off, staff_id }
// Idempotent qua check audit_log existing
// ─────────────────────────────────────────────────────────────────
birthdayRouter.post('/redeem/:customer_id', async (c) => {
  const customerId = c.req.param('customer_id');
  const db = c.env.AURA_DB;
  const { order_id, discount_pct, amount_off, staff_id } = await c.req.json();

  if (!order_id) {
    return c.json({ success: false, error: 'Thiếu order_id' }, 400);
  }

  // Verify customer + birthday month
  const customer = await db.prepare(
    `SELECT c.id, c.name, c.date_of_birth AS birthday, c.loyalty_tier, lt.birthday_discount
     FROM customers c
     LEFT JOIN loyalty_tiers lt ON lt.tier_name = c.loyalty_tier
     WHERE c.id = ?`
  ).bind(customerId).first();

  if (!customer) {
    return c.json({ success: false, error: 'Customer không tồn tại' }, 404);
  }

  if (!customer.birthday) {
    return c.json({ success: false, error: 'Khách chưa có ngày sinh' }, 400);
  }

  // Parse + check birth month
  let birthMonth;
  try {
    birthMonth = customer.birthday.includes('-')
      ? parseInt(customer.birthday.split('-')[1])
      : parseInt(customer.birthday.split('/')[1]);
  } catch {
    return c.json({ success: false, error: 'Format ngày sinh không hợp lệ' }, 400);
  }

  const currentMonth = new Date().getMonth() + 1;
  if (birthMonth !== currentMonth) {
    return c.json({ success: false, error: 'Không phải tháng sinh nhật của khách' }, 400);
  }

  // Check đã dùng tháng này chưa (idempotency)
  const used = await hasUsedBirthdayThisMonth(db, customerId);
  if (used) {
    return c.json({
      success: false,
      error: 'already_used_this_month',
      message: 'Khách đã dùng birthday discount tháng này rồi',
    }, 409);
  }

  // Ghi audit log
  const yyyy_mm = new Date().toISOString().slice(0, 7);
  await db.prepare(
    `INSERT INTO loyalty_audit_log (customer_id, staff_id, action, amount_vnd, order_id, metadata, created_at)
     VALUES (?, ?, 'birthday_discount_used', ?, ?, ?, datetime('now'))`
  ).bind(
    customerId,
    staff_id || null,
    amount_off || 0,
    order_id,
    JSON.stringify({
      month: yyyy_mm,
      discount_pct: discount_pct || customer.birthday_discount || 0,
      tier: customer.loyalty_tier,
      amount_off: amount_off || 0,
    })
  ).run();

  return c.json({
    success: true,
    customer_id: customerId,
    order_id,
    discount_pct: discount_pct || customer.birthday_discount,
    amount_off: amount_off || 0,
    month: yyyy_mm,
    message: `✅ Đã ghi nhận birthday discount cho ${customer.name} (đơn ${order_id})`,
  });
});

/**
 * Utility function — check birthday discount cho customer
 * Gọi từ POS/order creation flow nếu cần inline
 *
 * @param {D1Database} db
 * @param {string} customerId
 * @returns {Promise<{eligible: boolean, discount_pct: number, ...}>}
 */
export async function getBirthdayDiscount(db, customerId) {
  if (!customerId) { return { eligible: false, discount_pct: 0 }; }

  const customer = await db.prepare(
    `SELECT c.date_of_birth AS birthday, c.loyalty_tier, lt.birthday_discount
     FROM customers c
     LEFT JOIN loyalty_tiers lt ON lt.tier_name = c.loyalty_tier
     WHERE c.id = ?`
  ).bind(customerId).first();

  if (!customer || !customer.birthday) {
    return { eligible: false, discount_pct: 0, reason: 'no_birthday' };
  }

  let birthMonth;
  try {
    birthMonth = customer.birthday.includes('-')
      ? parseInt(customer.birthday.split('-')[1])
      : parseInt(customer.birthday.split('/')[1]);
  } catch {
    return { eligible: false, discount_pct: 0, reason: 'invalid_format' };
  }

  const currentMonth = new Date().getMonth() + 1;
  if (birthMonth !== currentMonth) {
    return { eligible: false, discount_pct: 0, reason: 'not_birthday_month' };
  }

  // v3.1: check đã dùng tháng này chưa
  const used = await hasUsedBirthdayThisMonth(db, customerId);
  if (used) {
    return { eligible: false, discount_pct: 0, reason: 'already_used_this_month' };
  }

  return {
    eligible: true,
    discount_pct: customer.birthday_discount || 0,
    birth_month: birthMonth,
    one_time_per_month: true,
  };
}
