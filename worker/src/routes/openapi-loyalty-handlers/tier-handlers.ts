import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { getTenantId, resolvePublicTenantId } from '../../middleware/tenant';
import { hasOpenApiLoyaltyTenantMismatch, writeLoyaltyAuditLog } from './loyalty-db-helpers';

export function registerTierHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/tiers - List all loyalty tier configurations
  app.openapi(LoyaltyRoutes.tiers.list as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = resolvePublicTenantId(c);
    if (c.get?.('user') && hasOpenApiLoyaltyTenantMismatch(c, tenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }

    let tiers: { results: any[] } = { results: [] };
    try {
      tiers = (await db.prepare('SELECT * FROM loyalty_tier_configs ORDER BY min_points ASC').all()) as { results: any[] };
    } catch {
      tiers = { results: [] };
    }
    if (!tiers.results || tiers.results.length === 0) {
      tiers = (await db.prepare(
        'SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, \'[]\') as benefits FROM tier_configs ORDER BY min_points ASC'
      ).all().catch(() => ({ results: [] }))) as { results: any[] };
    }

    const rawRows = tiers.results || [];
    const scopedRows = tenantId && tenantId !== '*'
      ? rawRows.filter((r) => matchesTenantRow(r, tenantId))
      : rawRows;
    const effectiveRows = scopedRows.length > 0
      ? scopedRows
      : rawRows.filter((r) => matchesTenantRow(r, 'default'));

    return c.json({
      success: true,
      data: effectiveRows,
    });
  });

  // GET /api/loyalty/tiers/{tier} - Get loyalty tier config by tier
  app.openapi(LoyaltyRoutes.tiers.get as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = resolvePublicTenantId(c);
    if (c.get?.('user') && hasOpenApiLoyaltyTenantMismatch(c, tenantId)) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant access denied' }, 403);
    }
    const { tier } = c.req.valid('param');

    let config: any = null;
    if (tenantId && tenantId !== '*') {
      try {
        config = await db
          .prepare("SELECT * FROM loyalty_tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(tier, tenantId)
          .first();
      } catch {
        config = null;
      }
    }
    if (!config) {
      try {
        config = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
      } catch {
        config = null;
      }
    }
    if (!config && tenantId && tenantId !== '*') {
      config = await db
        .prepare(
          "SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, '[]') as benefits FROM tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(tier, tenantId)
        .first()
        .catch(() => null);
    }
    if (!config) {
      config = await db.prepare(
        'SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, \'[]\') as benefits FROM tier_configs WHERE tier = ?'
      ).bind(tier).first().catch(() => null);
    }

    if (!config || (tenantId !== '*' && !matchesTenantRow(config, tenantId) && !matchesTenantRow(config, 'default'))) {
      return c.json({ success: false, error: 'Tier config not found' }, 404);
    }

    return c.json({ success: true, data: config });
  });

  // PATCH /api/loyalty/tiers/{tier} - Update loyalty tier config
  app.openapi(LoyaltyRoutes.tiers.update as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    if (!user || !['owner', 'admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    const userTenant =
      typeof user.tenantId === 'string'
        ? user.tenantId.trim()
        : typeof user.tenant_id === 'string'
          ? user.tenant_id.trim()
          : '';
    const isHqCaller = userTenant === '*' || userTenant.toLowerCase() === 'hq';
    const requestedOverride = (
      c.req?.query?.('tenant_id') ||
      c.req?.query?.('tenantId') ||
      c.req?.query?.('store_id') ||
      c.req?.query?.('storeId') ||
      c.req?.header?.('x-tenant-id') ||
      c.req?.header?.('X-Tenant-ID') ||
      c.req?.header?.('x-store-id') ||
      c.req?.header?.('X-Store-ID') ||
      ''
    ).trim();
    const rawResolvedTenant = getTenantId(c).trim() || 'default';
    const resolvedTenant = rawResolvedTenant.toLowerCase() === 'hq' ? '*' : rawResolvedTenant;
    const normalizedRequestedOverride = requestedOverride.toLowerCase() === 'hq' ? '*' : requestedOverride;
    const effectiveTenant =
      isHqCaller && normalizedRequestedOverride && normalizedRequestedOverride !== '*'
        ? normalizedRequestedOverride
        : resolvedTenant === '*'
          ? 'default'
          : resolvedTenant;
    const allowUnscopedTierFallback = effectiveTenant === 'default';
    if (
      hasOpenApiLoyaltyTenantMismatch(c, effectiveTenant) ||
      (!isHqCaller && requestedOverride && (requestedOverride === '*' || requestedOverride !== (userTenant || 'default'))) ||
      (effectiveTenant !== 'default' && (!userTenant || (userTenant !== effectiveTenant && !isHqCaller)))
    ) {
      return c.json({ success: false, error: 'Global tier configuration can only be modified by default tenant admin' }, 403);
    }
    const { tier } = c.req.valid('param');
    const validatedBody = (c.req.valid('json') || {}) as Record<string, unknown>;
    const rawBody = (await c.req.json?.().catch(() => ({}))) as Record<string, unknown>;
    const body = { ...(rawBody && typeof rawBody === 'object' ? rawBody : {}), ...validatedBody } as Record<string, any>;
    const bodyAny = body as Record<string, unknown>;

    if (body.minPoints !== undefined) {
      const minPts = Number(body.minPoints);
      if (typeof body.minPoints === 'boolean' || body.minPoints === null || !Number.isFinite(minPts) || minPts < 0) {
        return c.json({ success: false, error: 'minPoints must be a non-negative finite number' }, 400);
      }
    }
    if (body.maxPoints !== undefined && body.maxPoints !== null) {
      const maxPts = Number(body.maxPoints);
      if (typeof body.maxPoints === 'boolean' || !Number.isFinite(maxPts) || maxPts < 0) {
        return c.json({ success: false, error: 'maxPoints must be a non-negative finite number' }, 400);
      }
      if (body.minPoints !== undefined && maxPts <= Number(body.minPoints)) {
        return c.json({ success: false, error: 'maxPoints must be greater than minPoints' }, 400);
      }
    }
    if (body.pointMultiplier !== undefined) {
      const mult = Number(body.pointMultiplier);
      if (typeof body.pointMultiplier === 'boolean' || body.pointMultiplier === null || !Number.isFinite(mult) || mult <= 0) {
        return c.json({ success: false, error: 'pointMultiplier must be a positive finite number' }, 400);
      }
    }
    if (body.discountPercent !== undefined) {
      const disc = Number(body.discountPercent);
      if (typeof body.discountPercent === 'boolean' || body.discountPercent === null || !Number.isFinite(disc) || disc < 0 || disc > 100) {
        return c.json({ success: false, error: 'discountPercent must be between 0 and 100' }, 400);
      }
    }
    const birthdayBonus = bodyAny.birthday_bonus ?? body.birthdayBonus;
    if (birthdayBonus !== undefined) {
      const bonusVal = Number(birthdayBonus);
      if (typeof birthdayBonus === 'boolean' || birthdayBonus === null || birthdayBonus === '' || !Number.isFinite(bonusVal) || bonusVal < 0) {
        return c.json({ success: false, error: 'birthday_bonus must be a non-negative finite number' }, 400);
      }
    }
    const birthdayDiscount = bodyAny.birthday_discount ?? bodyAny.birthdayDiscount;
    if (birthdayDiscount !== undefined) {
      const bdayDiscVal = Number(birthdayDiscount);
      if (typeof birthdayDiscount === 'boolean' || birthdayDiscount === null || birthdayDiscount === '' || !Number.isFinite(bdayDiscVal) || bdayDiscVal < 0 || bdayDiscVal > 100) {
        return c.json({ success: false, error: 'birthday_discount must be between 0 and 100' }, 400);
      }
    }

    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    let needsTenantInsert = false;
    try {
      existing = await db
        .prepare("SELECT * FROM loyalty_tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(tier, effectiveTenant)
        .first();
      if (!existing && allowUnscopedTierFallback) {
        existing = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
      } else if (!existing && !allowUnscopedTierFallback) {
        const seedRow = await db
          .prepare("SELECT * FROM loyalty_tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'")
          .bind(tier)
          .first()
          .catch(() => null);
        if (seedRow) {
          existing = seedRow;
          needsTenantInsert = true;
        }
      }
    } catch {
      if (allowUnscopedTierFallback) {
        try {
          existing = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
        } catch {
          usingCanonical = true;
        }
      } else {
        usingCanonical = true;
      }
    }
    if (!existing) {
      existing = await db
        .prepare(
          "SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, '[]') as benefits FROM tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(tier, effectiveTenant)
        .first()
        .catch(() => null);
      if (!existing && allowUnscopedTierFallback) {
        existing = await db
          .prepare(
            "SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, '[]') as benefits FROM tier_configs WHERE tier = ?"
          )
          .bind(tier)
          .first()
          .catch(() => null);
      } else if (!existing && !allowUnscopedTierFallback) {
        const seedCanonical = await db
          .prepare(
            "SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, '[]') as benefits FROM tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'"
          )
          .bind(tier)
          .first()
          .catch(() => null);
        if (seedCanonical) {
          existing = seedCanonical;
          needsTenantInsert = true;
        }
      }
      if (existing) {
        usingCanonical = true;
      }
    }
    if (!existing) {
      return c.json({ success: false, error: 'Tier config not found' }, 404);
    }
    if (effectiveTenant !== 'default' && (!('tenant_id' in existing) || existing.tenant_id === undefined)) {
      return c.json({ success: false, error: 'Global tier configuration can only be modified by default tenant admin' }, 403);
    }

    const effectiveMinPoints =
      body.minPoints !== undefined
        ? Number(body.minPoints)
        : existing.min_points !== undefined && existing.min_points !== null
          ? Number(existing.min_points)
          : undefined;
    const effectiveMaxPoints =
      body.maxPoints !== undefined
        ? body.maxPoints === null
          ? null
          : Number(body.maxPoints)
        : existing.max_points !== undefined && existing.max_points !== null
          ? Number(existing.max_points)
          : null;
    if (
      effectiveMinPoints !== undefined &&
      effectiveMaxPoints !== null &&
      Number.isFinite(effectiveMinPoints) &&
      Number.isFinite(effectiveMaxPoints) &&
      effectiveMinPoints >= effectiveMaxPoints
    ) {
      return c.json({ success: false, error: 'maxPoints must be greater than minPoints' }, 400);
    }

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | boolean)[] = [];
    const loyaltyTiersUpdates: string[] = [];
    const loyaltyTiersParams: (string | number | boolean)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?'); params.push(body.name);
      canonicalUpdates.push('tier_name = ?', 'display_name_vi = ?'); canonicalParams.push(body.name, body.name);
      loyaltyTiersUpdates.push('display_name_vi = ?'); loyaltyTiersParams.push(body.name);
    }
    if (body.minPoints !== undefined) {
      updates.push('min_points = ?'); params.push(body.minPoints);
      canonicalUpdates.push('min_points = ?'); canonicalParams.push(body.minPoints);
      loyaltyTiersUpdates.push('min_points = ?'); loyaltyTiersParams.push(body.minPoints);
    }
    if (body.maxPoints !== undefined) { updates.push('max_points = ?'); params.push(body.maxPoints); }
    if (body.pointMultiplier !== undefined) {
      const hasPointMult = 'point_multiplier' in existing;
      const hasPointsMult = 'points_multiplier' in existing;
      if (hasPointMult && !hasPointsMult) {
        updates.push('point_multiplier = ?'); params.push(body.pointMultiplier);
      } else if (hasPointsMult && !hasPointMult) {
        updates.push('points_multiplier = ?'); params.push(body.pointMultiplier);
      } else {
        updates.push('point_multiplier = ?', 'points_multiplier = ?'); params.push(body.pointMultiplier, body.pointMultiplier);
      }
      canonicalUpdates.push('point_multiplier = ?', 'points_multiplier = ?'); canonicalParams.push(body.pointMultiplier, body.pointMultiplier);
      loyaltyTiersUpdates.push('point_multiplier = ?', 'points_multiplier = ?'); loyaltyTiersParams.push(body.pointMultiplier, body.pointMultiplier);
    }
    if (body.discountPercent !== undefined) {
      updates.push('discount_percent = ?'); params.push(body.discountPercent);
    }
    if (birthdayBonus !== undefined) {
      updates.push('birthday_bonus = ?'); params.push(Number(birthdayBonus));
    }
    if (birthdayDiscount !== undefined) {
      loyaltyTiersUpdates.push('birthday_discount = ?'); loyaltyTiersParams.push(Number(birthdayDiscount));
    }
    if (body.freeShipping !== undefined) { updates.push('free_shipping = ?'); params.push(body.freeShipping ? 1 : 0); }
    if (body.prioritySupport !== undefined) { updates.push('priority_support = ?'); params.push(body.prioritySupport ? 1 : 0); }
    if (body.color !== undefined) {
      updates.push('color = ?'); params.push(body.color);
      canonicalUpdates.push('color = ?'); canonicalParams.push(body.color);
      loyaltyTiersUpdates.push('color = ?'); loyaltyTiersParams.push(body.color);
    }
    if (body.icon !== undefined) { updates.push('icon = ?'); params.push(body.icon); }
    if (body.benefits !== undefined) {
      const benefitsJson = JSON.stringify(body.benefits);
      if ('perks' in existing && !('benefits' in existing)) {
        updates.push('perks = ?'); params.push(benefitsJson);
      } else {
        updates.push('benefits = ?'); params.push(benefitsJson);
      }
      canonicalUpdates.push('perks = ?'); canonicalParams.push(benefitsJson);
      loyaltyTiersUpdates.push('perks = ?'); loyaltyTiersParams.push(benefitsJson);
    }

    if (updates.length === 0 && canonicalUpdates.length === 0 && loyaltyTiersUpdates.length === 0) {
      return c.json({ success: true, data: existing });
    }

    if (needsTenantInsert && !usingCanonical) {
      const insertId = `${effectiveTenant}_${tier}`;
      await db
        .prepare(
          `INSERT INTO loyalty_tier_configs (
            id, tier, name, min_points, max_points, point_multiplier, discount_percent,
            free_shipping, priority_support, birthday_bonus, color, icon, benefits, tenant_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          insertId,
          tier,
          existing.name ?? tier,
          existing.min_points ?? 0,
          existing.max_points ?? null,
          existing.point_multiplier ?? existing.points_multiplier ?? 1,
          existing.discount_percent ?? 0,
          existing.free_shipping ?? 0,
          existing.priority_support ?? 0,
          existing.birthday_bonus ?? 0,
          existing.color ?? '#CD7F32',
          existing.icon ?? 'award',
          typeof existing.benefits === 'string' ? existing.benefits : JSON.stringify(existing.benefits ?? []),
          effectiveTenant,
          now,
          now
        )
        .run()
        .catch(async () => {
          const rowCopy: Record<string, unknown> = { ...existing, tenant_id: effectiveTenant };
          if ('id' in rowCopy) rowCopy.id = insertId;
          if ('updated_at' in rowCopy) rowCopy.updated_at = now;
          if ('created_at' in rowCopy) rowCopy.created_at = now;
          const cols = Object.keys(rowCopy);
          const placeholders = cols.map(() => '?').join(', ');
          await db
            .prepare(`INSERT INTO loyalty_tier_configs (${cols.join(', ')}) VALUES (${placeholders})`)
            .bind(...cols.map((k) => (rowCopy[k] as string | number | null) ?? null))
            .run()
            .catch(() => {});
        });
    } else if (needsTenantInsert && usingCanonical) {
      const insertId = `${effectiveTenant}_${tier}`;
      await db
        .prepare(
          `INSERT INTO tier_configs (
            id, tier, tier_name, display_name_vi, min_points, points_multiplier, point_multiplier,
            cashback_rate, birthday_bonus, perks, color, tenant_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          insertId,
          tier,
          existing.tier_name ?? existing.name ?? tier,
          existing.display_name_vi ?? existing.name ?? tier,
          existing.min_points ?? 0,
          existing.points_multiplier ?? existing.point_multiplier ?? 1,
          existing.point_multiplier ?? existing.points_multiplier ?? 1,
          existing.cashback_rate ?? 0,
          existing.birthday_bonus ?? 0,
          typeof existing.perks === 'string' ? existing.perks : JSON.stringify(existing.benefits ?? []),
          existing.color ?? '#CD7F32',
          effectiveTenant,
          now,
          now
        )
        .run()
        .catch(() => {});
    }

    if (updates.length > 0 && !usingCanonical) {
      updates.push('updated_at = ?');
      const scopedParams = [...params, now, tier, effectiveTenant];
      try {
        await db
          .prepare(`UPDATE loyalty_tier_configs SET ${updates.join(', ')} WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
          .bind(...scopedParams)
          .run();
      } catch (err) {
        if (!allowUnscopedTierFallback) {
          throw err;
        }
        await db
          .prepare(`UPDATE loyalty_tier_configs SET ${updates.join(', ')} WHERE tier = ?`)
          .bind(...params, now, tier)
          .run();
      }
    }

    if (canonicalUpdates.length > 0) {
      canonicalUpdates.push('updated_at = ?');
      const scopedCanonicalParams = [...canonicalParams, now, tier, effectiveTenant];
      await db
        .prepare(`UPDATE tier_configs SET ${canonicalUpdates.join(', ')} WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
        .bind(...scopedCanonicalParams)
        .run()
        .catch(async () => {
          if (allowUnscopedTierFallback) {
            await db
              .prepare(`UPDATE tier_configs SET ${canonicalUpdates.join(', ')} WHERE tier = ?`)
              .bind(...canonicalParams, now, tier)
              .run()
              .catch(() => {});
          }
        });
    }

    if (loyaltyTiersUpdates.length > 0) {
      loyaltyTiersUpdates.push('updated_at = ?');
      const scopedLoyaltyTiersParams = [...loyaltyTiersParams, now, tier, effectiveTenant];
      await db
        .prepare(`UPDATE loyalty_tiers SET ${loyaltyTiersUpdates.join(', ')} WHERE tier_name = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
        .bind(...scopedLoyaltyTiersParams)
        .run()
        .catch(async () => {
          if (allowUnscopedTierFallback) {
            await db
              .prepare(`UPDATE loyalty_tiers SET ${loyaltyTiersUpdates.join(', ')} WHERE tier_name = ?`)
              .bind(...loyaltyTiersParams, now, tier)
              .run()
              .catch(() => {});
          }
        });
    }

    await writeLoyaltyAuditLog(db, user.id, 'loyalty_tier_update', 'loyalty_tier', tier, JSON.stringify(body), now, effectiveTenant);

    let config: any = null;
    if (!usingCanonical) {
      config = await db
        .prepare("SELECT * FROM loyalty_tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(tier, effectiveTenant)
        .first()
        .catch(() => null);
      if (!config && allowUnscopedTierFallback) {
        config = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first().catch(() => null);
      }
    }
    if (!config) {
      config = await db
        .prepare("SELECT *, points_multiplier as point_multiplier FROM tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(tier, effectiveTenant)
        .first()
        .catch(() => null);
      if (!config && allowUnscopedTierFallback) {
        config = await db.prepare('SELECT *, points_multiplier as point_multiplier FROM tier_configs WHERE tier = ?').bind(tier).first().catch(() => null);
      }
    }
    return c.json({ success: true, data: config });
  });
}
