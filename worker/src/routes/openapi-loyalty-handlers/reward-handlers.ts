import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';
import {
  checkRewardTenant,
  findExistingLoyaltyIdempotencyTx,
  getLoyaltyAccountWithFallback,
  hasOpenApiLoyaltyTenantMismatch,
  matchesLoyaltyTenant,
  recordLoyaltyTransactionDualWrite,
  resolveRewardTenantId,
  writeLoyaltyAuditLog,
} from './loyalty-db-helpers';

const LOYALTY_REWARD_WRITE_ROLES = ['owner', 'manager', 'admin'];

const TIER_RANK: Record<string, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
  vip: 4,
};

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
    if (reward.min_tier === undefined || reward.min_tier === null) {
      try {
        const legacyTierRow = (await db
          .prepare('SELECT min_tier FROM rewards WHERE id = ? LIMIT 1')
          .bind(id)
          .first()) as { min_tier?: string | null } | null;
        if (legacyTierRow?.min_tier) {
          reward = { ...reward, min_tier: legacyTierRow.min_tier };
        }
      } catch {
        // Ignore when rewards table or min_tier column is absent
      }
    }
    return { reward, fromRewardsTable: false };
  }

  try {
    const raw = (await db.prepare('SELECT * FROM rewards WHERE id = ?').bind(id).first()) as Record<string, any> | null;
    if (raw) {
      const legacy = {
        ...raw,
        id: raw.id,
        name: raw.name ?? raw.title,
        description: raw.description ?? null,
        points_cost: raw.points_cost ?? raw.point_cost ?? 100,
        type: raw.type ?? raw.reward_type ?? raw.discount_type ?? 'voucher',
        reward_type: raw.reward_type ?? raw.type ?? raw.discount_type ?? 'voucher',
        value: raw.value ?? (raw.reward_value !== undefined ? Number(raw.reward_value) || 0 : raw.discount_value ?? 0),
        reward_value: String(raw.reward_value ?? raw.value ?? raw.discount_value ?? 0),
        max_redemptions: raw.max_redemptions ?? (raw.stock !== undefined && raw.stock !== null && raw.stock > 0 ? raw.stock : null),
        stock: raw.stock ?? null,
        min_tier: raw.min_tier ?? 'bronze',
        current_redemptions: raw.current_redemptions ?? raw.redeemed_count ?? 0,
        redeemed_count: raw.redeemed_count ?? raw.current_redemptions ?? 0,
        image_url: raw.image_url ?? null,
        is_active: raw.is_active ?? 1,
        created_at: raw.created_at,
        updated_at: raw.updated_at ?? raw.created_at,
      };
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
    const rawTenantId = getTenantId(c);
    if (hasOpenApiLoyaltyTenantMismatch(c, rawTenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }
    const tenantId = rawTenantId.trim().toLowerCase() === 'hq' ? '*' : rawTenantId.trim();
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
    if (tenantId !== '*') {
      let rawRewards: any[] = [];
      try {
        try {
          const scopedRewards = (await db.prepare(
            `SELECT * FROM loyalty_rewards ${whereClause} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY points_cost ASC`
          ).bind(...params, tenantId).all()) as { results: any[] };
          rawRewards = scopedRewards.results || [];
        } catch {
          rawRewards = [];
        }
        if (rawRewards.length === 0) {
          const rewards = (await db.prepare(
            `SELECT * FROM loyalty_rewards ${whereClause} ORDER BY points_cost ASC`
          ).bind(...params).all()) as { results: any[] };
          rawRewards = rewards.results || [];
        }
      } catch {
        const canonicalWhere = whereClause.replace('AND type = ?', 'AND reward_type = ?');
        try {
          const scopedRewards = (await db.prepare(
            `SELECT * FROM loyalty_rewards ${canonicalWhere} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY points_cost ASC`
          ).bind(...params, tenantId).all()) as { results: any[] };
          rawRewards = scopedRewards.results || [];
        } catch {
          rawRewards = [];
        }
        if (rawRewards.length === 0) {
          const rewards = (await db.prepare(
            `SELECT * FROM loyalty_rewards ${canonicalWhere} ORDER BY points_cost ASC`
          ).bind(...params).all().catch(() => ({ results: [] }))) as { results: any[] };
          rawRewards = rewards.results || [];
        }
      }
      const scoped: any[] = [];
      for (const r of rawRewards) {
        if (await checkRewardTenant(db, r, tenantId)) {
          scoped.push(r);
        }
      }
      total = scoped.length;
      rewardResults = scoped.slice(offset, offset + limit);
    } else {
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
    }

    if (rewardResults.length === 0 && !query.type) {
      try {
        const activeFilter = query.isActive !== undefined ? 'WHERE is_active = ?' : '';
        const activeParams = query.isActive !== undefined ? [query.isActive ? 1 : 0] : [];
        const fallbackRewards = (await db.prepare(
          `SELECT * FROM rewards ${activeFilter}`
        ).bind(...activeParams).all()) as { results: any[] };
        const sortedFallback = (fallbackRewards.results || []).sort(
          (a: any, b: any) => Number(a.points_cost ?? a.point_cost ?? 100) - Number(b.points_cost ?? b.point_cost ?? 100)
        );
        const scopedFallback: any[] = [];
        for (const r of sortedFallback) {
          if (await checkRewardTenant(db, r, tenantId)) {
            scopedFallback.push(r);
          }
        }
        total = scopedFallback.length;
        rewardResults = scopedFallback.slice(offset, offset + limit);
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
    const rawTenantId = getTenantId(c);
    if (hasOpenApiLoyaltyTenantMismatch(c, rawTenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }
    const tenantId = rawTenantId.trim().toLowerCase() === 'hq' ? '*' : rawTenantId.trim();
    const { id } = c.req.valid('param');

    const { reward } = await findRewardByIdWithFallback(db, id);

    if (!reward || !(await checkRewardTenant(db, reward, tenantId))) {
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
    const rawTenantId = getTenantId(c);
    const normalizedTenant = rawTenantId.trim().toLowerCase() === 'hq' ? '*' : rawTenantId.trim();
    const tenantId = normalizedTenant === '*' ? 'default' : normalizedTenant;
    const user = c.get('user');
    if (!user || !LOYALTY_REWARD_WRITE_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    if (hasOpenApiLoyaltyTenantMismatch(c, rawTenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();
    const isActiveInt = body.isActive !== false ? 1 : 0;

    let insertedWithTenant = false;
    if (tenantId !== 'default') {
      try {
        await db.prepare(
          `INSERT INTO loyalty_rewards (id, name, description, points_cost, type, value, max_redemptions, current_redemptions, valid_from, valid_to, is_active, image_url, terms, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          tenantId,
          now,
          now
        ).run();
        insertedWithTenant = true;
      } catch {
        insertedWithTenant = false;
      }
    }
    if (!insertedWithTenant) {
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
        await db.prepare('UPDATE loyalty_rewards SET tenant_id = ? WHERE id = ?').bind(tenantId, id).run().catch(() => {});
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
        await db.prepare('UPDATE loyalty_rewards SET tenant_id = ? WHERE id = ?').bind(tenantId, id).run().catch(() => {});
      }
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
      try { await db.prepare('UPDATE rewards SET tenant_id = ? WHERE id = ?').bind(tenantId, id).run(); } catch { /* tenant_id column may not exist */ }
    } catch {
      // Ignore when rewards table is absent
    }

    await writeLoyaltyAuditLog(db, user.id, 'loyalty_reward_create', 'loyalty_reward', id, JSON.stringify({ ...body, tenant_id: tenantId }), now, tenantId);

    const { reward } = await findRewardByIdWithFallback(db, id);

    return c.json({
      success: true,
      data: mapRewardRow(reward),
    }, 201);
  });

  // PATCH /api/loyalty/rewards/{id} - Update reward
  app.openapi(LoyaltyRoutes.rewards.update as any, async (c: any) => {
    const db = getDatabase(c);
    const rawTenantId = getTenantId(c);
    const user = c.get('user');
    if (!user || !LOYALTY_REWARD_WRITE_ROLES.includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    if (hasOpenApiLoyaltyTenantMismatch(c, rawTenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }
    const tenantId = rawTenantId.trim().toLowerCase() === 'hq' ? '*' : rawTenantId.trim();
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const { reward: existing } = await findRewardByIdWithFallback(db, id);
    if (!existing || !(await checkRewardTenant(db, existing, tenantId))) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }
    const effectiveRewardTenant = await resolveRewardTenantId(db, existing, tenantId);

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

    const writeRewardTenant = effectiveRewardTenant && effectiveRewardTenant !== '*' ? effectiveRewardTenant : tenantId;
    const tenantClause = writeRewardTenant !== '*' ? " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?" : '';
    const tenantBind = writeRewardTenant !== '*' ? [writeRewardTenant] : [];
    const allowUnscopedFallback = !writeRewardTenant || writeRewardTenant === 'default';

    try {
      await db.prepare(`UPDATE loyalty_rewards SET ${updates.join(', ')} WHERE id = ?${tenantClause}`).bind(...params, ...tenantBind).run();
    } catch (err) {
      try {
        if (!allowUnscopedFallback) {
          throw err;
        }
        await db.prepare(`UPDATE loyalty_rewards SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      } catch {
        if (canonicalUpdates.length > 0) {
          try {
            await db.prepare(`UPDATE loyalty_rewards SET ${canonicalUpdates.join(', ')} WHERE id = ?${tenantClause}`).bind(...canonicalParams, id, ...tenantBind).run();
          } catch (canonErr) {
            if (!allowUnscopedFallback) {
              throw canonErr;
            }
            await db.prepare(`UPDATE loyalty_rewards SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams, id).run();
          }
        }
      }
    }

    if (rewardsTableUpdates.length > 0) {
      rewardsTableUpdates.push('updated_at = ?');
      rewardsTableParams.push(now, id);
      try {
        await db.prepare(`UPDATE rewards SET ${rewardsTableUpdates.join(', ')} WHERE id = ?${tenantClause}`).bind(...rewardsTableParams, ...tenantBind).run();
      } catch {
        if (allowUnscopedFallback) {
          await db.prepare(`UPDATE rewards SET ${rewardsTableUpdates.join(', ')} WHERE id = ?`).bind(...rewardsTableParams).run().catch(() => {});
        }
      }
    }

    await writeLoyaltyAuditLog(db, user.id, 'loyalty_reward_update', 'loyalty_reward', id, JSON.stringify(body), now, effectiveRewardTenant);

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
    const rawTenantId = getTenantId(c);
    if (hasOpenApiLoyaltyTenantMismatch(c, rawTenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }
    const tenantId = rawTenantId.trim().toLowerCase() === 'hq' ? '*' : rawTenantId.trim();

    const { reward, fromRewardsTable } = await findRewardByIdWithFallback(db, id);
    if (!reward || !(await checkRewardTenant(db, reward, tenantId))) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }

    if (!reward.is_active) {
      return c.json({ success: false, error: 'Reward is not active' }, 400);
    }

    const customerLookupId = String(user.customerId || user.customer_id || user.id);
    let verifiedOrderTenant: string | null = null;
    if (body.orderId) {
      let orderRow: Record<string, unknown> | null = null;
      let orderLookupSucceeded = false;
      try {
        orderRow = await db.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1').bind(body.orderId).first<Record<string, unknown>>();
        orderLookupSucceeded = true;
      } catch (err) {
        if (!/no such table:\s*orders/i.test(String(err))) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }
      }
      if (orderLookupSucceeded) {
        if (!orderRow || !orderRow.id || !matchesLoyaltyTenant(orderRow, tenantId)) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }
        if (orderRow.tenant_id !== undefined && orderRow.tenant_id !== null && String(orderRow.tenant_id).trim() !== '') {
          verifiedOrderTenant = String(orderRow.tenant_id).trim();
        }
        if (orderRow.customer_id !== undefined && orderRow.customer_id !== null && String(orderRow.customer_id).trim() !== '') {
          const selfIds = [customerLookupId, String(user.id), String(user.userId || ''), String(user.sub || '')].filter(Boolean);
          if (!selfIds.includes(String(orderRow.customer_id))) {
            return c.json({ success: false, error: 'Order not found' }, 404);
          }
        }
        const ordStatus = String(orderRow.status ?? '').trim().toLowerCase();
        const ordPayStatus = String(orderRow.payment_status ?? '').trim().toLowerCase();
        if (
          ['cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'].includes(ordStatus) ||
          ['refunded', 'failed', 'cancelled', 'canceled'].includes(ordPayStatus)
        ) {
          return c.json({ success: false, error: 'Order is not eligible for reward redemption' }, 400);
        }
      }
    }
    const { account, usingCustomersFallback } = await getLoyaltyAccountWithFallback(db, customerLookupId, now, tenantId);

    if (!account) {
      return c.json({ success: false, error: 'No loyalty account found' }, 404);
    }

    const requiredTierRaw = String(reward.min_tier ?? reward.minTier ?? 'bronze').trim().toLowerCase();
    const userTierRaw = String(account.tier ?? account.loyalty_tier ?? 'bronze').trim().toLowerCase();
    const reqTierRank = TIER_RANK[requiredTierRaw] ?? 0;
    const userTierRank = TIER_RANK[userTierRaw] ?? 0;
    if (userTierRank < reqTierRank) {
      return c.json({ success: false, error: 'Hạng thành viên chưa đủ để đổi phần thưởng này' }, 403);
    }

    const currentPoints = Number(account.current_points ?? account.loyalty_points ?? 0);
    const currentRedemptions = Number(reward.current_redemptions ?? reward.redeemed_count ?? 0);
    const maxRedemptions = reward.max_redemptions ?? (reward.stock !== undefined && reward.stock > 0 ? reward.stock : null);
    const pointsCost = Number(reward.points_cost ?? reward.point_cost ?? 100);

    // Always verify customer has sufficient points to redeem the reward
    if (currentPoints < pointsCost) {
      return c.json({ success: false, error: 'Insufficient points' }, 400);
    }

    if (fromRewardsTable && reward.stock !== undefined && reward.stock !== null && Number(reward.stock) === 0) {
      return c.json({ success: false, error: 'Reward max redemptions reached' }, 409);
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

    const accountId = String(account.id);
    const customerId = String(account.customer_id ?? customerLookupId);
    const rewardName = String(reward.name ?? reward.title ?? id);
    const effectiveRewardTenant = await resolveRewardTenantId(db, reward, tenantId);
    const effectiveAccountTenant = (account?.tenant_id && String(account.tenant_id).trim()) || effectiveRewardTenant;
    if (tenantId === '*' && effectiveRewardTenant !== 'default' && effectiveAccountTenant !== 'default' && effectiveRewardTenant !== effectiveAccountTenant) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }
    const resolvedRedeemTenant = tenantId !== '*' ? tenantId : (effectiveRewardTenant !== 'default' ? effectiveRewardTenant : effectiveAccountTenant);
    if (verifiedOrderTenant && verifiedOrderTenant !== '*' && resolvedRedeemTenant && resolvedRedeemTenant !== '*' && verifiedOrderTenant !== resolvedRedeemTenant) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    const effectiveTenant = resolvedRedeemTenant && resolvedRedeemTenant !== '*' ? resolvedRedeemTenant.trim() || 'default' : null;
    const allowUnscopedWrite = !effectiveTenant || effectiveTenant === 'default';

    // Check idempotency isolated by tenant and account ownership
    const existing = await findExistingLoyaltyIdempotencyTx(db, body.idempotencyKey, {
      tenantId: resolvedRedeemTenant,
      accountId,
      customerId,
    });
    if (existing) {
      return c.json({ success: false, error: 'Duplicate redemption request' }, 409);
    }

    let quotaReserved = false;
    if (fromRewardsTable) {
      if (reward.stock !== undefined && reward.stock !== null && Number(reward.stock) > 0) {
        let rStockRes: any = null;
        if (effectiveTenant) {
          rStockRes = await db.prepare(
            `UPDATE rewards
             SET stock = stock - 1
             WHERE id = ? AND COALESCE(is_active, 1) = 1 AND stock >= 1
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(id, effectiveTenant).run().catch(() => null);
        }
        if (!rStockRes && allowUnscopedWrite) {
          rStockRes = await db.prepare(
            `UPDATE rewards
             SET stock = stock - 1
             WHERE id = ? AND COALESCE(is_active, 1) = 1 AND stock >= 1`
          ).bind(id).run().catch(() => null);
        }
        if (!rStockRes || (rStockRes?.meta?.changes ?? 1) === 0) {
          return c.json({ success: false, error: 'Reward max redemptions reached' }, 409);
        }
        quotaReserved = Boolean(rStockRes);
      }
    } else {
      try {
        let qRes: any = null;
        if (effectiveTenant) {
          try {
            qRes = await db.prepare(
              `UPDATE loyalty_rewards
               SET current_redemptions = COALESCE(current_redemptions, 0) + 1
               WHERE id = ? AND COALESCE(is_active, 1) = 1
                 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                 AND (max_redemptions IS NULL OR max_redemptions <= 0 OR COALESCE(current_redemptions, 0) < max_redemptions)`
            ).bind(id, effectiveTenant).run();
          } catch (err) {
            if (!allowUnscopedWrite) {
              throw err;
            }
            qRes = null;
          }
        }
        if (!qRes && allowUnscopedWrite) {
          qRes = await db.prepare(
            `UPDATE loyalty_rewards
             SET current_redemptions = COALESCE(current_redemptions, 0) + 1
             WHERE id = ? AND COALESCE(is_active, 1) = 1
               AND (max_redemptions IS NULL OR max_redemptions <= 0 OR COALESCE(current_redemptions, 0) < max_redemptions)`
          ).bind(id).run();
        }
        if ((qRes?.meta?.changes ?? 1) === 0) {
          return c.json({ success: false, error: 'Reward max redemptions reached' }, 409);
        }
        quotaReserved = true;
      } catch {
        let qRes: any = null;
        if (effectiveTenant) {
          qRes = await db.prepare(
            `UPDATE loyalty_rewards
             SET redeemed_count = COALESCE(redeemed_count, 0) + 1
             WHERE id = ? AND COALESCE(is_active, 1) = 1
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
               AND (stock IS NULL OR stock <= 0 OR COALESCE(redeemed_count, 0) < stock)`
          ).bind(id, effectiveTenant).run().catch(() => null);
        }
        if (!qRes && allowUnscopedWrite) {
          qRes = await db.prepare(
            `UPDATE loyalty_rewards
             SET redeemed_count = COALESCE(redeemed_count, 0) + 1
             WHERE id = ? AND COALESCE(is_active, 1) = 1
               AND (stock IS NULL OR stock <= 0 OR COALESCE(redeemed_count, 0) < stock)`
          ).bind(id).run().catch(() => null);
        }
        if (qRes && (qRes?.meta?.changes ?? 1) === 0) {
          return c.json({ success: false, error: 'Reward max redemptions reached' }, 409);
        }
        quotaReserved = Boolean(qRes);
      }
      if (effectiveTenant) {
        await db.prepare(
          "UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock IS NOT NULL AND stock >= 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, effectiveTenant).run().catch(async () => {
          if (allowUnscopedWrite) {
            await db.prepare(
              'UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock IS NOT NULL AND stock >= 1'
            ).bind(id).run().catch(() => {});
          }
        });
      } else {
        await db.prepare(
          'UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock IS NOT NULL AND stock >= 1'
        ).bind(id).run().catch(() => {});
      }
    }

    const rollbackQuotaReservation = async () => {
      if (!quotaReserved) return;
      if (fromRewardsTable) {
        if (effectiveTenant) {
          await db.prepare(
            "UPDATE rewards SET stock = COALESCE(stock, 0) + 1 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, effectiveTenant).run().catch(async () => {
            if (allowUnscopedWrite) {
              await db.prepare('UPDATE rewards SET stock = COALESCE(stock, 0) + 1 WHERE id = ?').bind(id).run().catch(() => {});
            }
          });
        } else {
          await db.prepare('UPDATE rewards SET stock = COALESCE(stock, 0) + 1 WHERE id = ?').bind(id).run().catch(() => {});
        }
      } else if (effectiveTenant) {
        await db.prepare(
          "UPDATE loyalty_rewards SET current_redemptions = MAX(0, COALESCE(current_redemptions, 1) - 1) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, effectiveTenant).run().catch(async () => {
          if (allowUnscopedWrite) {
            await db.prepare('UPDATE loyalty_rewards SET current_redemptions = MAX(0, COALESCE(current_redemptions, 1) - 1) WHERE id = ?').bind(id).run().catch(async () => {
              await db.prepare('UPDATE loyalty_rewards SET redeemed_count = MAX(0, COALESCE(redeemed_count, 1) - 1) WHERE id = ?').bind(id).run().catch(() => {});
            });
          }
        });
      } else {
        await db.prepare('UPDATE loyalty_rewards SET current_redemptions = MAX(0, COALESCE(current_redemptions, 1) - 1) WHERE id = ?').bind(id).run().catch(async () => {
          await db.prepare('UPDATE loyalty_rewards SET redeemed_count = MAX(0, COALESCE(redeemed_count, 1) - 1) WHERE id = ?').bind(id).run().catch(() => {});
        });
      }
    };

    const transactionId = crypto.randomUUID();
    const pointsChange = -pointsCost;
    let authoritativeBalance = currentPoints + pointsChange;

    const deductFromCustomersOnly = async () => {
      try {
        let custDeduct: any;
        if (effectiveTenant) {
          try {
            custDeduct = await db.prepare(
              `UPDATE customers
               SET loyalty_points = loyalty_points - ?, updated_at = ?
               WHERE id = ? AND COALESCE(loyalty_points, 0) >= ?
                 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(pointsCost, now, customerId, pointsCost, effectiveTenant).run();
          } catch {
            if (!allowUnscopedWrite) {
              await rollbackQuotaReservation();
              return false;
            }
            custDeduct = await db.prepare(
              `UPDATE customers
               SET loyalty_points = loyalty_points - ?, updated_at = ?
               WHERE id = ? AND COALESCE(loyalty_points, 0) >= ?`
            ).bind(pointsCost, now, customerId, pointsCost).run();
          }
        } else {
          custDeduct = await db.prepare(
            `UPDATE customers
             SET loyalty_points = loyalty_points - ?, updated_at = ?
             WHERE id = ? AND COALESCE(loyalty_points, 0) >= ?`
          ).bind(pointsCost, now, customerId, pointsCost).run();
        }
        if ((custDeduct?.meta?.changes ?? 1) === 0) {
          await rollbackQuotaReservation();
          return false;
        }
        const postCust = await db.prepare(
          'SELECT loyalty_points FROM customers WHERE id = ? LIMIT 1'
        ).bind(customerId).first<{ loyalty_points?: number }>().catch(() => null);
        if (typeof postCust?.loyalty_points === 'number') {
          authoritativeBalance = Number(postCust.loyalty_points);
        }
      } catch {
        await rollbackQuotaReservation();
        return false;
      }
      return true;
    };

    if (usingCustomersFallback) {
      const ok = await deductFromCustomersOnly();
      if (!ok) {
        return c.json({ success: false, error: 'Insufficient points' }, 409);
      }
    } else {
      try {
        let deductRes: any;
        if (effectiveTenant) {
          try {
            deductRes = await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = current_points - ?, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?) AND COALESCE(current_points, 0) >= ?
                 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(pointsCost, now, now, accountId, customerId, pointsCost, effectiveTenant).run();
          } catch {
            if (!allowUnscopedWrite) {
              await rollbackQuotaReservation();
              return c.json({ success: false, error: 'Insufficient points' }, 409);
            }
            deductRes = await db.prepare(
              `UPDATE loyalty_accounts
               SET current_points = current_points - ?, last_activity_at = ?, updated_at = ?
               WHERE (id = ? OR customer_id = ?) AND COALESCE(current_points, 0) >= ?`
            ).bind(pointsCost, now, now, accountId, customerId, pointsCost).run();
          }
        } else {
          deductRes = await db.prepare(
            `UPDATE loyalty_accounts
             SET current_points = current_points - ?, last_activity_at = ?, updated_at = ?
             WHERE (id = ? OR customer_id = ?) AND COALESCE(current_points, 0) >= ?`
          ).bind(pointsCost, now, now, accountId, customerId, pointsCost).run();
        }
        if ((deductRes?.meta?.changes ?? 1) === 0) {
          await rollbackQuotaReservation();
          return c.json({ success: false, error: 'Insufficient points' }, 409);
        }
        if (effectiveTenant) {
          await db.prepare(
            `UPDATE customers
             SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?), updated_at = ?
             WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(pointsCost, now, customerId, effectiveTenant).run().catch(async () => {
            if (allowUnscopedWrite) {
              await db.prepare(
                `UPDATE customers
                 SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?), updated_at = ?
                 WHERE id = ?`
              ).bind(pointsCost, now, customerId).run().catch(() => {});
            }
          });
        } else {
          await db.prepare(
            `UPDATE customers
             SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?), updated_at = ?
             WHERE id = ?`
          ).bind(pointsCost, now, customerId).run().catch(() => {});
        }
        const postAcct = await db.prepare(
          'SELECT current_points FROM loyalty_accounts WHERE id = ? OR customer_id = ? LIMIT 1'
        ).bind(accountId, customerId).first<{ current_points?: number }>().catch(() => null);
        if (typeof postAcct?.current_points === 'number') {
          authoritativeBalance = Number(postAcct.current_points);
        }
      } catch {
        const ok = await deductFromCustomersOnly();
        if (!ok) {
          return c.json({ success: false, error: 'Insufficient points' }, 409);
        }
      }
    }

    await recordLoyaltyTransactionDualWrite(db, {
      txId: transactionId,
      accountId,
      customerId,
      type: 'redeem',
      points: pointsChange,
      balanceAfter: authoritativeBalance,
      orderId: body.orderId || null,
      rewardId: id,
      description: `Redeemed: ${rewardName}`,
      reason: `Redeemed: ${rewardName}`,
      idempotencyKey: body.idempotencyKey ?? null,
      tenantId: resolvedRedeemTenant,
      now,
    });

    if (!quotaReserved && !fromRewardsTable) {
      try {
        await db.prepare(
          "UPDATE loyalty_rewards SET current_redemptions = COALESCE(current_redemptions, 0) + 1 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, effectiveTenant).run();
      } catch {
        if (allowUnscopedWrite) {
          try {
            await db.prepare(
              'UPDATE loyalty_rewards SET current_redemptions = COALESCE(current_redemptions, 0) + 1 WHERE id = ?'
            ).bind(id).run();
          } catch {
            await db.prepare(
              'UPDATE loyalty_rewards SET redeemed_count = COALESCE(redeemed_count, 0) + 1 WHERE id = ?'
            ).bind(id).run().catch(() => {});
          }
        } else {
          await db.prepare(
            "UPDATE loyalty_rewards SET redeemed_count = COALESCE(redeemed_count, 0) + 1 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, effectiveTenant).run().catch(() => {});
        }
      }
    }

    const writeTenant = effectiveTenant || 'default';
    const voucherRand = new Uint8Array(3);
    crypto.getRandomValues(voucherRand);
    const voucherSuffix = Array.from(voucherRand, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const voucherCode = `RWD-${Date.now().toString(36).toUpperCase()}-${voucherSuffix}`;
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO loyalty_redemptions (
          id, customer_id, reward_id, code, points_spent, order_id, status, expires_at, redeemed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
      ).bind(`lrd_${transactionId}`, customerId, id, voucherCode, pointsCost, body.orderId || null, expiresAt, now, now).run();
      await db.prepare('UPDATE loyalty_redemptions SET tenant_id = ? WHERE id = ?').bind(writeTenant, `lrd_${transactionId}`).run().catch(() => {});
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
      await db.prepare('UPDATE user_rewards SET tenant_id = ? WHERE id = ?').bind(writeTenant, `uwr_${transactionId}`).run().catch(() => {});
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
      now,
      resolvedRedeemTenant
    );

    return c.json({
      success: true,
      data: {
        transactionId,
        reward: {
          ...mapRewardRow(reward),
          currentRedemptions: currentRedemptions + 1,
        },
        newBalance: authoritativeBalance,
        expiresAt,
      },
    });
  });
}

