/**
 * Loyalty Routes — /api/loyalty
 * Thin Hono router — handler bodies extracted to tree/loyalty/.
 */

import { Hono } from 'hono';
import { redeemRewardSchema, zodErrorResponse } from '../lib/validators';
import { resolvePilotStore } from '../lib/pilot-store';
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
import { rateLimitMiddleware, LOYALTY_REDEEM_RATE_LIMIT, CASHBACK_SPEND_RATE_LIMIT } from '../middleware/rate-limit';

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
  const headerTenant = (c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id') || '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (headerTenant && headerTenant !== '*' ? headerTenant : 'default');
  const campaign = await getActiveCampaign(c.env.AURA_DB, storeTenant);
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
loyaltyRouter.post('/spend-cashback', rateLimitMiddleware(CASHBACK_SPEND_RATE_LIMIT), handleSpendCashback);
loyaltyRouter.get('/lookup', handleLookup);

loyaltyRouter.get('/points', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' ? rawCustTenant : 'default');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(
      'SELECT id, points_change, reason, balance_after, description, created_at, tenant_id FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(cust.id, limit, offset).all();
    results = res.results || [];
  } catch {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT id, points_change, reason, balance_after, description, created_at FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(cust.id, limit, offset).all();
      results = res.results || [];
    } catch {
      results = [];
    }
  }
  if (results.length === 0) {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT id, customer_id, points AS points_change, type AS reason, balance_after, description, created_at, tenant_id FROM loyalty_transactions WHERE customer_id = ? OR account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(cust.id, `la_${cust.id}`, limit, offset).all();
      results = res.results || [];
    } catch {
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
  }

  const scopedResults = (results || []).filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const rec = row as Record<string, unknown>;
    if ('tenant_id' in rec && rec.tenant_id !== undefined && rec.tenant_id !== null) {
      const rowTenant = String(rec.tenant_id).trim() || 'default';
      return rowTenant === storeTenant;
    }
    return true;
  });

  return c.json({ success: true, data: scopedResults });
});

loyaltyRouter.get('/cashback', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' ? rawCustTenant : 'default');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const type = c.req.query('type');

  let wallet: { id: string } | null = null;
  try {
    wallet = await c.env.AURA_DB.prepare(
      "SELECT id FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    )
      .bind(cust.id, storeTenant).first<{ id: string }>();
  } catch {
    wallet = await c.env.AURA_DB.prepare('SELECT id FROM cashback_wallets WHERE customer_id = ?')
      .bind(cust.id).first<{ id: string }>();
  }

  if (!wallet) {
    return c.json({ success: true, data: [] });
  }

  let query = 'SELECT id, type, amount, balance_after, description, created_at FROM cashback_transactions WHERE wallet_id = ?';
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
    let fallbackQuery = 'SELECT id, type, amount, balance_after, description, created_at FROM cashback_transactions WHERE customer_id = ?';
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
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' ? rawCustTenant : 'default');
  const db = c.env.AURA_DB;

  const filterTenantReward = (r: { id: string; title: string; point_cost: number }) => {
    const rec = r as unknown as Record<string, unknown>;
    if ('is_active' in rec && rec.is_active !== undefined && Number(rec.is_active) === 0) {
      return false;
    }
    if ('tenant_id' in rec && rec.tenant_id !== undefined) {
      const rowTenant = String(rec.tenant_id ?? '').trim() || 'default';
      return rowTenant === storeTenant;
    }
    return true;
  };

  let allRewards: Array<{ id: string; title: string; point_cost: number }> = [];
  try {
    const res = await db.prepare('SELECT * FROM rewards ORDER BY point_cost ASC').all<{ id: string; title: string; point_cost: number }>();
    allRewards = (res.results || []).filter(filterTenantReward);
  } catch {
    allRewards = [];
  }
  if (allRewards.length === 0) {
    try {
      const res = await db.prepare(
        'SELECT id, name AS title, points_cost AS point_cost, description, type AS discount_type, value AS discount_value, is_active, tenant_id FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
      ).all<{ id: string; title: string; point_cost: number }>();
      allRewards = (res.results || []).filter(filterTenantReward);
    } catch {
      try {
        const res = await db.prepare(
          'SELECT id, name AS title, points_cost AS point_cost, description, type AS discount_type, value AS discount_value, is_active FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
        ).all<{ id: string; title: string; point_cost: number }>();
        allRewards = (res.results || []).filter(filterTenantReward);
      } catch {
        const res = await db.prepare(
          'SELECT id, name AS title, points_cost AS point_cost, description, reward_type AS discount_type, reward_value AS discount_value, is_active FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
        ).all<{ id: string; title: string; point_cost: number }>();
        allRewards = (res.results || []).filter(filterTenantReward);
      }
    }
  }

  const tenantRewards = allRewards;

  const pts = cust.loyalty_points || 0;
  const data = tenantRewards.map(r => ({ ...r, can_redeem: pts >= r.point_cost }));

  return c.json({ success: true, data });
});

loyaltyRouter.post('/redeem', rateLimitMiddleware(LOYALTY_REDEEM_RATE_LIMIT), async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' ? rawCustTenant : 'default');
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemRewardSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { reward_id } = parsed.data;

  let fromLegacyRewards = false;
  let reward: { id: string; title: string; point_cost: number } | null = null;
  try {
    reward = await db.prepare('SELECT * FROM rewards WHERE id = ?').bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
    if (reward) fromLegacyRewards = true;
  } catch {
    reward = null;
  }
  if (!reward) {
    try {
      reward = await db.prepare(
        'SELECT id, name AS title, points_cost AS point_cost, max_redemptions, current_redemptions, stock, valid_from, valid_to, min_tier, is_active, tenant_id FROM loyalty_rewards WHERE id = ? AND is_active = 1'
      ).bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
    } catch {
      try {
        reward = await db.prepare(
          'SELECT id, name AS title, points_cost AS point_cost, max_redemptions, current_redemptions, stock, is_active, tenant_id FROM loyalty_rewards WHERE id = ? AND is_active = 1'
        ).bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
      } catch {
        reward = await db.prepare(
          'SELECT id, name AS title, points_cost AS point_cost FROM loyalty_rewards WHERE id = ? AND is_active = 1'
        ).bind(reward_id).first<{ id: string; title: string; point_cost: number }>().catch(() => null);
      }
    }
  }
  if (!reward) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }
  const rewardRec = reward as unknown as Record<string, unknown>;
  if ('is_active' in rewardRec && rewardRec.is_active !== undefined && Number(rewardRec.is_active) === 0) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }
  if ('tenant_id' in rewardRec && rewardRec.tenant_id !== undefined) {
    const rewardTenant = String(rewardRec.tenant_id ?? '').trim() || 'default';
    if (rewardTenant !== storeTenant) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }
  }
  const nowIso = new Date().toISOString();
  if (typeof rewardRec.valid_from === 'string' && rewardRec.valid_from.trim() && nowIso < rewardRec.valid_from.trim()) {
    return c.json({ success: false, error: 'Reward is not yet active' }, 400);
  }
  if (typeof rewardRec.valid_to === 'string' && rewardRec.valid_to.trim() && nowIso > rewardRec.valid_to.trim()) {
    return c.json({ success: false, error: 'Reward has expired' }, 400);
  }
  if (typeof rewardRec.min_tier === 'string' && rewardRec.min_tier.trim()) {
    const tierRank: Record<string, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
    const reqRank = tierRank[rewardRec.min_tier.trim().toLowerCase()] ?? 0;
    const custTierRaw = String(cust.loyalty_tier || (custRecord?.tier as string) || 'bronze').trim().toLowerCase();
    const custRank = tierRank[custTierRaw] ?? 1;
    if (reqRank > custRank) {
      return c.json({ success: false, error: 'Tier requirement not met for this reward' }, 403);
    }
  }
  if (typeof rewardRec.stock === 'number' && rewardRec.stock === 0) {
    return c.json({ success: false, error: 'Reward out of stock' }, 409);
  }
  if (
    typeof rewardRec.max_redemptions === 'number' &&
    rewardRec.max_redemptions > 0 &&
    Number(rewardRec.current_redemptions ?? rewardRec.redeemed_count ?? 0) >= rewardRec.max_redemptions
  ) {
    return c.json({ success: false, error: 'Reward redemption limit reached' }, 409);
  }

  const pts = cust.loyalty_points || 0;
  if (pts < reward.point_cost) {
    return c.json({ success: false, error: 'Không du diem', needed: reward.point_cost, current: pts }, 400);
  }

  let newPts = pts - reward.point_cost;
  const now = new Date().toISOString();
  let deductRes: unknown;
  try {
    deductRes = await db.prepare(
      "UPDATE customers SET loyalty_points = loyalty_points - ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND COALESCE(loyalty_points, 0) >= ?"
    ).bind(reward.point_cost, now, cust.id, storeTenant, reward.point_cost).run();
  } catch {
    try {
      deductRes = await db.prepare(
        'UPDATE customers SET loyalty_points = loyalty_points - ?, updated_at = ? WHERE id = ? AND COALESCE(loyalty_points, 0) >= ?'
      ).bind(reward.point_cost, now, cust.id, reward.point_cost).run();
    } catch {
      deductRes = await db.prepare(
        'UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ? AND COALESCE(loyalty_points, 0) >= ?'
      ).bind(reward.point_cost, cust.id, reward.point_cost).run();
    }
  }
  const deductChanges = (deductRes as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 1;
  if (deductChanges === 0) {
    return c.json({ success: false, error: 'Không du diem', needed: reward.point_cost, current: pts }, 409);
  }
  const postCust = await db.prepare('SELECT loyalty_points FROM customers WHERE id = ?').bind(cust.id).first<{ loyalty_points?: number }>().catch(() => null);
  if (typeof postCust?.loyalty_points === 'number') {
    newPts = Number(postCust.loyalty_points);
  }
  await db.prepare(
    "UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?), last_activity_at = ?, updated_at = ? WHERE (customer_id = ? OR id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
  ).bind(reward.point_cost, now, now, cust.id, `la_${cust.id}`, storeTenant).run().catch(() =>
    db.prepare(
      'UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?), last_activity_at = ?, updated_at = ? WHERE customer_id = ? OR id = ?'
    ).bind(reward.point_cost, now, now, cust.id, `la_${cust.id}`).run().catch(() => {})
  );
  if (typeof rewardRec.stock === 'number' && rewardRec.stock > 0) {
    const stockRes = await db.prepare(
      "UPDATE rewards SET stock = MAX(0, stock - 1), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND (stock IS NULL OR stock = -1 OR stock >= 1)"
    ).bind(now, reward_id, storeTenant).run().catch(() =>
      db.prepare('UPDATE rewards SET stock = MAX(0, stock - 1), updated_at = ? WHERE id = ? AND (stock IS NULL OR stock = -1 OR stock >= 1)').bind(now, reward_id).run().catch(() => null)
    );
    const stockChanges = (stockRes as { meta?: { changes?: number } } | null)?.meta?.changes ?? 1;
    if (fromLegacyRewards && stockChanges === 0) {
      await db.prepare(
        'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, updated_at = ? WHERE id = ?'
      ).bind(reward.point_cost, now, cust.id).run().catch(() => {});
      return c.json({ success: false, error: 'Reward out of stock' }, 409);
    }
  }
  const lrUpdateRes = await db.prepare(
    "UPDATE loyalty_rewards SET current_redemptions = COALESCE(current_redemptions, 0) + 1, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND (max_redemptions IS NULL OR max_redemptions <= 0 OR COALESCE(current_redemptions, 0) < max_redemptions) AND (stock IS NULL OR stock = -1 OR stock >= 1)"
  ).bind(now, reward_id, storeTenant).run().catch(() =>
    db.prepare(
      'UPDATE loyalty_rewards SET current_redemptions = COALESCE(current_redemptions, 0) + 1, updated_at = ? WHERE id = ? AND (max_redemptions IS NULL OR max_redemptions <= 0 OR COALESCE(current_redemptions, 0) < max_redemptions)'
    ).bind(now, reward_id).run().catch(() =>
      db.prepare('UPDATE loyalty_rewards SET current_redemptions = COALESCE(current_redemptions, 0) + 1, updated_at = ? WHERE id = ?').bind(now, reward_id).run().catch(() => null)
    )
  );
  const lrChanges = (lrUpdateRes as { meta?: { changes?: number } } | null)?.meta?.changes ?? 1;
  if (
    !fromLegacyRewards &&
    (typeof rewardRec.max_redemptions === 'number' || typeof rewardRec.stock === 'number') &&
    lrChanges === 0
  ) {
    await db.prepare(
      'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, updated_at = ? WHERE id = ?'
    ).bind(reward.point_cost, now, cust.id).run().catch(() => {});
    return c.json({ success: false, error: 'Reward redemption limit reached' }, 409);
  }

  const logId = genId('ptl_');
  try {
    await db.prepare(
      'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(logId, cust.id, -reward.point_cost, 'redeem', newPts, `D?i: ${reward.title}`, now).run();
    if (storeTenant && storeTenant !== '*') {
      await db.prepare('UPDATE loyalty_point_logs SET tenant_id = ? WHERE id = ?').bind(storeTenant, logId).run().catch(() => {});
    }
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
  if (storeTenant && storeTenant !== '*') {
    await db.prepare('UPDATE loyalty_transactions SET tenant_id = ? WHERE id = ?').bind(storeTenant, logId).run().catch(() => {});
  }

  const codeRand = new Uint8Array(3);
  crypto.getRandomValues(codeRand);
  const codeSuffix = Array.from(codeRand, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const code = `${reward.title.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}${codeSuffix}`;
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const redemptionId = genId('uwr_');

  try {
    await db.prepare(
      `INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, created_at)
       SELECT ?, ?, ?, ?, 'active', ?, ?
       WHERE EXISTS (SELECT 1 FROM rewards WHERE id = ?)`
    ).bind(redemptionId, cust.id, reward_id, code, expiresAt, now, reward_id).run();
    if (storeTenant && storeTenant !== '*') {
      await db.prepare('UPDATE user_rewards SET tenant_id = ? WHERE id = ?').bind(storeTenant, redemptionId).run().catch(() => {});
    }
  } catch {
    // Ignore when user_rewards is absent
  }
  await db.prepare(
    `INSERT OR IGNORE INTO loyalty_redemptions (id, customer_id, reward_id, code, points_spent, status, expires_at, redeemed_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  ).bind(redemptionId, cust.id, reward_id, code, reward.point_cost, expiresAt, now, now).run().catch(() => {});
  if (storeTenant && storeTenant !== '*') {
    await db.prepare('UPDATE loyalty_redemptions SET tenant_id = ? WHERE id = ?').bind(storeTenant, redemptionId).run().catch(() => {});
  }

  return c.json({
    success: true,
    data: { code, reward: reward.title, points_spent: reward.point_cost, points_remaining: newPts, expires_at: expiresAt }
  });
});

loyaltyRouter.get('/my-rewards', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' ? rawCustTenant : 'default');
  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(
      'SELECT ur.*, COALESCE(r.title, lr.name) AS title, COALESCE(r.discount_type, lr.type) AS discount_type, COALESCE(r.discount_value, lr.value) AS discount_value, r.tenant_id AS r_tenant_id, lr.tenant_id AS lr_tenant_id FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id LEFT JOIN loyalty_rewards lr ON ur.reward_id = lr.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
    ).bind(cust.id).all();
    results = res.results || [];
  } catch {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT ur.*, COALESCE(r.title, lr.name) AS title, COALESCE(r.discount_type, lr.type) AS discount_type, COALESCE(r.discount_value, lr.value) AS discount_value FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id LEFT JOIN loyalty_rewards lr ON ur.reward_id = lr.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
      ).bind(cust.id).all();
      results = res.results || [];
    } catch {
      results = [];
    }
  }
  if (results.length === 0) {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT lr.*, COALESCE(r.name, rw.title) AS title, COALESCE(r.type, rw.discount_type) AS discount_type, COALESCE(r.value, rw.discount_value) AS discount_value, r.tenant_id AS r_tenant_id, rw.tenant_id AS rw_tenant_id FROM loyalty_redemptions lr LEFT JOIN loyalty_rewards r ON lr.reward_id = r.id LEFT JOIN rewards rw ON lr.reward_id = rw.id WHERE lr.customer_id = ? ORDER BY lr.created_at DESC LIMIT 20'
      ).bind(cust.id).all();
      results = res.results || [];
    } catch {
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
  }

  const scopedResults = (results || []).filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const rec = row as Record<string, unknown>;
    if ('tenant_id' in rec && rec.tenant_id !== undefined && rec.tenant_id !== null) {
      const rowTenant = String(rec.tenant_id).trim() || 'default';
      if (rowTenant !== storeTenant) return false;
    }
    const rewardTenantRaw = rec.r_tenant_id ?? rec.lr_tenant_id ?? rec.rw_tenant_id;
    if (rewardTenantRaw !== undefined && rewardTenantRaw !== null) {
      const rewardTenant = String(rewardTenantRaw).trim() || 'default';
      if (rewardTenant !== storeTenant) return false;
    }
    return true;
  });

  return c.json({ success: true, data: scopedResults });
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
