import type { RecipeComponent } from '../model/supplier-policy';

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
  productId: string,
  tenantId?: string
): Promise<RecipeComponent[]> {
  const normTenant = tenantId ? tenantId.trim() : undefined;
  let recipe: { id: string; tenant_id?: string | null } | null = null;
  if (normTenant && normTenant !== '*') {
    try {
      recipe = await db
        .prepare("SELECT id, tenant_id FROM recipes WHERE product_id = ? AND is_active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
        .bind(productId, normTenant)
        .first<{ id: string; tenant_id?: string | null }>();
    } catch {
      recipe = await db
        .prepare('SELECT id FROM recipes WHERE product_id = ? AND is_active = 1 LIMIT 1')
        .bind(productId)
        .first<{ id: string; tenant_id?: string | null }>();
    }
  } else {
    recipe = await db
      .prepare('SELECT id FROM recipes WHERE product_id = ? AND is_active = 1 LIMIT 1')
      .bind(productId)
      .first<{ id: string; tenant_id?: string | null }>();
  }

  if (!recipe) return [];
  if (normTenant && normTenant !== '*' && 'tenant_id' in recipe && recipe.tenant_id !== undefined) {
    const rowTenant = typeof recipe.tenant_id === 'string' && recipe.tenant_id.trim() ? recipe.tenant_id.trim() : 'default';
    if (rowTenant !== normTenant) return [];
  }

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
  orderItems: Array<{ product_id: string; quantity: number }>,
  tenantId?: string
): Promise<void> {
  const db = env.AURA_DB;
  const normTenant = tenantId ? tenantId.trim() : undefined;

  const recipeMap = new Map<string, RecipeComponent[]>();
  for (const item of orderItems) {
    if (!recipeMap.has(item.product_id)) {
      const components = await getRecipeForProduct(db, item.product_id, normTenant);
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

  try {
    await db.batch(ops);
    if (normTenant && normTenant !== '*') {
      await db
        .prepare("UPDATE inventory_transactions SET tenant_id = ? WHERE reference_id = ? AND reference_type = 'order'")
        .bind(normTenant, orderId)
        .run()
        .catch(() => {});
    }
  } catch {
    const fallbackOps = [];
    for (const [ingredientId, qty] of depletion) {
      fallbackOps.push(
        db.prepare(
          `UPDATE ingredients SET current_stock = MAX(0, current_stock - ?), updated_at = ? WHERE id = ?`
        ).bind(qty, now, ingredientId)
      );
      fallbackOps.push(
        db.prepare(
          `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, notes, created_at)
           VALUES (?, ?, 'deduction', ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          ingredientId,
          -qty,
          orderId,
          `BOM deduction for order ${orderId}`,
          now
        )
      );
    }
    await db.batch(fallbackOps).catch(() => {});
  }
}
