import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';

async function writeRewardAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, userId, action, 'loyalty_reward', entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, action, 'loyalty_reward', entityId, metadata, now).run().catch(() => {});
    } catch {
      // Ignore audit log error
    }
  }
}

function mapRewardRow(r: any) {
  return {
    ...r,
    type: r.type ?? r.reward_type,
    value: r.value ?? r.reward_value,
    pointsCost: r.points_cost,
    maxRedemptions: r.max_redemptions ?? r.stock ?? null,
    currentRedemptions: r.current_redemptions ?? r.redeemed_count ?? 0,
    validFrom: r.valid_from ?? null,
    validTo: r.valid_to ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  };
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

    const reward = (await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first()) as any;

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
        body.isActive !== false ? 1 : 0,
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
        body.isActive !== false ? 1 : 0,
        now
      ).run();
    }

    await writeRewardAuditLog(db, user.id, 'loyalty_reward_create', id, JSON.stringify(body), now);

    const reward = (await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first()) as any;

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

    const existing = (await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first()) as any;
    if (!existing) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | boolean)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?'); params.push(body.name);
      canonicalUpdates.push('name = ?'); canonicalParams.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push('description = ?'); params.push(body.description);
      canonicalUpdates.push('description = ?'); canonicalParams.push(body.description);
    }
    if (body.pointsCost !== undefined) {
      updates.push('points_cost = ?'); params.push(body.pointsCost);
      canonicalUpdates.push('points_cost = ?'); canonicalParams.push(body.pointsCost);
    }
    if (body.type !== undefined) {
      updates.push('type = ?'); params.push(body.type);
      canonicalUpdates.push('reward_type = ?'); canonicalParams.push(body.type);
    }
    if (body.value !== undefined) {
      updates.push('value = ?'); params.push(body.value);
      canonicalUpdates.push('reward_value = ?'); canonicalParams.push(String(body.value));
    }
    if (body.maxRedemptions !== undefined) {
      updates.push('max_redemptions = ?'); params.push(body.maxRedemptions);
      canonicalUpdates.push('stock = ?'); canonicalParams.push(body.maxRedemptions);
    }
    if (body.validFrom !== undefined) { updates.push('valid_from = ?'); params.push(body.validFrom); }
    if (body.validTo !== undefined) { updates.push('valid_to = ?'); params.push(body.validTo); }
    if (body.isActive !== undefined) {
      updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0);
      canonicalUpdates.push('is_active = ?'); canonicalParams.push(body.isActive ? 1 : 0);
    }
    if (body.imageUrl !== undefined) { updates.push('image_url = ?'); params.push(body.imageUrl); }
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

    await writeRewardAuditLog(db, user.id, 'loyalty_reward_update', id, JSON.stringify(body), now);

    const reward = (await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first()) as any;

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

    const reward = (await db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').bind(id).first()) as any;
    if (!reward) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }

    if (!reward.is_active) {
      return c.json({ success: false, error: 'Reward is not active' }, 400);
    }

    let account: any = null;
    let usingCanonicalAccount = false;
    try {
      account = await db.prepare('SELECT * FROM loyalty_accounts WHERE customer_id = ?')
        .bind(user.customerId || user.id).first();
    } catch {
      usingCanonicalAccount = true;
      account = await db.prepare('SELECT *, id as customer_id, loyalty_points as current_points FROM customers WHERE id = ?')
        .bind(user.customerId || user.id).first().catch(() => null);
    }

    if (!account) {
      return c.json({ success: false, error: 'No loyalty account found' }, 404);
    }

    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
    const currentRedemptions = Number(reward.current_redemptions ?? reward.redeemed_count ?? 0);
    const maxRedemptions = reward.max_redemptions ?? reward.stock ?? null;

    // Always verify customer has sufficient points to redeem the reward
    if (currentPoints < reward.points_cost) {
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
    const pointsChange = -reward.points_cost;

    try {
      await db.prepare(
        `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, order_id, reward_id, description, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(transactionId, account.id, 'redeem', pointsChange, currentPoints + pointsChange, body.orderId || null, id, `Redeemed: ${reward.name}`, body.idempotencyKey ?? null, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO loyalty_transactions (id, customer_id, order_id, points, type, reason, balance_after, created_at)
         VALUES (?, ?, ?, ?, 'redeem', ?, ?, ?)`
      ).bind(transactionId, account.id, body.orderId || null, pointsChange, `Redeemed: ${reward.name}`, currentPoints + pointsChange, now).run();
    }

    if (!usingCanonicalAccount) {
      await db.prepare(
        'UPDATE loyalty_accounts SET current_points = current_points + ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
      ).bind(pointsChange, now, now, account.id).run();
    } else {
      await db.prepare(
        'UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = ? WHERE id = ?'
      ).bind(pointsChange, now, account.id).run();
    }

    try {
      await db.prepare(
        'UPDATE loyalty_rewards SET current_redemptions = current_redemptions + 1 WHERE id = ?'
      ).bind(id).run();
    } catch {
      await db.prepare(
        'UPDATE loyalty_rewards SET redeemed_count = redeemed_count + 1 WHERE id = ?'
      ).bind(id).run();
    }

    await writeRewardAuditLog(db, user.id, 'loyalty_reward_redeem', id, JSON.stringify({ points: pointsChange, accountId: account.id }), now);

    return c.json({
      success: true,
      data: {
        transactionId,
        reward: {
          ...mapRewardRow(reward),
          currentRedemptions: currentRedemptions + 1,
        },
        newBalance: currentPoints + pointsChange,
        expiresAt: null,
      },
    });
  });
}

