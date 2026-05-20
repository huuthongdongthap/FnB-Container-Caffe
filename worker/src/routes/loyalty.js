/**
 * Loyalty Routes — /api/loyalty
 * Cashback wallet, points, rewards, tier management
 *
 * v2 Launch (2026-05-18):
 *   - 4-tier (Bronze/Silver/Gold/Platinum, 3/5/7/10%)
 *   - Bonus campaigns (Grand Opening 6/6 cashback x2 + signup +50k)
 *   - Idempotency in processOrderLoyalty (UNIQUE order_id + earn)
 *   - Min order 30k for cashback eligibility
 *   - Auto-upgrade Silver khi spend >=200k ngày khai trương
 */

import { Hono } from 'hono';
import { verifyJWT, generateJWT } from './auth.js';
import { applyReferralForNewCustomer } from './referrals.js';
import { notifyMember } from './zalo.js';

export const loyaltyRouter = new Hono();

// ── Constants ──
const MIN_ORDER_FOR_CASHBACK = 30000; // 30k VND
const DEFAULT_MAX_CASHBACK_PER_TX = 50000; // 50k VND
const DEFAULT_TIER = 'bronze'; // Was 'silver' before v2

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

// ── Get active campaign (helper) ──
async function getActiveCampaign(db) {
  const now = new Date().toISOString();
  return await db.prepare(
    'SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1'
  ).bind(now, now).first();
}

// ── Calculate cashback expiry from tier (helper) ──
function calcExpiresAt(tier) {
  if (!tier || !tier.expiry_days) {return null;}
  return new Date(Date.now() + tier.expiry_days * 86400000).toISOString();
}

// Auth middleware — extracts customer from JWT (skips public routes)
async function authCustomer(c, next) {
  // Public routes: no auth required
  const pubPaths = ['/phone-auth', '/tiers', '/active-campaign', '/lookup'];
  const pathSegments = c.req.path.split('/').filter(Boolean);
  const relPath = '/' + pathSegments.slice(2).join('/');
  if (pubPaths.includes(relPath)) {
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

// ── GET /api/loyalty/active-campaign — public campaign info for frontend banner ──
loyaltyRouter.get('/active-campaign', async (c) => {
  const campaign = await getActiveCampaign(c.env.AURA_DB);
  if (!campaign) {return c.json({ success: true, campaign: null });}

  // Add remaining signup slots
  let slotsLeft = null;
  if (campaign.signup_bonus_cap) {
    const granted = await c.env.AURA_DB.prepare(
      'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
    ).bind(campaign.id).first();
    slotsLeft = Math.max(0, campaign.signup_bonus_cap - (granted?.count || 0));
  }

  return c.json({
    success: true,
    campaign: {
      code: campaign.code,
      name: campaign.name,
      description: campaign.description,
      cashback_multiplier: campaign.cashback_multiplier,
      signup_bonus_vnd: campaign.signup_bonus_vnd,
      signup_bonus_cap: campaign.signup_bonus_cap,
      signup_slots_left: slotsLeft,
      refer_bonus_vnd: campaign.refer_bonus_vnd,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
    },
  });
});

// ── POST /api/loyalty/phone-auth — phone-based auth (no password) ──
// Public route: finds or creates a customer by phone number, returns JWT
// v2: Apply signup bonus from active campaign for first N sign-ups
loyaltyRouter.post('/phone-auth', async (c) => {
  try {
    // Rate limit: 10 requests per 5 minutes per IP
    if (!(await throttle(c, 'pa', 10, 300))) {
      return c.json({ success: false, error: 'Quá nhiều yêu cầu, thử lại sau 5 phút' }, 429);
    }

    const body = await c.req.json();
    const phone = (body.phone || '').replace(/\s+/g, '');
    if (!phone || !/^(0|\+84)[0-9]{9,10}$/.test(phone)) {
      return c.json({ success: false, error: 'Số điện thoại không hợp lệ' }, 400);
    }
    const dob    = body.dob    || null;
    const zalo   = (body.zalo || '').replace(/\s+/g, '') || null;
    const source = body.source || 'unknown';

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();

    // 1. Look up existing customer by phone
    let customer = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(phone).first();
    let bonusGranted = 0;
    let bonusMessage = null;
    let isNew = false;

    if (!customer) {
      // 2. Create new customer (default tier=bronze for v2)
      isNew = true;
      const id = genId('CUS_');
      const email = phone + '@loyalty.aura';
      const name = body.name || 'Thành viên';
      await db.prepare(
        'INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, date_of_birth, zalo, source, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)'
      ).bind(id, email, name, phone, DEFAULT_TIER, dob, zalo, source, now, now).run();

      // Also create a cashback wallet for the new customer
      const wid = genId('wal_');
      await db.prepare(
        'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
      ).bind(wid, id, now, now).run();

      customer = { id, email, name, phone, loyalty_points: 0, loyalty_tier: DEFAULT_TIER, created_at: now };

      // 2a. Apply signup bonus from active campaign (Grand Opening 6/6)
      try {
        const campaign = await getActiveCampaign(db);
        if (campaign && campaign.signup_bonus_vnd > 0) {
          // Check cap
          const grantedCount = await db.prepare(
            'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
          ).bind(campaign.id).first();

          if (!campaign.signup_bonus_cap || (grantedCount?.count || 0) < campaign.signup_bonus_cap) {
            bonusGranted = campaign.signup_bonus_vnd;
            const bonusExpiresAt = new Date(Date.now() + 90 * 86400000).toISOString(); // 90 days

            // Grant bonus: tx + wallet update + signup log + audit
            await db.batch([
              db.prepare(
                'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                genId('cbt_'), wid, id, null, 'bonus',
                bonusGranted, bonusGranted, bonusExpiresAt, campaign.id,
                'Quà khai trương — ' + campaign.name, now
              ),
              db.prepare(
                'UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?'
              ).bind(bonusGranted, bonusGranted, now, wid),
              db.prepare(
                'INSERT INTO signup_bonus_log (customer_id, campaign_id, bonus_vnd, granted_at) VALUES (?, ?, ?, ?)'
              ).bind(id, campaign.id, bonusGranted, now),
              db.prepare(
                'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
              ).bind(id, 'signup_bonus', bonusGranted, JSON.stringify({
                campaign: campaign.code,
                position: (grantedCount?.count || 0) + 1,
                cap: campaign.signup_bonus_cap,
              }), now),
            ]);

            bonusMessage = '🎉 Bạn được tặng ' + bonusGranted.toLocaleString('vi-VN') + 'đ vào ví khai trương AURA!';
          }
        }
      } catch (e) {
        console.error('Signup bonus error (non-fatal):', e.message);
      }

      // 2c. Process referral code if provided (fire-and-forget)
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
        tier: customer.loyalty_tier || DEFAULT_TIER,
        points: customer.loyalty_points || 0,
      },
      is_new: isNew,
      bonus_granted: bonusGranted,
      bonus_message: bonusMessage,
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
  ).bind(cust.loyalty_tier || DEFAULT_TIER).first();

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

  // Cashback expiring within 7 days
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
  const expiring = await db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE wallet_id = ? AND type IN ('earn', 'bonus') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime('now')"
  ).bind(wallet.id, sevenDaysFromNow).first();

  return c.json({
    success: true,
    data: {
      id: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      tier: cust.loyalty_tier || DEFAULT_TIER,
      total_points: cust.loyalty_points || 0,
      tier_config: tier,
      wallet: {
        balance: wallet.balance,
        total_earned: wallet.total_earned,
        total_spent: wallet.total_spent,
        expiring_within_7d: expiring?.total || 0,
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
// v2: Min order 30k validation
loyaltyRouter.post('/spend-cashback', async (c) => {
  const cust = c.get('customer');
  const db = c.env.AURA_DB;
  const { order_id, amount } = await c.req.json();

  if (!order_id || !amount || amount <= 0 || !Number.isInteger(amount)) {
    return c.json({ success: false, error: 'order_id and positive integer amount required' }, 400);
  }

  // Idempotency: block if order already has a spend transaction
  const existingSpend = await db.prepare(
    "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'spend' LIMIT 1"
  ).bind(order_id).first();
  if (existingSpend) {
    return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
  }

  const order = await db.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(order_id).first();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  // Min order 30k để dùng ví
  if (order.total_amount < MIN_ORDER_FOR_CASHBACK) {
    return c.json({
      success: false,
      error: 'Đơn tối thiểu ' + MIN_ORDER_FOR_CASHBACK.toLocaleString('vi-VN') + 'đ để dùng ví cashback',
      min_order: MIN_ORDER_FOR_CASHBACK,
    }, 400);
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
    'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('cbt_'), wallet.id, cust.id, order_id, 'spend', -amount, newBalance, 'Thanh toán đơn #' + order_id.slice(0, 8), now).run();

  await db.prepare('UPDATE orders SET cashback_used = ? WHERE id = ?').bind(amount, order_id).run();

  // Audit log
  await db.prepare(
    'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(cust.id, 'cashback_spend', amount, order_id, JSON.stringify({ order_total: order.total_amount }), now).run();

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

// ── GET /api/loyalty/lookup?phone=... — POS phone lookup (public) ──
loyaltyRouter.get('/lookup', async (c) => {
  const phone = (c.req.query('phone') || '').trim();
  if (!phone) return c.json({ ok: false, error: 'Thiếu số điện thoại' }, 400);

  const db = c.env.AURA_DB;
  const customer = await db.prepare(
    'SELECT * FROM customers WHERE phone = ?'
  ).bind(phone).first();
  if (!customer) return c.json({ ok: false, error: 'Không tìm thấy thành viên' }, 200);

  const wallet = await db.prepare(
    'SELECT * FROM cashback_wallets WHERE customer_id = ?'
  ).bind(customer.id).first();

  const balance = wallet?.balance || 0;

  // Lifetime cashback earned (earn + bonus transactions)
  const lifetimeRow = await db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE customer_id = ? AND type IN ('earn', 'bonus')"
  ).bind(customer.id).first();

  // Cashback expiring within 7 days
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
  const expiringRow = await db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM cashback_transactions WHERE customer_id = ? AND type IN ('earn', 'bonus') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime('now')"
  ).bind(customer.id, sevenDays).first();

  // Tier progress based on loyalty_points
  const currentTierRow = await db.prepare(
    'SELECT * FROM loyalty_tiers WHERE tier_name = ?'
  ).bind(customer.loyalty_tier || DEFAULT_TIER).first();

  const nextTierRow = await db.prepare(
    'SELECT * FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1'
  ).bind(customer.loyalty_points || 0).first();

  let tierProgress = null;
  if (nextTierRow && currentTierRow) {
    const pts = customer.loyalty_points || 0;
    const needed = nextTierRow.min_points - pts;
    const range = nextTierRow.min_points - (currentTierRow.min_points || 0);
    const filled = range - needed;
    const tierViMap = { silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' };
    tierProgress = {
      next_tier: nextTierRow.tier_name,
      next_tier_vi: tierViMap[nextTierRow.tier_name] || nextTierRow.tier_name,
      to_next: needed,
      percent: Math.max(0, Math.min(100, range > 0 ? (filled / range) * 100 : 100)),
    };
  }

  const tierViMap = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' };

  return c.json({
    ok: true,
    member: {
      id: customer.id,
      member_id: 'AC' + String(customer.id).slice(-6).toUpperCase(),
      name: customer.name,
      phone: customer.phone,
      tier: customer.loyalty_tier || DEFAULT_TIER,
      loyalty_tier: customer.loyalty_tier || DEFAULT_TIER,
      loyalty_points: customer.loyalty_points || 0,
      tier_vi: tierViMap[customer.loyalty_tier] || 'Đồng',
      balance: balance,
      cashback_balance: balance,
      cashback_balance_vnd: balance,
      lifetime_cashback: lifetimeRow?.total || 0,
      expiring_amount: expiringRow?.total || 0,
      expiring_within_7d: expiringRow?.cnt || 0,
      tier_progress: tierProgress,
      member_since: customer.created_at,
    },
  });
});

/**
 * Process loyalty rewards after order completion.
 * Called from orders.js when status → 'delivered'/'completed'.
 * Not an HTTP endpoint — internal function.
 *
 * v2 changes:
 *   - Idempotency check: skip if order already has 'earn' transaction
 *   - Apply campaign multiplier (Grand Opening x2)
 *   - Cap at campaign.max_cap_per_customer_vnd (default 50k)
 *   - Set expires_at based on tier.expiry_days (90/120/180/null)
 *   - Auto-upgrade Silver if campaign + order >= auto_upgrade_min_spend
 *   - Min order 30k for cashback eligibility
 *   - Audit log entries
 */
// ════════════════════════════════════════════════════════
// Process order loyalty: cashback + points + tier upgrade
// Idempotent: UNIQUE (order_id, type='earn') chống double-credit
// Campaign-aware: apply multiplier + cap + auto-upgrade
// ════════════════════════════════════════════════════════
export async function processOrderLoyalty(orderId, env) {
  const db = env.AURA_DB;

  // 1. Get order
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) { return { ok: false, reason: 'order_not_found' }; }

  if (!order.customer_phone) {
    console.log(`Order ${orderId} has no phone, skip loyalty`);
    return { ok: false, reason: 'no_customer' };
  }

  // 2. Idempotency check
  const existingEarn = await db.prepare(
    "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1"
  ).bind(orderId).first();
  if (existingEarn) {
    return { ok: false, reason: 'already_processed', existing_id: existingEarn.id };
  }

  // 3. Min order check
  const total = order.total_amount || order.total || 0;
  if (total < MIN_ORDER_FOR_CASHBACK) {
    return { ok: false, reason: 'below_min_order', min: MIN_ORDER_FOR_CASHBACK };
  }

  // 4. Get customer + tier (orders link via phone)
  const customer = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(order.customer_phone).first();
  if (!customer) { return { ok: false, reason: 'customer_not_found' }; }

  const tier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
    .bind(customer.loyalty_tier || DEFAULT_TIER).first();
  if (!tier) { return { ok: false, reason: 'tier_not_found' }; }
  const now = new Date().toISOString();
  const campaign = await db.prepare(
    "SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1"
  ).bind(now, now).first();

  const multiplier = campaign?.cashback_multiplier ?? 1.0;
  const maxCap = campaign?.max_cap_per_customer_vnd ?? DEFAULT_MAX_CASHBACK_PER_TX;

  const cbUsed = order.cashback_used || 0;
  const baseRate = tier.cashback_rate;
  const rawCashback = Math.round((total - cbUsed) * baseRate * multiplier);
  const cashback = Math.min(rawCashback, maxCap);

  // 1 point per 10,000₫ — aligns with tier thresholds (silver=50pts≈500k, gold=200pts≈2M, platinum=500pts≈5M)
  const points = Math.floor(total / 10000 * tier.point_multiplier);

  const expiresAt = calcExpiresAt(tier);

  let wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(customer.id).first();
  if (!wallet) {
    const wid = genId('wal_');
    await db.prepare(
      'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
    ).bind(wid, customer.id, now, now).run();
    wallet = { id: wid, balance: 0, total_earned: 0, total_spent: 0 };
  }

  const newBalance = (wallet.balance || 0) + cashback;
  const newPoints = (customer.loyalty_points || 0) + points;

  await db.batch([
    db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ?')
      .bind(newBalance, cashback, now, customer.id),

    db.prepare(
      'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, multiplier_applied, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      genId('cbt_'), wallet.id, customer.id, orderId, 'earn',
      cashback, newBalance, expiresAt, multiplier, campaign?.id || null,
      'Cashback đơn #' + orderId.slice(0, 8) + (multiplier > 1 ? ' (x' + multiplier + ')' : ''),
      now
    ),

    db.prepare('UPDATE customers SET loyalty_points = ?, updated_at = ? WHERE id = ?')
      .bind(newPoints, now, customer.id),

    db.prepare(
      'INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(genId('ptl_'), customer.id, orderId, points, 'purchase', newPoints, 'Tích điểm đơn #' + orderId.slice(0, 8), now),

    db.prepare(
      'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(customer.id, 'cashback_earn', cashback, orderId, JSON.stringify({
      tier: tier.tier_name,
      base_rate: tier.cashback_rate,
      multiplier,
      campaign: campaign?.code || null,
      raw_cashback: rawCashback,
      capped: cashback < rawCashback,
      cap_used: maxCap,
    }), now),

    db.prepare('UPDATE orders SET cashback_earned = ?, points_earned = ? WHERE id = ?')
      .bind(cashback, points, orderId),
  ]);

  let tierUpgraded = false;
  let newTierName = customer.loyalty_tier;

  if (campaign?.auto_upgrade_tier && campaign?.auto_upgrade_min_spend &&
      total >= campaign.auto_upgrade_min_spend &&
      customer.loyalty_tier === 'bronze') {
    newTierName = campaign.auto_upgrade_tier;
    tierUpgraded = true;

    await db.prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
      .bind(newTierName, now, customer.id).run();

    await db.batch([
      db.prepare(
        'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(genId('ptl_'), customer.id, 0, 'tier_upgrade', newPoints, 'Nâng hạng campaign: ' + newTierName, now),
      db.prepare(
        'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(customer.id, 'tier_upgrade', null, orderId, JSON.stringify({
        from: customer.loyalty_tier,
        to: newTierName,
        reason: 'campaign_auto',
        campaign: campaign.code,
      }), now),
    ]);
  } else {
    const nextTier = await db.prepare(
      'SELECT tier_name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1'
    ).bind(newPoints).first();

    if (nextTier && nextTier.tier_name !== customer.loyalty_tier) {
      newTierName = nextTier.tier_name;
      tierUpgraded = true;
      await db.prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
        .bind(newTierName, now, customer.id).run();

      await db.batch([
        db.prepare(
          'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(genId('ptl_'), customer.id, 0, 'tier_upgrade', newPoints, 'Nâng hạng lên ' + newTierName, now),
        db.prepare(
          'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(customer.id, 'tier_upgrade', null, orderId, JSON.stringify({
          from: customer.loyalty_tier,
          to: newTierName,
          reason: 'points_threshold',
          points: newPoints,
        }), now),
      ]);
    }
  }

  // Zalo ZNS: cashback earned (fire-and-forget, never throws)
  notifyMember(env, {
    customer_id:  customer.id,
    template_key: 'cashback_earned',
    data: { amount: cashback, balance: newBalance, order_id: orderId },
  }).catch(() => {});

  // Zalo ZNS: tier upgrade (fire-and-forget)
  if (tierUpgraded) {
    const upgradedTier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
      .bind(newTierName).first().catch(() => null);
    notifyMember(env, {
      customer_id:  customer.id,
      template_key: 'tier_upgrade',
      data: {
        new_tier_vi: upgradedTier?.display_name_vi || newTierName,
        new_rate:    upgradedTier?.cashback_rate   || 0,
      },
    }).catch(() => {});
  }

  return {
    cashback,
    points,
    wallet_balance: newBalance,
    total_points: newPoints,
    tier: newTierName,
    tier_upgraded: tierUpgraded,
    multiplier_applied: multiplier,
    campaign_code: campaign?.code || null,
    expires_at: expiresAt,
  };
}
