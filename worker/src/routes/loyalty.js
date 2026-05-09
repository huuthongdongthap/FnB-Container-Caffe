/**
 * Loyalty Routes — /api/loyalty
 * Cashback wallet, points, rewards, tier management
 */

import { Hono } from 'hono';
import { verifyJWT, generateJWT } from './auth.js';
import { applyReferralForNewCustomer } from './referrals.js';

export const loyaltyRouter = new Hono();

function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Rate limiter: max N requests per windowSec per IP ──
async function throttle(c, key, max, windowSec) {
  const kv = c.env.AUTH_KV;
  if (!kv) {return true;}
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const fullKey = 'rl:' + key + ':' + ip;
  const cur = parseInt(await kv.get(fullKey) || '0', 10);
  if (cur >= max) {return false;}
  await kv.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

// Auth middleware — extracts customer from JWT (skips public routes)
async function authCustomer(c, next) {
  // Public routes: no auth required
  const pubPaths = ['/phone-auth', '/tiers'];
  if (pubPaths.includes(c.req.path.replace('/api/loyalty', ''))) {
    await next();
    return;
  }
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const payload = await verifyJWT(auth.substring(7), c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  const customer = await c.env.AURA_DB.prepare(
    'SELECT * FROM customers WHERE email = ?'
  ).bind(payload.email).first();
  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }
  c.set('customer', customer);
  await next();
}

loyaltyRouter.use('/*', authCustomer);

// ── POST /api/loyalty/phone-auth — phone-based auth (no password) ──
// Public route: finds or creates a customer by phone number, returns JWT
loyaltyRouter.post('/phone-auth', async (c) => {
  try {
    // Rate limit: 10 requests per 5 minutes per IP
    if (!(await throttle(c, 'pa', 10, 300))) {
      return c.json({ success: false, error: 'Quá nhiều yêu cầu, thử lại sau 5 phút' }, 429);
    }

    const body = await c.req.json();
    const phone = (body.phone || '').replace(/\s+/g, '');
    if (!phone || !/^[0-9]{9,15}$/.test(phone)) {
      return c.json({ success: false, error: 'Số điện thoại không hợp lệ' }, 400);
    }

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();

    // 1. Look up existing customer by phone
    let customer = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(phone).first();

    if (!customer) {
      // 2. Create new customer
      const id = genId('CUS_');
      const email = phone + '@loyalty.aura';
      const name = body.name || 'Thành viên';
      await db.prepare(
        'INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at, updated_at) VALUES (?, ?, ?, ?, 0, \'silver\', ?, ?)'
      ).bind(id, email, name, phone, now, now).run();

      // Also create a cashback wallet for the new customer
      const wid = genId('wal_');
      await db.prepare(
        'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
      ).bind(wid, id, now, now).run();

      customer = { id, email, name, phone, loyalty_points: 0, loyalty_tier: 'silver', created_at: now };

      // 2b. Process referral code if provided (fire-and-forget)
      if (body.referral_code) {
        c.executionCtx?.waitUntil?.(
          applyReferralForNewCustomer(db, id, body.referral_code).catch(e =>
            console.error('referral apply error:', e)
          )
        );
      }
    }

    // 3. Generate JWT (reuse email-based token so existing auth middleware works)
    const token = await generateJWT(
      { email: customer.email, name: customer.name, id: customer.id, role: 'customer' },
      c.env.JWT_SECRET,
      c.env.JWT_EXPIRY_SECONDS
    );

    return c.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        tier: customer.loyalty_tier || 'silver',
        points: customer.loyalty_points || 0,
      },
    });
  } catch (err) {
    console.error('phone-auth error:', err);
    return c.json({ success: false, error: 'Lỗi hệ thống, thử lại sau' }, 500);
  }
});

// ── GET /api/loyalty/summary — full member summary ──
loyaltyRouter.get('/summary', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;

  const tier = await db.prepare(
    'SELECT * FROM loyalty_tiers WHERE tier_name = ?'
  ).bind(cust.loyalty_tier || 'silver').first();

  let wallet = await db.prepare(
    'SELECT * FROM cashback_wallets WHERE customer_id = ?'
  ).bind(cust.id).first();

  if (!wallet) {
    const wid = genId('wal_');
    const now = new Date().toISOString();
    await db.prepare(
      'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
    ).bind(wid, cust.id, now, now).run();
    wallet = { id: wid, balance: 0, total_earned: 0, total_spent: 0 };
  }

  const nextTier = await db.prepare(
    'SELECT tier_name, min_points FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1'
  ).bind(cust.loyalty_points || 0).first();

  const { results: activeRewards } = await db.prepare(
    'SELECT COUNT(*) as cnt FROM user_rewards WHERE customer_id = ? AND status = \'active\''
  ).bind(cust.id).all();

  return c.json({
    success: true,
    data: {
      id: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      tier: cust.loyalty_tier || 'silver',
      total_points: cust.loyalty_points || 0,
      tier_config: tier,
      wallet: {
        balance: wallet.balance,
        total_earned: wallet.total_earned,
        total_spent: wallet.total_spent,
      },
      next_tier: nextTier || null,
      active_rewards: activeRewards[0]?.cnt || 0,
      member_since: cust.created_at,
    },
  });
});

// ── GET /api/loyalty/points — point history ──
loyaltyRouter.get('/points', async (c) => {
  const cust = c.get('customer');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const { results } = await c.env.AURA_DB.prepare(
    'SELECT * FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(cust.id, limit, offset).all();

  return c.json({ success: true, data: results });
});

// ── GET /api/loyalty/cashback — cashback transaction history ──
loyaltyRouter.get('/cashback', async (c) => {
  const cust = c.get('customer');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const type = c.req.query('type'); // earn, spend, bonus

  const wallet = await c.env.AURA_DB.prepare(
    'SELECT id FROM cashback_wallets WHERE customer_id = ?'
  ).bind(cust.id).first();

  if (!wallet) {
    return c.json({ success: true, data: [] });
  }

  let query = 'SELECT * FROM cashback_transactions WHERE wallet_id = ?';
  const params = [wallet.id];
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await c.env.AURA_DB.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

// ── POST /api/loyalty/spend-cashback — use cashback on an order ──
loyaltyRouter.post('/spend-cashback', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;
  const { order_id, amount } = await c.req.json();

  if (!order_id || !amount || amount <= 0) {
    return c.json({ success: false, error: 'order_id and positive amount required' }, 400);
  }

  const order = await db.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(order_id).first();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  // Max 50% of order value
  const maxAllowed = Math.round(order.total_amount * 0.5);
  if (amount > maxAllowed) {
    return c.json({ success: false, error: 'Tối đa 50% giá trị đơn hàng', max_allowed: maxAllowed }, 400);
  }

  const wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(cust.id).first();
  if (!wallet || wallet.balance < amount) {
    return c.json({ success: false, error: 'Số dư không đủ', balance: wallet?.balance || 0 }, 400);
  }

  const newBalance = wallet.balance - amount;
  const now = new Date().toISOString();

  await db.prepare('UPDATE cashback_wallets SET balance = ?, total_spent = total_spent + ?, updated_at = ? WHERE customer_id = ?')
    .bind(newBalance, amount, now, cust.id).run();

  await db.prepare(
    'INSERT INTO cashback_transactions (id, wallet_id, order_id, type, amount, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('cbt_'), wallet.id, order_id, 'spend', -amount, newBalance, 'Thanh toán đơn #' + order_id.slice(0, 8), now).run();

  await db.prepare('UPDATE orders SET cashback_used = ? WHERE id = ?').bind(amount, order_id).run();

  return c.json({ success: true, data: { amount_spent: amount, new_balance: newBalance } });
});

// ── GET /api/loyalty/rewards — available rewards to redeem ──
loyaltyRouter.get('/rewards', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;

  const { results: allRewards } = await db.prepare(
    'SELECT * FROM rewards ORDER BY point_cost ASC'
  ).all();

  // Mark which ones user can afford
  const pts = cust.loyalty_points || 0;
  const data = (allRewards || []).map(r => ({
    ...r,
    can_redeem: pts >= r.point_cost,
  }));

  return c.json({ success: true, data });
});

// ── POST /api/loyalty/redeem — redeem a reward ──
loyaltyRouter.post('/redeem', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;
  const { reward_id } = await c.req.json();

  if (!reward_id) {
    return c.json({ success: false, error: 'reward_id required' }, 400);
  }

  const reward = await db.prepare('SELECT * FROM rewards WHERE id = ?').bind(reward_id).first();
  if (!reward) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }

  const pts = cust.loyalty_points || 0;
  if (pts < reward.point_cost) {
    return c.json({ success: false, error: 'Không đủ điểm', needed: reward.point_cost, current: pts }, 400);
  }

  // Deduct points
  const newPts = pts - reward.point_cost;
  const now = new Date().toISOString();
  await db.prepare('UPDATE customers SET loyalty_points = ?, updated_at = ? WHERE id = ?')
    .bind(newPts, now, cust.id).run();

  // Log point deduction
  await db.prepare(
    'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('ptl_'), cust.id, -reward.point_cost, 'redeem', newPts, 'Đổi: ' + reward.title, now).run();

  // Generate unique reward code
  const code = reward.title.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30 days

  await db.prepare(
    'INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('uwr_'), cust.id, reward_id, code, 'active', expiresAt, now).run();

  return c.json({
    success: true,
    data: { code, reward: reward.title, points_spent: reward.point_cost, points_remaining: newPts, expires_at: expiresAt },
  });
});

// ── GET /api/loyalty/my-rewards — user's claimed rewards ──
loyaltyRouter.get('/my-rewards', async (c) => {
  const cust = c.get('customer');
  const { results } = await c.env.AURA_DB.prepare(
    'SELECT ur.*, r.title, r.discount_type, r.discount_value FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
  ).bind(cust.id).all();

  return c.json({ success: true, data: results });
});

// ── GET /api/loyalty/tiers — list all tier configs (public) ──
loyaltyRouter.get('/tiers', async (c) => {
  const { results } = await c.env.AURA_DB.prepare(
    'SELECT * FROM loyalty_tiers ORDER BY min_points ASC'
  ).all();
  return c.json({ success: true, data: results });
});

/**
 * Process loyalty rewards after order completion.
 * Called from orders.js when status → 'delivered'/'completed'.
 * Not an HTTP endpoint — internal function.
 */
export async function processOrderLoyalty(db, orderId, customerEmail) {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) {return null;}

  const customer = await db.prepare('SELECT * FROM customers WHERE email = ?').bind(customerEmail).first();
  if (!customer) {return null;}

  const tier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
    .bind(customer.loyalty_tier || 'silver').first();
  if (!tier) {return null;}

  const total = order.total_amount || order.total || 0;
  const cbUsed = order.cashback_used || 0;
  const now = new Date().toISOString();

  // 1. Calculate cashback (on amount excluding cashback_used)
  const cashback = Math.round((total - cbUsed) * tier.cashback_rate);

  // 2. Calculate points: 1 point per 10,000₫ × multiplier
  const points = Math.floor(total / 10000 * tier.point_multiplier);

  // 3. Ensure wallet exists
  let wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?')
    .bind(customer.id).first();
  if (!wallet) {
    const wid = genId('wal_');
    await db.prepare(
      'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
    ).bind(wid, customer.id, now, now).run();
    wallet = { id: wid, balance: 0, total_earned: 0, total_spent: 0 };
  }

  // 4. Credit cashback
  const newBalance = wallet.balance + cashback;
  await db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ?')
    .bind(newBalance, cashback, now, customer.id).run();

  await db.prepare(
    'INSERT INTO cashback_transactions (id, wallet_id, order_id, type, amount, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('cbt_'), wallet.id, orderId, 'earn', cashback, newBalance, 'Cashback đơn #' + orderId.slice(0, 8), now).run();

  // 5. Credit points
  const newPoints = (customer.loyalty_points || 0) + points;
  await db.prepare('UPDATE customers SET loyalty_points = ?, updated_at = ? WHERE id = ?')
    .bind(newPoints, now, customer.id).run();

  await db.prepare(
    'INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('ptl_'), customer.id, orderId, points, 'purchase', newPoints, 'Tích điểm đơn #' + orderId.slice(0, 8), now).run();

  // 6. Check tier upgrade
  let tierUpgraded = false;
  const nextTier = await db.prepare(
    'SELECT tier_name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1'
  ).bind(newPoints).first();

  if (nextTier && nextTier.tier_name !== customer.loyalty_tier) {
    await db.prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
      .bind(nextTier.tier_name, now, customer.id).run();
    tierUpgraded = true;

    await db.prepare(
      'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(genId('ptl_'), customer.id, 0, 'tier_upgrade', newPoints, 'Nâng hạng lên ' + nextTier.tier_name, now).run();
  }

  // 7. Update order
  await db.prepare('UPDATE orders SET cashback_earned = ?, points_earned = ? WHERE id = ?')
    .bind(cashback, points, orderId).run();

  return { cashback, points, wallet_balance: newBalance, total_points: newPoints, tier: nextTier?.tier_name || customer.loyalty_tier, tier_upgraded: tierUpgraded };
}
