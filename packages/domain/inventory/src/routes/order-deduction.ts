import { deductOrderStock } from '../policies/inventory-recipe-policy';

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
 * Reverse all `reserve` transactions for an order when it is cancelled.
 * Idempotent: no-op if no `reserve` txns exist for the order.
 */
export async function restoreInventoryForOrder(env: Env, orderId: string): Promise<void> {
  try {
    const reservations = await env.AURA_DB.prepare(
      `SELECT id, item_id, quantity FROM inventory_transactions
       WHERE reference_id = ? AND reference_type = 'order' AND type = 'reserve'`
    )
      .bind(orderId)
      .all<{ id: string; item_id: string; quantity: number }>();

    if (reservations.results && reservations.results.length > 0) {
      const ops = [];
      for (const res of reservations.results) {
        ops.push(
          env.AURA_DB.prepare(
            'UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime(\'now\') WHERE id = ?'
          ).bind(Math.abs(res.quantity), res.item_id)
        );
        ops.push(
          env.AURA_DB.prepare(
            'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            crypto.randomUUID(),
            res.item_id,
            'release',
            Math.abs(res.quantity),
            orderId,
            'order',
            `Restore from cancelled order ${orderId}`
          )
        );
        ops.push(env.AURA_DB.prepare('DELETE FROM inventory_transactions WHERE id = ?').bind(res.id));
      }
      await env.AURA_DB.batch(ops);
      return;
    }
  } catch {
    // Fallback to stock_movements below
  }

  try {
    let movements = await env.AURA_DB.prepare(
      `SELECT ingredient_id, quantity FROM stock_movements WHERE reference_id = ? AND type = 'out'`
    )
      .bind(orderId)
      .all<{ id?: string; ingredient_id: string; quantity: number }>();

    if (!movements.results || movements.results.length === 0) {
      movements = await env.AURA_DB.prepare(
        `SELECT id, ingredient_id, quantity FROM stock_movements
         WHERE reference_id = ? AND reference_type = 'order' AND type = 'consumption'`
      )
        .bind(orderId)
        .all<{ id?: string; ingredient_id: string; quantity: number }>();
    }

    if (!movements.results || movements.results.length === 0) return;

    const now = new Date().toISOString();
    const ops = [];
    for (const mov of movements.results) {
      const absQty = Math.abs(mov.quantity);
      ops.push(
        env.AURA_DB.prepare(
          'UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?'
        ).bind(absQty, now, mov.ingredient_id)
      );
      ops.push(
        env.AURA_DB.prepare(
          'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          crypto.randomUUID(),
          mov.ingredient_id,
          'adjustment',
          absQty,
          orderId,
          'order',
          `Restore from cancelled order ${orderId}`,
          now
        )
      );
      if (mov.id) {
        ops.push(env.AURA_DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(mov.id));
      }
    }
    await env.AURA_DB.batch(ops);
  } catch {
    // non-blocking fallback
  }
}

/**
 * Auto-deduct inventory for an order by matching product SKU or name against active inventory items.
 * Never blocks order creation — deduction failures are logged only.
 */
export async function deductInventoryForOrder(
  env: Env,
  orderId: string,
  orderItems: Array<{ product_id: string; quantity: number; name?: string }>,
  tenantId?: string
): Promise<void> {
  let effectiveTenant = tenantId && tenantId.trim() ? tenantId.trim() : undefined;
  if (!effectiveTenant && orderId) {
    try {
      const ordRow = await env.AURA_DB.prepare('SELECT tenant_id FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ tenant_id?: string | null }>();
      if (ordRow && 'tenant_id' in ordRow && ordRow.tenant_id !== undefined && ordRow.tenant_id !== null) {
        const trimmed = String(ordRow.tenant_id).trim();
        if (trimmed) {
          effectiveTenant = trimmed;
        }
      }
    } catch {
      // Optional orders table/column in partial test mocks
    }
  }
  const matchesRowTenant = (row: Record<string, unknown> | null | undefined): boolean => {
    if (!row) return false;
    if (!effectiveTenant || effectiveTenant === '*') return true;
    if ('tenant_id' in row && row.tenant_id !== undefined) {
      const rowTenant = row.tenant_id && String(row.tenant_id).trim() ? String(row.tenant_id).trim() : 'default';
      return rowTenant === effectiveTenant;
    }
    return effectiveTenant === 'default';
  };
  let bomProductIds = new Set<string>();
  try {
    const bomRes = await deductOrderStock(
      env.AURA_DB as any,
      orderId,
      orderItems.map(i => ({ productId: i.product_id, quantity: i.quantity })),
      { allowNegative: true, tenantId: effectiveTenant }
    );
    if (bomRes.alreadyDeducted) {
      return;
    }
    if (bomRes.ok && bomRes.depletions.length > 0) {
      for (const dep of bomRes.depletions) {
        try {
          if (effectiveTenant && effectiveTenant !== '*') {
            await env.AURA_DB.prepare(
              "UPDATE inventory_items SET current_stock = MAX(0, current_stock - ?), updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?"
            )
              .bind(dep.quantity, dep.ingredientId, effectiveTenant)
              .run();
          } else {
            await env.AURA_DB.prepare(
              "UPDATE inventory_items SET current_stock = MAX(0, current_stock - ?), updated_at = datetime('now') WHERE id = ?"
            )
              .bind(dep.quantity, dep.ingredientId)
              .run();
          }
        } catch {
          // Best-effort sync when inventory_items shares ingredient IDs
        }
      }
    }
    bomProductIds = new Set((bomRes.ok ? bomRes.depletions : []).map((d: any) => d.productId).filter(Boolean));
    const itemsWithProductId = orderItems.filter(i => Boolean(i.product_id));
    if (
      bomRes.ok &&
      bomRes.depletions.length > 0 &&
      itemsWithProductId.length > 0 &&
      itemsWithProductId.every(i => bomProductIds.has(i.product_id))
    ) {
      return;
    }
  } catch (err) {
    console.warn('[inventory] BOM deduction fallback:', (err as Error).message);
  }

  for (const item of orderItems) {
    if (item.product_id && bomProductIds.has(item.product_id)) continue;
    try {
      const cleanName = (item.name || '').trim().toLowerCase();
      let invItem: { id: string; sku: string; name: string; current_stock: number; unit: string; tenant_id?: string | null } | null = null;
      if (effectiveTenant && effectiveTenant !== '*') {
        try {
          invItem = cleanName
            ? await env.AURA_DB.prepare(
                `SELECT id, sku, name, current_stock, unit, tenant_id FROM inventory_items
                 WHERE active = 1 AND (sku = ? OR LOWER(name) LIKE ?) AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?
                 LIMIT 1`
              )
                .bind(String(item.product_id), `%${cleanName}%`, effectiveTenant)
                .first()
            : await env.AURA_DB.prepare(
                `SELECT id, sku, name, current_stock, unit, tenant_id FROM inventory_items
                 WHERE active = 1 AND sku = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?
                 LIMIT 1`
              )
                .bind(String(item.product_id), effectiveTenant)
                .first();
        } catch {
          if (effectiveTenant === 'default') {
            invItem = cleanName
              ? await env.AURA_DB.prepare(
                  `SELECT id, sku, name, current_stock, unit FROM inventory_items
                   WHERE active = 1 AND (sku = ? OR LOWER(name) LIKE ?)
                   LIMIT 1`
                )
                  .bind(String(item.product_id), `%${cleanName}%`)
                  .first()
              : await env.AURA_DB.prepare(
                  `SELECT id, sku, name, current_stock, unit FROM inventory_items
                   WHERE active = 1 AND sku = ?
                   LIMIT 1`
                )
                  .bind(String(item.product_id))
                  .first();
          }
        }
      } else {
        invItem = cleanName
          ? await env.AURA_DB.prepare(
              `SELECT id, sku, name, current_stock, unit FROM inventory_items
               WHERE active = 1 AND (sku = ? OR LOWER(name) LIKE ?)
               LIMIT 1`
            )
              .bind(String(item.product_id), `%${cleanName}%`)
              .first()
          : await env.AURA_DB.prepare(
              `SELECT id, sku, name, current_stock, unit FROM inventory_items
               WHERE active = 1 AND sku = ?
               LIMIT 1`
            )
              .bind(String(item.product_id))
              .first();
      }

      if (!invItem || !matchesRowTenant(invItem as unknown as Record<string, unknown>)) continue;

      const have = invItem.current_stock || 0;
      const need = item.quantity;
      const newStock = Math.max(0, have - need);

      await env.AURA_DB.batch([
        env.AURA_DB.prepare(
          'UPDATE inventory_items SET current_stock = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(newStock, invItem.id),
        env.AURA_DB.prepare(
          'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          crypto.randomUUID(),
          invItem.id,
          'reserve',
          -(have - newStock),
          orderId,
          'order',
          `Auto-deduct from order ${orderId}`
        ),
      ]);
    } catch (err) {
      try {
        const cleanName = (item.name || '').trim().toLowerCase();
        let ingredient: { id: string; name: string; current_stock: number; unit: string; tenant_id?: string | null } | null = null;
        if (effectiveTenant && effectiveTenant !== '*') {
          try {
            ingredient = cleanName
              ? await env.AURA_DB.prepare(
                  `SELECT id, name, current_stock, unit, tenant_id FROM ingredients
                   WHERE (id = ? OR LOWER(name) LIKE ?) AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?
                   LIMIT 1`
                )
                  .bind(String(item.product_id), `%${cleanName}%`, effectiveTenant)
                  .first()
              : await env.AURA_DB.prepare(
                  `SELECT id, name, current_stock, unit, tenant_id FROM ingredients
                   WHERE id = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?
                   LIMIT 1`
                )
                  .bind(String(item.product_id), effectiveTenant)
                  .first();
          } catch {
            if (effectiveTenant === 'default') {
              ingredient = cleanName
                ? await env.AURA_DB.prepare(
                    `SELECT id, name, current_stock, unit FROM ingredients
                     WHERE id = ? OR LOWER(name) LIKE ?
                     LIMIT 1`
                  )
                    .bind(String(item.product_id), `%${cleanName}%`)
                    .first()
                : await env.AURA_DB.prepare(
                    `SELECT id, name, current_stock, unit FROM ingredients
                     WHERE id = ?
                     LIMIT 1`
                  )
                    .bind(String(item.product_id))
                    .first();
            }
          }
        } else {
          ingredient = cleanName
            ? await env.AURA_DB.prepare(
                `SELECT id, name, current_stock, unit FROM ingredients
                 WHERE id = ? OR LOWER(name) LIKE ?
                 LIMIT 1`
              )
                .bind(String(item.product_id), `%${cleanName}%`)
                .first()
            : await env.AURA_DB.prepare(
                `SELECT id, name, current_stock, unit FROM ingredients
                 WHERE id = ?
                 LIMIT 1`
              )
                .bind(String(item.product_id))
                .first();
        }

        if (!ingredient || !matchesRowTenant(ingredient as unknown as Record<string, unknown>)) continue;

        const have = ingredient.current_stock || 0;
        const need = item.quantity;
        const newStock = Math.max(0, have - need);
        const now = new Date().toISOString();

        await env.AURA_DB.batch([
          env.AURA_DB.prepare(
            'UPDATE ingredients SET current_stock = ?, updated_at = ? WHERE id = ?'
          ).bind(newStock, now, ingredient.id),
          env.AURA_DB.prepare(
            'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            crypto.randomUUID(),
            ingredient.id,
            'consumption',
            -(have - newStock),
            orderId,
            'order',
            `Auto-deduct from order ${orderId}`,
            now
          ),
        ]);
      } catch {
        const sku = item.product_id;
        console.error('[inventory] deduction failed', { orderId, productId: sku, message: (err as Error).message });
      }
    }
  }
}

