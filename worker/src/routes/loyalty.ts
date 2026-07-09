/**
 * Loyalty Routes — /api/loyalty
 * Thin Hono router — handler bodies extracted to tree/loyalty/.
 */

import { Hono } from 'hono';
import { createLogger } from '../middleware/logger';
import { redeemRewardSchema } from '../lib/validators';
import type { Env } from '../types/env';
import type { Customer } from '../types/models';

import { genId } from '../tree/loyalty/helpers';
import { getActiveCampaign } from '../tree/loyalty/campaign';
import { authCustomer } from '../tree/loyalty/auth-middleware';
import { handlePhoneAuth } from '../tree/loyalty/phone-auth-handler';
import { handleSummary } from '../tree/loyalty/summary-handler';
import { handleSpendCashback } from '../tree/loyalty/spend-cashback-handler';
import { handleLookup } from '../tree/loyalty/lookup-handler';

const log = createLogger({ route: 'loyalty' });
export const loyaltyRouter = new Hono<{ Bindings: Env }>();

loyaltyRouter.use('/*', authCustomer);

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
loyaltyRouter.get('/summary', handleSummary);
loyaltyRouter.post('/spend-cashback', handleSpendCashback);
loyaltyRouter.get('/lookup', handleLookup);

loyaltyRouter.get('/points', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const { results } = await c.env.AURA_DB.prepare(
    'SELECT * FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(cust.id, limit, offset).all();

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

  const { results } = await c.env.AURA_DB.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/rewards', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  const { results: allRewards } = await db.prepare('SELECT * FROM rewards ORDER BY point_cost ASC').all<{ id: string; title: string; point_cost: number }>();

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
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
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
  ).bind(genId('ptl_'), cust.id, -reward.point_cost, 'redeem', newPts, `D?i: ${reward.title}`, now).run();

  const code = `${reward.title.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

  await db.prepare(
    'INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('uwr_'), cust.id, reward_id, code, 'active', expiresAt, now).run();

  return c.json({
    success: true,
    data: { code, reward: reward.title, points_spent: reward.point_cost, points_remaining: newPts, expires_at: expiresAt }
  });
});

loyaltyRouter.get('/my-rewards', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const { results } = await c.env.AURA_DB.prepare(
    'SELECT ur.*, r.title, r.discount_type, r.discount_value FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
  ).bind(cust.id).all();

  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/tiers', async(c) => {
  const { results } = await c.env.AURA_DB.prepare('SELECT * FROM loyalty_tiers ORDER BY min_points ASC').all();
  return c.json({ success: true, data: results });
});

// Re-exports for backward compat with orders.ts, refunds.ts, and tests
export { processOrderLoyalty, deductPointsForRefund } from '../tree/loyalty/process-order';
