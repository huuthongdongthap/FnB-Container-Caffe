/**
 * Loyalty Routes — /api/loyalty
 * Thin Hono router — helpers + processOrderLoyalty extracted to tree/loyalty/.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { createLogger } from '../middleware/logger';
import { generateJWT, verifyJWT } from '../lib/jwt';
import { phoneAuthSchema, spendCashbackSchema, redeemRewardSchema } from '../lib/validators';
import type { Env } from '../types/env';
import type { Customer, CashbackWallet, LoyaltyTier, BonusCampaign } from '../types/models';

import { genId, nowSqlTimestamp, throttle } from '../tree/loyalty/helpers';
import { getActiveCampaign, calcExpiresAt } from '../tree/loyalty/campaign';
import { authCustomer } from '../tree/loyalty/auth-middleware';

const log = createLogger({ route: 'loyalty' });
export const loyaltyRouter = new Hono<{ Bindings: Env }>();

const MIN_ORDER_TO_EARN = 20000;
const MIN_ORDER_TO_SPEND = 20000;
const DEFAULT_MAX_CASHBACK_PER_TX = 50000;
const DEFAULT_TIER = 'bronze';
const TIER_VI_MAP: Record<string, string> = { bronze: 'DGng', silver: 'B?c', gold: 'VAng', platinum: 'B?ch Kim' };

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

    const body = await c.req.json() as Record<string, unknown>;
    const parsed = phoneAuthSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const validated = parsed.data;
    const phone = validated.phone.replace(/\s+/g, '');
    const dob = validated.dob || null;
    const zalo = (validated.zalo || '').replace(/\s+/g, '') || null;
    const source = validated.source || 'unknown';

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
      const name = validated.name || 'Thành viên';
      await db.prepare(
        'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, date_of_birth, zalo, source, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)'
      ).bind(id, email, name, phone, DEFAULT_TIER, dob, zalo, source, now, now).run();

      const wid = genId('wal_');
      await db.prepare(
        'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
      ).bind(wid, id, now, now).run();

      customer = { id, email, name, phone, loyalty_points: 0, lifetime_points: 0, loyalty_tier: DEFAULT_TIER, created_at: now } as Customer;

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

      if (validated.referral_code) {
        const { applyReferralForNewCustomer } = await import('./referrals');
        c.executionCtx?.waitUntil?.(
          applyReferralForNewCustomer(db, id, validated.referral_code).catch(e =>
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
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = spendCashbackSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const { order_id, amount } = parsed.data;

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
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemRewardSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const { reward_id } = parsed.data;

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

// Re-export processOrderLoyalty for backward compat with orders.ts and tests
export { processOrderLoyalty } from '../tree/loyalty/process-order';
