import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';
import { checkSupplierTenant } from './supplier-handlers';

async function checkIngredientTenant(
  db: any,
  id: string,
  row: Record<string, unknown>,
  tenantId: string
): Promise<boolean> {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    return matchesTenantRow(row, normTenant);
  }
  const invRow = (await db
    .prepare('SELECT id, tenant_id FROM inventory_items WHERE id = ?')
    .bind(id)
    .first()
    .catch(() => null)) as Record<string, unknown> | null;
  if (invRow && 'tenant_id' in invRow && invRow.tenant_id !== undefined) {
    return matchesTenantRow(invRow, normTenant);
  }
  return normTenant === 'default';
}

async function checkPurchaseOrderTenant(
  db: any,
  po: Record<string, unknown>,
  tenantId: string
): Promise<boolean> {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') return true;
  if ('tenant_id' in po && po.tenant_id !== undefined) {
    return matchesTenantRow(po, normTenant);
  }
  const poId = String(po.id || '');
  if (poId) {
    const itemRow = (await db
      .prepare('SELECT ingredient_id FROM purchase_order_items WHERE purchase_order_id = ? LIMIT 1')
      .bind(poId)
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    if (itemRow && itemRow.ingredient_id) {
      return checkIngredientTenant(db, String(itemRow.ingredient_id), itemRow, normTenant);
    }
  }
  if (po.supplier_id) {
    const supRow = (await db
      .prepare('SELECT * FROM suppliers WHERE id = ?')
      .bind(String(po.supplier_id))
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    if (supRow && 'tenant_id' in supRow && supRow.tenant_id !== undefined) {
      return matchesTenantRow(supRow, normTenant);
    }
  }
  if (po.created_by) {
    const userRow = (await db
      .prepare('SELECT id, tenant_id FROM users WHERE id = ?')
      .bind(String(po.created_by))
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    if (userRow && 'tenant_id' in userRow && userRow.tenant_id !== undefined) {
      return matchesTenantRow(userRow, normTenant);
    }
  }
  return normTenant === 'default';
}

async function writePoAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, userId, userId, action, 'purchase_order', entityId, 'purchase_order', entityId, metadata, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'purchase_order', entityId, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, action, 'purchase_order', entityId, metadata, now).run().catch(() => {});
      } catch {
        // Ignore audit log error
      }
    }
  }
}

export function registerPurchaseOrderHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/purchase-orders - List purchase orders
  app.openapi(InventoryRoutes.purchaseOrders.list as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c).trim() || 'default';
    const query = c.req.valid('query');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (query.status) {
      whereClause += 'WHERE status = ? ';
      params.push(query.status);
    }

    if (query.supplierId) {
      whereClause += whereClause ? 'AND supplier_id = ? ' : 'WHERE supplier_id = ? ';
      params.push(query.supplierId);
    }

    if (query.dateFrom) {
      whereClause += whereClause ? 'AND order_date >= ? ' : 'WHERE order_date >= ? ';
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereClause += whereClause ? 'AND order_date <= ? ' : 'WHERE order_date <= ? ';
      params.push(query.dateTo);
    }

    let total = 0;
    try {
      if (tenantId !== '*') {
        try {
          const tenantWhere = whereClause
            ? `${whereClause}AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? `
            : "WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ";
          const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM purchase_orders ${tenantWhere}`).bind(...params, tenantId).first()) as { total: number } | null;
          total = countResult?.total || 0;
        } catch {
          const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM purchase_orders ${whereClause}`).bind(...params).first()) as { total: number } | null;
          total = countResult?.total || 0;
        }
      } else {
        const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM purchase_orders ${whereClause}`).bind(...params).first()) as { total: number } | null;
        total = countResult?.total || 0;
      }
    } catch {
      total = 0;
    }

    let itemsResults: any[] = [];
    const aliasWhere = whereClause
      ? whereClause.replace(/supplier_id/g, 'po.supplier_id').replace(/status/g, 'po.status')
      : '';
    let fetchedItems = false;
    if (tenantId !== '*') {
      try {
        const tenantAliasWhere = aliasWhere
          ? `${aliasWhere}AND COALESCE(NULLIF(TRIM(po.tenant_id), ''), 'default') = ? `
          : "WHERE COALESCE(NULLIF(TRIM(po.tenant_id), ''), 'default') = ? ";
        const items = (await db.prepare(
          `SELECT po.*, s.name as supplier_name
           FROM purchase_orders po
           LEFT JOIN suppliers s ON po.supplier_id = s.id
           ${tenantAliasWhere}
           ORDER BY po.created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, tenantId, limit, offset).all()) as { results: any[] };
        itemsResults = items.results || [];
        fetchedItems = true;
      } catch {
        try {
          const tenantWhere = whereClause
            ? `${whereClause}AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? `
            : "WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ";
          const items = (await db.prepare(
            `SELECT * FROM purchase_orders ${tenantWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, tenantId, limit, offset).all()) as { results: any[] };
          itemsResults = items.results || [];
          fetchedItems = true;
        } catch {
          fetchedItems = false;
        }
      }
    }
    if (!fetchedItems) {
      try {
        const items = (await db.prepare(
          `SELECT po.*, s.name as supplier_name
           FROM purchase_orders po
           LEFT JOIN suppliers s ON po.supplier_id = s.id
           ${aliasWhere}
           ORDER BY po.created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: any[] };
        itemsResults = items.results || [];
      } catch {
        try {
          const items = (await db.prepare(
            `SELECT * FROM purchase_orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, limit, offset).all()) as { results: any[] };
          itemsResults = items.results || [];
        } catch {
          itemsResults = [];
        }
      }
    }

    if (tenantId !== '*' && itemsResults.length > 0) {
      const checked: any[] = [];
      for (const row of itemsResults) {
        if (await checkPurchaseOrderTenant(db, row, tenantId)) {
          checked.push(row);
        }
      }
      if (checked.length !== itemsResults.length) {
        total = Math.max(0, total - (itemsResults.length - checked.length));
      }
      itemsResults = checked;
    }

    return c.json({
      success: true,
      data: itemsResults,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/purchase-orders/{id} - Get purchase order by ID
  app.openapi(InventoryRoutes.purchaseOrders.get as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c).trim() || 'default';
    const { id } = c.req.valid('param');

    let po: any = null;
    try {
      po = await db.prepare(
        `SELECT po.*, s.name as supplier_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.id = ?`
      ).bind(id).first();
    } catch {
      po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first().catch(() => null);
    }

    if (!po || !(await checkPurchaseOrderTenant(db, po, tenantId))) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    let items: any[] = [];
    try {
      const res = await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
      items = res.results || [];
    } catch {
      try {
        const res = await db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').bind(id).all();
        items = res.results || [];
      } catch {
        items = [];
      }
    }
    po.items = items.map((it: any) => ({
      ...it,
      unitCost: it.unit_cost ?? it.unit_price ?? 0,
      unit_cost: it.unit_cost ?? it.unit_price ?? 0,
    }));

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders - Create purchase order
  app.openapi(InventoryRoutes.purchaseOrders.create as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c).trim() || 'default';
    const user = c.get('user');
    if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let supplier: any = null;
    try {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(body.supplierId).first();
      if (supplier && !(await checkSupplierTenant(db, supplier, tenantId))) {
        supplier = null;
      }
    } catch {
      supplier = { id: body.supplierId, name: body.supplierId };
    }
    if (!supplier) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }

    for (const item of body.items) {
      let ingredient: any = null;
      try {
        ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      } catch {
        ingredient = null;
      }
      if (!ingredient) {
        ingredient = await db.prepare('SELECT *, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
      }
      if (!ingredient || !(await checkIngredientTenant(db, item.ingredientId, ingredient, tenantId))) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }
    }

    const poRand = new Uint8Array(4);
    crypto.getRandomValues(poRand);
    const id = `po_${Date.now()}_${Array.from(poRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const poNumber = `PO-${Date.now()}`;
    const expectedDate = body.expectedDate || null;
    let totalAmount = 0;
    for (const item of body.items) {
      totalAmount += (item.quantity || 1) * (item.unitCost || 0);
    }

    const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';
    let insertedPo = false;
    if (tenantId && tenantId !== '*') {
      try {
        await db.prepare(
          `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_date, expected_delivery_date, status, total_amount, notes, created_by, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          poNumber,
          body.supplierId,
          body.orderDate || now.split('T')[0],
          expectedDate,
          expectedDate,
          'draft',
          totalAmount,
          body.notes || null,
          user.id,
          effectiveTenant,
          now,
          now
        ).run();
        insertedPo = true;
      } catch {
        insertedPo = false;
      }
    }
    if (!insertedPo) {
      try {
        await db.prepare(
          `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_date, expected_delivery_date, status, total_amount, notes, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          poNumber,
          body.supplierId,
          body.orderDate || now.split('T')[0],
          expectedDate,
          expectedDate,
          'draft',
          totalAmount,
          body.notes || null,
          user.id,
          now,
          now
        ).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO purchase_orders (id, supplier_id, order_date, expected_date, status, notes, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            id,
            body.supplierId,
            body.orderDate || now.split('T')[0],
            expectedDate,
            'draft',
            body.notes || null,
            user.id,
            now,
            now
          ).run();
        } catch {
          // Fallback for minimal schema
        }
      }
    }

    for (const item of body.items) {
      let ingredient: any = null;
      try {
        ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      } catch {
        ingredient = null;
      }
      if (!ingredient) {
        ingredient = await db.prepare('SELECT *, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
      }
      if (!ingredient) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }
      const unitCost = item.unitCost || ingredient.cost_per_unit || ingredient.costPerUnit || 0;
      const itemTotal = (item.quantity || 1) * unitCost;
      const itemRand = new Uint8Array(4);
      crypto.getRandomValues(itemRand);
      const itemId = `poi_${Date.now()}_${Array.from(itemRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;

      try {
        await db.prepare(
          `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_price, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(itemId, id, id, item.ingredientId, item.quantity, unitCost, unitCost, itemTotal, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(itemId, id, item.ingredientId, item.quantity, unitCost, now).run();
        } catch {
          // Fallback
        }
      }
    }

    await writePoAuditLog(db, user.id, 'purchase_order_create', id, JSON.stringify(body), now);

    let po: any = null;
    try {
      po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
      const items = (await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all()) as { results: any[] };
      if (po) po.items = items.results;
    } catch {
      po = {
        id,
        po_number: poNumber,
        supplier_id: body.supplierId,
        order_date: body.orderDate || now.split('T')[0],
        expected_date: expectedDate,
        status: 'draft',
        total_amount: totalAmount,
        notes: body.notes || null,
        items: body.items,
        created_at: now,
        updated_at: now,
      };
    }

    return c.json({ success: true, data: po }, 201);
  });

  // PATCH /api/inventory/purchase-orders/{id} - Update purchase order
  app.openapi(InventoryRoutes.purchaseOrders.update as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c).trim() || 'default';
    const user = c.get('user');
    if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first().catch(() => null)) as any;
    if (!existing || !(await checkPurchaseOrderTenant(db, existing, tenantId))) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    if (existing.status === 'received' || existing.status === 'cancelled') {
      return c.json(
        {
          success: false,
          error: `Cannot modify a ${existing.status} purchase order`,
          code: 'INVALID_OPERATION',
        },
        400
      );
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (body.supplierId !== undefined) {
      let supplier: any = null;
      try {
        supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(body.supplierId).first();
        if (supplier && !(await checkSupplierTenant(db, supplier, tenantId))) {
          supplier = null;
        }
      } catch {
        supplier = { id: body.supplierId };
      }
      if (!supplier) {
        return c.json({ success: false, error: 'Supplier not found' }, 404);
      }
      updates.push('supplier_id = ?');
      params.push(body.supplierId);
    }
    if (body.expectedDate !== undefined) { updates.push('expected_date = ?'); params.push(body.expectedDate); }
    if (body.status !== undefined) {
      if (body.status === 'received') {
        return c.json({ success: false, error: 'Use the receive endpoint to mark a purchase order as received' }, 400);
      }
      updates.push('status = ?');
      params.push(body.status);
    }
    if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      await db.prepare(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    if (body.items) {
      for (const item of body.items) {
        let ingredient: any = null;
        try {
          ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
        } catch {
          ingredient = null;
        }
        if (!ingredient) {
          ingredient = await db.prepare('SELECT *, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
        }
        if (!ingredient || !(await checkIngredientTenant(db, item.ingredientId, ingredient, tenantId))) {
          return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
        }
      }

      await db.prepare('DELETE FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).run();

      let recalculatedTotal = 0;
      for (const item of body.items) {
        let ingredient: any = null;
        try {
          ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
        } catch {
          ingredient = null;
        }
        if (!ingredient) {
          ingredient = await db.prepare('SELECT *, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
        }

        const unitCost = item.unitCost || ingredient.cost_per_unit || 0;
        const itemTotal = (item.quantity || 1) * unitCost;
        recalculatedTotal += itemTotal;
        const itemRand = new Uint8Array(4);
        crypto.getRandomValues(itemRand);
        const itemId = `poi_${Date.now()}_${Array.from(itemRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;

        try {
          await db.prepare(
            `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_price, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(itemId, id, id, item.ingredientId, item.quantity, unitCost, unitCost, itemTotal, now).run();
        } catch {
          await db.prepare(
            `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(itemId, id, item.ingredientId, item.quantity, unitCost, now).run();
        }
      }

      try {
        await db.prepare('UPDATE purchase_orders SET total_amount = ?, updated_at = ? WHERE id = ?')
          .bind(recalculatedTotal, now, id).run();
      } catch {
        await db.prepare('UPDATE purchase_orders SET total = ?, updated_at = ? WHERE id = ?')
          .bind(recalculatedTotal, now, id).run().catch(() => {});
      }
    }

    await writePoAuditLog(db, user.id, 'purchase_order_update', id, JSON.stringify(body), now);

    const po = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first()) as any;
    const items = (await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all()) as { results: any[] };
    if (po) po.items = items.results;

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders/{id}/receive - Receive purchase order items
  app.openapi(InventoryRoutes.purchaseOrders.receive as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c).trim() || 'default';
    const user = c.get('user');
    if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first().catch(() => null)) as any;
    if (!existing || !(await checkPurchaseOrderTenant(db, existing, tenantId))) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }
    const rawExistingTenant = existing.tenant_id && String(existing.tenant_id).trim() ? String(existing.tenant_id).trim() : undefined;
    const effectiveTenant = tenantId === '*' ? (rawExistingTenant || 'default') : (rawExistingTenant || tenantId || 'default');

    if (existing.status === 'received') {
      return c.json({ success: false, error: 'Purchase order already received' }, 409);
    }
    if (existing.status === 'cancelled') {
      return c.json({ success: false, error: 'Cannot receive cancelled purchase order' }, 409);
    }

    let poItems: Array<Record<string, unknown>> = [];
    try {
      const poItemsRes = await db
        .prepare(
          'SELECT id, ingredient_id, quantity, unit_price, received_quantity FROM purchase_order_items WHERE purchase_order_id = ?'
        )
        .bind(id)
        .all();
      poItems = (poItemsRes?.results as Array<Record<string, unknown>> | undefined) || [];
    } catch {
      try {
        const poItemsRes = await db.prepare('SELECT id, ingredient_id, quantity, received_quantity FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
        poItems = (poItemsRes?.results as Array<Record<string, unknown>> | undefined) || [];
      } catch {
        try {
          const poItemsRes = await db.prepare('SELECT ingredient_id, quantity FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
          poItems = (poItemsRes?.results as Array<Record<string, unknown>> | undefined) || [];
        } catch {
          try {
            const poItemsRes = await db.prepare('SELECT ingredient_id FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all();
            poItems = (poItemsRes?.results as Array<Record<string, unknown>> | undefined) || [];
          } catch {
            poItems = [];
          }
        }
      }
    }

    const dedupedItemsMap = new Map<string, any>();
    for (const rawItem of body.items) {
      const key = String(rawItem.ingredientId);
      if (!dedupedItemsMap.has(key)) {
        dedupedItemsMap.set(key, rawItem);
      }
    }
    const uniqueItems = Array.from(dedupedItemsMap.values());

    const resolvedItems: Array<{
      item: any;
      orderedItem?: Record<string, unknown>;
      receiveQty: number;
      ingredient: any;
      usingCanonical: boolean;
    }> = [];
    for (const item of uniqueItems) {
      const receiveQty = Number(item.receivedQuantity ?? item.received_quantity);
      if (!Number.isFinite(receiveQty) || receiveQty < 0) {
        return c.json({ success: false, error: 'Invalid received_quantity' }, 400);
      }
      const orderedItem = poItems.find((pi) => String(pi.ingredient_id) === String(item.ingredientId));
      if (poItems.length > 0 && !orderedItem) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} is not part of this purchase order` }, 400);
      }
      if (orderedItem && orderedItem.quantity !== undefined && orderedItem.quantity !== null) {
        const alreadyReceived = Math.max(0, Number(orderedItem.received_quantity || 0));
        if (alreadyReceived + receiveQty > Number(orderedItem.quantity)) {
          return c.json({ success: false, error: `Received quantity exceeds ordered quantity for ingredient ${item.ingredientId}` }, 400);
        }
      }
      let ingredient: any = null;
      let usingCanonical = false;
      try {
        ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      } catch {
        usingCanonical = true;
      }
      if (!ingredient) {
        ingredient = await db.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
        if (ingredient) {
          usingCanonical = true;
        }
      }
      if (!ingredient || !(await checkIngredientTenant(db, item.ingredientId, ingredient, effectiveTenant))) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }
      resolvedItems.push({ item, orderedItem, receiveQty, ingredient, usingCanonical });
    }

    let casRes: any;
    if (effectiveTenant && effectiveTenant !== '*') {
      try {
        casRes = await db.prepare(
          "UPDATE purchase_orders SET status = 'received', updated_at = ? WHERE id = ? AND status NOT IN ('received', 'cancelled') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, id, effectiveTenant).run();
      } catch {
        casRes = await db.prepare(
          "UPDATE purchase_orders SET status = 'received', updated_at = ? WHERE id = ? AND status NOT IN ('received', 'cancelled')"
        ).bind(now, id).run();
      }
    } else {
      casRes = await db.prepare(
        "UPDATE purchase_orders SET status = 'received', updated_at = ? WHERE id = ? AND status NOT IN ('received', 'cancelled')"
      ).bind(now, id).run();
    }
    if (casRes && casRes.meta && typeof casRes.meta.changes === 'number' && casRes.meta.changes === 0) {
      return c.json({ success: false, error: 'Purchase order already received' }, 409);
    }

    for (const { item, orderedItem, receiveQty, ingredient, usingCanonical } of resolvedItems) {
      const movId = `mov_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const hasIngTenantCol = Boolean(ingredient && typeof ingredient === 'object' && 'tenant_id' in ingredient);
      const poItemId = orderedItem?.id ? String(orderedItem.id) : undefined;
      if (poItemId) {
        await db
          .prepare('UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?')
          .bind(receiveQty, poItemId)
          .run()
          .catch(() =>
            db
              .prepare('UPDATE purchase_order_items SET received_quantity = ? WHERE purchase_order_id = ? AND ingredient_id = ?')
              .bind(receiveQty, id, item.ingredientId)
              .run()
              .catch(() => {})
          );
      } else {
        await db
          .prepare('UPDATE purchase_order_items SET received_quantity = ? WHERE purchase_order_id = ? AND ingredient_id = ?')
          .bind(receiveQty, id, item.ingredientId)
          .run()
          .catch(() => {});
      }

      if (!usingCanonical) {
        if (effectiveTenant && effectiveTenant !== '*' && hasIngTenantCol) {
          try {
            await db.prepare(
              "UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(receiveQty, now, item.ingredientId, effectiveTenant).run();
          } catch {
            await db.prepare('UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
              .bind(receiveQty, now, item.ingredientId).run();
          }
        } else {
          await db.prepare('UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
            .bind(receiveQty, now, item.ingredientId).run();
        }

        await db.prepare(
          `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          movId,
          item.ingredientId,
          'purchase_receipt',
          receiveQty,
          id,
          'purchase_order',
          `Received from PO ${id}`,
          user.id,
          now
        ).run();

        if (effectiveTenant && effectiveTenant !== '*') {
          await db.prepare(
            "UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(receiveQty, now, now, item.ingredientId, effectiveTenant).run().catch(() =>
            db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
              .bind(receiveQty, now, now, item.ingredientId).run().catch(() => {})
          );
        } else {
          await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
            .bind(receiveQty, now, now, item.ingredientId).run().catch(() => {});
        }

        await db.prepare(
          `INSERT OR IGNORE INTO inventory_transactions (
            id, item_id, type, quantity, reference_type, reference_id, notes, created_at
          )
          SELECT ?, ?, 'in', ?, 'purchase', ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id = ?)`
        ).bind(
          movId,
          item.ingredientId,
          receiveQty,
          id,
          `Received from PO ${id}`,
          now,
          item.ingredientId
        ).run().catch(() => {});
        if (effectiveTenant && effectiveTenant !== '*') {
          await db.prepare('UPDATE stock_movements SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, movId).run().catch(() => {});
          await db.prepare('UPDATE inventory_transactions SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, movId).run().catch(() => {});
        }
      } else {
        if (effectiveTenant && effectiveTenant !== '*') {
          try {
            await db.prepare(
              "UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(receiveQty, now, now, item.ingredientId, effectiveTenant).run();
          } catch {
            await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
              .bind(receiveQty, now, now, item.ingredientId).run();
          }
        } else {
          await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
            .bind(receiveQty, now, now, item.ingredientId).run();
        }

        await db.prepare(
          `INSERT INTO inventory_transactions (
            id, item_id, type, quantity, reference_type, reference_id, notes, created_at
          ) VALUES (?, ?, 'in', ?, 'purchase', ?, ?, ?)`
        ).bind(
          movId,
          item.ingredientId,
          receiveQty,
          id,
          `Received from PO ${id}`,
          now
        ).run();
        if (effectiveTenant && effectiveTenant !== '*') {
          await db.prepare('UPDATE inventory_transactions SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, movId).run().catch(() => {});
        }
      }
    }

    await writePoAuditLog(db, user.id, 'purchase_order_receive', id, JSON.stringify(body), now);

    const po = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first()) as any;
    const items = (await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).all()) as { results: any[] };
    if (po) po.items = items.results;

    return c.json({ success: true, data: po });
  });
}

