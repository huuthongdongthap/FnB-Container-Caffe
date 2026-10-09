/**
 * Canonical Inventory / Recipe (BOM) Policy
 * Single Authoritative Policy for Recipe resolution, BOM consumption, deterministic stock deduction, and cost/margin computation.
 * Invariants: Products remain Catalog master; Never trust client quantities/costs; Stock deduction is idempotent.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'inventory-recipe-policy' });

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
    ingredientId: string;
    ingredientName?: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  totalCost: number;
  realizedRevenue: number;
  grossMargin: number;
  grossMarginPercent: number;
}

export interface StockDeductionResult {
  ok: boolean;
  alreadyDeducted: boolean;
  depletions: OrderConsumptionCalculation['depletions'];
  error?: string;
  insufficientIngredients?: Array<{ ingredientId: string; needed: number; available: number }>;
}

export async function getCanonicalRecipe(
  db: D1Database,
  productId: string
): Promise<CanonicalRecipe | null> {
  const recipe = await db.prepare(
    'SELECT id, product_id, name, instructions FROM recipes WHERE product_id = ? LIMIT 1'
  ).bind(productId).first<any>();

  if (!recipe) return null;

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
  orderItems: Array<{ productId: string; quantity: number; sellingPrice?: number }>
): Promise<OrderConsumptionCalculation> {
  const depletionsMap = new Map<string, {
    ingredientId: string;
    ingredientName?: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>();

  let realizedRevenue = 0;

  for (const item of orderItems) {
    if (typeof item.sellingPrice === 'number') {
      realizedRevenue += item.sellingPrice * item.quantity;
    }
    const recipe = await getCanonicalRecipe(db, item.productId);
    if (!recipe || recipe.components.length === 0) continue; // No BOM -> 0 consumption

    for (const comp of recipe.components) {
      const needed = comp.quantity * item.quantity;
      const existing = depletionsMap.get(comp.ingredientId);
      if (existing) {
        existing.quantity += needed;
        existing.totalCost = existing.quantity * existing.unitCost;
      } else {
        depletionsMap.set(comp.ingredientId, {
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
  const totalCost = depletions.reduce((sum, d) => sum + d.totalCost, 0);
  const grossMargin = realizedRevenue - totalCost;
  const grossMarginPercent = realizedRevenue > 0 ? (grossMargin / realizedRevenue) * 100 : 0;

  return { depletions, totalCost, realizedRevenue, grossMargin, grossMarginPercent };
}

export async function deductOrderStock(
  db: D1Database,
  orderId: string,
  orderItems: Array<{ productId: string; quantity: number }>,
  options?: { allowNegative?: boolean }
): Promise<StockDeductionResult> {
  // 1. Idempotency Guard
  const existing = await db.prepare(
    `SELECT id FROM stock_movements WHERE reference_id = ? AND reference_type = 'order' LIMIT 1`
  ).bind(orderId).first<{ id: string }>();

  if (existing) {
    return { ok: true, alreadyDeducted: true, depletions: [] };
  }

  // 2. Calculate Server-Side BOM Consumption
  const { depletions } = await calculateOrderConsumption(db, orderItems);
  if (depletions.length === 0) {
    return { ok: true, alreadyDeducted: false, depletions: [] };
  }

  // 3. Stock Level Verification
  if (!options?.allowNegative) {
    const insufficient: Array<{ ingredientId: string; needed: number; available: number }> = [];
    for (const d of depletions) {
      const ing = await db.prepare('SELECT id, current_stock FROM ingredients WHERE id = ?').bind(d.ingredientId).first<any>();
      const current = Number(ing?.current_stock ?? 0);
      if (current < d.quantity) {
        insufficient.push({ ingredientId: d.ingredientId, needed: d.quantity, available: current });
      }
    }
    if (insufficient.length > 0) {
      return { ok: false, alreadyDeducted: false, depletions, error: 'insufficient_stock', insufficientIngredients: insufficient };
    }
  }

  // 4. Atomic Deductions & Stock Movement Logging
  const now = new Date().toISOString();
  for (const d of depletions) {
    const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(
      'UPDATE ingredients SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?'
    ).bind(d.quantity, now, d.ingredientId).run();

    await db.prepare(
      `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at)
       VALUES (?, ?, 'consumption', ?, ?, 'order', ?, ?)`
    ).bind(movId, d.ingredientId, -d.quantity, orderId, `BOM deduction for order ${orderId}`, now).run();
  }

  return { ok: true, alreadyDeducted: false, depletions };
}

export function calculateProductMargin(sellingPrice: number, recipeCost: number) {
  const margin = sellingPrice - recipeCost;
  const marginPercent = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;
  return { margin, marginPercent };
}
