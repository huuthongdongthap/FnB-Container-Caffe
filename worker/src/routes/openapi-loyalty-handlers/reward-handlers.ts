import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';
import {
  getLoyaltyAccountWithFallback,
  recordLoyaltyTransactionDualWrite,
  syncLoyaltyAccountAndCustomerBalance,
  writeLoyaltyAuditLog,
} from './loyalty-db-helpers';

function mapRewardRow(r: any) {
  return {
    ...r,
    name: r.name ?? r.title,
    type: r.type ?? r.reward_type ?? r.discount_type ?? 'voucher',
    value: r.value ?? r.reward_value ?? r.discount_value ?? 0,
    pointsCost: r.points_cost ?? r.point_cost ?? 100,
    maxRedemptions: r.max_redemptions ?? (r.stock !== undefined && r.stock > 0 ? r.stock : null),
    currentRedemptions: r.current_redemptions ?? r.redeemed_count ?? 0,
    validFrom: r.valid_from ?? null,
    validTo: r.valid_to ?? null,
    isActive: r.is_active ?? 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  };
}

async function findRewardByIdWithFallback(db: any, id: string): Promise<{ reward: any | null; fromRewardsTable: boolean }> {
  let reward: any = null;
  try {
    reward = await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first();
  } catch {
    reward = null;
  }
  if (reward) {
    return { reward, fromRewardsTable: false };
  }

  try {
    const legacy = await db.prepare(
      `SELECT
        id,
        COALESCE(name, title) as name,
        description,
        COALESCE(points_cost, point_cost, 100) as points_cost,
        COALESCE(type, discount_type, 'voucher') as type,
        COALESCE(reward_type, discount_type, 'voucher') as reward_type,
        COALESCE(value, discount_value, 0) as value,
        CAST(COALESCE(reward_value, discount_value, 0) AS TEXT) as reward_value,
        CASE WHEN stock IS NOT NULL AND stock > 0 THEN stock ELSE NULL END as max_redemptions,
        stock,
        0 as current_redemptions,
        0 as redeemed_count,
        image_url,
        COALESCE(is_active, 1) as is_active,
        created_at,
        COALESCE(updated_at, created_at) as updated_at
      FROM rewards WHERE id = ?`
    ).bind(id).first();
    if (legacy) {
      return { reward: legacy, fromRewardsTable: true };
    }
  } catch {
    // Ignore when rewards table is absent
  }

  return { reward: null, fromRewardsTable: false };
}

export function registerRewardHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/rewards - List available rewards
  app.openapi(LoyaltyRoutes.rewards.list as any, async (c: any) => {
    const db = getDatabase(c);
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

    let total = 0;
    let rewardResults: any[] = [];
    try {
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM loyalty_rewards ${whereClause}`).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rewards = (await db.prepare(
        `SELECT * FROM loyalty_rewards ${whereClause} ORDER BY points_cost ASC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      rewardResults = rewards.results || [];
    } catch {
      const canonicalWhere = whereClause.replace('AND type = ?', 'AND reward_type = ?');
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM loyalty_rewards ${canonicalWhere}`).bind(...params).first().catch(() => null)) as { total: number } | null;
      total = countResult?.total || 0;

      const rewards = (await db.prepare(
        `SELECT * FROM loyalty_rewards ${canonicalWhere} ORDER BY points_cost ASC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all().catch(() => ({ results: [] }))) as { results: any[] };
      rewardResults = rewards.results || [];
    }

    if (rewardResults.length === 0 && !query.type) {
      try {
        const activeFilter = query.isActive !== undefined ? 'WHERE is_active = ?' : '';
        const activeParams = query.isActive !== undefined ? [query.isActive ? 1 : 0] : [];
        const fallbackCount = (await db.prepare(`SELECT COUNT(*) as total FROM rewards ${activeFilter}`).bind(...activeParams).first()) as { total: number } | null;
        total = fallbackCount?.total || 0;
        if (total > 0) {
          const fallbackRewards = (await db.prepare(
            `SELECT id, COALESCE(name, title) as name, description, COALESCE(points_cost, point_cost, 100) as points_cost, COALESCE(type, discount_type, 'voucher') as type, COALESCE(value, discount_value, 0) as value, CASE WHEN stock IS NOT NULL AND stock > 0 THEN stock ELSE NULL END as max_redemptions, 0 as current_redemptions, image_url, COALESCE(is_active, 1) as is_active, created_at, COALESCE(updated_at, created_at) as updated_at
             FROM rewards ${activeFilter} ORDER BY COALESCE(points_cost, point_cost, 100) ASC LIMIT ? OFFSET ?`
          ).bind(...activeParams, limit, offset).all()) as { results: any[] };
          rewardResults = fallbackRewards.results || [];
        }
      } catch {
        // Ignore when rewards table is absent
      }
    }

    return c.json({
      success: true,
      data: {
        rewards: rewardResults.map(mapRewardRow),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // GET /api/loyalty/rewards/{id} - Get reward by ID
  app.openapi(LoyaltyRoutes.rewards.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');

    const { reward } = await findRewardByIdWithFallback(db, id);

    if (!reward) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapRewardRow(reward),
    });
  });

  // POST /api/loyalty/rewards - Create reward
  app.openapi(LoyaltyRoutes.rewards.create as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    if (user?.role !== 'owner' && user?.role !== 'manager' && user?.role !== 'admin') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();
    const isActiveInt = body.isActive !== false ? 1 : 0;

    try {
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
        isActiveInt,
        body.imageUrl || null,
        body.terms || null,
        now,
        now
      ).run();
    } catch {
      await db.prepare(
        `INSERT INTO loyalty_rewards (id, name, description, points_cost, reward_type, reward_value, stock, redeemed_count, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      ).bind(
        id,
        body.name,
        body.description || null,
        body.pointsCost,
        body.type,
        String(body.value ?? ''),
        body.maxRedemptions ?? null,
        isActiveInt,
        now
      ).run();
    }

    try {
      await db.prepare(
        `INSERT OR IGNORE INTO rewards (
          id, title, name, description, point_cost, points_cost,
          discount_type, discount_value, type, value, reward_type, reward_value,
          min_tier, stock, image_url, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bronze', ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.name,
        body.name,
        body.description || null,
        body.pointsCost,
        body.pointsCost,
        body.type,
        Math.round(Number(body.value || 0)),
        body.type,
        Number(body.value || 0),
        body.type,
        Number(body.value || 0),
        body.maxRedemptions ?? -1,
        body.imageUrl || null,
        isActiveInt,
        now,
        now
      ).run();
    } catch {
      // Ignore when rewards table is absent
    }

    await writeLoyaltyAuditLog(db, user.id, 'loyalty_reward_create', 'loyalty_reward', id, JSON.stringify(body), now);

    const { reward } = await findRewardByIdWithFallback(db, id);

    return c.json({
      success: true,
      data: mapRewardRow(reward),
    }, 201);
  });

  // PATCH /api/loyalty/rewards/{id} - Update reward
  app.openapi(LoyaltyRoutes.rewards.update as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    if (user?.role !== 'owner' && user?.role !== 'manager' && user?.role !== 'admin') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const { reward: existing } = await findRewardByIdWithFallback(db, id);
    if (!existing) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | boolean)[] = [];
    const rewardsTableUpdates: string[] = [];
    const rewardsTableParams: (string | number | boolean)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?'); params.push(body.name);
      canonicalUpdates.push('name = ?'); canonicalParams.push(body.name);
      rewardsTableUpdates.push('title = ?', 'name = ?'); rewardsTableParams.push(body.name, body.name);
    }
    if (body.description !== undefined) {
      updates.push('description = ?'); params.push(body.description);
      canonicalUpdates.push('description = ?'); canonicalParams.push(body.description);
      rewardsTableUpdates.push('description = ?'); rewardsTableParams.push(body.description);
    }
    if (body.pointsCost !== undefined) {
      updates.push('points_cost = ?'); params.push(body.pointsCost);
      canonicalUpdates.push('points_cost = ?'); canonicalParams.push(body.pointsCost);
      rewardsTableUpdates.push('point_cost = ?', 'points_cost = ?'); rewardsTableParams.push(body.pointsCost, body.pointsCost);
    }
    if (body.type !== undefined) {
      updates.push('type = ?'); params.push(body.type);
      canonicalUpdates.push('reward_type = ?'); canonicalParams.push(body.type);
      rewardsTableUpdates.push('discount_type = ?', 'type = ?', 'reward_type = ?'); rewardsTableParams.push(body.type, body.type, body.type);
    }
    if (body.value !== undefined) {
      updates.push('value = ?'); params.push(body.value);
      canonicalUpdates.push('reward_value = ?'); canonicalParams.push(String(body.value));
      rewardsTableUpdates.push('discount_value = ?', 'value = ?', 'reward_value = ?');
      rewardsTableParams.push(Math.round(Number(body.value)), Number(body.value), Number(body.value));
    }
    if (body.maxRedemptions !== undefined) {
      updates.push('max_redemptions = ?'); params.push(body.maxRedemptions);
      canonicalUpdates.push('stock = ?'); canonicalParams.push(body.maxRedemptions);
      rewardsTableUpdates.push('stock = ?'); rewardsTableParams.push(body.maxRedemptions);
    }
    if (body.validFrom !== undefined) { updates.push('valid_from = ?'); params.push(body.validFrom); }
    if (body.validTo !== undefined) { updates.push('valid_to = ?'); params.push(body.validTo); }
    if (body.isActive !== undefined) {
      const isActiveInt = body.isActive ? 1 : 0;
      updates.push('is_active = ?'); params.push(isActiveInt);
      canonicalUpdates.push('is_active = ?'); canonicalParams.push(isActiveInt);
      rewardsTableUpdates.push('is_active = ?'); rewardsTableParams.push(isActiveInt);
    }
    if (body.imageUrl !== undefined) {
      updates.push('image_url = ?'); params.push(body.imageUrl);
      rewardsTableUpdates.push('image_url = ?'); rewardsTableParams.push(body.imageUrl);
    }
    if (body.terms !== undefined) { updates.push('terms = ?'); params.push(body.terms); }

    if (updates.length === 0) {
      return c.json({ success: true, data: existing });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    try {
      await db.prepare(`UPDATE loyalty_rewards SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    } catch {
      if (canonicalUpdates.length > 0) {
        await db.prepare(`UPDATE loyalty_rewards SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams, id).run();
      }
    }

    if (rewardsTableUpdates.length > 0) {
      rewardsTableUpdates.push('updated_at = ?');
      rewardsTableParams.push(now, id);
      await db.prepare(`UPDATE rewards SET ${rewardsTableUpdates.join(', ')} WHERE id = ?`).bind(...rewardsTableParams).run().catch(() => {});
    }

    await writeLoyaltyAuditLog(db, user.id, 'loyalty_reward_update', 'loyalty_reward', id, JSON.stringify(body), now);

    const { reward } = await findRewardByIdWithFallback(db, id);

    return c.json({
      success: true,
      data: mapRewardRow(reward),
    });
  });

  // POST /api/loyalty/rewards/redeem - Redeem reward
  app.openapi(LoyaltyRoutes.rewards.redeem as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    const body = c.req.valid('json');
    const id = body.rewardId || c.req.param?.('id');
    const now = new Date().toISOString();

    const { reward } = await findRewardByIdWithFallback(db, id);
    if (!reward) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }

    if (!reward.is_active) {
      return c.json({ success: false, error: 'Reward is not active' }, 400);
    }

    const customerLookupId = String(user.customerId || user.id);
    const { account } = await getLoyaltyAccountWithFallback(db, customerLookupId, now);

    if (!account) {
      return c.json({ success: false, error: 'No loyalty account found' }, 404);
    }

    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
    const currentRedemptions = Number(reward.current_redemptions ?? reward.redeemed_count ?? 0);
    const maxRedemptions = reward.max_redemptions ?? (reward.stock !== undefined && reward.stock > 0 ? reward.stock : null);
    const pointsCost = Number(reward.points_cost ?? reward.point_cost ?? 100);

    // Always verify customer has sufficient points to redeem the reward
    if (currentPoints < pointsCost) {
      return c.json({ success: false, error: 'Insufficient points' }, 400);
    }

    if (maxRedemptions && currentRedemptions >= maxRedemptions) {
      return c.json({ success: false, error: 'Reward max redemptions reached' }, 409);
    }

    if (reward.valid_from && new Date(reward.valid_from) > new Date()) {
      return c.json({ success: false, error: 'Reward not yet valid' }, 400);
    }

    if (reward.valid_to && new Date(reward.valid_to) < new Date()) {
      return c.json({ success: false, error: 'Reward expired' }, 400);
    }

    // Check idempotency
    let existing: any = null;
    try {
      existing = await db.prepare('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?')
        .bind(body.idempotencyKey ?? null).first();
    } catch {
      existing = null;
    }
    if (existing) {
      return c.json({ success: false, error: 'Duplicate redemption request' }, 409);
    }

    const transactionId = crypto.randomUUID();
    const pointsChange = -pointsCost;
    const newBalance = currentPoints + pointsChange;
    const accountId = String(account.id);
    const customerId = String(account.customer_id ?? customerLookupId);
    const rewardName = String(reward.name ?? reward.title ?? id);

    await recordLoyaltyTransactionDualWrite(db, {
      txId: transactionId,
      accountId,
      customerId,
      type: 'redeem',
      points: pointsChange,
      balanceAfter: newBalance,
      orderId: body.orderId || null,
      rewardId: id,
      description: `Redeemed: ${rewardName}`,
      reason: `Redeemed: ${rewardName}`,
      idempotencyKey: body.idempotencyKey ?? null,
      now,
    });

    await syncLoyaltyAccountAndCustomerBalance(db, {
      accountId,
      customerId,
      newBalance,
      now,
    });

    try {
      await db.prepare(
        'UPDATE loyalty_rewards SET current_redemptions = COALESCE(current_redemptions, 0) + 1 WHERE id = ?'
      ).bind(id).run();
    } catch {
      await db.prepare(
        'UPDATE loyalty_rewards SET redeemed_count = COALESCE(redeemed_count, 0) + 1 WHERE id = ?'
      ).bind(id).run();
    }

    const voucherCode = `RWD-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO loyalty_redemptions (
          id, customer_id, reward_id, code, points_spent, order_id, status, expires_at, redeemed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
      ).bind(`lrd_${transactionId}`, customerId, id, voucherCode, pointsCost, body.orderId || null, expiresAt, now, now).run();
    } catch {
      // Ignore when loyalty_redemptions is absent in older migration snapshots
    }

    try {
      await db.prepare(
        `INSERT OR IGNORE INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, created_at)
         SELECT ?, ?, ?, ?, 'active', ?, ?
         WHERE EXISTS (SELECT 1 FROM customers WHERE id = ?)
           AND EXISTS (SELECT 1 FROM rewards WHERE id = ?)`
      ).bind(`uwr_${transactionId}`, customerId, id, voucherCode, expiresAt, now, customerId, id).run();
    } catch {
      // Ignore when user_rewards is absent
    }

    await writeLoyaltyAuditLog(
      db,
      user.id,
      'loyalty_reward_redeem',
      'loyalty_reward',
      id,
      JSON.stringify({ points: pointsChange, accountId: account.id }),
      now
    );

    return c.json({
      success: true,
      data: {
        transactionId,
        reward: {
          ...mapRewardRow(reward),
          currentRedemptions: currentRedemptions + 1,
        },
        newBalance,
        expiresAt: null,
      },
    });
  });
}

