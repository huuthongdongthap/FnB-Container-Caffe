import type { Recipe, RecipeComponent } from '../model/supplier-policy';

interface D1Database {
  prepare: (sql: string) => {
    bind: (...args: any[]) => {
      all: <T = any>() => Promise<{ results: T[] }>;
      first: <T = any>() => Promise<T | null>;
      run: () => Promise<{ meta: { changes: number } }>;
    };
  };
  batch: (ops: any[]) => Promise<any[]>;
}

interface Env {
  AURA_DB: D1Database;
  executionCtx?: { waitUntil: (p: Promise<any>) => void };
}

/**
 * Map product_id → recipe components via `recipes` + `recipe_items` tables.
 * Returns empty array if product has no BOM defined.
 */
export async function getRecipeForProduct(
  db: D1Database,
  productId: string
): Promise<RecipeComponent[]> {
  const recipe = await db
    .prepare('SELECT id FROM recipes WHERE product_id = ? AND is_active = 1 LIMIT 1')
    .bind(productId)
    .first<{ id: string }>();

  if (!recipe) return [];

  const { results } = await db
    .prepare(
      `SELECT ri.ingredient_id, ri.quantity
       FROM recipe_items ri
       WHERE ri.recipe_id = ?`
    )
    .bind(recipe.id)
    .all<{ ingredient_id: string; quantity: number }>();

  return results || [];
}

/**
 * Calculate total ingredient depletion for an order:
 * for each order line, multiply recipe component qty by order line quantity.
 */
export function calculateBomDepletion(
  orderItems: Array<{ product_id: string; quantity: number }>,
  recipeMap: Map<string, RecipeComponent[]>
): Map<string, number> {
  const depletion = new Map<string, number>();

  for (const item of orderItems) {
    const components = recipeMap.get(item.product_id);
    if (!components) continue;

    for (const comp of components) {
      const totalNeeded = comp.quantity * item.quantity;
      const prev = depletion.get(comp.ingredient_id) ?? 0;
      depletion.set(comp.ingredient_id, prev + totalNeeded);
    }
  }

  return depletion;
}

/**
 * Deduct ingredients based on BOM for a completed order.
 * Inserts 'out' type transactions + updates ingredient stock.
 */
export async function deductIngredientsForOrder(
  env: Env,
  orderId: string,
  orderItems: Array<{ product_id: string; quantity: number }>
): Promise<void> {
  const db = env.AURA_DB;

  const recipeMap = new Map<string, RecipeComponent[]>();
  for (const item of orderItems) {
    if (!recipeMap.has(item.product_id)) {
      const components = await getRecipeForProduct(db, item.product_id);
      if (components.length > 0) {
        recipeMap.set(item.product_id, components);
      }
    }
  }

  if (recipeMap.size === 0) return;

  const depletion = calculateBomDepletion(orderItems, recipeMap);
  if (depletion.size === 0) return;

  const ops = [];
  const now = new Date().toISOString();

  for (const [ingredientId, qty] of depletion) {
    ops.push(
      db.prepare(
        `UPDATE ingredients SET current_stock = MAX(0, current_stock - ?), updated_at = ? WHERE id = ?`
      ).bind(qty, now, ingredientId)
    );
    ops.push(
      db.prepare(
        `INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes)
         VALUES (?, ?, 'out', ?, ?, 'order', ?)`
      ).bind(
        crypto.randomUUID(),
        ingredientId,
        -qty,
        orderId,
        `BOM deduction for order ${orderId}`
      )
    );
  }

  await db.batch(ops);
}
