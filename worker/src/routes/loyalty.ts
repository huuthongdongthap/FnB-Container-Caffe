/**
 * Loyalty Routes — /api/loyalty
 * Converted from routes/loyalty.js with TypeScript.
 * Business logic preserved exactly — v2 loyalty system with cashback, tiers, campaigns.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { createLogger } from '../middleware/logger';
import { verifyJWT, generateJWT } from '../lib/jwt';
import type { Env } from '../types/env';
import type { Customer, CashbackWallet, BonusCampaign, LoyaltyTier } from '../types/models';

const log = createLogger({ route: 'loyalty' });
export const loyaltyRouter = new Hono<{ Bindings: Env }>();

const MIN_ORDER_TO_EARN = 20000;
const MIN_ORDER_TO_SPEND = 20000;
const DEFAULT_MAX_CASHBACK_PER_TX = 50000;
const DEFAULT_TIER = 'bronze';
const TIER_VI_MAP: Record<string, string> = { bronze: 'DGng', silver: 'B?c', gold: 'VAng', platinum: 'B?ch Kim' };

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function nowSqlTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function throttle(c: { env: Env; req: { header: (n: string) => string | undefined } }, key: string, max: number, windowSec: number): Promise<boolean> {
  const kv = c.env.AUTH_KV;
  if (!kv) { return true; }
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') { return true; }
  const fullKey = 'rl:' + key + ':' + ip;
  const cur = parseInt(await kv.get(fullKey) || '0', 10);
  if (cur >= max) { return false; }
  await kv.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

async function getActiveCampaign(db: import('@cloudflare/workers-types').D1Database): Promise<BonusCampaign | null> {
  const now = nowSqlTimestamp();
  return await db.prepare(
    'SELECT * FROM bonus_campaigns WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY id DESC LIMIT 1'
  ).bind(now, now).first<BonusCampaign>() || null;
}

function calcExpiresAt(tier: { expiry_days?: number | null } | null): string | null {
  if (!tier || !tier.expiry_days) { return null; }
  return new Date(Date.now() + tier.expiry_days * 86400000).toISOString();
}

const authCustomer: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
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
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE email = ?'
  ).bind(payload.email).first<Customer>();
  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }
  c.set('customer', customer as unknown as Record<string, unknown>);
  await next();
};

loyaltyRouter.use('/*', authCustomer);

loyaltyRouter.get('/active-campaign', async (c) => {
  const campaign = await getActiveCampaign(c.env.AURA_DB);
  if (!campaign) { return c.json({ success: true, campaign: null }); }
  let slotsLeft: number | null = null;
  if (campaign.signup_bonus_cap) {
    const granted = await c.env.AURA_DB.prepare(
      'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
    ).bind(campaign.id).first<{ count: number }>();
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

loyaltyRouter.post('/phone-auth', async (c) => {
  try {
    if (!(await throttle(c, 'pa', 10, 300))) {
      return c.json({ success: false, error: 'Quá nhiều yêu cầu, thử lại sau 5 phút' }, 429);
    }

    const body = await c.req.json() as { phone?: string; name?: string; dob?: string; zalo?: string; source?: string; referral_code?: string };
    const phone = (body.phone || '').replace(/\s+/g, '');
    if (!phone || !/^(0|\+84)[0-9]{9,10}$/.test(phone)) {
      return c.json({ success: false, error: 'Số điện thoại không hợp lệ' }, 400);
    }
    const dob = body.dob || null;
    const zalo = (body.zalo || '').replace(/\s+/g, '') || null;
    const source = body.source || 'unknown';

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();

    let customer = await db.prepare(
      'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
    ).bind(phone).first<Customer>();
    let bonusGranted = 0;
    let bonusMessage: string | null = null;
    let isNew = false;

    if (!customer) {
      isNew = true;
      const id = genId('CUS_');
      const email = phone + '@loyalty.aura';
      const name = body.name || 'Thành viên';
      await db.prepare(
        'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, date_of_birth, zalo, source, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)'
      ).bind(id, email, name, phone, DEFAULT_TIER, dob, zalo, source, now, now).run();

      const wid = genId('wal_');
      await db.prepare(
        'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
      ).bind(wid, id, now, now).run();

      customer = { id, email, name, phone, loyalty_points: 0, lifetime_points: 0, loyalty_tier: DEFAULT_TIER, created_at: now, date_of_birth: null, zalo: null, source: null, last_ip: null, consent_erpnext_sync: null, updated_at: now };

      try {
        const campaign = await getActiveCampaign(db);
        if (campaign && campaign.signup_bonus_vnd > 0) {
          const grantedCount = await db.prepare(
            'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
          ).bind(campaign.id).first<{ count: number }>();

          if (!campaign.signup_bonus_cap || (grantedCount?.count || 0) < campaign.signup_bonus_cap) {
            bonusGranted = campaign.signup_bonus_vnd;
            const bonusExpiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
            await db.batch([
              db.prepare(
                'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(genId('cbt_'), wid, id, null, 'bonus', bonusGranted, bonusGranted, bonusExpiresAt, campaign.id, 'Quà khai truong — ' + campaign.name, now),
              db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(bonusGranted, bonusGranted, now, wid),
              db.prepare('INSERT INTO signup_bonus_log (customer_id, campaign_id, bonus_vnd, granted_at) VALUES (?, ?, ?, ?)').bind(id, campaign.id, bonusGranted, now),
              db.prepare('INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, metadata, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, 'signup_bonus', bonusGranted, JSON.stringify({ campaign: campaign.code, position: (grantedCount?.count || 0) + 1, cap: campaign.signup_bonus_cap }), now),
            ]);
            bonusMessage = '🚀 B?n duoc t?ng ' + bonusGranted.toLocaleString('vi-VN') + 'd vao vi khai truong AURA!';
          }
        }
      } catch (e) {
        log.error('Signup bonus error (non-fatal):', { message: (e as Error).message });
      }

      if (body.referral_code) {
        const { applyReferralForNewCustomer } = await import('./referrals');
        c.executionCtx?.waitUntil?.(
          applyReferralForNewCustomer(db, id, body.referral_code).catch(e =>
            log.error('Referral apply error:', { message: (e as Error).message })
          )
        );
      }
    }

    const token = await generateJWT(
      { email: customer.email || '', name: customer.name || '', id: customer.id, role: 'customer' },
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
    log.error('phone-auth error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Lỗi hệ thống, thử lại sau' }, 500);
  }
});

loyaltyRouter.get('/summary', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  const tier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
    .bind(cust.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();

  let wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?')
    .bind(cust.id).first<CashbackWallet>();

  if (!wallet) {
    const wid = genId('wal_');
    const now = new Date().toISOString();
    await db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)').bind(wid, cust.id, now, now).run();
    wallet = { id: wid, customer_id: cust.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const nextTier = await db.prepare('SELECT tier_name, min_points FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1')
    .bind(cust.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();

  const { results: activeRewards } = await db.prepare(
    'SELECT COUNT(*) as cnt FROM user_rewards WHERE customer_id = ? AND status = \'active\''
  ).bind(cust.id).all<{ cnt: number }>();

  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
  const expiring = await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE wallet_id = ? AND type IN (\'earn\', \'bonus\') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime(\'now\')'
  ).bind(wallet.id, sevenDaysFromNow).first<{ total: number }>();

  return c.json({
    success: true,
    data: {
      id: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      tier: cust.loyalty_tier || DEFAULT_TIER,
      total_points: cust.loyalty_points || 0,
      lifetime_points: cust.lifetime_points || 0,
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

loyaltyRouter.get('/points', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const { results } = await c.env.AURA_DB.prepare(
    'SELECT * FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(cust.id, limit, offset).all();

  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/cashback', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const type = c.req.query('type');

  const wallet = await c.env.AURA_DB.prepare('SELECT id FROM cashback_wallets WHERE customer_id = ?')
    .bind(cust.id).first<{ id: string }>();

  if (!wallet) {
    return c.json({ success: true, data: [] });
  }

  let query = 'SELECT * FROM cashback_transactions WHERE wallet_id = ?';
  const params: unknown[] = [wallet.id];
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await c.env.AURA_DB.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

loyaltyRouter.post('/spend-cashback', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const body = await c.req.json() as { order_id?: string; amount?: number };
  const { order_id, amount } = body;

  if (!order_id || !amount || amount <= 0 || !Number.isInteger(amount)) {
    return c.json({ success: false, error: 'order_id and positive integer amount required' }, 400);
  }

  const existingSpend = await db.prepare(
    'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'spend\' LIMIT 1'
  ).bind(order_id).first<{ id: string }>();
  if (existingSpend) {
    return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
  }

  const order = await db.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(order_id).first<{ total_amount: number }>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  if (order.total_amount < MIN_ORDER_TO_SPEND) {
    return c.json({
      success: false,
      error: 'Don toi thieu ' + MIN_ORDER_TO_SPEND.toLocaleString('vi-VN') + 'd de dung vi cashback',
      min_order: MIN_ORDER_TO_SPEND,
    }, 400);
  }

  const maxAllowed = Math.round(order.total_amount * 0.5);
  if (amount > maxAllowed) {
    return c.json({ success: false, error: 'Toi da 50% gia tr? don hang', max_allowed: maxAllowed }, 400);
  }

  const wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(cust.id).first<CashbackWallet>();
  if (!wallet) {
    return c.json({ success: false, error: 'Vi khong ton tai', balance: 0 }, 400);
  }

  const newBalance = wallet.balance - amount;
  if (newBalance < 0) {
    return c.json({ success: false, error: 'So du khong du', balance: wallet.balance }, 400);
  }

  const now = new Date().toISOString();
  const updateResult = await db.prepare(
    'UPDATE cashback_wallets SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ? WHERE customer_id = ? AND balance >= ?'
  ).bind(amount, amount, now, cust.id, amount).run();

  if ((updateResult as unknown as { changes: number }).changes === 0) {
    return c.json({ success: false, error: 'So du khong du (race condition)', balance: wallet.balance }, 400);
  }

  await db.prepare('UPDATE orders SET cashback_used = ? WHERE id = ?').bind(amount, order_id).run();
  await db.prepare(
    'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(cust.id, 'cashback_spend', amount, order_id, JSON.stringify({ order_total: order.total_amount }), now).run();

  const updatedWallet = await db.prepare('SELECT balance FROM cashback_wallets WHERE customer_id = ?').bind(cust.id).first<{ balance: number }>();
  return c.json({ success: true, data: { amount_spent: amount, new_balance: updatedWallet?.balance || 0 } });
});

loyaltyRouter.get('/rewards', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  const { results: allRewards } = await db.prepare('SELECT * FROM rewards ORDER BY point_cost ASC').all<{ id: string; title: string; point_cost: number }>();

  const pts = cust.loyalty_points || 0;
  const data = (allRewards || []).map(r => ({ ...r, can_redeem: pts >= r.point_cost }));

  return c.json({ success: true, data });
});

loyaltyRouter.post('/redeem', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const body = await c.req.json() as { reward_id?: string };
  const { reward_id } = body;

  if (!reward_id) {
    return c.json({ success: false, error: 'reward_id required' }, 400);
  }

  const reward = await db.prepare('SELECT * FROM rewards WHERE id = ?').bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
  if (!reward) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }

  const pts = cust.loyalty_points || 0;
  if (pts < reward.point_cost) {
    return c.json({ success: false, error: 'Không du diem', needed: reward.point_cost, current: pts }, 400);
  }

  const newPts = pts - reward.point_cost;
  const now = new Date().toISOString();
  await db.prepare('UPDATE customers SET loyalty_points = ?, updated_at = ? WHERE id = ?').bind(newPts, now, cust.id).run();
  await db.prepare(
    'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('ptl_'), cust.id, -reward.point_cost, 'redeem', newPts, 'D?i: ' + reward.title, now).run();

  const code = reward.title.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

  await db.prepare(
    'INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('uwr_'), cust.id, reward_id, code, 'active', expiresAt, now).run();

  return c.json({
    success: true,
    data: { code, reward: reward.title, points_spent: reward.point_cost, points_remaining: newPts, expires_at: expiresAt },
  });
});

loyaltyRouter.get('/my-rewards', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const { results } = await c.env.AURA_DB.prepare(
    'SELECT ur.*, r.title, r.discount_type, r.discount_value FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
  ).bind(cust.id).all();

  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/tiers', async (c) => {
  const { results } = await c.env.AURA_DB.prepare('SELECT * FROM loyalty_tiers ORDER BY min_points ASC').all();
  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/lookup', async (c) => {
  const phone = (c.req.query('phone') || '').trim();
  if (!phone) { return c.json({ ok: false, error: 'Thi?u s? di?n tho?i' }, 400); }

  const db = c.env.AURA_DB;
  const customer = await db.prepare(
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
  ).bind(phone).first<Customer>();
  if (!customer) { return c.json({ ok: false, error: 'Không tìm thấy thành viên' }, 200); }

  const wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(customer.id).first<CashbackWallet>();
  const balance = wallet?.balance || 0;

  const lifetimeRow = await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE customer_id = ? AND type IN (\'earn\', \'bonus\')'
  ).bind(customer.id).first<{ total: number }>();

  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
  const expiringRow = await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM cashback_transactions WHERE customer_id = ? AND type IN (\'earn\', \'bonus\') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime(\'now\')'
  ).bind(customer.id, sevenDays).first<{ total: number; cnt: number }>();

  const nextTierRow = await db.prepare(
    'SELECT * FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1'
  ).bind(customer.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();

  let tierProgress: Record<string, unknown> | null = null;
  if (nextTierRow && customer.lifetime_points !== undefined) {
    const pts = customer.lifetime_points || 0;
    const needed = nextTierRow.min_points - pts;
    const prevTier = await db.prepare(
      'SELECT min_points FROM loyalty_tiers WHERE min_points < ? ORDER BY min_points DESC LIMIT 1'
    ).bind(nextTierRow.min_points).first<{ min_points: number }>();
    const range = nextTierRow.min_points - (prevTier?.min_points || 0);
    const filled = pts - (prevTier?.min_points || 0);
    tierProgress = {
      next_tier: nextTierRow.tier_name,
      next_tier_vi: TIER_VI_MAP[nextTierRow.tier_name] || nextTierRow.tier_name,
      to_next: needed,
      percent: Math.max(0, Math.min(100, range > 0 ? (filled / range) * 100 : 100)),
    };
  }

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
      lifetime_points: customer.lifetime_points || 0,
      tier_vi: TIER_VI_MAP[customer.loyalty_tier] || TIER_VI_MAP['bronze'],
      balance,
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

export async function processOrderLoyalty(orderId: string, env: Record<string, unknown>) {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<Record<string, unknown>>();
  if (!order) { return { ok: false, reason: 'order_not_found' }; }

  if (!order.customer_phone) {
    log.info('Order skip loyalty (no phone)', { order_id: orderId });
    return { ok: false, reason: 'no_customer' };
  }

  const existingEarn = await db.prepare(
    'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'earn\' LIMIT 1'
  ).bind(orderId).first<{ id: string }>();
  if (existingEarn) {
    return { ok: false, reason: 'already_processed', existing_id: existingEarn.id };
  }

  const total = (order.total_amount || order.total || 0) as number;
  if (total < MIN_ORDER_TO_EARN) {
    return { ok: false, reason: 'below_min_order', min: MIN_ORDER_TO_EARN };
  }

  const customer = await db.prepare(
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
  ).bind(order.customer_phone).first<Customer>();
  if (!customer) { return { ok: false, reason: 'customer_not_found' }; }

  const tier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
    .bind(customer.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();
  if (!tier) { return { ok: false, reason: 'tier_not_found' }; }

  const now = nowSqlTimestamp();
  const campaign = await getActiveCampaign(db);

  const multiplier = campaign?.cashback_multiplier ?? 1.0;
  const maxCap = campaign?.max_cap_per_customer_vnd ?? DEFAULT_MAX_CASHBACK_PER_TX;

  const cbUsed = (order.cashback_used || 0) as number;
  const baseRate = tier.cashback_rate;
  const rawCashback = Math.round((total - cbUsed) * baseRate * multiplier);
  const cashback = Math.min(rawCashback, maxCap);

  const points = Math.floor(total / 10000 * (tier.point_multiplier || 1));

  const expiresAt = calcExpiresAt(tier);

  let wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(customer.id).first<CashbackWallet>();
  if (!wallet) {
    const wid = genId('wal_');
    await db.prepare(
      'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
    ).bind(wid, customer.id, now, now).run();
    wallet = { id: wid, customer_id: customer.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const newBalance = (wallet.balance || 0) + cashback;
  const newPoints = (customer.loyalty_points || 0) + points;
  const newLifetimePoints = (customer.lifetime_points || 0) + points;

  try {
    await db.batch([
      db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ?').bind(newBalance, cashback, now, customer.id),
      db.prepare('INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, multiplier_applied, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(genId('cbt_'), wallet.id, customer.id, orderId, 'earn', cashback, newBalance, expiresAt, multiplier, campaign?.id || null, 'Cashback d?n #' + orderId.slice(0, 8) + (multiplier > 1 ? ' (x' + multiplier + ')' : ''), now),
      db.prepare('UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?').bind(newPoints, newLifetimePoints, now, customer.id),
      db.prepare('INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(genId('ptl_'), customer.id, orderId, points, 'purchase', newPoints, 'Tich di?m d?n #' + orderId.slice(0, 8), now),
      db.prepare('INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(customer.id, 'cashback_earn', cashback, orderId, JSON.stringify({ tier: tier.tier_name, base_rate: tier.cashback_rate, multiplier, campaign: campaign?.code || null, raw_cashback: rawCashback, capped: cashback < rawCashback, cap_used: maxCap }), now),
      db.prepare('UPDATE orders SET cashback_earned = ?, points_earned = ? WHERE id = ?').bind(cashback, points, orderId),
    ]);
  } catch (err) {
    const errMsg = (err as Error).message || '';
    if (errMsg.includes('UNIQUE') || errMsg.includes('constraint')) {
      log.info('processOrderLoyalty: UNIQUE constraint, idempotent skip', { order_id: orderId });
      return { ok: false, reason: 'already_processed' };
    }
    log.error('processOrderLoyalty batch error:', { message: errMsg });
    throw err;
  }

  try {
    const { processReferralOnFirstOrder } = await import('./referrals');
    await processReferralOnFirstOrder(db, customer.id);
  } catch (refErr) {
    log.error('Error processing referral on first order:', { message: (refErr as Error).message });
  }

  let tierUpgraded = false;
  let newTierName = customer.loyalty_tier;

  const nextTier = await db.prepare('SELECT tier_name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1').bind(newLifetimePoints).first<{ tier_name: string }>();
  if (nextTier && nextTier.tier_name !== customer.loyalty_tier) {
    newTierName = nextTier.tier_name;
    tierUpgraded = true;
    await db.prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?').bind(newTierName, now, customer.id).run();
    await db.batch([
      db.prepare('INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(genId('ptl_'), customer.id, 0, 'tier_upgrade', newPoints, 'Nang hang len ' + newTierName, now),
      db.prepare('INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(customer.id, 'tier_upgrade', null, orderId, JSON.stringify({ from: customer.loyalty_tier, to: newTierName, reason: 'points_threshold', points: newPoints, lifetime_points: newLifetimePoints }), now),
    ]);
  }

  const { notifyMember } = await import('./zalo.js');
  notifyMember(env as Record<string, unknown>, {
    customer_id: customer.id,
    template_key: 'cashback_earned',
    data: { amount: cashback, balance: newBalance, order_id: orderId },
  }).catch(() => {});

  if (tierUpgraded) {
    const upgradedTier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?').bind(newTierName).first<Record<string, unknown>>().catch(() => null);
    notifyMember(env as Record<string, unknown>, {
      customer_id: customer.id,
      template_key: 'tier_upgrade',
      data: {
        new_tier_vi: upgradedTier?.display_name_vi || newTierName,
        new_rate: upgradedTier?.cashback_rate || 0,
      },
    }).catch(() => {});

    (async () => {
      try {
        const mapping = await db.prepare('SELECT erpnext_id FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1').bind('customer', customer.id).first<{ erpnext_id: string }>();
        if (!mapping) { return; }
        const consent = await db.prepare('SELECT consent_erpnext_sync FROM customers WHERE id = ? AND consent_erpnext_sync = 1 LIMIT 1').bind(customer.id).first<{ consent_erpnext_sync: number }>();
        if (!consent) { return; }
        const { createErpnextCrmClient } = await import('../clients/erpnext-crm-client.js');
        const crm = createErpnextCrmClient(env);
        if (!crm) { return; }
        const TIER_TAGS: Record<string, string> = { bronze: 'Loyalty_Bronze', silver: 'Loyalty_Silver', gold: 'Loyalty_Gold', platinum: 'Loyalty_Platinum' };
        const oldTag = TIER_TAGS[customer.loyalty_tier];
        const newTag = TIER_TAGS[newTierName];
        if (oldTag && oldTag !== newTag) { await crm.removeTag(mapping.erpnext_id, oldTag); }
        if (newTag) { await crm.addTag(mapping.erpnext_id, newTag); }
      } catch (e) {
        log.error('ERPNext tier-tag sync:', { message: (e as Error).message });
      }
    })();
  }

  return {
    cashback, points, wallet_balance: newBalance, total_points: newPoints,
    lifetime_points: newLifetimePoints, tier: newTierName, tier_upgraded: tierUpgraded,
    multiplier_applied: multiplier, campaign_code: campaign?.code || null, expires_at: expiresAt,
  };
}
