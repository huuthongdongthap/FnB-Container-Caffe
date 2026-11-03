/**
 * Dynamic Pricing & Happy Hour Router
 * Edge-automated time and velocity pricing with margin floor protection.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { getTenantId, resolvePublicTenantId as resolvePricingTenantId } from '../middleware/tenant';
import { matchesTenantRow } from '../lib/db';
import type { DynamicPricingRule as DynamicPricingRuleRow } from '../types/api';

export const dynamicPricingRouter = new Hono<{ Bindings: Env }>();

dynamicPricingRouter.use('/*', async (c, next) => {
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    return optionalAuth()(c, next);
  }
  return next();
});

export function getVietnamTime(date: Date): { day: number; minutes: number } {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false, weekday: 'short', hour: 'numeric', minute: 'numeric'
  }).formatToParts(safeDate);
  let h = 0;
  let m = 0;
  let day = safeDate.getDay();
  for (const p of parts) {
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') m = parseInt(p.value, 10);
    if (p.type === 'weekday') day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.value);
  }
  return { day: day === -1 ? safeDate.getDay() : day, minutes: (h % 24) * 60 + m };
}

export function isRuleActiveAt(rule: DynamicPricingRuleRow, date: Date = new Date()): boolean {
  if (!rule.is_active) return false;
  const { day, minutes } = getVietnamTime(date);
  const days = rule.days_of_week.split(',').map((d) => parseInt(d.trim(), 10));
  if (!days.includes(day)) return false;

  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
  const timeStr = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  if (rule.start_time <= rule.end_time) {
    return timeStr >= rule.start_time && timeStr <= rule.end_time;
  }
  return timeStr >= rule.start_time || timeStr <= rule.end_time;
}

const calculateSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().min(1),
    price: z.number().nonnegative(),
    category: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    unit_cost: z.number().nonnegative().optional()
  })).min(1).max(100),
  timestamp: z.string().optional()
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  rule_type: z.enum(['happy_hour', 'early_bird', 'category_flash', 'velocity_clearance']),
  discount_percent: z.number().min(1).max(70),
  target_category: z.string().optional(),
  target_product_id: z.string().optional(),
  min_margin_percent: z.number().min(0).max(100).default(30),
  days_of_week: z.string().regex(/^[0-6](\s*,\s*[0-6])*$/).default('1,2,3,4,5'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  is_active: z.boolean().default(true)
});

// GET /api/pricing/dynamic/active
dynamicPricingRouter.get('/active', async (c) => {
  const tenantId = resolvePricingTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const rawTs = c.req.query('timestamp');
  const date = rawTs ? new Date(rawTs) : new Date();
  if (rawTs && Number.isNaN(date.getTime())) {
    return c.json({ success: false, error: 'Invalid timestamp' }, 400);
  }

  const { results: rules } = await db.prepare(
    "SELECT * FROM dynamic_pricing_rules WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND is_active = 1"
  ).bind(tenantId, tenantId).all<DynamicPricingRuleRow>().catch(() => ({ results: [] }));

  const active = (rules || [])
    .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
    .filter((r) => isRuleActiveAt(r, date));
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
  const tenantId = resolvePricingTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const evalDate = timestamp ? new Date(timestamp) : new Date();
  if (timestamp && Number.isNaN(evalDate.getTime())) {
    return c.json({ success: false, error: 'Invalid timestamp' }, 400);
  }

  const { results: rules } = await db.prepare(
    "SELECT * FROM dynamic_pricing_rules WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND is_active = 1"
  ).bind(tenantId, tenantId).all<DynamicPricingRuleRow>().catch(() => ({ results: [] }));

  const activeRules = (rules || [])
    .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
    .filter((r) => isRuleActiveAt(r, evalDate));

  const user = c.get('user' as never) as { id?: string; role?: string } | undefined;
  const isPrivilegedCaller = Boolean(user?.role && user.role !== 'customer');

  const serverCostByProduct = new Map<string, number>();
  const serverPriceByProduct = new Map<string, number>();
  const lookupProductIds = Array.from(
    new Set(
      items
        .filter((it) => !isPrivilegedCaller || it.unit_cost === undefined || it.unit_cost <= 0)
        .map((it) => it.product_id)
    )
  );

  if (lookupProductIds.length > 0) {
    const placeholders = lookupProductIds.map(() => '?').join(', ');
    let batchMatchedAny = false;
    try {
      const batchStmt = db
        .prepare(`SELECT id, price, cost_price, tenant_id FROM products WHERE id IN (${placeholders})`)
        .bind(...lookupProductIds);
      if (typeof (batchStmt as { all?: unknown }).all === 'function') {
        const { results: prodRows } = await batchStmt.all<{
          id: string;
          price?: number | null;
          cost_price?: number | null;
          tenant_id?: string | null;
        }>();
        for (const row of prodRows || []) {
          if (row && lookupProductIds.includes(row.id) && matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
            batchMatchedAny = true;
            if (Number(row.cost_price) > 0) {
              serverCostByProduct.set(row.id, Number(row.cost_price));
            }
            if (Number(row.price) > 0) {
              serverPriceByProduct.set(row.id, Number(row.price));
            }
          }
        }
      }
    } catch {
      // Fallback to per-id query below when batch query is unsupported by schema or mock
    }

    if (!batchMatchedAny) {
      for (const productId of lookupProductIds) {
        if (!serverCostByProduct.has(productId)) {
          try {
            const stmt = db.prepare('SELECT id, price, cost_price, tenant_id FROM products WHERE id = ?').bind(productId);
            if (typeof (stmt as { first?: unknown }).first === 'function') {
              const row = await stmt.first<{ id: string; price?: number | null; cost_price?: number | null; tenant_id?: string | null }>();
              if (row && matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
                if (Number(row.cost_price) > 0) {
                  serverCostByProduct.set(productId, Number(row.cost_price));
                }
                if (Number(row.price) > 0) {
                  serverPriceByProduct.set(productId, Number(row.price));
                }
              }
            }
          } catch {
            try {
              const fallbackStmt = db.prepare('SELECT id, cost_price, tenant_id FROM products WHERE id = ?').bind(productId);
              if (typeof (fallbackStmt as { first?: unknown }).first === 'function') {
                const row = await fallbackStmt.first<{ id: string; cost_price?: number | null; tenant_id?: string | null }>();
                if (row && matchesTenantRow(row as unknown as Record<string, unknown>, tenantId) && Number(row.cost_price) > 0) {
                  serverCostByProduct.set(productId, Number(row.cost_price));
                }
              }
            } catch {
              // Fallback if products table or cost_price column is unavailable
            }
          }
        }
      }
    }
  }

  let originalTotal = 0;
  let discountedTotal = 0;

  const calculatedItems = items.map((item) => {
    const serverPrice = serverPriceByProduct.get(item.product_id);
    const effectivePrice = !isPrivilegedCaller && serverPrice !== undefined && serverPrice > 0
      ? Math.max(serverPrice, item.price)
      : item.price;
    const itemSubtotal = effectivePrice * item.quantity;
    originalTotal += itemSubtotal;

    // Find first matching active rule (specific product takes priority over category)
    const matchedRule = activeRules.find((r) => r.target_product_id === item.product_id) ||
      activeRules.find((r) => r.target_category && r.target_category === item.category) ||
      activeRules.find((r) => !r.target_product_id && !r.target_category);

    if (!matchedRule) {
      discountedTotal += itemSubtotal;
      return { ...item, price: effectivePrice, original_price: effectivePrice, final_price: effectivePrice, discount_applied: 0, rule_name: null };
    }

    let discountPercent = matchedRule.discount_percent;
    const serverCost = serverCostByProduct.get(item.product_id);
    const effectiveUnitCost = !isPrivilegedCaller
      ? (serverCost !== undefined && serverCost > 0
          ? Math.max(serverCost, item.unit_cost || 0)
          : (item.unit_cost !== undefined && item.unit_cost > 0 ? item.unit_cost : undefined))
      : (item.unit_cost !== undefined && item.unit_cost > 0
          ? item.unit_cost
          : serverCost);

    // Margin Floor Protection: Final price cannot be below unit_cost * (1 + min_margin / 100)
    if (effectiveUnitCost !== undefined && effectiveUnitCost > 0) {
      const minAllowablePrice = effectiveUnitCost * (1 + (matchedRule.min_margin_percent / 100));
      const requestedPrice = effectivePrice * (1 - discountPercent / 100);
      if (requestedPrice < minAllowablePrice) {
        const cappedDiscount = Math.max(0, ((effectivePrice - minAllowablePrice) / effectivePrice) * 100);
        discountPercent = Math.floor(cappedDiscount);
      }
    }

    const unitDiscount = Math.round(effectivePrice * (discountPercent / 100));
    const finalPrice = Math.max(0, effectivePrice - unitDiscount);
    const itemFinalTotal = finalPrice * item.quantity;
    discountedTotal += itemFinalTotal;

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      original_price: effectivePrice,
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
dynamicPricingRouter.get('/rules', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async (c) => {
  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const { results } = await db.prepare(
    "SELECT * FROM dynamic_pricing_rules WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY created_at DESC"
  ).bind(tenantId, tenantId).all<DynamicPricingRuleRow>();

  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

// POST /api/pricing/dynamic/rules
dynamicPricingRouter.post('/rules', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid rule' }, 400);
  }

  const data = parsed.data;
  const rawTenant = getTenantId(c);
  const tenantId = rawTenant === '*' ? 'default' : rawTenant;
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const randBytes = new Uint8Array(3);
  crypto.getRandomValues(randBytes);
  const randHex = Array.from(randBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const ruleId = `rule_${Date.now().toString(36)}_${randHex}`;

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
