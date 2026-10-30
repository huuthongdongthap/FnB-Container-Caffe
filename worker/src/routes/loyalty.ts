/**
 * Loyalty Routes — /api/loyalty
 * Thin Hono router — handler bodies extracted to tree/loyalty/.
 */

import { Hono } from 'hono';
import { redeemRewardSchema, zodErrorResponse } from '../lib/validators';
import type { Env } from '../types/env';
import type { Customer } from '../types/models';

import { genId } from '../tree/loyalty/helpers';
import { getActiveCampaign } from '../tree/loyalty/campaign';
import { authCustomer } from '../tree/loyalty/auth-middleware';
import { handlePhoneAuth } from '../tree/loyalty/phone-auth-handler';
import { handlePhoneOtpRequest } from '../tree/loyalty/phone-otp-handler';
import { handleSummary } from '../tree/loyalty/summary-handler';
import { handleSpendCashback } from '../tree/loyalty/spend-cashback-handler';
import { handleLookup } from '../tree/loyalty/lookup-handler';

export const loyaltyRouter = new Hono<{ Bindings: Env }>();

const LEGACY_LOYALTY_PATHS = new Set([
  '/active-campaign',
  '/phone-auth',
  '/phone-otp/request',
  '/summary',
  '/spend-cashback',
  '/lookup',
  '/points',
  '/cashback',
  '/redeem',
  '/my-rewards',
  '/tiers',
]);

loyaltyRouter.use('/*', async (c, next) => {
  const pathSegments = c.req.path.split('/').filter(Boolean);
  const relPath = pathSegments[0] === 'api' && pathSegments[1] === 'loyalty'
    ? `/${pathSegments.slice(2).join('/')}`
    : `/${pathSegments.join('/')}`;
  const isLegacyRoute =
    LEGACY_LOYALTY_PATHS.has(relPath) ||
    (relPath === '/rewards' && c.req.method === 'GET');
  if (!isLegacyRoute) {
    await next();
    return;
  }
  return authCustomer(c, next);
});

loyaltyRouter.get('/active-campaign', async(c) => {
  const campaign = await getActiveCampaign(c.env.AURA_DB);
  if (!campaign) {
    return c.json({ success: true, campaign: null });
  }
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
      end_date: campaign.end_date
    }
  });
});

loyaltyRouter.post('/phone-auth', handlePhoneAuth);
loyaltyRouter.post('/phone-otp/request', handlePhoneOtpRequest);
loyaltyRouter.get('/summary', handleSummary);
loyaltyRouter.post('/spend-cashback', handleSpendCashback);
loyaltyRouter.get('/lookup', handleLookup);

loyaltyRouter.get('/points', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(
      'SELECT * FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(cust.id, limit, offset).all();
    results = res.results || [];
  } catch {
    results = [];
  }
  if (results.length === 0) {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT id, customer_id, points AS points_change, type AS reason, balance_after, description, created_at FROM loyalty_transactions WHERE customer_id = ? OR account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(cust.id, `la_${cust.id}`, limit, offset).all();
      results = res.results || [];
    } catch {
      const res = await c.env.AURA_DB.prepare(
        'SELECT id, customer_id, points AS points_change, type AS reason, description, created_at FROM loyalty_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(cust.id, limit, offset).all().catch(() => ({ results: [] }));
      results = res.results || [];
    }
  }

  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/cashback', async(c) => {
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

  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(query).bind(...params).all();
    results = res.results || [];
  } catch {
    let fallbackQuery = 'SELECT * FROM cashback_transactions WHERE customer_id = ?';
    const fallbackParams: unknown[] = [cust.id];
    if (type) {
      fallbackQuery += ' AND type = ?';
      fallbackParams.push(type);
    }
    fallbackQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    fallbackParams.push(limit, offset);
    const res = await c.env.AURA_DB.prepare(fallbackQuery).bind(...fallbackParams).all();
    results = res.results || [];
  }
  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/rewards', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  let allRewards: Array<{ id: string; title: string; point_cost: number }> = [];
  try {
    const res = await db.prepare('SELECT * FROM rewards ORDER BY point_cost ASC').all<{ id: string; title: string; point_cost: number }>();
    allRewards = res.results || [];
  } catch {
    allRewards = [];
  }
  if (allRewards.length === 0) {
    try {
      const res = await db.prepare(
        'SELECT id, name AS title, points_cost AS point_cost, description, type AS discount_type, value AS discount_value, is_active FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
      ).all<{ id: string; title: string; point_cost: number }>();
      allRewards = res.results || [];
    } catch {
      const res = await db.prepare(
        'SELECT id, name AS title, points_cost AS point_cost, description, reward_type AS discount_type, reward_value AS discount_value, is_active FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
      ).all<{ id: string; title: string; point_cost: number }>();
      allRewards = res.results || [];
    }
  }

  const pts = cust.loyalty_points || 0;
  const data = (allRewards || []).map(r => ({ ...r, can_redeem: pts >= r.point_cost }));

  return c.json({ success: true, data });
});

loyaltyRouter.post('/redeem', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemRewardSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { reward_id } = parsed.data;

  let reward: { id: string; title: string; point_cost: number } | null = null;
  try {
    reward = await db.prepare('SELECT * FROM rewards WHERE id = ?').bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
  } catch {
    reward = null;
  }
  if (!reward) {
    reward = await db.prepare(
      'SELECT id, name AS title, points_cost AS point_cost FROM loyalty_rewards WHERE id = ? AND is_active = 1'
    ).bind(reward_id).first<{ id: string; title: string; point_cost: number }>().catch(() => null);
  }
  if (!reward) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }

  const pts = cust.loyalty_points || 0;
  if (pts < reward.point_cost) {
    return c.json({ success: false, error: 'Không du diem', needed: reward.point_cost, current: pts }, 400);
  }

  const newPts = pts - reward.point_cost;
  const now = new Date().toISOString();
  try {
    await db.prepare('UPDATE customers SET loyalty_points = ?, updated_at = ? WHERE id = ?').bind(newPts, now, cust.id).run();
  } catch {
    await db.prepare('UPDATE customers SET loyalty_points = ? WHERE id = ?').bind(newPts, cust.id).run();
  }
  await db.prepare(
    'UPDATE loyalty_accounts SET current_points = ?, last_activity_at = ?, updated_at = ? WHERE customer_id = ? OR id = ?'
  ).bind(newPts, now, now, cust.id, `la_${cust.id}`).run().catch(() => {});

  const logId = genId('ptl_');
  try {
    await db.prepare(
      'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(logId, cust.id, -reward.point_cost, 'redeem', newPts, `D?i: ${reward.title}`, now).run();
  } catch {
    // Ignore when loyalty_point_logs is absent
  }
  try {
    await db.prepare(
      'INSERT OR IGNORE INTO loyalty_transactions (id, account_id, customer_id, points, type, reason, balance_after, description, reward_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(logId, `la_${cust.id}`, cust.id, -reward.point_cost, 'redeem', 'redeem', newPts, `D?i: ${reward.title}`, reward_id, now).run();
  } catch {
    await db.prepare(
      'INSERT OR IGNORE INTO loyalty_transactions (id, customer_id, points, type, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(logId, cust.id, -reward.point_cost, 'redeem', `D?i: ${reward.title}`, now).run().catch(() => {});
  }

  const code = `${reward.title.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const redemptionId = genId('uwr_');

  try {
    await db.prepare(
      `INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, created_at)
       SELECT ?, ?, ?, ?, 'active', ?, ?
       WHERE EXISTS (SELECT 1 FROM rewards WHERE id = ?)`
    ).bind(redemptionId, cust.id, reward_id, code, expiresAt, now, reward_id).run();
  } catch {
    // Ignore when user_rewards is absent
  }
  await db.prepare(
    `INSERT OR IGNORE INTO loyalty_redemptions (id, customer_id, reward_id, code, points_spent, status, expires_at, redeemed_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  ).bind(redemptionId, cust.id, reward_id, code, reward.point_cost, expiresAt, now, now).run().catch(() => {});

  return c.json({
    success: true,
    data: { code, reward: reward.title, points_spent: reward.point_cost, points_remaining: newPts, expires_at: expiresAt }
  });
});

loyaltyRouter.get('/my-rewards', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(
      'SELECT ur.*, COALESCE(r.title, lr.name) AS title, COALESCE(r.discount_type, lr.type) AS discount_type, COALESCE(r.discount_value, lr.value) AS discount_value FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id LEFT JOIN loyalty_rewards lr ON ur.reward_id = lr.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
    ).bind(cust.id).all();
    results = res.results || [];
  } catch {
    results = [];
  }
  if (results.length === 0) {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT lr.*, COALESCE(r.name, rw.title) AS title, COALESCE(r.type, rw.discount_type) AS discount_type, COALESCE(r.value, rw.discount_value) AS discount_value FROM loyalty_redemptions lr LEFT JOIN loyalty_rewards r ON lr.reward_id = r.id LEFT JOIN rewards rw ON lr.reward_id = rw.id WHERE lr.customer_id = ? ORDER BY lr.created_at DESC LIMIT 20'
      ).bind(cust.id).all();
      results = res.results || [];
    } catch {
      const res = await c.env.AURA_DB.prepare(
        'SELECT lr.*, r.name AS title, r.reward_type AS discount_type, r.reward_value AS discount_value FROM loyalty_redemptions lr LEFT JOIN loyalty_rewards r ON lr.reward_id = r.id WHERE lr.customer_id = ? ORDER BY lr.created_at DESC LIMIT 20'
      ).bind(cust.id).all().catch(() => ({ results: [] }));
      results = res.results || [];
    }
  }

  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/tiers', async(c) => {
  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare('SELECT * FROM loyalty_tiers ORDER BY min_points ASC').all();
    results = res.results || [];
  } catch {
    const res = await c.env.AURA_DB.prepare('SELECT tier AS tier_name, min_points, cashback_rate, points_multiplier, perks FROM tier_configs ORDER BY min_points ASC').all();
    results = res.results || [];
  }
  return c.json({ success: true, data: results });
});

// Re-exports for backward compat with orders.ts, refunds.ts, and tests
export { loadPolicy, applyAccrual, reverseAccrual } from '@aura/domain-crm';
