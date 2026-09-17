import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';

export function registerRewardHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/rewards - List available rewards
  app.openapi(LoyaltyRoutes.rewards.list, async (c: Context<{ Bindings: Env }>) => {
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
  app.openapi(LoyaltyRoutes.rewards.get, async (c: Context<{ Bindings: Env }>) => {
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
  app.openapi(LoyaltyRoutes.rewards.create, async (c: Context<{ Bindings: Env }>) => {
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
  app.openapi(LoyaltyRoutes.rewards.update, async (c: Context<{ Bindings: Env }>) => {
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
  app.openapi(LoyaltyRoutes.rewards.redeem, async (c: Context<{ Bindings: Env }>) => {
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
}