/**
 * Birthday Discount Routes
 *
 * v3 rules (anh Còn quyết 30/5):
 *   - Áp dụng cả tháng sinh nhật (vd: tháng 5 sinh, áp 1-31/5)
 *   - Discount % theo tier:
 *     Bronze 5%, Silver 10%, Gold 15%, Platinum 20%
 *   - KHÔNG cộng với voucher khác (POS layer enforce)
 *   - KHÔNG còn free 1 ly birthday (đã bỏ)
 *
 * Mounted at /api/loyalty/birthday (via index.js)
 */

import { Hono } from 'hono';

export const birthdayRouter = new Hono();

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
    `SELECT c.id, c.name, c.birthday, c.loyalty_tier, lt.birthday_discount, lt.display_name_vi
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
      // YYYY-MM-DD or YYYY-MM-DDTxxx
      birthMonth = parseInt(customer.birthday.split('-')[1]);
    } else if (customer.birthday.includes('/')) {
      // DD/MM/YYYY
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
  const currentMonth = new Date().getMonth() + 1; // 1-12

  if (birthMonth !== currentMonth) {
    return c.json({
      success: true,
      eligible: false,
      reason: 'not_birthday_month',
      birth_month: birthMonth,
      current_month: currentMonth,
    });
  }

  // 4. Eligible — trả discount %
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
    message: `🎂 Chúc mừng sinh nhật ${customer.name}! Tặng giảm ${discountPct}% (tier ${customer.display_name_vi})`,
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
    `SELECT c.birthday, c.loyalty_tier, lt.birthday_discount
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

  return {
    eligible: true,
    discount_pct: customer.birthday_discount || 0,
    birth_month: birthMonth,
  };
}
