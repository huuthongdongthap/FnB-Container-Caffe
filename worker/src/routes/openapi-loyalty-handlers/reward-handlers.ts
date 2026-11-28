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
  isUnverifiedCustomerPhoneSession,
  matchesLoyaltyTenant,
  resolveRewardTenantId,
  writeLoyaltyAuditLog,
} from './loyalty-db-helpers';
import { redeemRewardAtomically } from './atomic-reward-redemption';

const LOYALTY_REWARD_WRITE_ROLES = ['owner', 'manager', 'admin'];

const TIER_RANK: Record<string, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
  vip: 4,
};

function resolveEffectivePointsCost(r: Record<string, unknown>): number {
  const pc = r.points_cost !== undefined && r.points_cost !== null ? Number(r.points_cost) : null;
  const legacyPc = r.point_cost !== undefined && r.point_cost !== null ? Number(r.point_cost) : null;
  if (legacyPc !== null && Number.isFinite(legacyPc) && (pc === null || (pc === 100 && legacyPc !== 100))) {
    return legacyPc;
  }
  return pc !== null && Number.isFinite(pc) ? pc : 100;
}

function resolveEffectiveRewardType(r: Record<string, unknown>): string {
  const t = typeof r.type === 'string' && r.type.trim() ? r.type.trim() : null;
  const rt = typeof r.reward_type === 'string' && r.reward_type.trim() ? r.reward_type.trim() : null;
  const dt = typeof r.discount_type === 'string' && r.discount_type.trim() ? r.discount_type.trim() : null;
  if (dt && (!t || (t === 'fixed' && dt !== 'fixed'))) {
    return dt;
  }
  return t ?? rt ?? dt ?? 'voucher';
}

function mapRewardRow(r: any) {
  return {
    ...r,
    name: r.name ?? r.title,
    type: resolveEffectiveRewardType(r),
    value: r.value ?? r.reward_value ?? r.discount_value ?? 0,
    pointsCost: resolveEffectivePointsCost(r),
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
        points_cost: resolveEffectivePointsCost(raw),
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
    let allLoyaltyRewards: any[] = [];
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
      allLoyaltyRewards = scoped;
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
      allLoyaltyRewards = rewardResults;
    }

    if (((tenantId !== '*' ? allLoyaltyRewards.length === 0 : total === 0) || tenantId === 'default') && !query.type) {
      try {
        const activeFilter = query.isActive !== undefined ? 'WHERE is_active = ?' : '';
        const activeParams = query.isActive !== undefined ? [query.isActive ? 1 : 0] : [];
        const fallbackRewards = (await db.prepare(
          `SELECT * FROM rewards ${activeFilter}`
        ).bind(...activeParams).all<Record<string, unknown>>()) as { results?: Record<string, unknown>[] };
        const baseRewards = tenantId !== '*' ? allLoyaltyRewards : rewardResults;
        const existingIds = new Set(baseRewards.map((r: Record<string, unknown>) => String(r.id)));
        const mergedFallback: Record<string, unknown>[] = [];
        for (const r of fallbackRewards.results || []) {
          if (!existingIds.has(String(r.id)) && (await checkRewardTenant(db, r, tenantId))) {
            mergedFallback.push(r);
          }
        }
        if (mergedFallback.length > 0) {
          const combined = [...baseRewards, ...mergedFallback].sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              resolveEffectivePointsCost(a) - resolveEffectivePointsCost(b)
          );
          total = combined.length;
          rewardResults = combined.slice(offset, offset + limit);
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
      } catch {
        try {
          await db.prepare(
            `INSERT INTO loyalty_rewards (id, name, description, points_cost, reward_type, reward_value, stock, redeemed_count, is_active, tenant_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
          ).bind(
            id,
            body.name,
            body.description || null,
            body.pointsCost,
            body.type,
            String(body.value ?? ''),
            body.maxRedemptions ?? null,
            isActiveInt,
            tenantId,
            now
          ).run();
        } catch (legacyRewardErr) {
          if (!/no such column:\s*tenant_id|no column named\s*tenant_id/i.test(String(legacyRewardErr))) {
            throw legacyRewardErr;
          }
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
      }
    }

    try {
      try {
        await db.prepare(
          `INSERT OR IGNORE INTO rewards (
            id, title, name, description, point_cost, points_cost,
            discount_type, discount_value, type, value, reward_type, reward_value,
            min_tier, stock, image_url, is_active, tenant_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bronze', ?, ?, ?, ?, ?, ?)`
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
          tenantId,
          now,
          now
        ).run();
      } catch (rewardsErr) {
        if (!/no such column:\s*tenant_id|no column named\s*tenant_id/i.test(String(rewardsErr))) {
          throw rewardsErr;
        }
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
      }
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

    const isStaffRedeem = ['owner', 'admin', 'manager', 'supervisor', 'staff', 'cashier'].includes(String(user.role || '').toLowerCase());
    const customerLookupId =
      isStaffRedeem && body.customerId && String(body.customerId).trim()
        ? String(body.customerId).trim()
        : String(user.customerId || user.customer_id || user.id);
    if (!isStaffRedeem && await isUnverifiedCustomerPhoneSession(db, user, customerLookupId, tenantId)) {
      return c.json({
        success: false,
        code: 'PHONE_VERIFICATION_REQUIRED',
        error: 'Vui lòng xác thực mã OTP để sử dụng ví hoàn tiền và ưu đãi.',
      }, 403);
    }
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
    const maxRedemptions = reward.max_redemptions;
    const pointsCost = resolveEffectivePointsCost(reward);

    // Always verify customer has sufficient points to redeem the reward
    if (currentPoints < pointsCost) {
      return c.json({ success: false, error: 'Insufficient points' }, 400);
    }

    if (reward.stock !== undefined && reward.stock !== null && Number(reward.stock) === 0) {
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
    // Check idempotency isolated by tenant and account ownership
    const existing = await findExistingLoyaltyIdempotencyTx(db, body.idempotencyKey, {
      tenantId: resolvedRedeemTenant,
      accountId,
      customerId,
    });
    if (existing) {
      return c.json({ success: false, error: 'Duplicate redemption request' }, 409);
    }

    const transactionId = crypto.randomUUID();
    const pointsChange = -pointsCost;
    let authoritativeBalance: number;

    const writeTenant = effectiveTenant || 'default';
    const voucherRand = new Uint8Array(3);
    crypto.getRandomValues(voucherRand);
    const voucherSuffix = Array.from(voucherRand, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const voucherCode = `RWD-${Date.now().toString(36).toUpperCase()}-${voucherSuffix}`;
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    try {
      authoritativeBalance = await redeemRewardAtomically(db, {
        accountId, customerId, rewardId: id, tenantId: writeTenant,
        usingCustomersFallback, fromRewardsTable, pointsCost, transactionId,
        voucherCode, expiresAt, now, rewardName, orderId: body.orderId || null,
        idempotencyKey: body.idempotencyKey ?? null,
      });
    } catch (error) {
      const conflict = /integer overflow|UNIQUE constraint failed|Redemption conflict/i.test(String(error));
      return c.json({ success: false, error: conflict
        ? 'Redemption conflict: points or reward availability changed'
        : 'Reward redemption unavailable' }, conflict ? 409 : 503);
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
        voucherCode,
        code: voucherCode,
        reward: {
          ...mapRewardRow(reward),
          currentRedemptions: currentRedemptions + 1,
        },
        newBalance: authoritativeBalance,
        expiresAt,
        expires_at: expiresAt,
      },
    });
  });
}

