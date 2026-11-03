/**
 * Canonical Inventory / Recipe (BOM) Policy
 * Single Authoritative Policy for Recipe resolution, BOM consumption, deterministic stock deduction, and cost/margin computation.
 * Invariants: Products remain Catalog master; Never trust client quantities/costs; Stock deduction is idempotent.
 */
import type { D1Database } from '@cloudflare/workers-types';

export interface CanonicalRecipeComponent {
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
}

export interface CanonicalRecipe {
  id: string;
  productId: string;
  name?: string | null;
  instructions?: string | null;
  components: CanonicalRecipeComponent[];
  unitCost: number;
}

export interface OrderConsumptionCalculation {
  depletions: Array<{
    productId?: string;
    productIds?: string[];
    ingredientId: string;
    ingredientName?: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  coveredProductIds?: string[];
  totalCost: number;
  realizedRevenue: number;
  grossMargin: number;
  grossMarginPercent: number;
}

export interface StockDeductionResult {
  ok: boolean;
  alreadyDeducted: boolean;
  depletions: OrderConsumptionCalculation['depletions'];
  coveredProductIds?: string[];
  error?: string;
  insufficientIngredients?: Array<{ ingredientId: string; needed: number; available: number }>;
}

export async function getCanonicalRecipe(
  db: D1Database,
  productId: string,
  tenantId?: string
): Promise<CanonicalRecipe | null> {
  const effectiveTenant = tenantId && tenantId.trim() ? tenantId.trim() : undefined;
  let recipe: any = null;
  if (effectiveTenant && effectiveTenant !== '*') {
    try {
      recipe = await db.prepare(
        "SELECT id, product_id, name, instructions, tenant_id FROM recipes WHERE product_id = ? AND is_active = 1 AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) LIMIT 1"
      ).bind(productId, effectiveTenant).first<any>();
    } catch {
      // Fallback when is_active or tenant_id column is absent
    }
  }
  if (!recipe) {
    try {
      recipe = await db.prepare(
        'SELECT id, product_id, name, instructions, tenant_id FROM recipes WHERE product_id = ? AND is_active = 1 LIMIT 1'
      ).bind(productId).first<any>();
    } catch {
      try {
        recipe = await db.prepare(
          'SELECT id, product_id, name, instructions FROM recipes WHERE product_id = ? AND is_active = 1 LIMIT 1'
        ).bind(productId).first<any>();
      } catch {
        // Fallback when is_active column is absent
      }
    }
  }
  if (!recipe) {
    try {
      recipe = await db.prepare(
        'SELECT id, product_id, name, instructions, tenant_id FROM recipes WHERE product_id = ? LIMIT 1'
      ).bind(productId).first<any>();
    } catch {
      recipe = await db.prepare(
        'SELECT id, product_id, name, instructions FROM recipes WHERE product_id = ? LIMIT 1'
      ).bind(productId).first<any>();
    }
  }

  if (!recipe) return null;
  if (effectiveTenant && effectiveTenant !== '*' && 'tenant_id' in recipe && recipe.tenant_id !== undefined) {
    const recTenant = recipe.tenant_id && String(recipe.tenant_id).trim() ? String(recipe.tenant_id).trim() : 'default';
    if (recTenant !== effectiveTenant) return null;
  }

  const rows = await db.prepare(
    `SELECT ri.ingredient_id, ri.quantity, ri.unit, i.name as ing_name, COALESCE(i.cost_per_unit, 0) as cost_per_unit
     FROM recipe_items ri
     LEFT JOIN ingredients i ON ri.ingredient_id = i.id
     WHERE ri.recipe_id = ?`
  ).bind(recipe.id).all<any>();

  const components: CanonicalRecipeComponent[] = (rows.results || []).map((r: any) => ({
    ingredientId: r.ingredient_id,
    ingredientName: r.ing_name || undefined,
    quantity: Number(r.quantity || 0),
    unit: r.unit || 'g',
    costPerUnit: Number(r.cost_per_unit || 0),
  }));

  const unitCost = components.reduce((sum, c) => sum + (c.quantity * c.costPerUnit), 0);

  return {
    id: recipe.id,
    productId: recipe.product_id,
    name: recipe.name ?? null,
    instructions: recipe.instructions ?? null,
    components,
    unitCost,
  };
}

export async function calculateOrderConsumption(
  db: D1Database,
  orderItems: Array<{ productId: string; quantity: number; sellingPrice?: number }>,
  tenantId?: string
): Promise<OrderConsumptionCalculation> {
  const depletionsMap = new Map<string, {
    productId?: string;
    productIds: string[];
    ingredientId: string;
    ingredientName?: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>();
  const coveredProductIdSet = new Set<string>();

  let realizedRevenue = 0;

  for (const item of orderItems) {
    if (!item || typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      continue;
    }
    if (typeof item.sellingPrice === 'number' && Number.isFinite(item.sellingPrice) && item.sellingPrice >= 0) {
      realizedRevenue += item.sellingPrice * item.quantity;
    }
    const recipe = await getCanonicalRecipe(db, item.productId, tenantId);
    if (!recipe || recipe.components.length === 0) continue; // No BOM -> 0 consumption
    if (item.productId) {
      coveredProductIdSet.add(item.productId);
    }

    for (const comp of recipe.components) {
      const needed = comp.quantity * item.quantity;
      const existing = depletionsMap.get(comp.ingredientId);
      if (existing) {
        existing.quantity += needed;
        existing.totalCost = existing.quantity * existing.unitCost;
        if (item.productId && !existing.productIds.includes(item.productId)) {
          existing.productIds.push(item.productId);
        }
      } else {
        depletionsMap.set(comp.ingredientId, {
          productId: item.productId,
          productIds: item.productId ? [item.productId] : [],
          ingredientId: comp.ingredientId,
          ingredientName: comp.ingredientName,
          unit: comp.unit,
          quantity: needed,
          unitCost: comp.costPerUnit,
          totalCost: needed * comp.costPerUnit,
        });
      }
    }
  }

  const depletions = Array.from(depletionsMap.values());
  const coveredProductIds = Array.from(coveredProductIdSet);
  const totalCost = depletions.reduce((sum, d) => sum + d.totalCost, 0);
  const grossMargin = realizedRevenue - totalCost;
  const grossMarginPercent = realizedRevenue > 0 ? (grossMargin / realizedRevenue) * 100 : 0;

  return { depletions, coveredProductIds, totalCost, realizedRevenue, grossMargin, grossMarginPercent };
}

export async function deductOrderStock(
  db: D1Database,
  orderId: string,
  orderItems: Array<{ productId: string; quantity: number }>,
  options?: { allowNegative?: boolean; tenantId?: string }
): Promise<StockDeductionResult> {
  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    return { ok: false, alreadyDeducted: false, depletions: [], coveredProductIds: [], error: 'invalid_order_id' };
  }
  if (!Array.isArray(orderItems) || orderItems.some(i => !i || typeof i.quantity !== 'number' || !Number.isFinite(i.quantity) || i.quantity <= 0)) {
    return { ok: false, alreadyDeducted: false, depletions: [], coveredProductIds: [], error: 'invalid_order_items' };
  }
  const effectiveTenant = options?.tenantId && options.tenantId.trim() ? options.tenantId.trim() : undefined;
  // 1. Idempotency Guard
  let existing: { id: string } | null = null;
  if (effectiveTenant && effectiveTenant !== '*') {
    try {
      existing = await db.prepare(
        "SELECT id FROM stock_movements WHERE reference_id = ? AND reference_type = 'order' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(orderId, effectiveTenant).first<{ id: string }>();
    } catch {
      existing = await db.prepare(
        `SELECT id FROM stock_movements WHERE reference_id = ? AND reference_type = 'order' LIMIT 1`
      ).bind(orderId).first<{ id: string }>();
    }
  } else {
    existing = await db.prepare(
      `SELECT id FROM stock_movements WHERE reference_id = ? AND reference_type = 'order' LIMIT 1`
    ).bind(orderId).first<{ id: string }>();
  }

  if (existing) {
    return { ok: true, alreadyDeducted: true, depletions: [], coveredProductIds: [] };
  }

  // 2. Calculate Server-Side BOM Consumption
  const { depletions, coveredProductIds = [] } = await calculateOrderConsumption(db, orderItems, effectiveTenant);
  if (depletions.length === 0) {
    return { ok: true, alreadyDeducted: false, depletions: [], coveredProductIds };
  }

  // 3. Stock Level Verification
  if (!options?.allowNegative) {
    const insufficient: Array<{ ingredientId: string; needed: number; available: number }> = [];
    for (const d of depletions) {
      let ing: any = null;
      try {
        ing = await db.prepare('SELECT id, current_stock, tenant_id FROM ingredients WHERE id = ?').bind(d.ingredientId).first<any>();
      } catch {
        ing = await db.prepare('SELECT id, current_stock FROM ingredients WHERE id = ?').bind(d.ingredientId).first<any>();
      }
      if (ing && effectiveTenant && effectiveTenant !== '*' && 'tenant_id' in ing && ing.tenant_id !== undefined) {
        const ingTenant = ing.tenant_id && String(ing.tenant_id).trim() ? String(ing.tenant_id).trim() : 'default';
        if (ingTenant !== effectiveTenant) {
          ing = null;
        }
      }
      const current = Number(ing?.current_stock ?? 0);
      if (current < d.quantity) {
        insufficient.push({ ingredientId: d.ingredientId, needed: d.quantity, available: current });
      }
    }
    if (insufficient.length > 0) {
      return {
        ok: false,
        alreadyDeducted: false,
        depletions,
        coveredProductIds,
        error: 'insufficient_stock',
        insufficientIngredients: insufficient,
      };
    }
  }

  // 4. Atomic Deductions & Stock Movement Logging
  const now = new Date().toISOString();
  for (const d of depletions) {
    const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (effectiveTenant && effectiveTenant !== '*') {
      let ingRow: any = null;
      try {
        ingRow = await db.prepare('SELECT id, tenant_id FROM ingredients WHERE id = ?').bind(d.ingredientId).first<any>();
      } catch {
        // Optional tenant_id column
      }
      if (ingRow && 'tenant_id' in ingRow && ingRow.tenant_id !== undefined) {
        const ingTenant = ingRow.tenant_id && String(ingRow.tenant_id).trim() ? String(ingRow.tenant_id).trim() : 'default';
        if (ingTenant !== effectiveTenant) {
          continue;
        }
      }
      try {
        await db.prepare(
          "UPDATE ingredients SET current_stock = current_stock - ?, updated_at = ? WHERE id = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?4)"
        ).bind(d.quantity, now, d.ingredientId, effectiveTenant).run();
      } catch {
        await db.prepare(
          'UPDATE ingredients SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?'
        ).bind(d.quantity, now, d.ingredientId).run();
      }
    } else {
      await db.prepare(
        'UPDATE ingredients SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?'
      ).bind(d.quantity, now, d.ingredientId).run();
    }

    if (effectiveTenant && effectiveTenant !== '*') {
      try {
        await db.prepare(
          `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at, tenant_id)
           VALUES (?, ?, 'consumption', ?, ?, 'order', ?, ?, ?)`
        ).bind(movId, d.ingredientId, -d.quantity, orderId, `BOM deduction for order ${orderId}`, now, effectiveTenant).run();
      } catch {
        await db.prepare(
          `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at)
           VALUES (?, ?, 'consumption', ?, ?, 'order', ?, ?)`
        ).bind(movId, d.ingredientId, -d.quantity, orderId, `BOM deduction for order ${orderId}`, now).run();
      }
    } else {
      await db.prepare(
        `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at)
         VALUES (?, ?, 'consumption', ?, ?, 'order', ?, ?)`
      ).bind(movId, d.ingredientId, -d.quantity, orderId, `BOM deduction for order ${orderId}`, now).run();
    }
  }

  return { ok: true, alreadyDeducted: false, depletions, coveredProductIds };
}

export function calculateProductMargin(sellingPrice: number, recipeCost: number) {
  const margin = sellingPrice - recipeCost;
  const marginPercent = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;
  return { margin, marginPercent };
}
