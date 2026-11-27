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
 * Best-effort spoilage record keyed by (tenant, order, ingredient). It only writes when a
 * matching ingredient row exists (waste_log references ingredients) and is skipped when the
 * order already has an entry, so retries never double count. The authoritative append-only
 * record stays in inventory_transactions / stock_movements.
 */
async function recordWasteLog(env: Env, orderId: string, tenant: string, ingredientId: string, quantity: number): Promise<void> {
  try {
    await env.AURA_DB.prepare(
      `INSERT INTO waste_log (id, ingredient_id, quantity, unit, reason, notes, tenant_id, order_id, item_id)
       SELECT ?, i.id, ?, COALESCE(NULLIF(TRIM(i.unit), ''), 'unit'), 'order_cancelled_after_prep', ?, ?, ?, ?
         FROM ingredients i
        WHERE i.id = ?
          AND NOT EXISTS (SELECT 1 FROM waste_log w WHERE w.order_id = ? AND w.ingredient_id = i.id AND w.tenant_id = ?)`
    ).bind(
      crypto.randomUUID(), quantity, `Spoiled after preparation started, cancelled order ${orderId}`,
      tenant, orderId, ingredientId, ingredientId, orderId, tenant
    ).run();
  } catch {
    // waste_log or its tenant/order columns are absent in minimal schemas
  }
}

const inFlightOrderRestorations = new Map<string, Promise<void>>();

/** Statuses after which ingredients were already brewed or plated, so cancelling cannot return them to clean stock. */
const POST_PREP_STATUSES = new Set(['preparing', 'ready', 'delivering', 'delivered', 'served', 'completed']);

function isPostPrepStatus(status?: string): boolean {
  return POST_PREP_STATUSES.has(String(status ?? '').trim().toLowerCase());
}

/**
 * Reverse the stock held by an order when it is cancelled.
 * Before preparation starts the stock is released back; once preparation has started the
 * quantities are spoiled, so they are recorded as waste and never re-enter clean stock.
 * The ledger is append-only and idempotent: a retry finds the existing release/waste row.
 */
export async function restoreInventoryForOrder(
  env: Env,
  orderId: string,
  tenantId?: string,
  preCancelStatus?: string | { preCancelStatus?: string },
): Promise<void> {
  const resolvedPreStatus =
    typeof preCancelStatus === 'string'
      ? preCancelStatus
      : preCancelStatus?.preCancelStatus;
  const lockKey = String(orderId || '');
  const previous = inFlightOrderRestorations.get(lockKey) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => restoreInventoryForOrderInternal(env, orderId, tenantId, resolvedPreStatus));
  inFlightOrderRestorations.set(lockKey, current);
  try {
    await current;
  } finally {
    if (inFlightOrderRestorations.get(lockKey) === current) {
      inFlightOrderRestorations.delete(lockKey);
    }
  }
}

async function restoreInventoryForOrderInternal(
  env: Env,
  orderId: string,
  tenantId?: string,
  preCancelStatus?: string,
): Promise<void> {
  const spoiled = isPostPrepStatus(preCancelStatus);
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
    let reservations: { results: Array<{ id: string; item_id: string; type?: string; quantity: number }> };
    try {
      reservations = await env.AURA_DB.prepare(
        `SELECT id, item_id, type, quantity FROM inventory_transactions
         WHERE reference_id = ? AND reference_type = 'order' AND type IN ('reserve', 'sale')
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      )
        .bind(orderId, effectiveTenant)
        .all<{ id: string; item_id: string; type?: string; quantity: number }>();
    } catch {
      reservations = { results: [] };
    }
    if ((!reservations.results || reservations.results.length === 0) && (!effectiveTenant || effectiveTenant === 'default' || effectiveTenant === '*')) {
      const fallbackRes = await env.AURA_DB.prepare(
        `SELECT id, item_id, quantity, tenant_id FROM inventory_transactions
         WHERE reference_id = ? AND reference_type = 'order' AND type = 'reserve'`
      )
        .bind(orderId)
        .all<{ id: string; item_id: string; type?: string; quantity: number; tenant_id?: string | null }>()
        .catch(() =>
          env.AURA_DB.prepare(
            `SELECT id, item_id, quantity FROM inventory_transactions
             WHERE reference_id = ? AND reference_type = 'order' AND type = 'reserve'`
          )
            .bind(orderId)
            .all<{ id: string; item_id: string; type?: string; quantity: number; tenant_id?: string | null }>()
        );
      reservations = {
        results: (fallbackRes.results || []).filter((r) => matchesItemTenant(r as unknown as Record<string, unknown>)),
      };
    }

    if (reservations.results && reservations.results.length > 0) {
      const ops = [];
      const fallbackOps = [];
      const handledItemIds = new Set<string>();
      const seenReservationIds = new Set<string>();
      const wasteItems: Array<{ itemId: string; quantity: number }> = [];
      try {
        const done = await env.AURA_DB.prepare(
          `SELECT item_id, type, quantity FROM inventory_transactions
           WHERE reference_id = ? AND reference_type = 'order' AND type IN ('release', 'waste')`
        ).bind(orderId).all<{ item_id: string; type?: string; quantity?: number }>();
        for (const row of done.results || []) {
          if (row.type && row.type !== 'release' && row.type !== 'waste') continue;
          if (!row.type && typeof row.quantity === 'number' && row.quantity < 0) continue;
          handledItemIds.add(row.item_id);
        }
      } catch {
        // Partial mocks without the ledger table: nothing recorded yet
      }
      for (const res of reservations.results) {
        if (res.id) {
          if (seenReservationIds.has(res.id)) continue;
          seenReservationIds.add(res.id);
        }
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
        if (handledItemIds.has(res.item_id)) continue;
        const spoilThisRes = spoiled;
        const absQty = Math.abs(res.quantity);
        const relId = crypto.randomUUID();
        const ledgerType = spoilThisRes ? 'waste' : 'release';
        const ledgerNote = spoilThisRes
          ? `Spoiled after preparation started, cancelled order ${orderId}`
          : `Restore from cancelled order ${orderId}`;
        if (!spoilThisRes) {
          ops.push(
            hasItemTenantCol
              ? env.AURA_DB.prepare(
                  "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
                ).bind(absQty, res.item_id, effectiveTenant)
              : env.AURA_DB.prepare(
                  "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
                ).bind(absQty, res.item_id)
          );
          fallbackOps.push(
            env.AURA_DB.prepare(
              "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
            ).bind(absQty, res.item_id)
          );
        }
        ops.push(
          hasItemTenantCol
            ? env.AURA_DB.prepare(
                'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(relId, res.item_id, ledgerType, absQty, orderId, 'order', ledgerNote, effectiveTenant)
            : env.AURA_DB.prepare(
                'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).bind(relId, res.item_id, ledgerType, absQty, orderId, 'order', ledgerNote)
        );
        fallbackOps.push(
          env.AURA_DB.prepare(
            'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(relId, res.item_id, ledgerType, absQty, orderId, 'order', ledgerNote)
        );
        if (spoilThisRes) {
          wasteItems.push({ itemId: res.item_id, quantity: absQty });
        }
      }
      if (ops.length > 0) {
        try {
          await env.AURA_DB.batch(ops);
        } catch (batchErr) {
          if (effectiveTenant !== 'default') throw batchErr;
          await env.AURA_DB.batch(fallbackOps);
        }
        for (const w of wasteItems) {
          await recordWasteLog(env, orderId, effectiveTenant, w.itemId, w.quantity);
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
    const handledIngredientIds = new Set<string>();
    const seenMovementIds = new Set<string>();
    const movementWasteItems: Array<{ ingredientId: string; quantity: number }> = [];
    try {
      const done = await env.AURA_DB.prepare(
        `SELECT ingredient_id, type, quantity FROM stock_movements
         WHERE reference_id = ? AND reference_type = 'order' AND type IN ('adjustment', 'waste', 'return', 'release')`
      ).bind(orderId).all<{ ingredient_id: string; type?: string; quantity?: number }>();
      for (const row of done.results || []) {
        if (row.type && !['adjustment', 'waste', 'return', 'release'].includes(row.type)) continue;
        if (!row.type && typeof row.quantity === 'number' && row.quantity < 0) continue;
        handledIngredientIds.add(row.ingredient_id);
      }
    } catch {
      // Partial schema
    }

    for (const mov of movements.results) {
      if (mov.id) {
        if (seenMovementIds.has(mov.id)) continue;
        seenMovementIds.add(mov.id);
      }
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
      if (handledIngredientIds.has(mov.ingredient_id)) continue;

      const absQty = Math.abs(mov.quantity);
      const restoreMovId = crypto.randomUUID();
      const movType = spoiled ? 'waste' : 'adjustment';
      const movQty = spoiled ? -absQty : absQty;
      const movNote = spoiled
        ? `Spoiled after preparation started, cancelled order ${orderId}`
        : `Restore from cancelled order ${orderId}`;

      if (!spoiled) {
        ops.push(
          hasIngTenantCol
            ? env.AURA_DB.prepare(
                "UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(absQty, now, mov.ingredient_id, effectiveTenant)
            : env.AURA_DB.prepare(
                'UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?'
              ).bind(absQty, now, mov.ingredient_id)
        );
        fallbackOps.push(
          env.AURA_DB.prepare(
            'UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?'
          ).bind(absQty, now, mov.ingredient_id)
        );
      }

      ops.push(
        hasIngTenantCol
          ? env.AURA_DB.prepare(
              'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(restoreMovId, mov.ingredient_id, movType, movQty, orderId, 'order', movNote, now, effectiveTenant)
          : env.AURA_DB.prepare(
              'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(restoreMovId, mov.ingredient_id, movType, movQty, orderId, 'order', movNote, now)
      );

      fallbackOps.push(
        env.AURA_DB.prepare(
          'INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(restoreMovId, mov.ingredient_id, movType, movQty, orderId, 'order', movNote, now)
      );

      if (spoiled) {
        movementWasteItems.push({ ingredientId: mov.ingredient_id, quantity: absQty });
      } else {
        try {
          await env.AURA_DB.prepare(
            "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)"
          ).bind(absQty, mov.ingredient_id, effectiveTenant).run();
        } catch {
          // Best-effort sync when inventory_items shares ingredient IDs
        }
      }
    }
    if (ops.length > 0) {
      try {
        await env.AURA_DB.batch(ops);
      } catch (batchErr) {
        if (effectiveTenant !== 'default') throw batchErr;
        await env.AURA_DB.batch(fallbackOps);
      }
      for (const w of movementWasteItems) {
        await recordWasteLog(env, orderId, effectiveTenant, w.ingredientId, w.quantity);
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
  let bomProductIds = new Set<string>();
  try {
    const bomRes = await deductOrderStock(
      env.AURA_DB as any,
      orderId,
      orderItems.map(i => ({ productId: i.product_id, quantity: i.quantity })),
      { allowNegative: true, tenantId: effectiveTenant }
    );
    if (bomRes.ok && bomRes.depletions.length > 0) {
      for (const dep of bomRes.depletions) {
        try {
          await env.AURA_DB.prepare(
            "UPDATE inventory_items SET current_stock = MAX(0, COALESCE((SELECT current_stock FROM ingredients WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?), current_stock - ?)), updated_at = datetime('now') WHERE id = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
          )
            .bind(dep.ingredientId, effectiveTenant, dep.quantity, dep.ingredientId, effectiveTenant)
            .run();
        } catch {
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
    }
    // Also reconcile any previously-deducted BOM ingredients whose mirror may have missed sync during a partial failure
    if (bomRes.ok && orderId) {
      try {
        const syncedRows = await env.AURA_DB.prepare(
          "SELECT DISTINCT ingredient_id FROM stock_movements WHERE reference_id = ? AND reference_type = 'order' AND type IN ('order_consumption', 'consumption', 'sale', 'out') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
          .bind(orderId, effectiveTenant)
          .all<{ ingredient_id?: string }>();
        for (const row of syncedRows?.results || []) {
          if (!row?.ingredient_id) continue;
          await env.AURA_DB.prepare(
            "UPDATE inventory_items SET current_stock = MAX(0, COALESCE((SELECT current_stock FROM ingredients WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?), current_stock)), updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
            .bind(row.ingredient_id, effectiveTenant, row.ingredient_id, effectiveTenant)
            .run()
            .catch(() => {});
        }
      } catch {
        // Optional reconciliation in partial test mocks
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
      (bomRes.alreadyDeducted || bomRes.depletions.length > 0) &&
      itemsWithProductId.length > 0 &&
      itemsWithProductId.every(i => bomProductIds.has(i.product_id))
    ) {
      return;
    }
  } catch (err) {
    console.warn('[inventory] BOM deduction failed (retryable):', (err as Error).message);
    return;
  }

  if (orderId) {
    if (bomProductIds.size === 0) {
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
    }
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

        // Two order lines can resolve to the same ingredient. The unique index on order consumption
        // allows one ledger row per (tenant, order, ingredient), so the later line is folded into the
        // existing row instead of being rolled back and lost.
        const foldIntoExistingConsumption = async () => {
          const stockOp = hasIngTenantCol
            ? env.AURA_DB.prepare(
                "UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(deductQty, now, ingredient.id, effectiveTenant)
            : env.AURA_DB.prepare(
                'UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ?'
              ).bind(deductQty, now, ingredient.id);
          const ledgerMatch =
            "reference_id = ? AND reference_type = 'order' AND type = 'consumption' AND ingredient_id = ?";
          try {
            await env.AURA_DB.batch([
              stockOp,
              env.AURA_DB.prepare(
                `UPDATE stock_movements SET quantity = quantity - ? WHERE ${ledgerMatch} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
              ).bind(deductQty, orderId, ingredient.id, effectiveTenant),
            ]);
          } catch {
            // Legacy schemas without stock_movements.tenant_id
            await env.AURA_DB.batch([
              stockOp,
              env.AURA_DB.prepare(`UPDATE stock_movements SET quantity = quantity - ? WHERE ${ledgerMatch}`).bind(
                deductQty,
                orderId,
                ingredient.id
              ),
            ]);
          }
        };
        const isDuplicateConsumption = (e: unknown) => /UNIQUE constraint failed/i.test(String((e as Error)?.message ?? e));

        try {
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
              if (isDuplicateConsumption(batchErr)) throw batchErr;
              if (effectiveTenant !== 'default') throw batchErr;
              await env.AURA_DB.batch(fallbackIngBatch);
            }
          } else {
            await env.AURA_DB.batch(fallbackIngBatch);
          }
        } catch (dupErr) {
          if (!isDuplicateConsumption(dupErr)) throw dupErr;
          await foldIntoExistingConsumption();
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

