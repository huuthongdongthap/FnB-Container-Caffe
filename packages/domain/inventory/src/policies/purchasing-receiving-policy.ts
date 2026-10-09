/**
 * Canonical Purchasing & Receiving Policy
 * Flow: Supplier → Purchase Order → Receiving → Stock → Recipe Consumption → Cost
 * Invariants: Receiving is the only gateway that increases stock;
 * Cancelled POs cannot increase stock; Receiving is idempotent; Never trust client totals.
 */
import type { D1Database } from '@cloudflare/workers-types';

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
  }
) {
  const supplier = await db.prepare(
    'SELECT id, name FROM suppliers WHERE id = ? AND is_active = 1'
  ).bind(input.supplierId).first<{ id: string; name: string }>();

  if (!supplier) {
    throw new Error('Supplier not found or inactive');
  }

  const now = new Date().toISOString();
  const poId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;

  let subtotal = 0;
  const processedItems = [];

  for (const item of input.items) {
    const ing = await db.prepare(
      'SELECT id, cost_per_unit FROM ingredients WHERE id = ?'
    ).bind(item.ingredientId).first<{ id: string; cost_per_unit: number }>();
    if (!ing) throw new Error(`Ingredient ${item.ingredientId} not found`);

    const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : Number(ing.cost_per_unit || 0);
    const totalPrice = item.quantity * unitPrice;
    subtotal += totalPrice;

    processedItems.push({
      id: `poi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      purchaseOrderId: poId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      receivedQuantity: 0,
    });
  }

  // Pure document creation — NEVER touches ingredients.current_stock
  await db.prepare(
    `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_delivery_date, status, subtotal, total, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ordered', ?, ?, ?, ?, ?, ?)`
  ).bind(poId, poNumber, input.supplierId, now.slice(0, 10), input.expectedDate || null, subtotal, subtotal, input.notes || null, input.createdBy || 'system', now, now).run();

  for (const item of processedItems) {
    await db.prepare(
      `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price, received_quantity)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).bind(item.id, poId, item.ingredientId, item.quantity, item.unitPrice, item.totalPrice).run();
  }

  return { id: poId, poNumber, supplierId: input.supplierId, status: 'ordered', total: subtotal, items: processedItems };
}

export async function receivePurchaseOrder(
  db: D1Database,
  poId: string,
  items: ReceiveItemInput[],
  options?: { receiptId?: string; receivedBy?: string }
): Promise<ReceivePurchaseOrderResult> {
  const po = await db.prepare(
    'SELECT id, status, supplier_id FROM purchase_orders WHERE id = ?'
  ).bind(poId).first<{ id: string; status: string; supplier_id: string }>();

  if (!po) return { ok: false, error: 'purchase_order_not_found' };
  if (po.status === 'cancelled') return { ok: false, error: 'cancelled_purchase_order' };

  // 1. Idempotency Guard
  if (options?.receiptId) {
    const existing = await db.prepare(
      'SELECT id FROM stock_movements WHERE reference_id = ? LIMIT 1'
    ).bind(options.receiptId).first();
    if (existing) {
      return { ok: true, alreadyReceived: true, status: po.status as any, receivedItems: [] };
    }
  }

  const poiRows = await db.prepare(
    'SELECT id, ingredient_id, quantity, COALESCE(unit_price, 0) as unit_price, COALESCE(received_quantity, 0) as received_quantity FROM purchase_order_items WHERE purchase_order_id = ?'
  ).bind(poId).all<any>();

  const poItems = poiRows.results || [];
  if (poItems.length === 0) return { ok: false, error: 'empty_purchase_order' };

  // 2. Validate Items & Guard Against Supplier Mismatch
  for (const rcv of items) {
    const matching = poItems.find(p => p.ingredient_id === rcv.ingredientId);
    if (!matching) return { ok: false, error: 'supplier_item_mismatch' };
    if (rcv.receivedQuantity <= 0) return { ok: false, error: 'invalid_received_quantity' };
  }

  // 3. Increment Stock & Record Immutable Movement
  const now = new Date().toISOString();
  const receiptKey = options?.receiptId || `grn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const receivedSummaries = [];

  for (const rcv of items) {
    const poi = poItems.find(p => p.ingredient_id === rcv.ingredientId)!;
    const newTotalReceived = poi.received_quantity + rcv.receivedQuantity;

    // Update PO item progress
    await db.prepare(
      'UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?'
    ).bind(newTotalReceived, poi.id).run();

    // Receiving is the ONLY gateway that increases stock from purchases
    await db.prepare(
      'UPDATE ingredients SET current_stock = current_stock + ?, cost_per_unit = ?, updated_at = ? WHERE id = ?'
    ).bind(rcv.receivedQuantity, poi.unit_price, now, rcv.ingredientId).run();

    // Immutable ledger log with canonical incoming cost
    await db.prepare(
      `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at)
       VALUES (?, ?, 'purchase_receipt', ?, ?, 'purchase_order', ?, ?, ?)`
    ).bind(
      `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      rcv.ingredientId,
      rcv.receivedQuantity,
      receiptKey,
      `Received from PO ${poId}`,
      options?.receivedBy || 'system',
      now
    ).run();

    receivedSummaries.push({
      ingredientId: rcv.ingredientId,
      quantity: rcv.receivedQuantity,
      unitPrice: poi.unit_price,
      newTotalReceived,
    });
    poi.received_quantity = newTotalReceived;
  }

  // 4. Determine Terminal vs Partial Status
  const allFullyReceived = poItems.every(p => p.received_quantity >= p.quantity);
  const nextStatus = allFullyReceived ? 'received' : 'partially_received';

  await db.prepare(
    'UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?'
  ).bind(nextStatus, now, poId).run();

  return { ok: true, alreadyReceived: false, status: nextStatus, receivedItems: receivedSummaries };
}

export async function cancelPurchaseOrder(db: D1Database, poId: string) {
  const po = await db.prepare('SELECT id, status FROM purchase_orders WHERE id = ?').bind(poId).first<{ id: string; status: string }>();
  if (!po) return { ok: false, error: 'purchase_order_not_found' };
  if (po.status === 'received') return { ok: false, error: 'cannot_cancel_received_order' };

  await db.prepare('UPDATE purchase_orders SET status = \'cancelled\', updated_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), poId).run();
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
