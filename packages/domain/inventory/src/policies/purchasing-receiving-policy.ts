/**
 * Canonical Purchasing & Receiving Policy
 * Flow: Supplier → Purchase Order → Receiving → Stock → Recipe Consumption → Cost
 * Invariants: Receiving is the only gateway that increases stock;
 * Cancelled POs cannot increase stock; Receiving is idempotent; Never trust client totals.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { matchesTenantRow } from 'worker/src/lib/db';

export interface ReceiveItemInput {
  ingredientId: string;
  receivedQuantity: number;
}

export interface ReceivePurchaseOrderResult {
  ok: boolean;
  alreadyReceived?: boolean;
  status?: 'partially_received' | 'received';
  receivedItems?: Array<{
    ingredientId: string;
    quantity: number;
    unitPrice: number;
    newTotalReceived: number;
  }>;
  error?: string;
}

export async function createCanonicalPurchaseOrder(
  db: D1Database,
  input: {
    supplierId: string;
    items: Array<{ ingredientId: string; quantity: number; unitPrice?: number }>;
    notes?: string;
    expectedDate?: string;
    createdBy?: string;
    tenantId?: string;
  },
  tenantId?: string
) {
  const rawEffectiveTenant = (tenantId ?? input.tenantId)?.trim() || 'default';
  const effectiveTenant = rawEffectiveTenant.toLowerCase() === 'hq' ? '*' : rawEffectiveTenant;
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Purchase order requires at least one item');
  }

  let supplier: { id: string; name: string; tenant_id?: string | null } | null = null;
  if (effectiveTenant !== '*') {
    try {
      supplier = await db.prepare(
        "SELECT * FROM suppliers WHERE id = ? AND is_active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(input.supplierId, effectiveTenant).first<{ id: string; name: string; tenant_id?: string | null }>();
    } catch {
      supplier = null;
    }
  }
  if (!supplier && (effectiveTenant === 'default' || effectiveTenant === '*')) {
    supplier = await db.prepare(
      'SELECT * FROM suppliers WHERE id = ? AND is_active = 1'
    ).bind(input.supplierId).first<{ id: string; name: string; tenant_id?: string | null }>();
  }

  if (!supplier || (effectiveTenant && !matchesTenantRow(supplier, effectiveTenant))) {
    throw new Error('Supplier not found or inactive');
  }
  const rawSupplierTenant = 'tenant_id' in supplier && supplier.tenant_id !== undefined
    ? ((typeof supplier.tenant_id === 'string' && supplier.tenant_id.trim()) || 'default')
    : 'default';
  const supplierTenant = rawSupplierTenant === '*' || rawSupplierTenant.toLowerCase() === 'hq' ? 'default' : rawSupplierTenant;
  const poTenant = effectiveTenant && effectiveTenant !== '*' ? effectiveTenant : supplierTenant;

  const now = new Date().toISOString();
  const poId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;

  let subtotal = 0;
  const processedItems = [];
  const seenIngredientIds = new Set<string>();

  for (const item of input.items) {
    const normalizedIngredientId = typeof item.ingredientId === 'string' ? item.ingredientId.trim() : '';
    if (!normalizedIngredientId) {
      throw new Error('Ingredient ID is required');
    }
    if (seenIngredientIds.has(normalizedIngredientId)) {
      throw new Error(`Duplicate ingredient ${normalizedIngredientId} in purchase order`);
    }
    seenIngredientIds.add(normalizedIngredientId);

    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`Invalid item quantity for ingredient ${item.ingredientId}`);
    }
    if (item.unitPrice !== undefined && (typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      throw new Error(`Invalid unit price for ingredient ${item.ingredientId}`);
    }
    let ing: { id: string; cost_per_unit: number; tenant_id?: string | null } | null = null;
    if (poTenant && poTenant !== '*') {
      try {
        ing = await db.prepare(
          "SELECT * FROM ingredients WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(normalizedIngredientId, poTenant).first<{ id: string; cost_per_unit: number; tenant_id?: string | null }>();
      } catch {
        ing = null;
      }
    }
    if (!ing && (poTenant === 'default' || poTenant === '*')) {
      ing = await db.prepare(
        'SELECT * FROM ingredients WHERE id = ?'
      ).bind(normalizedIngredientId).first<{ id: string; cost_per_unit: number; tenant_id?: string | null }>();
    }
    if (!ing || (poTenant && !matchesTenantRow(ing, poTenant))) {
      throw new Error(`Ingredient ${item.ingredientId} not found`);
    }

    const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : Number(ing.cost_per_unit || 0);
    const totalPrice = item.quantity * unitPrice;
    subtotal += totalPrice;

    processedItems.push({
      id: `poi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      purchaseOrderId: poId,
      ingredientId: normalizedIngredientId,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      receivedQuantity: 0,
    });
  }

  // Pure document creation — NEVER touches ingredients.current_stock
  if (poTenant && poTenant !== '*') {
    try {
      await db.prepare(
        `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_delivery_date, status, subtotal, total, notes, created_by, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, 'ordered', ?, ?, ?, ?, ?, ?, ?)`
      ).bind(poId, poNumber, input.supplierId, now.slice(0, 10), input.expectedDate || null, subtotal, subtotal, input.notes || null, input.createdBy || 'system', now, now, poTenant).run();
    } catch (err) {
      if (poTenant !== 'default') throw err;
      await db.prepare(
        `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_delivery_date, status, subtotal, total, notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'ordered', ?, ?, ?, ?, ?, ?)`
      ).bind(poId, poNumber, input.supplierId, now.slice(0, 10), input.expectedDate || null, subtotal, subtotal, input.notes || null, input.createdBy || 'system', now, now).run();
    }
  } else {
    await db.prepare(
      `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_delivery_date, status, subtotal, total, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ordered', ?, ?, ?, ?, ?, ?)`
    ).bind(poId, poNumber, input.supplierId, now.slice(0, 10), input.expectedDate || null, subtotal, subtotal, input.notes || null, input.createdBy || 'system', now, now).run();
  }

  for (const item of processedItems) {
    if (poTenant && poTenant !== '*') {
      try {
        await db.prepare(
          `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price, received_quantity, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
        ).bind(item.id, poId, item.ingredientId, item.quantity, item.unitPrice, item.totalPrice, poTenant).run();
      } catch (err) {
        if (poTenant !== 'default') throw err;
        await db.prepare(
          `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price, received_quantity)
           VALUES (?, ?, ?, ?, ?, ?, 0)`
        ).bind(item.id, poId, item.ingredientId, item.quantity, item.unitPrice, item.totalPrice).run();
      }
    } else {
      await db.prepare(
        `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price, received_quantity)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      ).bind(item.id, poId, item.ingredientId, item.quantity, item.unitPrice, item.totalPrice).run();
    }
  }

  return { id: poId, poNumber, supplierId: input.supplierId, status: 'ordered', total: subtotal, items: processedItems };
}

export async function receivePurchaseOrder(
  db: D1Database,
  poId: string,
  items: ReceiveItemInput[],
  options?: { receiptId?: string; receivedBy?: string; tenantId?: string }
): Promise<ReceivePurchaseOrderResult> {
  const rawNormTenant = options?.tenantId && options.tenantId.trim() ? options.tenantId.trim() : 'default';
  const normTenant = rawNormTenant.toLowerCase() === 'hq' ? '*' : rawNormTenant;
  const po = await db.prepare(
    'SELECT * FROM purchase_orders WHERE id = ?'
  ).bind(poId).first<{ id: string; status: string; supplier_id: string; tenant_id?: string | null }>();

  if (!po || !matchesTenantRow(po, normTenant)) {
    return { ok: false, error: 'purchase_order_not_found' };
  }
  if (po.status === 'cancelled') return { ok: false, error: 'cancelled_purchase_order' };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'invalid_received_items' };

  const rawPoTenant = po.tenant_id && String(po.tenant_id).trim() ? String(po.tenant_id).trim() : '';
  const effectiveTenant =
    normTenant !== '*'
      ? normTenant
      : rawPoTenant && rawPoTenant !== '*' && rawPoTenant.toLowerCase() !== 'hq'
        ? rawPoTenant
        : 'default';

  // 1. Idempotency Guard
  if (options?.receiptId) {
    let existing: Record<string, unknown> | null = null;
    if (effectiveTenant) {
      try {
        existing = await db.prepare(
          "SELECT id, tenant_id FROM stock_movements WHERE reference_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(options.receiptId, effectiveTenant).first<Record<string, unknown>>();
      } catch (err) {
        if (effectiveTenant !== 'default') throw err;
        const unscoped = await db.prepare(
          'SELECT id FROM stock_movements WHERE reference_id = ? LIMIT 1'
        ).bind(options.receiptId).first<Record<string, unknown>>();
        if (unscoped && matchesTenantRow(unscoped, effectiveTenant)) {
          existing = unscoped;
        }
      }
    } else {
      existing = await db.prepare(
        'SELECT id FROM stock_movements WHERE reference_id = ? LIMIT 1'
      ).bind(options.receiptId).first<Record<string, unknown>>();
    }
    if (existing) {
      return { ok: true, alreadyReceived: true, status: po.status as any, receivedItems: [] };
    }
  }

  if (po.status === 'received') {
    return { ok: false, error: 'already_fully_received' };
  }

  let poiRows: { results?: any[] } = { results: [] };
  if (effectiveTenant && effectiveTenant !== '*') {
    try {
      poiRows = await db.prepare(
        "SELECT id, ingredient_id, quantity, COALESCE(unit_price, 0) as unit_price, COALESCE(received_quantity, 0) as received_quantity, tenant_id FROM purchase_order_items WHERE purchase_order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(poId, effectiveTenant).all<any>();
    } catch {
      poiRows = { results: [] };
    }
  }
  if ((!poiRows.results || poiRows.results.length === 0) && (effectiveTenant === 'default' || effectiveTenant === '*')) {
    poiRows = await db.prepare(
      'SELECT id, ingredient_id, quantity, COALESCE(unit_price, 0) as unit_price, COALESCE(received_quantity, 0) as received_quantity FROM purchase_order_items WHERE purchase_order_id = ?'
    ).bind(poId).all<any>();
  }

  const poItems = (poiRows.results || []).filter(item =>
    matchesTenantRow(item as Record<string, unknown>, effectiveTenant || 'default')
  );
  if (poItems.length === 0) return { ok: false, error: 'empty_purchase_order' };

  // 2. Validate Items & Guard Against Supplier Mismatch and Over-Receiving
  // Aggregate duplicate ingredientId entries into one receipt line per item so
  // each purchase_order_items row is updated once atomically.
  const mergedItemsMap = new Map<string, number>();
  for (const rcv of items) {
    const matching = poItems.find(p => p.ingredient_id === rcv.ingredientId);
    if (!matching) return { ok: false, error: 'supplier_item_mismatch' };
    if (typeof rcv.receivedQuantity !== 'number' || !Number.isFinite(rcv.receivedQuantity) || rcv.receivedQuantity <= 0) {
      return { ok: false, error: 'invalid_received_quantity' };
    }
    const aggregatedQty = (mergedItemsMap.get(rcv.ingredientId) ?? 0) + rcv.receivedQuantity;
    const nextTotal = Number(matching.received_quantity || 0) + aggregatedQty;
    if (nextTotal > Number(matching.quantity)) {
      return { ok: false, error: 'Cannot receive more than ordered quantity' };
    }
    mergedItemsMap.set(rcv.ingredientId, aggregatedQty);
  }
  const mergedItems = Array.from(mergedItemsMap.entries()).map(([ingredientId, receivedQuantity]) => ({
    ingredientId,
    receivedQuantity,
  }));

  // 3. Increment Stock & Record Immutable Movement
  const now = new Date().toISOString();
  const receiptKey = options?.receiptId || `grn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const receivedSummaries = [];
  const appliedPoiUpdates: Array<{ id: string; prevReceivedQuantity: number }> = [];
  const appliedIngredientUpdates: Array<{ ingredientId: string; receivedQuantity: number }> = [];
  const pendingMovements: Array<{ movId: string; ingredientId: string; receivedQuantity: number }> = [];

  const rollbackPartialReceipt = async () => {
    for (const ingUpd of appliedIngredientUpdates) {
      if (effectiveTenant) {
        await db.prepare(
          "UPDATE ingredients SET current_stock = MAX(0, current_stock - ?), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(ingUpd.receivedQuantity, now, ingUpd.ingredientId, effectiveTenant).run().catch(async () => {
          if (effectiveTenant === 'default') {
            await db.prepare(
              'UPDATE ingredients SET current_stock = MAX(0, current_stock - ?), updated_at = ? WHERE id = ?'
            ).bind(ingUpd.receivedQuantity, now, ingUpd.ingredientId).run().catch(() => {});
          }
        });
      }
    }
    for (const poiUpd of appliedPoiUpdates) {
      if (effectiveTenant && effectiveTenant !== '*') {
        await db.prepare(
          "UPDATE purchase_order_items SET received_quantity = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(poiUpd.prevReceivedQuantity, poiUpd.id, effectiveTenant).run().catch(async () => {
          if (effectiveTenant === 'default') {
            await db.prepare(
              'UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?'
            ).bind(poiUpd.prevReceivedQuantity, poiUpd.id).run().catch(() => {});
          }
        });
      } else {
        await db.prepare(
          'UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?'
        ).bind(poiUpd.prevReceivedQuantity, poiUpd.id).run().catch(() => {});
      }
    }
    if (options?.receiptId) {
      await db.prepare(
        'DELETE FROM stock_movements WHERE reference_id = ?'
      ).bind(receiptKey).run().catch(() => {});
    }
  };

  try {
    for (const rcv of mergedItems) {
      const poi = poItems.find(p => p.ingredient_id === rcv.ingredientId)!;
      const prevReceivedQuantity = Number(poi.received_quantity || 0);
      const newTotalReceived = prevReceivedQuantity + rcv.receivedQuantity;

      // Atomic conditional update prevents concurrent over-receiving beyond ordered quantity
      let poiRes: { meta?: { changes?: number } } | undefined;
      if (effectiveTenant && effectiveTenant !== '*') {
        try {
          poiRes = await db.prepare(
            "UPDATE purchase_order_items SET received_quantity = ? WHERE id = ? AND COALESCE(received_quantity, 0) + ? <= quantity AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(newTotalReceived, poi.id, rcv.receivedQuantity, effectiveTenant).run();
        } catch (err) {
          if (effectiveTenant !== 'default') throw err;
          poiRes = await db.prepare(
            'UPDATE purchase_order_items SET received_quantity = ? WHERE id = ? AND COALESCE(received_quantity, 0) + ? <= quantity'
          ).bind(newTotalReceived, poi.id, rcv.receivedQuantity).run();
        }
      } else {
        poiRes = await db.prepare(
          'UPDATE purchase_order_items SET received_quantity = ? WHERE id = ? AND COALESCE(received_quantity, 0) + ? <= quantity'
        ).bind(newTotalReceived, poi.id, rcv.receivedQuantity).run();
      }
      if (poiRes?.meta && typeof poiRes.meta.changes === 'number' && poiRes.meta.changes === 0) {
        await rollbackPartialReceipt();
        return { ok: false, error: 'Cannot receive more than ordered quantity' };
      }
      appliedPoiUpdates.push({ id: poi.id, prevReceivedQuantity });

      // Receiving is the ONLY gateway that increases stock from purchases; preserve positive cost_per_unit when PO unit_price is 0
      if (effectiveTenant) {
        try {
          await db.prepare(
            "UPDATE ingredients SET current_stock = current_stock + ?, cost_per_unit = CASE WHEN ? > 0 THEN ?2 ELSE cost_per_unit END, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(rcv.receivedQuantity, poi.unit_price, now, rcv.ingredientId, effectiveTenant).run();
        } catch (err) {
          if (effectiveTenant !== 'default') throw err;
          await db.prepare(
            'UPDATE ingredients SET current_stock = current_stock + ?, cost_per_unit = CASE WHEN ? > 0 THEN ?2 ELSE cost_per_unit END, updated_at = ? WHERE id = ?'
          ).bind(rcv.receivedQuantity, poi.unit_price, now, rcv.ingredientId).run();
        }
      } else {
        await db.prepare(
          'UPDATE ingredients SET current_stock = current_stock + ?, cost_per_unit = CASE WHEN ? > 0 THEN ?2 ELSE cost_per_unit END, updated_at = ? WHERE id = ?'
        ).bind(rcv.receivedQuantity, poi.unit_price, now, rcv.ingredientId).run();
      }
      appliedIngredientUpdates.push({ ingredientId: rcv.ingredientId, receivedQuantity: rcv.receivedQuantity });

      const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      pendingMovements.push({
        movId,
        ingredientId: rcv.ingredientId,
        receivedQuantity: rcv.receivedQuantity,
      });

      receivedSummaries.push({
        ingredientId: rcv.ingredientId,
        quantity: rcv.receivedQuantity,
        unitPrice: poi.unit_price,
        newTotalReceived,
      });
      poi.received_quantity = newTotalReceived;
    }

    // Record immutable ledger movements and idempotency key only after all item stock updates succeed
    for (const mov of pendingMovements) {
      if (effectiveTenant) {
        try {
          await db.prepare(
            `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at, tenant_id)
             VALUES (?, ?, 'purchase_receipt', ?, ?, 'purchase_order', ?, ?, ?, ?)`
          ).bind(
            mov.movId,
            mov.ingredientId,
            mov.receivedQuantity,
            receiptKey,
            `Received from PO ${poId}`,
            options?.receivedBy || 'system',
            now,
            effectiveTenant
          ).run();
        } catch (err) {
          if (effectiveTenant !== 'default') throw err;
          await db.prepare(
            `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at)
             VALUES (?, ?, 'purchase_receipt', ?, ?, 'purchase_order', ?, ?, ?)`
          ).bind(
            mov.movId,
            mov.ingredientId,
            mov.receivedQuantity,
            receiptKey,
            `Received from PO ${poId}`,
            options?.receivedBy || 'system',
            now
          ).run();
        }
      } else {
        await db.prepare(
          `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at)
           VALUES (?, ?, 'purchase_receipt', ?, ?, 'purchase_order', ?, ?, ?)`
        ).bind(
          mov.movId,
          mov.ingredientId,
          mov.receivedQuantity,
          receiptKey,
          `Received from PO ${poId}`,
          options?.receivedBy || 'system',
          now
        ).run();
      }
    }

    // 4. Determine Terminal vs Partial Status
    const allFullyReceived = poItems.every(p => p.received_quantity >= p.quantity);
    const nextStatus = allFullyReceived ? 'received' : 'partially_received';

    if (effectiveTenant) {
      try {
        await db.prepare(
          "UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(nextStatus, now, poId, effectiveTenant).run();
      } catch (err) {
        if (effectiveTenant !== 'default') throw err;
        await db.prepare(
          'UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?'
        ).bind(nextStatus, now, poId).run();
      }
    } else {
      await db.prepare(
        'UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?'
      ).bind(nextStatus, now, poId).run();
    }

    return { ok: true, alreadyReceived: false, status: nextStatus, receivedItems: receivedSummaries };
  } catch (err) {
    await rollbackPartialReceipt();
    throw err;
  }
}

export async function cancelPurchaseOrder(db: D1Database, poId: string, tenantId?: string) {
  const rawNormTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  const normTenant = rawNormTenant.toLowerCase() === 'hq' ? '*' : rawNormTenant;
  const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(poId).first<{ id: string; status: string; tenant_id?: string | null }>();
  if (!po || !matchesTenantRow(po, normTenant)) return { ok: false, error: 'purchase_order_not_found' };
  if (po.status === 'received') return { ok: false, error: 'cannot_cancel_received_order' };
  if (po.status === 'partially_received') return { ok: false, error: 'cannot_cancel_partially_received_order' };

  const rawPoTenant = po.tenant_id && String(po.tenant_id).trim() ? String(po.tenant_id).trim() : '';
  const effectiveTenant = normTenant !== '*'
    ? normTenant
    : rawPoTenant && rawPoTenant !== '*' && rawPoTenant.toLowerCase() !== 'hq'
      ? rawPoTenant
      : 'default';
  const now = new Date().toISOString();
  if (effectiveTenant && effectiveTenant !== '*') {
    try {
      await db.prepare(
        "UPDATE purchase_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(now, poId, effectiveTenant).run();
    } catch (err) {
      if (effectiveTenant !== 'default') throw err;
      await db.prepare("UPDATE purchase_orders SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, poId).run();
    }
  } else {
    await db.prepare("UPDATE purchase_orders SET status = 'cancelled', updated_at = ? WHERE id = ?")
      .bind(now, poId).run();
  }
  return { ok: true };
}

export function mapSupplierToErpnext(supplier: { id: string; name: string; taxId?: string; address?: string; phone?: string }) {
  return {
    supplier_name: supplier.name,
    supplier_type: 'Company',
    tax_id: supplier.taxId || '',
    address_line1: supplier.address || '',
    mobile_no: supplier.phone || '',
  };
}
