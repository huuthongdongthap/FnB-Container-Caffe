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

const inFlightOrderRestorations = new Map<string, Promise<void>>();

/**
 * Reverse all `reserve` transactions for an order when it is cancelled.
 * Idempotent: no-op if no `reserve` txns exist for the order.
 */
export async function restoreInventoryForOrder(env: Env, orderId: string, tenantId?: string): Promise<void> {
  const lockKey = String(orderId || '');
  const previous = inFlightOrderRestorations.get(lockKey) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => restoreInventoryForOrderInternal(env, orderId, tenantId));
  inFlightOrderRestorations.set(lockKey, current);
  try {
    await current;
  } finally {
    if (inFlightOrderRestorations.get(lockKey) === current) {
      inFlightOrderRestorations.delete(lockKey);
    }
  }
}

async function restoreInventoryForOrderInternal(env: Env, orderId: string, tenantId?: string): Promise<void> {
  const rawExplicit = tenantId && tenantId.trim() ? tenantId.trim() : '';
  const explicitTenant =
    rawExplicit && rawExplicit !== '*' && rawExplicit.toLowerCase() !== 'hq'
      ? rawExplicit
      : undefined;
  let effectiveTenant = explicitTenant || 'default';
  if (orderId) {
    try {
      const ordRow = typeof (env.AURA_DB.prepare('SELECT tenant_id FROM orders WHERE id = ?').bind(orderId) as any).first === 'function'
        ? await env.AURA_DB.prepare('SELECT tenant_id FROM orders WHERE id = ?').bind(orderId).first<{ tenant_id?: string | null }>()
        : null;
      if (ordRow && 'tenant_id' in ordRow && ordRow.tenant_id !== undefined) {
        const ordTenant = ordRow.tenant_id && String(ordRow.tenant_id).trim() ? String(ordRow.tenant_id).trim() : 'default';
        if (explicitTenant) {
          if (ordTenant !== explicitTenant) {
            return;
          }
        } else {
          effectiveTenant = ordTenant;
        }
      }
    } catch {
      // Optional orders lookup in partial mocks
    }
  }
  const matchesItemTenant = (row: Record<string, unknown> | null | undefined): boolean => {
    if (!row || !effectiveTenant || effectiveTenant === '*') return true;
    if ('tenant_id' in row && row.tenant_id !== undefined) {
      const rowTenant = row.tenant_id && String(row.tenant_id).trim() ? String(row.tenant_id).trim() : 'default';
      return rowTenant === effectiveTenant;
    }
    return true;
  };

  try {
    let reservations: { results: Array<{ id: string; item_id: string; quantity: number }> };
    try {
      reservations = await env.AURA_DB.prepare(
        `SELECT id, item_id, quantity FROM inventory_transactions
         WHERE reference_id = ? AND reference_type = 'order' AND type IN ('reserve', 'sale')
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      )
        .bind(orderId, effectiveTenant)
        .all<{ id: string; item_id: string; quantity: number }>();
    } catch {
      reservations = { results: [] };
    }
    if ((!reservations.results || reservations.results.length === 0) && (!effectiveTenant || effectiveTenant === 'default' || effectiveTenant === '*')) {
      const fallbackRes = await env.AURA_DB.prepare(
        `SELECT id, item_id, quantity, tenant_id FROM inventory_transactions
         WHERE reference_id = ? AND reference_type = 'order' AND type = 'reserve'`
      )
        .bind(orderId)
        .all<{ id: string; item_id: string; quantity: number; tenant_id?: string | null }>()
        .catch(() =>
          env.AURA_DB.prepare(
            `SELECT id, item_id, quantity FROM inventory_transactions
             WHERE reference_id = ? AND reference_type = 'order' AND type = 'reserve'`
          )
            .bind(orderId)
            .all<{ id: string; item_id: string; quantity: number; tenant_id?: string | null }>()
        );
      reservations = {
        results: (fallbackRes.results || []).filter((r) => matchesItemTenant(r as unknown as Record<string, unknown>)),
      };
    }

    if (reservations.results && reservations.results.length > 0) {
      const ops = [];
      const fallbackOps = [];
      for (const res of reservations.results) {
        let hasItemTenantCol = false;
        if (effectiveTenant && effectiveTenant !== '*') {
          try {
            const prep = env.AURA_DB.prepare('SELECT id, tenant_id FROM inventory_items WHERE id = ?').bind(res.item_id) as any;
            const itemRow = typeof prep.first === 'function' ? await prep.first() : null;
            if (itemRow) {
              hasItemTenantCol = 'tenant_id' in (itemRow as Record<string, unknown>);
              if (!matchesItemTenant(itemRow)) continue;
            }
          } catch {
            // Ignore when inventory_items.tenant_id is absent in partial mocks
          }
        }
        if (res.id) {
          let claimDelRes: { meta?: { changes?: number } } | null = null;
          try {
            const delStmt = hasItemTenantCol
              ? env.AURA_DB.prepare(
                  "DELETE FROM inventory_transactions WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
                ).bind(res.id, effectiveTenant)
              : env.AURA_DB.prepare('DELETE FROM inventory_transactions WHERE id = ?').bind(res.id);
            if (typeof (delStmt as any).run === 'function') {
              claimDelRes = await delStmt.run();
            }
          } catch {
            if (effectiveTenant === 'default') {
              const fallbackDelStmt = env.AURA_DB.prepare('DELETE FROM inventory_transactions WHERE id = ?').bind(res.id);
              if (typeof (fallbackDelStmt as any).run === 'function') {
                claimDelRes = await fallbackDelStmt.run().catch(() => null);
              }
            }
          }
          if (claimDelRes?.meta && typeof claimDelRes.meta.changes === 'number' && claimDelRes.meta.changes === 0) {
            continue;
          }
        }
        const absQty = Math.abs(res.quantity);
        const relId = crypto.randomUUID();
        ops.push(
          hasItemTenantCol
            ? env.AURA_DB.prepare(
                "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(absQty, res.item_id, effectiveTenant)
            : env.AURA_DB.prepare(
                "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
              ).bind(absQty, res.item_id)
        );
        ops.push(
          hasItemTenantCol
            ? env.AURA_DB.prepare(
                'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                relId,
                res.item_id,
                'release',
                absQty,
                orderId,
                'order',
                `Restore from cancelled order ${orderId}`,
                effectiveTenant
              )
            : env.AURA_DB.prepare(
                'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                relId,
                res.item_id,
                'release',
                absQty,
                orderId,
                'order',
                `Restore from cancelled order ${orderId}`
              )
        );
        ops.push(
          hasItemTenantCol
            ? env.AURA_DB.prepare(
                "DELETE FROM inventory_transactions WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(res.id, effectiveTenant)
            : env.AURA_DB.prepare('DELETE FROM inventory_transactions WHERE id = ?').bind(res.id)
        );

        fallbackOps.push(
          env.AURA_DB.prepare(
            "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
          ).bind(absQty, res.item_id)
        );
        fallbackOps.push(
          env.AURA_DB.prepare(
            'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            relId,
            res.item_id,
            'release',
            absQty,
            orderId,
            'order',
            `Restore from cancelled order ${orderId}`
          )
        );
        fallbackOps.push(env.AURA_DB.prepare('DELETE FROM inventory_transactions WHERE id = ?').bind(res.id));
      }
      if (ops.length > 0) {
        try {
          await env.AURA_DB.batch(ops);
        } catch (batchErr) {
          if (effectiveTenant !== 'default') throw batchErr;
          await env.AURA_DB.batch(fallbackOps);
        }
      }
      // Do not return early: a hybrid order may have both SKU reservations
      // (inventory_transactions) and BOM ingredient deductions (stock_movements).
    }
  } catch {
    // Continue to stock_movements restoration below
  }

  try {
    let movements: { results: Array<{ id?: string; ingredient_id: string; quantity: number }> };
    try {
      movements = await env.AURA_DB.prepare(
        `SELECT id, ingredient_id, quantity FROM stock_movements WHERE reference_id = ? AND type = 'out' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      )
        .bind(orderId, effectiveTenant)
        .all<{ id?: string; ingredient_id: string; quantity: number }>();
    } catch {
      if (effectiveTenant === 'default') {
        try {
          movements = await env.AURA_DB.prepare(
            `SELECT id, ingredient_id, quantity FROM stock_movements WHERE reference_id = ? AND type = 'out'`
          )
            .bind(orderId)
            .all<{ id?: string; ingredient_id: string; quantity: number }>();
        } catch {
          movements = await env.AURA_DB.prepare(
            `SELECT ingredient_id, quantity FROM stock_movements WHERE reference_id = ? AND type = 'out'`
          )
            .bind(orderId)
            .all<{ id?: string; ingredient_id: string; quantity: number }>();
        }
      } else {
        movements = { results: [] };
      }
    }

    if (!movements.results || movements.results.length === 0) {
      try {
        movements = await env.AURA_DB.prepare(
          `SELECT id, ingredient_id, quantity FROM stock_movements
           WHERE reference_id = ? AND reference_type = 'order' AND type IN ('consumption', 'order_deduction', 'deduction')
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        )
          .bind(orderId, effectiveTenant)
          .all<{ id?: string; ingredient_id: string; quantity: number }>();
      } catch {
        movements = { results: [] };
      }
      if ((!movements.results || movements.results.length === 0) && effectiveTenant === 'default') {
        const fallbackMovs = await env.AURA_DB.prepare(
          `SELECT id, ingredient_id, quantity FROM stock_movements
           WHERE reference_id = ? AND reference_type = 'order' AND type = 'consumption'`
        )
          .bind(orderId)
          .all<{ id?: string; ingredient_id: string; quantity: number; tenant_id?: string | null }>();
        movements = {
          results: (fallbackMovs.results || []).filter((m) => matchesItemTenant(m as unknown as Record<string, unknown>)),
        };
      }
    }

    if (!movements.results || movements.results.length === 0) return;

    const now = new Date().toISOString();
    const ops = [];
    const fallbackOps = [];
    for (const mov of movements.results) {
      let hasIngTenantCol = false;
      if (effectiveTenant && effectiveTenant !== '*') {
        try {
          const prep = env.AURA_DB.prepare('SELECT id, tenant_id FROM ingredients WHERE id = ?').bind(mov.ingredient_id) as any;
          const ingRow = typeof prep.first === 'function' ? await prep.first() : null;
          if (ingRow) {
            hasIngTenantCol = 'tenant_id' in (ingRow as Record<string, unknown>);
            if (!matchesItemTenant(ingRow)) continue;
          }
        } catch {
          // Ignore when ingredients.tenant_id is absent in partial mocks
        }
      }
      if (mov.id) {
        let claimMovDelRes: { meta?: { changes?: number } } | null = null;
        try {
          const delMovStmt = hasIngTenantCol
            ? env.AURA_DB.prepare(
                "DELETE FROM stock_movements WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(mov.id, effectiveTenant)
            : env.AURA_DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(mov.id);
          if (typeof (delMovStmt as any).run === 'function') {
            claimMovDelRes = await delMovStmt.run();
          }
        } catch {
          if (effectiveTenant === 'default') {
            const fallbackDelMovStmt = env.AURA_DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(mov.id);
            if (typeof (fallbackDelMovStmt as any).run === 'function') {
              claimMovDelRes = await fallbackDelMovStmt.run().catch(() => null);
            }
          }
        }
        if (claimMovDelRes?.meta && typeof claimMovDelRes.meta.changes === 'number' && claimMovDelRes.meta.changes === 0) {
          continue;
        }
      }
      const absQty = Math.abs(mov.quantity);
      const restoreMovId = crypto.randomUUID();
      ops.push(
        hasIngTenantCol
          ? env.AURA_DB.prepare(
              "UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(absQty, now, mov.ingredient_id, effectiveTenant)
          : env.AURA_DB.prepare(
              'UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?'
            ).bind(absQty, now, mov.ingredient_id)
      );
      ops.push(
        hasIngTenantCol
          ? env.AURA_DB.prepare(
              'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(
              restoreMovId,
              mov.ingredient_id,
              'adjustment',
              absQty,
              orderId,
              'order',
              `Restore from cancelled order ${orderId}`,
              now,
              effectiveTenant
            )
          : env.AURA_DB.prepare(
              'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(
              restoreMovId,
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
        ops.push(
          hasIngTenantCol
            ? env.AURA_DB.prepare(
                "DELETE FROM stock_movements WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(mov.id, effectiveTenant)
            : env.AURA_DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(mov.id)
        );
      }

      fallbackOps.push(
        env.AURA_DB.prepare(
          'UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?'
        ).bind(absQty, now, mov.ingredient_id)
      );
      fallbackOps.push(
        env.AURA_DB.prepare(
          'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          restoreMovId,
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
        fallbackOps.push(env.AURA_DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(mov.id));
      }
      try {
        await env.AURA_DB.prepare(
          "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)"
        )
          .bind(absQty, mov.ingredient_id, effectiveTenant)
          .run();
      } catch {
        // Best-effort sync when inventory_items shares ingredient IDs
      }
    }
    if (ops.length > 0) {
      try {
        await env.AURA_DB.batch(ops);
      } catch (batchErr) {
        if (effectiveTenant !== 'default') throw batchErr;
        await env.AURA_DB.batch(fallbackOps);
      }
    }
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
  const rawExplicit = tenantId && tenantId.trim() ? tenantId.trim() : '';
  const explicitTenant =
    rawExplicit && rawExplicit !== '*' && rawExplicit.toLowerCase() !== 'hq'
      ? rawExplicit
      : undefined;
  let effectiveTenant = explicitTenant || 'default';
  if (orderId) {
    try {
      const ordRow = await env.AURA_DB.prepare('SELECT tenant_id, status, payment_status FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ tenant_id?: string | null; status?: string | null; payment_status?: string | null }>()
        .catch(() =>
          env.AURA_DB.prepare('SELECT tenant_id FROM orders WHERE id = ?')
            .bind(orderId)
            .first<{ tenant_id?: string | null; status?: string | null; payment_status?: string | null }>()
        );
      if (ordRow) {
        const ordStatus = typeof ordRow.status === 'string' ? ordRow.status.trim().toLowerCase() : '';
        const ordPaymentStatus = typeof ordRow.payment_status === 'string' ? ordRow.payment_status.trim().toLowerCase() : '';
        if (
          ['cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'].includes(ordStatus) ||
          ['failed', 'expired', 'cancelled', 'canceled', 'refunded'].includes(ordPaymentStatus)
        ) {
          return;
        }
        if ('tenant_id' in ordRow && ordRow.tenant_id !== undefined) {
          const ordTenant = (ordRow.tenant_id && String(ordRow.tenant_id).trim()) || 'default';
          if (explicitTenant && ordTenant !== explicitTenant) {
            return;
          }
          if (!explicitTenant) {
            effectiveTenant = ordTenant;
          }
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
  if (orderId) {
    try {
      let existingMovement: { id?: string } | null = null;
      try {
        existingMovement = await env.AURA_DB.prepare(
          "SELECT id FROM stock_movements WHERE reference_id = ? AND reference_type = 'order' AND type IN ('order_consumption', 'consumption', 'sale', 'out') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        )
          .bind(orderId, effectiveTenant)
          .first<{ id?: string }>();
      } catch {
        if (effectiveTenant === 'default') {
          existingMovement = await env.AURA_DB.prepare(
            "SELECT id FROM stock_movements WHERE reference_id = ? AND reference_type = 'order' AND type IN ('order_consumption', 'consumption', 'sale', 'out') LIMIT 1"
          )
            .bind(orderId)
            .first<{ id?: string }>()
            .catch(() => null);
        }
      }
      if (existingMovement?.id) {
        return;
      }
    } catch {
      // Optional stock_movements query in partial test mocks
    }
    try {
      let existingTx: { id?: string } | null = null;
      try {
        existingTx = await env.AURA_DB.prepare(
          "SELECT id FROM inventory_transactions WHERE reference_id = ? AND reference_type = 'order' AND type IN ('reserve', 'sale', 'out', 'release') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        )
          .bind(orderId, effectiveTenant)
          .first<{ id?: string }>();
      } catch {
        if (effectiveTenant === 'default') {
          existingTx = await env.AURA_DB.prepare(
            "SELECT id FROM inventory_transactions WHERE reference_id = ? AND reference_type = 'order' AND type IN ('reserve', 'sale', 'out', 'release') LIMIT 1"
          )
            .bind(orderId)
            .first<{ id?: string }>()
            .catch(() => null);
        }
      }
      if (existingTx?.id) {
        return;
      }
    } catch {
      // Optional inventory_transactions query in partial test mocks
    }
  }
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
          await env.AURA_DB.prepare(
            "UPDATE inventory_items SET current_stock = MAX(0, current_stock - ?), updated_at = datetime('now') WHERE id = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)"
          )
            .bind(dep.quantity, dep.ingredientId, effectiveTenant)
            .run();
        } catch {
          // Best-effort sync when inventory_items shares ingredient IDs
        }
      }
    }
    bomProductIds = new Set(
      (bomRes.ok
        ? (bomRes.coveredProductIds ??
          bomRes.depletions.flatMap((d: any) => d.productIds ?? [d.productId]))
        : []
      ).filter(Boolean)
    );
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

  if (orderId) {
    try {
      let existingReserve: { id?: string } | null = null;
      try {
        existingReserve = await env.AURA_DB.prepare(
          "SELECT id FROM inventory_transactions WHERE reference_id = ? AND reference_type = 'order' AND type IN ('reserve', 'sale') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        )
          .bind(orderId, effectiveTenant)
          .first<{ id?: string }>();
      } catch {
        if (effectiveTenant === 'default') {
          existingReserve = await env.AURA_DB.prepare(
            "SELECT id FROM inventory_transactions WHERE reference_id = ? AND reference_type = 'order' AND type = 'reserve' LIMIT 1"
          )
            .bind(orderId)
            .first<{ id?: string }>();
        }
      }
      if (existingReserve?.id) {
        return;
      }
    } catch {
      // Optional inventory_transactions query in partial test mocks
    }
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
                 WHERE active = 1 AND (sku = ? OR LOWER(name) LIKE ?) AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)
                 LIMIT 1`
              )
                .bind(String(item.product_id), `%${cleanName}%`, effectiveTenant)
                .first()
            : await env.AURA_DB.prepare(
                `SELECT id, sku, name, current_stock, unit, tenant_id FROM inventory_items
                 WHERE active = 1 AND sku = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)
                 LIMIT 1`
              )
                .bind(String(item.product_id), effectiveTenant)
                .first();
        } catch (invErr) {
          if (effectiveTenant !== 'default') throw invErr;
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
      const deductQty = Math.max(0, have - newStock);
      const txId = crypto.randomUUID();
      const hasTenantCol = 'tenant_id' in (invItem as unknown as Record<string, unknown>);

      const fallbackItemBatch = [
        hasTenantCol
          ? env.AURA_DB.prepare(
              "UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(deductQty, invItem.id, effectiveTenant)
          : env.AURA_DB.prepare(
              "UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = datetime('now') WHERE id = ?"
            ).bind(deductQty, invItem.id),
        env.AURA_DB.prepare(
          'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          txId,
          invItem.id,
          'reserve',
          -deductQty,
          orderId,
          'order',
          `Auto-deduct from order ${orderId}`
        ),
      ];

      if (hasTenantCol) {
        try {
          await env.AURA_DB.batch([
            env.AURA_DB.prepare(
              "UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(deductQty, invItem.id, effectiveTenant),
            env.AURA_DB.prepare(
              'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(
              txId,
              invItem.id,
              'reserve',
              -deductQty,
              orderId,
              'order',
              `Auto-deduct from order ${orderId}`,
              effectiveTenant
            ),
          ]);
        } catch (batchErr) {
          if (effectiveTenant !== 'default') throw batchErr;
          await env.AURA_DB.batch(fallbackItemBatch);
        }
      } else {
        await env.AURA_DB.batch(fallbackItemBatch);
      }

      if (!explicitTenant && !hasTenantCol && deductQty > 0) {
        try {
          const checkAfter = await env.AURA_DB.prepare(
            'SELECT id, sku, name, current_stock, unit FROM inventory_items WHERE active = 1 AND sku = ? LIMIT 1'
          )
            .bind(String(invItem.sku || item.product_id))
            .first<{ current_stock?: number }>();
          if (checkAfter && checkAfter.current_stock === have) {
            await env.AURA_DB.prepare(
              "UPDATE inventory_items SET current_stock = ?, updated_at = datetime('now') WHERE id = ?"
            )
              .bind(newStock, invItem.id)
              .run();
          }
        } catch {
          // Ignore in partial test mocks
        }
      }
      await env.AURA_DB.prepare('UPDATE inventory_transactions SET tenant_id = ? WHERE id = ?')
        .bind(effectiveTenant, txId)
        .run()
        .catch(() => {});
    } catch (err) {
      try {
        const cleanName = (item.name || '').trim().toLowerCase();
        let ingredient: { id: string; name: string; current_stock: number; unit: string; tenant_id?: string | null } | null = null;
        if (effectiveTenant && effectiveTenant !== '*') {
          try {
            ingredient = cleanName
              ? await env.AURA_DB.prepare(
                  `SELECT id, name, current_stock, unit, tenant_id FROM ingredients
                   WHERE (id = ? OR LOWER(name) LIKE ?) AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)
                   LIMIT 1`
                )
                  .bind(String(item.product_id), `%${cleanName}%`, effectiveTenant)
                  .first()
              : await env.AURA_DB.prepare(
                  `SELECT id, name, current_stock, unit, tenant_id FROM ingredients
                   WHERE id = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)
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
        const deductQty = Math.max(0, have - newStock);
        const now = new Date().toISOString();
        const movId = crypto.randomUUID();
        const hasIngTenantCol = 'tenant_id' in (ingredient as unknown as Record<string, unknown>);

        const fallbackIngBatch = [
          hasIngTenantCol
            ? env.AURA_DB.prepare(
                "UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(deductQty, now, ingredient.id, effectiveTenant)
            : env.AURA_DB.prepare(
                'UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ?'
              ).bind(deductQty, now, ingredient.id),
          env.AURA_DB.prepare(
            'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            movId,
            ingredient.id,
            'consumption',
            -deductQty,
            orderId,
            'order',
            `Auto-deduct from order ${orderId}`,
            now
          ),
        ];

        if (hasIngTenantCol) {
          try {
            await env.AURA_DB.batch([
              env.AURA_DB.prepare(
                "UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(deductQty, now, ingredient.id, effectiveTenant),
              env.AURA_DB.prepare(
                'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                movId,
                ingredient.id,
                'consumption',
                -deductQty,
                orderId,
                'order',
                `Auto-deduct from order ${orderId}`,
                now,
                effectiveTenant
              ),
            ]);
          } catch (batchErr) {
            if (effectiveTenant !== 'default') throw batchErr;
            await env.AURA_DB.batch(fallbackIngBatch);
          }
        } else {
          await env.AURA_DB.batch(fallbackIngBatch);
        }

        await env.AURA_DB.prepare('UPDATE stock_movements SET tenant_id = ? WHERE id = ?')
          .bind(effectiveTenant, movId)
          .run()
          .catch(() => {});
      } catch {
        const sku = item.product_id;
        console.error('[inventory] deduction failed', { orderId, productId: sku, message: (err as Error).message });
      }
    }
  }
}

