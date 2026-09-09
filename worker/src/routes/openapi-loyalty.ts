import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';
import { LoyaltyRoutes } from '../schemas/loyalty';

export const openApiLoyaltyRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiLoyaltyRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

// ============ TIERS ROUTES ============

// GET /api/loyalty/tiers - List all loyalty tier configurations
openApiLoyaltyRouter.openapi(LoyaltyRoutes.tiers.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;

  const tiers = await db.prepare('SELECT * FROM loyalty_tier_configs ORDER BY min_points ASC').all();

  return c.json({
    success: true,
    data: tiers.results,
  });
});

// GET /api/loyalty/tiers/{tier} - Get loyalty tier config by tier
openApiLoyaltyRouter.openapi(LoyaltyRoutes.tiers.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const { tier } = c.req.valid('param');

  const config = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();

  if (!config) {
    return c.json({ success: false, error: 'Tier config not found' }, 404);
  }

  return c.json({ success: true, data: config });
});

// PATCH /api/loyalty/tiers/{tier} - Update loyalty tier config
openApiLoyaltyRouter.openapi(LoyaltyRoutes.tiers.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { tier } = c.req.valid('param');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
  if (!existing) {
    return c.json({ success: false, error: 'Tier config not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | boolean)[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
  if (body.minPoints !== undefined) { updates.push('min_points = ?'); params.push(body.minPoints); }
  if (body.maxPoints !== undefined) { updates.push('max_points = ?'); params.push(body.maxPoints); }
  if (body.pointMultiplier !== undefined) { updates.push('point_multiplier = ?'); params.push(body.pointMultiplier); }
  if (body.discountPercent !== undefined) { updates.push('discount_percent = ?'); params.push(body.discountPercent); }
  if (body.birthdayBonus !== undefined) { updates.push('birthday_bonus = ?'); params.push(body.birthdayBonus); }
  if (body.freeShipping !== undefined) { updates.push('free_shipping = ?'); params.push(body.freeShipping ? 1 : 0); }
  if (body.prioritySupport !== undefined) { updates.push('priority_support = ?'); params.push(body.prioritySupport ? 1 : 0); }
  if (body.color !== undefined) { updates.push('color = ?'); params.push(body.color); }
  if (body.icon !== undefined) { updates.push('icon = ?'); params.push(body.icon); }
  if (body.benefits !== undefined) { updates.push('benefits = ?'); params.push(JSON.stringify(body.benefits)); }

  if (updates.length === 0) {
    return c.json({ success: true, data: existing });
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(tier);

  await db.prepare(`UPDATE loyalty_tier_configs SET ${updates.join(', ')} WHERE tier = ?`).bind(...params).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'loyalty_tier_update', 'loyalty_tier', tier, JSON.stringify(body), now).run();

  const config = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
  return c.json({ success: true, data: config });
});

// ============ ACCOUNT ROUTES ============

// GET /api/loyalty/account - Get current user's loyalty account
openApiLoyaltyRouter.openapi(LoyaltyRoutes.account.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');

  const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
    .bind(user.customerId || user.id).first();

  if (!account) {
    return c.json({ success: false, error: 'Account not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...account,
      currentPoints: account.current_points,
      lifetimePoints: account.lifetime_points,
      tierUpdatedAt: account.tier_updated_at,
      lastActivityAt: account.last_activity_at,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    },
  });
});

// GET /api/loyalty/account/transactions - Get loyalty transactions for current user
openApiLoyaltyRouter.openapi(LoyaltyRoutes.account.transactions, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const query = c.req.valid('query');

  const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
    .bind(user.customerId || user.id).first();

  if (!account) {
    return c.json({ success: false, error: 'Account not found' }, 404);
  }

  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE account_id = ?';
  const params: (string | number)[] = [account.id];

  if (query.type) {
    whereClause += ' AND type = ?';
    params.push(query.type);
  }

  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM loyalty_transactions ${whereClause}`).bind(...params).first();
  const total = countResult?.total || 0;

  const transactions = await db.prepare(
    `SELECT * FROM loyalty_transactions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    success: true,
    data: {
      transactions: transactions.results,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

// POST /api/loyalty/account/birthday-bonus - Claim birthday bonus points
openApiLoyaltyRouter.openapi(LoyaltyRoutes.account.claimBirthdayBonus, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const currentMonth = new Date().getMonth() + 1;

  const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
    .bind(user.customerId || user.id).first();

  if (!account) {
    return c.json({ success: false, error: 'No loyalty account found' }, 404);
  }

  // Check if already claimed this month
  const existingClaim = await db.prepare(
    `SELECT * FROM loyalty_transactions
     WHERE account_id = ? AND type = 'birthday' AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`
  ).bind(account.id, String(currentMonth).padStart(2, '0'), new Date().getFullYear()).first();

  if (existingClaim) {
    return c.json({ success: false, error: 'Birthday bonus already claimed this month' }, 400);
  }

  // Birthday bonus: configurable via tier config
  const tierConfig = await db.prepare('SELECT birthday_bonus FROM loyalty_tier_configs WHERE tier = ?')
    .bind(account.tier).first();
  const birthdayPoints = tierConfig?.birthday_bonus || 500;

  const transactionId = crypto.randomUUID();
  const idempotencyKey = body.idempotencyKey || `bday_${account.id}_${now.slice(0, 7)}`;

  await db.prepare(
    `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, description, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(transactionId, account.id, 'birthday', birthdayPoints, account.current_points + birthdayPoints, 'Birthday bonus', idempotencyKey, now).run();

  await db.prepare(
    'UPDATE loyalty_accounts SET current_points = current_points + ?, lifetime_points = lifetime_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
  ).bind(birthdayPoints, birthdayPoints, now, now, account.id).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'loyalty_birthday_claim', 'loyalty_account', account.id, JSON.stringify({ points: birthdayPoints }), now).run();

  return c.json({
    success: true,
    data: {
      points: birthdayPoints,
      newBalance: account.current_points + birthdayPoints,
    },
  });
});

// ============ REWARDS ROUTES ============

// GET /api/loyalty/rewards - List available rewards
openApiLoyaltyRouter.openapi(LoyaltyRoutes.rewards.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const query = c.req.valid('query');

  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number | boolean)[] = [];

  if (query.isActive !== undefined) {
    whereClause += ' AND is_active = ?';
    params.push(query.isActive ? 1 : 0);
  }

  if (query.type) {
    whereClause += ' AND type = ?';
    params.push(query.type);
  }

  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM loyalty_rewards ${whereClause}`).bind(...params).first();
  const total = countResult?.total || 0;

  const rewards = await db.prepare(
    `SELECT * FROM loyalty_rewards ${whereClause} ORDER BY points_cost ASC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    success: true,
    data: {
      rewards: rewards.results.map(r => ({
        ...r,
        pointsCost: r.points_cost,
        maxRedemptions: r.max_redemptions,
        currentRedemptions: r.current_redemptions,
        validFrom: r.valid_from,
        validTo: r.valid_to,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

// GET /api/loyalty/rewards/{id} - Get reward by ID
openApiLoyaltyRouter.openapi(LoyaltyRoutes.rewards.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const { id } = c.req.valid('param');

  const reward = await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first();

  if (!reward) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...reward,
      pointsCost: reward.points_cost,
      maxRedemptions: reward.max_redemptions,
      currentRedemptions: reward.current_redemptions,
      validFrom: reward.valid_from,
      validTo: reward.valid_to,
      isActive: reward.is_active,
      createdAt: reward.created_at,
      updatedAt: reward.updated_at,
    },
  });
});

// POST /api/loyalty/rewards - Create reward
openApiLoyaltyRouter.openapi(LoyaltyRoutes.rewards.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const id = crypto.randomUUID();

  await db.prepare(
    `INSERT INTO loyalty_rewards (id, name, description, points_cost, type, value, max_redemptions, current_redemptions, valid_from, valid_to, is_active, image_url, terms, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name,
    body.description || null,
    body.pointsCost,
    body.type,
    body.value,
    body.maxRedemptions || null,
    0,
    body.validFrom || null,
    body.validTo || null,
    body.isActive !== false ? 1 : 0,
    body.imageUrl || null,
    body.terms || null,
    now,
    now
  ).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'loyalty_reward_create', 'loyalty_reward', id, JSON.stringify(body), now).run();

  const reward = await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first();

  return c.json({
    success: true,
    data: {
      ...reward!,
      pointsCost: reward!.points_cost,
      maxRedemptions: reward!.max_redemptions,
      currentRedemptions: reward!.current_redemptions,
      validFrom: reward!.valid_from,
      validTo: reward!.valid_to,
      isActive: reward!.is_active,
      createdAt: reward!.created_at,
      updatedAt: reward!.updated_at,
    },
  }, 201);
});

// PATCH /api/loyalty/rewards/{id} - Update reward
openApiLoyaltyRouter.openapi(LoyaltyRoutes.rewards.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | boolean)[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
  if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
  if (body.pointsCost !== undefined) { updates.push('points_cost = ?'); params.push(body.pointsCost); }
  if (body.type !== undefined) { updates.push('type = ?'); params.push(body.type); }
  if (body.value !== undefined) { updates.push('value = ?'); params.push(body.value); }
  if (body.maxRedemptions !== undefined) { updates.push('max_redemptions = ?'); params.push(body.maxRedemptions); }
  if (body.validFrom !== undefined) { updates.push('valid_from = ?'); params.push(body.validFrom); }
  if (body.validTo !== undefined) { updates.push('valid_to = ?'); params.push(body.validTo); }
  if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
  if (body.imageUrl !== undefined) { updates.push('image_url = ?'); params.push(body.imageUrl); }
  if (body.terms !== undefined) { updates.push('terms = ?'); params.push(body.terms); }

  if (updates.length === 0) {
    return c.json({ success: true, data: existing });
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await db.prepare(`UPDATE loyalty_rewards SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'loyalty_reward_update', 'loyalty_reward', id, JSON.stringify(body), now).run();

  const reward = await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first();

  return c.json({
    success: true,
    data: {
      ...reward!,
      pointsCost: reward!.points_cost,
      maxRedemptions: reward!.max_redemptions,
      currentRedemptions: reward!.current_redemptions,
      validFrom: reward!.valid_from,
      validTo: reward!.valid_to,
      isActive: reward!.is_active,
      createdAt: reward!.created_at,
      updatedAt: reward!.updated_at,
    },
  });
});

// POST /api/loyalty/rewards/{id}/redeem - Redeem reward
openApiLoyaltyRouter.openapi(LoyaltyRoutes.rewards.redeem, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const reward = await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first();
  if (!reward) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }

  if (!reward.is_active) {
    return c.json({ success: false, error: 'Reward is not active' }, 400);
  }

  const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
    .bind(user.customerId || user.id).first();

  if (!account) {
    return c.json({ success: false, error: 'No loyalty account found' }, 404);
  }

  // Check tier requirement
  const tierConfig = await db.prepare('SELECT min_points FROM loyalty_tier_configs WHERE tier = ?')
    .bind(account.tier).first();
  if (tierConfig && account.current_points < reward.points_cost) {
    return c.json({ success: false, error: 'Insufficient points' }, 400);
  }

  if (reward.max_redemptions && reward.current_redemptions >= reward.max_redemptions) {
    return c.json({ success: false, error: 'Reward max redemptions reached' }, 409);
  }

  if (reward.valid_from && new Date(reward.valid_from) > new Date()) {
    return c.json({ success: false, error: 'Reward not yet valid' }, 400);
  }

  if (reward.valid_to && new Date(reward.valid_to) < new Date()) {
    return c.json({ success: false, error: 'Reward expired' }, 400);
  }

  // Check idempotency
  const existing = await db.prepare('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?')
    .bind(body.idempotencyKey).first();
  if (existing) {
    return c.json({ success: false, error: 'Duplicate redemption request' }, 409);
  }

  const transactionId = crypto.randomUUID();
  const pointsChange = -reward.points_cost;

  await db.prepare(
    `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, order_id, reward_id, description, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(transactionId, account.id, 'redeem', pointsChange, account.current_points + pointsChange, body.orderId || null, id, `Redeemed: ${reward.name}`, body.idempotencyKey, now).run();

  await db.prepare(
    'UPDATE loyalty_accounts SET current_points = current_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
  ).bind(pointsChange, now, now, account.id).run();

  await db.prepare(
    'UPDATE loyalty_rewards SET current_redemptions = current_redemptions + 1 WHERE id = ?'
  ).bind(id).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'loyalty_reward_redeem', 'loyalty_reward', id, JSON.stringify({ points: pointsChange, accountId: account.id }), now).run();

  return c.json({
    success: true,
    data: {
      transactionId,
      reward: {
        ...reward,
        pointsCost: reward.points_cost,
        maxRedemptions: reward.max_redemptions,
        currentRedemptions: reward.current_redemptions + 1,
        validFrom: reward.valid_from,
        validTo: reward.valid_to,
        isActive: reward.is_active,
        createdAt: reward.created_at,
        updatedAt: reward.updated_at,
      },
      newBalance: account.current_points + pointsChange,
      expiresAt: null,
    },
  });
});

// ============ ADMIN ROUTES ============

// POST /api/loyalty/admin/adjust-points - Adjust customer points (admin)
openApiLoyaltyRouter.openapi(LoyaltyRoutes.admin.adjustPoints, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  // Verify admin role
  if (user.role !== 'owner' && user.role !== 'manager') {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  // Check idempotency
  const existing = await db.prepare('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?')
    .bind(body.idempotencyKey).first();
  if (existing) {
    return c.json({ success: false, error: 'Duplicate adjustment request' }, 409);
  }

  const account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
    .bind(body.customerId).first();

  if (!account) {
    return c.json({ success: false, error: 'Loyalty account not found for customer' }, 404);
  }

  const newBalance = account.current_points + body.points;
  if (newBalance < 0) {
    return c.json({ success: false, error: 'Insufficient points for adjustment' }, 400);
  }

  const transactionId = crypto.randomUUID();

  await db.prepare(
    `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, description, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(transactionId, account.id, 'adjust', body.points, newBalance, body.reason, body.idempotencyKey, now).run();

  await db.prepare(
    'UPDATE loyalty_accounts SET current_points = ?, lifetime_points = lifetime_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
  ).bind(newBalance, Math.max(0, body.points), now, now, account.id).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, 'loyalty_points_adjust', 'loyalty_account', account.id, JSON.stringify({ points: body.points, reason: body.reason }), now).run();

  const transaction = await db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').bind(transactionId).first();

  return c.json({
    success: true,
    data: {
      ...transaction!,
      accountId: transaction!.account_id,
      rewardId: transaction!.reward_id,
      idempotencyKey: transaction!.idempotency_key,
      createdAt: transaction!.created_at,
    },
  });
});

// GET /api/loyalty/admin/accounts - List all loyalty accounts (admin)
openApiLoyaltyRouter.openapi(LoyaltyRoutes.admin.accounts, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');
  const query = c.req.valid('query');

  // Verify admin role
  if (user.role !== 'owner' && user.role !== 'manager') {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (query.tier) {
    whereClause += ' AND tier = ?';
    params.push(query.tier);
  }

  if (query.search) {
    whereClause += ' AND (customer_id IN (SELECT id FROM customers WHERE name LIKE ? OR email LIKE ?) OR referral_code LIKE ?)';
    const searchParam = `%${query.search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  const accounts = await db.prepare(
    `SELECT * FROM loyalty_accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    success: true,
    data: accounts.results.map(a => ({
      ...a,
      currentPoints: a.current_points,
      lifetimePoints: a.lifetime_points,
      tierProgress: a.tier_progress,
      pointsToNextTier: a.points_to_next_tier,
      totalSpent: a.total_spent,
      orderCount: a.order_count,
      lastOrderAt: a.last_order_at,
      birthdayBonusClaimed: a.birthday_bonus_claimed,
      referralCode: a.referral_code,
      referredBy: a.referred_by,
      referralCount: a.referral_count,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })),
  });
});

// GET /api/loyalty/admin/summary - Get loyalty program summary (admin)
openApiLoyaltyRouter.openapi(LoyaltyRoutes.admin.summary, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.DB;
  const user = c.get('user');

  // Verify admin role
  if (user.role !== 'owner' && user.role !== 'manager') {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  // Get total members
  const totalMembers = await db.prepare('SELECT COUNT(*) as total FROM loyalty_accounts').first();

  // Get active members (had activity in last 30 days)
  const activeMembers = await db.prepare(
    'SELECT COUNT(*) as total FROM loyalty_accounts WHERE last_activity_at >= datetime(\'now\', \'-30 days\')'
  ).first();

  // Get total points issued/redeemed/expired
  const pointsStats = await db.prepare(
    `SELECT
      SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_issued,
      SUM(CASE WHEN points < 0 THEN -points ELSE 0 END) as total_redeemed,
      SUM(CASE WHEN type = 'expire' THEN -points ELSE 0 END) as total_expired
     FROM loyalty_transactions`
  ).first();

  // Get by tier breakdown
  const byTier = await db.prepare(
    'SELECT tier, COUNT(*) as count, AVG(current_points) as avg_points FROM loyalty_accounts GROUP BY tier'
  ).all();

  const byTierRecord: Record<string, { count: number; avgPoints: number }> = {};
  byTier.results.forEach(row => {
    byTierRecord[row.tier] = {
      count: row.count,
      avgPoints: row.avg_points || 0,
    };
  });

  // Calculate redemption rate
  const totalIssued = pointsStats.total_issued || 0;
  const totalRedeemed = pointsStats.total_redeemed || 0;
  const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;

  // Average points per member
  const avgPointsPerMember = totalMembers?.total > 0 ? totalIssued / totalMembers.total : 0;

  return c.json({
    success: true,
    data: {
      totalMembers: totalMembers?.total || 0,
      activeMembers: activeMembers?.total || 0,
      totalPointsIssued: totalIssued,
      totalPointsRedeemed: totalRedeemed,
      totalPointsExpired: pointsStats.total_expired || 0,
      byTier: byTierRecord,
      redemptionRate,
      avgPointsPerMember,
    },
  });
});

export default openApiLoyaltyRouter;
