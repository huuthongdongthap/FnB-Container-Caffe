import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { LoyaltyRoutes } from '../../schemas/loyalty';

export function registerTierHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/loyalty/tiers - List all loyalty tier configurations
  app.openapi(LoyaltyRoutes.tiers.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;

    const tiers = await db.prepare('SELECT * FROM loyalty_tier_configs ORDER BY min_points ASC').all();

    return c.json({
      success: true,
      data: tiers.results,
    });
  });

  // GET /api/loyalty/tiers/{tier} - Get loyalty tier config by tier
  app.openapi(LoyaltyRoutes.tiers.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const { tier } = c.req.valid('param');

    const config = await db.prepare('SELECT * FROM loyalty_tier_configs WHERE tier = ?').bind(tier).first();

    if (!config) {
      return c.json({ success: false, error: 'Tier config not found' }, 404);
    }

    return c.json({ success: true, data: config });
  });

  // PATCH /api/loyalty/tiers/{tier} - Update loyalty tier config
  app.openapi(LoyaltyRoutes.tiers.update, async (c: Context<{ Bindings: Env }>) => {
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
}
