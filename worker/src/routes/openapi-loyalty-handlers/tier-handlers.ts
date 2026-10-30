import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';
import { getDatabase } from '../../lib/db';
import { writeLoyaltyAuditLog } from './loyalty-db-helpers';

export function registerTierHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/tiers - List all loyalty tier configurations
  app.openapi(LoyaltyRoutes.tiers.list as any, async (c: any) => {
    const db = getDatabase(c);

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

    return c.json({
      success: true,
      data: tiers.results || [],
    });
  });

  // GET /api/loyalty/tiers/{tier} - Get loyalty tier config by tier
  app.openapi(LoyaltyRoutes.tiers.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { tier } = c.req.valid('param');

    let config: any = null;
    try {
      config = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
    } catch {
      config = null;
    }
    if (!config) {
      config = await db.prepare(
        'SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, \'[]\') as benefits FROM tier_configs WHERE tier = ?'
      ).bind(tier).first().catch(() => null);
    }

    if (!config) {
      return c.json({ success: false, error: 'Tier config not found' }, 404);
    }

    return c.json({ success: true, data: config });
  });

  // PATCH /api/loyalty/tiers/{tier} - Update loyalty tier config
  app.openapi(LoyaltyRoutes.tiers.update as any, async (c: any) => {
    const db = getDatabase(c);
    const user = c.get('user');
    if (user?.role !== 'owner' && user?.role !== 'manager' && user?.role !== 'admin') {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    const { tier } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
    } catch {
      usingCanonical = true;
    }
    if (!existing) {
      existing = await db.prepare(
        'SELECT *, COALESCE(display_name_vi, tier_name, tier) as name, points_multiplier as point_multiplier, COALESCE(benefits, perks, \'[]\') as benefits FROM tier_configs WHERE tier = ?'
      ).bind(tier).first().catch(() => null);
      if (existing) {
        usingCanonical = true;
      }
    }
    if (!existing) {
      return c.json({ success: false, error: 'Tier config not found' }, 404);
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
      updates.push('point_multiplier = ?', 'points_multiplier = ?'); params.push(body.pointMultiplier, body.pointMultiplier);
      canonicalUpdates.push('point_multiplier = ?', 'points_multiplier = ?'); canonicalParams.push(body.pointMultiplier, body.pointMultiplier);
      loyaltyTiersUpdates.push('point_multiplier = ?', 'points_multiplier = ?'); loyaltyTiersParams.push(body.pointMultiplier, body.pointMultiplier);
    }
    if (body.discountPercent !== undefined) {
      updates.push('discount_percent = ?'); params.push(body.discountPercent);
    }
    if (body.birthdayBonus !== undefined) {
      updates.push('birthday_bonus = ?'); params.push(body.birthdayBonus);
      loyaltyTiersUpdates.push('birthday_discount = ?'); loyaltyTiersParams.push(body.birthdayBonus);
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
      updates.push('benefits = ?'); params.push(benefitsJson);
      canonicalUpdates.push('perks = ?'); canonicalParams.push(benefitsJson);
      loyaltyTiersUpdates.push('perks = ?'); loyaltyTiersParams.push(benefitsJson);
    }

    if (updates.length === 0) {
      return c.json({ success: true, data: existing });
    }

    updates.push('updated_at = ?');
    params.push(now, tier);

    if (!usingCanonical) {
      await db.prepare(`UPDATE loyalty_tier_configs SET ${updates.join(', ')} WHERE tier = ?`).bind(...params).run();
    }

    if (canonicalUpdates.length > 0) {
      canonicalUpdates.push('updated_at = ?');
      canonicalParams.push(now, tier);
      await db.prepare(`UPDATE tier_configs SET ${canonicalUpdates.join(', ')} WHERE tier = ?`).bind(...canonicalParams).run().catch(() => {});
    }

    if (loyaltyTiersUpdates.length > 0) {
      loyaltyTiersUpdates.push('updated_at = ?');
      loyaltyTiersParams.push(now, tier);
      await db.prepare(`UPDATE loyalty_tiers SET ${loyaltyTiersUpdates.join(', ')} WHERE tier_name = ?`).bind(...loyaltyTiersParams).run().catch(() => {});
    }

    await writeLoyaltyAuditLog(db, user.id, 'loyalty_tier_update', 'loyalty_tier', tier, JSON.stringify(body), now);

    let config: any = null;
    if (!usingCanonical) {
      config = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();
    }
    if (!config) {
      config = await db.prepare('SELECT *, points_multiplier as point_multiplier FROM tier_configs WHERE tier = ?').bind(tier).first().catch(() => null);
    }
    return c.json({ success: true, data: config });
  });
}
