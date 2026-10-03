/**
 * Dynamic Pricing & Happy Hour Router
 * Edge-automated time and velocity pricing with margin floor protection.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import type { DynamicPricingRule as DynamicPricingRuleRow } from '../types/api';

export const dynamicPricingRouter = new Hono<{ Bindings: Env }>();

export function getVietnamTime(date: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false, weekday: 'short', hour: 'numeric', minute: 'numeric'
  }).formatToParts(date);
  let h = 0;
  let m = 0;
  let day = date.getDay();
  for (const p of parts) {
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') m = parseInt(p.value, 10);
    if (p.type === 'weekday') day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.value);
  }
  return { day: day === -1 ? date.getDay() : day, minutes: (h % 24) * 60 + m };
}

export function isRuleActiveAt(rule: DynamicPricingRuleRow, date: Date = new Date()): boolean {
  if (!rule.is_active) return false;
  const { day, minutes } = getVietnamTime(date);
  const days = rule.days_of_week.split(',').map((d) => parseInt(d.trim(), 10));
  if (!days.includes(day)) return false;

  const [sH, sM] = rule.start_time.split(':').map(Number);
  const [eH, eM] = rule.end_time.split(':').map(Number);
  return minutes >= (sH || 0) * 60 + (sM || 0) && minutes <= (eH || 0) * 60 + (eM || 0);
}

const calculateSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().min(1),
    price: z.number().nonnegative(),
    category: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    unit_cost: z.number().nonnegative().optional()
  })).min(1),
  timestamp: z.string().optional()
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  rule_type: z.enum(['happy_hour', 'early_bird', 'category_flash', 'velocity_clearance']),
  discount_percent: z.number().min(1).max(70),
  target_category: z.string().optional(),
  target_product_id: z.string().optional(),
  min_margin_percent: z.number().min(0).max(100).default(30),
  days_of_week: z.string().default('1,2,3,4,5'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  is_active: z.boolean().default(true)
});

// GET /api/pricing/dynamic/active
dynamicPricingRouter.get('/active', async (c) => {
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const date = c.req.query('timestamp') ? new Date(c.req.query('timestamp')!) : new Date();

  const { results: rules } = await db.prepare(
    'SELECT * FROM dynamic_pricing_rules WHERE tenant_id = ? AND is_active = 1'
  ).bind(tenantId).all<DynamicPricingRuleRow>();

  const active = (rules || []).filter((r) => isRuleActiveAt(r, date));
  return c.json({ success: true, count: active.length, data: active });
});

// POST /api/pricing/dynamic/calculate
dynamicPricingRouter.post('/calculate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = calculateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid items payload' }, 400);
  }

  const { items, timestamp } = parsed.data;
  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const evalDate = timestamp ? new Date(timestamp) : new Date();

  const { results: rules } = await db.prepare(
    'SELECT * FROM dynamic_pricing_rules WHERE tenant_id = ? AND is_active = 1'
  ).bind(tenantId).all<DynamicPricingRuleRow>();

  const activeRules = (rules || []).filter((r) => isRuleActiveAt(r, evalDate));

  let originalTotal = 0;
  let discountedTotal = 0;

  const calculatedItems = items.map((item) => {
    const itemSubtotal = item.price * item.quantity;
    originalTotal += itemSubtotal;

    // Find first matching active rule (specific product takes priority over category)
    const matchedRule = activeRules.find((r) => r.target_product_id === item.product_id) ||
      activeRules.find((r) => r.target_category && r.target_category === item.category) ||
      activeRules.find((r) => !r.target_product_id && !r.target_category);

    if (!matchedRule) {
      discountedTotal += itemSubtotal;
      return { ...item, original_price: item.price, final_price: item.price, discount_applied: 0, rule_name: null };
    }

    let discountPercent = matchedRule.discount_percent;

    // Margin Floor Protection: Final price cannot be below unit_cost * (1 + min_margin / 100)
    if (item.unit_cost !== undefined && item.unit_cost > 0) {
      const minAllowablePrice = item.unit_cost * (1 + (matchedRule.min_margin_percent / 100));
      const requestedPrice = item.price * (1 - discountPercent / 100);
      if (requestedPrice < minAllowablePrice) {
        const cappedDiscount = Math.max(0, ((item.price - minAllowablePrice) / item.price) * 100);
        discountPercent = Math.floor(cappedDiscount);
      }
    }

    const unitDiscount = Math.round(item.price * (discountPercent / 100));
    const finalPrice = Math.max(0, item.price - unitDiscount);
    const itemFinalTotal = finalPrice * item.quantity;
    discountedTotal += itemFinalTotal;

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      original_price: item.price,
      final_price: finalPrice,
      discount_applied: unitDiscount * item.quantity,
      discount_percent: discountPercent,
      rule_name: matchedRule.name
    };
  });

  return c.json({
    success: true,
    data: {
      original_total: originalTotal,
      discounted_total: discountedTotal,
      total_savings: originalTotal - discountedTotal,
      items: calculatedItems
    }
  });
});

// GET /api/pricing/dynamic/rules
dynamicPricingRouter.get('/rules', requireAuth(['owner', 'manager']), async (c) => {
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const { results } = await db.prepare(
    'SELECT * FROM dynamic_pricing_rules WHERE tenant_id = ? ORDER BY created_at DESC'
  ).bind(tenantId).all<DynamicPricingRuleRow>();

  return c.json({ success: true, data: results || [] });
});

// POST /api/pricing/dynamic/rules
dynamicPricingRouter.post('/rules', requireAuth(['owner', 'manager']), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid rule' }, 400);
  }

  const data = parsed.data;
  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const ruleId = `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  await db.prepare(`
    INSERT INTO dynamic_pricing_rules (
      id, tenant_id, name, rule_type, discount_percent, target_category,
      target_product_id, min_margin_percent, days_of_week, start_time, end_time, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    ruleId, tenantId, data.name, data.rule_type, data.discount_percent,
    data.target_category || null, data.target_product_id || null, data.min_margin_percent,
    data.days_of_week, data.start_time, data.end_time, data.is_active ? 1 : 0
  ).run();

  return c.json({ success: true, message: 'Dynamic pricing rule created', id: ruleId }, 201);
});
