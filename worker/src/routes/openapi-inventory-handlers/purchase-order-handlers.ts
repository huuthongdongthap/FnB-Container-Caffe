import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { checkSupplierTenant } from './supplier-handlers';

const PO_READ_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'staff', 'kitchen', 'barista', 'chef', 'cashier', 'waiter'];
const PO_MUTATION_ROLES = ['owner', 'manager', 'admin'];

export const FORBIDDEN_TENANT_SENTINEL = '__FORBIDDEN_TENANT__';

function getOverrideCandidates(c: any): string[] {
  return [
    c?.req?.query?.('tenant_id'),
    c?.req?.query?.('tenantId'),
    c?.req?.query?.('store_id'),
    c?.req?.query?.('storeId'),
    c?.req?.header?.('X-Tenant-ID'),
    c?.req?.header?.('x-tenant-id'),
    c?.req?.header?.('X-Store-ID'),
    c?.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

export function resolveOpenApiIngredientTenant(c: any): string {
  const candidates = getOverrideCandidates(c);
  if (new Set(candidates).size > 1) {
    return FORBIDDEN_TENANT_SENTINEL;
  }
  const reqTenant = candidates[0] || '';
  const ctxTenant = (c?.get?.('tenantId') as string | undefined)?.trim() || '';
  const user = c?.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const role = user?.role ? String(user.role).trim().toLowerCase() : '';
  const userTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
  const isWildcardHQ = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
  const hqAdmin = isHQSuperAdmin(c) || isWildcardHQ;
  const boundTenant = userTenant || 'default';
  const resolved = getTenantId(c).trim() || 'default';

  if (user) {
    if (!hqAdmin) {
      if (
        boundTenant === '*' ||
        boundTenant.toLowerCase() === 'hq' ||
        (reqTenant && (reqTenant === '*' || reqTenant.toLowerCase() === 'hq' || reqTenant !== boundTenant)) ||
        (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) ||
        resolved !== boundTenant
      ) {
        return FORBIDDEN_TENANT_SENTINEL;
      }
      return boundTenant;
    }
    if (!isWildcardHQ && ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' && ctxTenant !== boundTenant && !reqTenant) {
      return FORBIDDEN_TENANT_SENTINEL;
    }
  } else if (
    (reqTenant && (reqTenant === '*' || reqTenant.toLowerCase() === 'hq')) ||
    (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq'))
  ) {
    return FORBIDDEN_TENANT_SENTINEL;
  }

  if (reqTenant) {
    return reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant;
  }
  if (ctxTenant) {
    return ctxTenant.toLowerCase() === 'hq' ? '*' : ctxTenant;
  }
  return resolved.toLowerCase() === 'hq' ? '*' : resolved;
}

async function verifyPurchaseOrderAccess(
  c: any,
  allowedRoles: string[],
): Promise<{ user: { id: string; role: string; tenantId?: string }; errorResponse: null } | { user: null; errorResponse: Response }> {
  let user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (!user && c.req?.raw && c.env?.JWT_SECRET && (c.req?.header?.('Authorization') || c.req?.header?.('authorization'))) {
    const session = await authenticateRequest(c.req.raw, c.env, { optional: true }).catch(() => null);
    if (session && 'payload' in session) {
      user = {
        id: session.payload.id,
        role: session.payload.role,
        tenantId: session.payload.tenantId,
      };
      c.set?.('user', user);
    }
  }
  const role = user?.role ? String(user.role).toLowerCase() : '';
  if (!user || !role) {
    return {
      user: null,
      errorResponse: c.json({ success: false, error: 'Authentication required', code: 'UNAUTHORIZED' }, 401),
    };
  }
  if (!allowedRoles.includes(role)) {
    return {
      user: null,
      errorResponse: c.json({ success: false, error: 'Insufficient permissions', code: 'FORBIDDEN' }, 403),
    };
  }
  const candidates = getOverrideCandidates(c);
  if (new Set(candidates).size > 1) {
    return {
      user: null,
      errorResponse: c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403),
    };
  }
  const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
  const isWildcardHQ = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
  const hqAdmin = isHQSuperAdmin(c) || isWildcardHQ;
  const boundTenant = userTenant || 'default';
  const reqTenant = candidates[0] || '';
  const ctxTenant = (c.get?.('tenantId') as string | undefined)?.trim() || '';
  const resolvedTenant = getTenantId(c).trim() || 'default';

  if (!hqAdmin) {
    if (
      boundTenant === '*' ||
      boundTenant.toLowerCase() === 'hq' ||
      (reqTenant && (reqTenant === '*' || reqTenant.toLowerCase() === 'hq' || reqTenant !== boundTenant)) ||
      (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) ||
      resolvedTenant !== boundTenant
    ) {
      return {
        user: null,
        errorResponse: c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403),
      };
    }
  } else if (!isWildcardHQ && ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' && ctxTenant !== boundTenant && !reqTenant) {
    return {
      user: null,
      errorResponse: c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403),
    };
  }
  return {
    user: { id: user.id || 'system', role, tenantId: userTenant || user.tenantId },
    errorResponse: null,
  };
}

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

function normalizeConcreteTenant(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*' || trimmed.toLowerCase() === 'hq') return undefined;
  return trimmed;
}

async function resolvePurchaseOrderConcreteTenant(
  db: any,
  po: Record<string, unknown>,
  tenantId: string
): Promise<string> {
  const fromPo = normalizeConcreteTenant(po.tenant_id);
  if (fromPo) return fromPo;
  if (tenantId !== '*' && tenantId.toLowerCase() !== 'hq') {
    return normalizeConcreteTenant(tenantId) || 'default';
  }
  const poId = String(po.id || '');
  if (poId) {
    const itemRow = (await db
      .prepare('SELECT ingredient_id, tenant_id FROM purchase_order_items WHERE purchase_order_id = ? LIMIT 1')
      .bind(poId)
      .first()
      .catch(() =>
        db
          .prepare('SELECT ingredient_id FROM purchase_order_items WHERE purchase_order_id = ? LIMIT 1')
          .bind(poId)
          .first()
          .catch(() => null)
      )) as Record<string, unknown> | null;
    const fromItem = normalizeConcreteTenant(itemRow?.tenant_id);
    if (fromItem) return fromItem;
    if (itemRow?.ingredient_id) {
      const ingRow = (await db
        .prepare('SELECT tenant_id FROM ingredients WHERE id = ?')
        .bind(String(itemRow.ingredient_id))
        .first()
        .catch(() => null)) as Record<string, unknown> | null;
      const fromIng = normalizeConcreteTenant(ingRow?.tenant_id);
      if (fromIng) return fromIng;
      const invRow = (await db
        .prepare('SELECT tenant_id FROM inventory_items WHERE id = ?')
        .bind(String(itemRow.ingredient_id))
        .first()
        .catch(() => null)) as Record<string, unknown> | null;
      const fromInv = normalizeConcreteTenant(invRow?.tenant_id);
      if (fromInv) return fromInv;
    }
  }
  if (po.supplier_id) {
    const supRow = (await db
      .prepare('SELECT tenant_id FROM suppliers WHERE id = ?')
      .bind(String(po.supplier_id))
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    const fromSup = normalizeConcreteTenant(supRow?.tenant_id);
    if (fromSup) return fromSup;
  }
  if (poId) {
    const auditRow = (await db
      .prepare(
        "SELECT tenant_id FROM audit_logs WHERE (entity_id = ? OR resource_id = ?) AND tenant_id IS NOT NULL AND TRIM(tenant_id) != '' AND TRIM(tenant_id) != '*' ORDER BY created_at DESC LIMIT 1"
      )
      .bind(poId, poId)
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    const fromAudit = normalizeConcreteTenant(auditRow?.tenant_id);
    if (fromAudit) return fromAudit;
  }
  return 'default';
}

async function fetchTenantScopedPoItems(db: any, poId: string, effectiveTenant: string): Promise<any[]> {
  let items: any[] = [];
  try {
    const res = await db
      .prepare(
        'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), \'\'), ?) = ?'
      )
      .bind(poId, effectiveTenant, effectiveTenant)
      .all();
    items = res.results || [];
  } catch {
    try {
      const res = await db
        .prepare('SELECT * FROM purchase_order_items WHERE po_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), \'\'), ?) = ?')
        .bind(poId, effectiveTenant, effectiveTenant)
        .all();
      items = res.results || [];
    } catch {
      try {
        const res = await db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').bind(poId).all();
        items = res.results || [];
      } catch {
        try {
          const res = await db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').bind(poId).all();
          items = res.results || [];
        } catch {
          items = [];
        }
      }
    }
  }
  return items.filter((it: any) => {
    if (it && typeof it === 'object' && 'tenant_id' in it && it.tenant_id !== undefined && it.tenant_id !== null && String(it.tenant_id).trim() !== '') {
      return matchesTenantRow(it, effectiveTenant);
    }
    return true;
  });
}

async function writePoAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId?: string
): Promise<void> {
  const auditTenant = tenantId && tenantId.trim() && tenantId.trim() !== '*' ? tenantId.trim() : 'default';
  try {
    await db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, userId, userId, action, 'purchase_order', entityId, 'purchase_order', entityId, metadata, metadata, auditTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'purchase_order', entityId, metadata, auditTenant, now).run();
    } catch {
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
      await db.prepare(
        'UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?'
      ).bind(auditTenant, entityId, entityId, action, now).run().catch(() => {});
    }
  }
}

export function registerPurchaseOrderHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/purchase-orders - List purchase orders
  app.openapi(InventoryRoutes.purchaseOrders.list as any, async (c: any) => {
    const auth = await verifyPurchaseOrderAccess(c, PO_READ_ROLES);
    if (auth.errorResponse) return auth.errorResponse;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403);
    }
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
        let items: { results: any[] };
        try {
          items = (await db.prepare(
            `SELECT po.*, s.name as supplier_name
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplier_id = s.id AND (? = '*' OR COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?)
             ${tenantAliasWhere}
             ORDER BY po.created_at DESC LIMIT ? OFFSET ?`
          ).bind(tenantId, tenantId, ...params, tenantId, limit, offset).all()) as { results: any[] };
        } catch {
          items = (await db.prepare(
            `SELECT po.*, s.name as supplier_name
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplier_id = s.id
             ${tenantAliasWhere}
             ORDER BY po.created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, tenantId, limit, offset).all()) as { results: any[] };
        }
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
    const usedUnscopedFallback = !fetchedItems && tenantId !== '*';
    if (!fetchedItems) {
      const fetchLimit = usedUnscopedFallback ? 500 : limit;
      const fetchOffset = usedUnscopedFallback ? 0 : offset;
      try {
        const items = (await db.prepare(
          `SELECT po.*, s.name as supplier_name
           FROM purchase_orders po
           LEFT JOIN suppliers s ON po.supplier_id = s.id
           ${aliasWhere}
           ORDER BY po.created_at DESC LIMIT ? OFFSET ?`
        ).bind(...params, fetchLimit, fetchOffset).all()) as { results: any[] };
        itemsResults = items.results || [];
      } catch {
        try {
          const items = (await db.prepare(
            `SELECT * FROM purchase_orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, fetchLimit, fetchOffset).all()) as { results: any[] };
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
      if (usedUnscopedFallback) {
        total = checked.length;
        itemsResults = checked.slice(offset, offset + limit);
      } else {
        if (checked.length !== itemsResults.length) {
          total = Math.max(0, total - (itemsResults.length - checked.length));
        }
        itemsResults = checked;
      }
    }

    return c.json({
      success: true,
      data: itemsResults,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/purchase-orders/{id} - Get purchase order by ID
  app.openapi(InventoryRoutes.purchaseOrders.get as any, async (c: any) => {
    const auth = await verifyPurchaseOrderAccess(c, PO_READ_ROLES);
    if (auth.errorResponse) return auth.errorResponse;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403);
    }
    const { id } = c.req.valid('param');

    let po: any = null;
    try {
      po = await db.prepare(
        `SELECT po.*, s.name as supplier_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id AND (? = '*' OR COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?)
         WHERE po.id = ?`
      ).bind(tenantId, tenantId, id).first();
    } catch {
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
    }

    if (!po || !(await checkPurchaseOrderTenant(db, po, tenantId))) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    const effectivePoTenant = await resolvePurchaseOrderConcreteTenant(db, po, tenantId);
    const items = await fetchTenantScopedPoItems(db, id, effectivePoTenant);
    po.items = items.map((it: any) => ({
      ...it,
      unitCost: it.unit_cost ?? it.unit_price ?? 0,
      unit_cost: it.unit_cost ?? it.unit_price ?? 0,
    }));

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders - Create purchase order
  app.openapi(InventoryRoutes.purchaseOrders.create as any, async (c: any) => {
    const auth = await verifyPurchaseOrderAccess(c, PO_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403);
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
      supplier = null;
    }
    if (!supplier) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }

    const rawSupplierTenant = supplier.tenant_id && String(supplier.tenant_id).trim() ? String(supplier.tenant_id).trim() : undefined;
    const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : (rawSupplierTenant || 'default');

    const seenIngredientIds = new Set<string>();
    const resolvedItemsToInsert: Array<{
      ingredientId: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }> = [];
    let totalAmount = 0;

    for (const item of body.items) {
      const ingKey = String(item.ingredientId || '').trim();
      if (!ingKey || seenIngredientIds.has(ingKey)) {
        return c.json({ success: false, error: `Duplicate or invalid ingredient ${item.ingredientId} in purchase order items` }, 400);
      }
      seenIngredientIds.add(ingKey);

      let ingredient: any = null;
      try {
        ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
      } catch {
        ingredient = null;
      }
      if (!ingredient) {
        ingredient = await db.prepare('SELECT *, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
      }
      if (!ingredient || !(await checkIngredientTenant(db, item.ingredientId, ingredient, effectiveTenant))) {
        return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
      }

      const unitCost =
        item.unitCost !== undefined && item.unitCost !== null
          ? Number(item.unitCost)
          : Number(ingredient.cost_per_unit ?? ingredient.unit_price ?? ingredient.unit_cost ?? ingredient.costPerUnit ?? 0);
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return c.json({ success: false, error: `Invalid unitCost for ingredient ${item.ingredientId}` }, 400);
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return c.json({ success: false, error: `Invalid quantity for ingredient ${item.ingredientId}` }, 400);
      }
      const itemTotal = quantity * unitCost;
      totalAmount += itemTotal;
      resolvedItemsToInsert.push({
        ingredientId: item.ingredientId,
        quantity,
        unitCost,
        totalCost: itemTotal,
      });
    }

    const poRand = new Uint8Array(4);
    crypto.getRandomValues(poRand);
    const id = `po_${Date.now()}_${Array.from(poRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const poNumber = `PO-${Date.now()}`;
    const expectedDate = body.expectedDate || null;

    let insertedPo = false;
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
      await db.prepare('UPDATE purchase_orders SET total = ? WHERE id = ?').bind(totalAmount, id).run().catch(() => {});
    } catch (err) {
      if (effectiveTenant !== 'default') throw err;
      insertedPo = false;
    }
    if (!insertedPo) {
      if (effectiveTenant !== 'default') {
        throw new Error('Failed to insert tenant-scoped purchase order');
      }
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
          // Fallback for minimal default-tenant schema
        }
      }
    }

    for (const resolvedItem of resolvedItemsToInsert) {
      const itemRand = new Uint8Array(4);
      crypto.getRandomValues(itemRand);
      const itemId = `poi_${Date.now()}_${Array.from(itemRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;

      try {
        await db.prepare(
          `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_cost, total_price, created_at, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          itemId,
          id,
          id,
          resolvedItem.ingredientId,
          resolvedItem.quantity,
          resolvedItem.unitCost,
          resolvedItem.unitCost,
          resolvedItem.totalCost,
          resolvedItem.totalCost,
          now,
          effectiveTenant
        ).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_cost, total_price, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            itemId,
            id,
            id,
            resolvedItem.ingredientId,
            resolvedItem.quantity,
            resolvedItem.unitCost,
            resolvedItem.unitCost,
            resolvedItem.totalCost,
            resolvedItem.totalCost,
            now
          ).run();
          await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
        } catch {
          try {
            await db.prepare(
              `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_price, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              itemId,
              id,
              id,
              resolvedItem.ingredientId,
              resolvedItem.quantity,
              resolvedItem.unitCost,
              resolvedItem.unitCost,
              resolvedItem.totalCost,
              now
            ).run();
            await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
          } catch {
            try {
              await db.prepare(
                `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price)
                 VALUES (?, ?, ?, ?, ?, ?)`
              ).bind(
                itemId,
                id,
                resolvedItem.ingredientId,
                resolvedItem.quantity,
                resolvedItem.unitCost,
                resolvedItem.totalCost
              ).run();
              await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
            } catch (err) {
              if (effectiveTenant !== 'default') throw err;
              try {
                await db.prepare(
                  `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(itemId, id, resolvedItem.ingredientId, resolvedItem.quantity, resolvedItem.unitCost, now).run();
                await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
              } catch {
                // Fallback for minimal default-tenant schema
              }
            }
          }
        }
      }
    }

    await writePoAuditLog(db, user.id, 'purchase_order_create', id, JSON.stringify({ ...body, tenant_id: effectiveTenant }), now, effectiveTenant);

    let po: any = null;
    try {
      po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first();
      const items = await fetchTenantScopedPoItems(db, id, effectiveTenant);
      if (po) po.items = items;
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
    const auth = await verifyPurchaseOrderAccess(c, PO_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403);
    }
    const { id } = c.req.valid('param');
    const rawBody = await c.req.json().catch(() => ({}));
    const validBody = c.req.valid('json');
    const body = { ...(rawBody && typeof rawBody === 'object' ? rawBody : {}), ...validBody };
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

    const currentStatus = String(existing.status || 'draft');
    if (body.items !== undefined) {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ success: false, error: 'Purchase order items cannot be empty' }, 400);
      }
    }
    const rawShippingCost = body.shippingCost !== undefined ? body.shippingCost : body.shipping_cost;
    if (
      rawShippingCost !== undefined &&
      (typeof rawShippingCost !== 'number' || !Number.isFinite(rawShippingCost) || rawShippingCost < 0)
    ) {
      return c.json({ success: false, error: 'Invalid shippingCost: must be a non-negative finite number' }, 400);
    }
    const rawTaxAmount = body.taxAmount !== undefined ? body.taxAmount : body.tax_amount;
    if (
      rawTaxAmount !== undefined &&
      (typeof rawTaxAmount !== 'number' || !Number.isFinite(rawTaxAmount) || rawTaxAmount < 0)
    ) {
      return c.json({ success: false, error: 'Invalid taxAmount: must be a non-negative finite number' }, 400);
    }

    if (currentStatus === 'partially_received' && body.items !== undefined) {
      return c.json(
        {
          success: false,
          error: 'Cannot replace items on a partially_received purchase order',
          code: 'INVALID_OPERATION',
        },
        400
      );
    }

    const effectiveTenant = await resolvePurchaseOrderConcreteTenant(db, existing, tenantId);

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (body.supplierId !== undefined) {
      let supplier: any = null;
      try {
        supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(body.supplierId).first();
        if (supplier && !(await checkSupplierTenant(db, supplier, effectiveTenant))) {
          supplier = null;
        }
      } catch {
        supplier = null;
      }
      if (!supplier) {
        return c.json({ success: false, error: 'Supplier not found' }, 404);
      }
      updates.push('supplier_id = ?');
      params.push(body.supplierId);
    }
    if (body.expectedDate !== undefined) { updates.push('expected_date = ?'); params.push(body.expectedDate); }
    if (body.status !== undefined) {
      if (body.status === 'received' || (body.status === 'partially_received' && currentStatus !== 'partially_received')) {
        return c.json({ success: false, error: 'Use the receive endpoint to mark a purchase order as received' }, 400);
      }
      const allowedTransitions: Record<string, Set<string>> = {
        draft: new Set(['draft', 'pending', 'ordered', 'approved', 'cancelled']),
        pending: new Set(['pending', 'ordered', 'approved', 'cancelled']),
        ordered: new Set(['ordered', 'approved', 'cancelled']),
        approved: new Set(['approved', 'ordered', 'cancelled']),
        partially_received: new Set(['partially_received']),
      };
      const allowedNext = allowedTransitions[currentStatus];
      if (!allowedNext || !allowedNext.has(String(body.status))) {
        return c.json(
          {
            success: false,
            error: `Invalid status transition from ${currentStatus} to ${body.status}`,
            code: 'INVALID_OPERATION',
          },
          400
        );
      }
      updates.push('status = ?');
      params.push(body.status);
    }
    if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      try {
        await db.prepare(
          `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(...params, effectiveTenant).run();
      } catch (err) {
        if (effectiveTenant !== 'default') throw err;
        await db.prepare(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      }
    }

    if (body.items) {
      const seenPatchIngredients = new Set<string>();
      const resolvedPatchItems: Array<{
        ingredientId: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }> = [];
      let recalculatedTotal = 0;

      for (const item of body.items) {
        const ingKey = String(item.ingredientId || '').trim();
        if (!ingKey || seenPatchIngredients.has(ingKey)) {
          return c.json({ success: false, error: `Duplicate or invalid ingredient ${item.ingredientId} in purchase order items` }, 400);
        }
        seenPatchIngredients.add(ingKey);

        let ingredient: any = null;
        try {
          ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(item.ingredientId).first();
        } catch {
          ingredient = null;
        }
        if (!ingredient) {
          ingredient = await db.prepare('SELECT *, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(item.ingredientId).first().catch(() => null);
        }
        if (!ingredient || !(await checkIngredientTenant(db, item.ingredientId, ingredient, effectiveTenant))) {
          return c.json({ success: false, error: `Ingredient ${item.ingredientId} not found` }, 400);
        }

        const unitCost =
          item.unitCost !== undefined && item.unitCost !== null
            ? Number(item.unitCost)
            : Number(ingredient.cost_per_unit ?? ingredient.unit_price ?? ingredient.unit_cost ?? ingredient.costPerUnit ?? 0);
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          return c.json({ success: false, error: `Invalid unitCost for ingredient ${item.ingredientId}` }, 400);
        }
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return c.json({ success: false, error: `Invalid quantity for ingredient ${item.ingredientId}` }, 400);
        }
        const itemTotal = quantity * unitCost;
        recalculatedTotal += itemTotal;
        resolvedPatchItems.push({
          ingredientId: item.ingredientId,
          quantity,
          unitCost,
          totalCost: itemTotal,
        });
      }

      try {
        await db
          .prepare(
            "DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND (tenant_id = ? OR tenant_id IS NULL OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
          )
          .bind(id, effectiveTenant, effectiveTenant)
          .run();
      } catch {
        await db.prepare('DELETE FROM purchase_order_items WHERE purchase_order_id = ?').bind(id).run();
      }

      for (const resolvedItem of resolvedPatchItems) {
        const itemRand = new Uint8Array(4);
        crypto.getRandomValues(itemRand);
        const itemId = `poi_${Date.now()}_${Array.from(itemRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;

        try {
          await db.prepare(
            `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_cost, total_price, created_at, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            itemId,
            id,
            id,
            resolvedItem.ingredientId,
            resolvedItem.quantity,
            resolvedItem.unitCost,
            resolvedItem.unitCost,
            resolvedItem.totalCost,
            resolvedItem.totalCost,
            now,
            effectiveTenant
          ).run();
        } catch {
          try {
            await db.prepare(
              `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_cost, total_price, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              itemId,
              id,
              id,
              resolvedItem.ingredientId,
              resolvedItem.quantity,
              resolvedItem.unitCost,
              resolvedItem.unitCost,
              resolvedItem.totalCost,
              resolvedItem.totalCost,
              now
            ).run();
            await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
          } catch {
            try {
              await db.prepare(
                `INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, unit_price, total_price, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                itemId,
                id,
                id,
                resolvedItem.ingredientId,
                resolvedItem.quantity,
                resolvedItem.unitCost,
                resolvedItem.unitCost,
                resolvedItem.totalCost,
                now
              ).run();
              await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
            } catch {
              try {
                await db.prepare(
                  `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price)
                   VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(
                  itemId,
                  id,
                  resolvedItem.ingredientId,
                  resolvedItem.quantity,
                  resolvedItem.unitCost,
                  resolvedItem.totalCost
                ).run();
                await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
              } catch (err) {
                if (effectiveTenant !== 'default') throw err;
                await db.prepare(
                  `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(itemId, id, resolvedItem.ingredientId, resolvedItem.quantity, resolvedItem.unitCost, now).run();
                await db.prepare('UPDATE purchase_order_items SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, itemId).run().catch(() => {});
              }
            }
          }
        }
      }

      try {
        await db.prepare(
          "UPDATE purchase_orders SET total_amount = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(recalculatedTotal, now, id, effectiveTenant).run();
        await db.prepare('UPDATE purchase_orders SET total = ? WHERE id = ?').bind(recalculatedTotal, id).run().catch(() => {});
      } catch (err) {
        if (effectiveTenant !== 'default') throw err;
        try {
          await db.prepare('UPDATE purchase_orders SET total_amount = ?, updated_at = ? WHERE id = ?')
            .bind(recalculatedTotal, now, id).run();
        } catch {
          await db.prepare('UPDATE purchase_orders SET total = ?, updated_at = ? WHERE id = ?')
            .bind(recalculatedTotal, now, id).run().catch(() => {});
        }
      }
    }

    await writePoAuditLog(db, user.id, 'purchase_order_update', id, JSON.stringify({ ...body, tenant_id: effectiveTenant }), now, effectiveTenant);

    const po = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first()) as any;
    const items = await fetchTenantScopedPoItems(db, id, effectiveTenant);
    if (po) po.items = items;

    return c.json({ success: true, data: po });
  });

  // POST /api/inventory/purchase-orders/{id}/receive - Receive purchase order items
  app.openapi(InventoryRoutes.purchaseOrders.receive as any, async (c: any) => {
    const auth = await verifyPurchaseOrderAccess(c, PO_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403);
    }
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first().catch(() => null)) as any;
    if (!existing || !(await checkPurchaseOrderTenant(db, existing, tenantId))) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }
    const effectiveTenant = await resolvePurchaseOrderConcreteTenant(db, existing, tenantId);

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
          'SELECT id, ingredient_id, quantity, unit_price, received_quantity, tenant_id FROM purchase_order_items WHERE purchase_order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), \'\'), ?) = ?'
        )
        .bind(id, effectiveTenant, effectiveTenant)
        .all();
      poItems = (poItemsRes?.results as Array<Record<string, unknown>> | undefined) || [];
    } catch {
      try {
        const poItemsRes = await db
          .prepare(
            'SELECT id, ingredient_id, quantity, received_quantity, tenant_id FROM purchase_order_items WHERE purchase_order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), \'\'), ?) = ?'
          )
          .bind(id, effectiveTenant, effectiveTenant)
          .all();
        poItems = (poItemsRes?.results as Array<Record<string, unknown>> | undefined) || [];
      } catch {
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
      }
    }
    poItems = poItems.filter((row) => {
      if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
        return matchesTenantRow(row, effectiveTenant);
      }
      return true;
    });

    let poHasScheduledItemsTable = poItems.length > 0;
    if (!poHasScheduledItemsTable) {
      const existingRec = existing as Record<string, unknown>;
      if (
        ('total_cost' in existingRec && Number(existingRec.total_cost) === 0) ||
        ('total_amount' in existingRec && Number(existingRec.total_amount) === 0)
      ) {
        poHasScheduledItemsTable = true;
      } else {
        const tableRow = await db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'purchase_order_items'")
          .first<{ name?: string }>()
          .catch(() => null);
        if (tableRow?.name === 'purchase_order_items') {
          poHasScheduledItemsTable = true;
        }
      }
    }

    const dedupedItemsMap = new Map<string, any>();
    for (const rawItem of body.items) {
      const key = String(rawItem.ingredientId ?? rawItem.ingredient_id ?? '').trim();
      if (!key) {
        return c.json({ success: false, error: 'ingredientId is required for each receive item' }, 400);
      }
      if (dedupedItemsMap.has(key)) {
        return c.json({ success: false, error: 'Duplicate ingredientId in receive payload is not allowed' }, 400);
      }
      dedupedItemsMap.set(key, { ...rawItem, ingredientId: key });
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
      if (poHasScheduledItemsTable && !orderedItem) {
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

    if (!resolvedItems.some((r) => r.receiveQty > 0)) {
      return c.json({ success: false, error: 'At least one item must have receivedQuantity > 0' }, 400);
    }

    const allItemsFullyReceived =
      poItems.length > 0
        ? poItems.every((pi) => {
            const orderedQty = Number(pi.quantity ?? 0);
            if (!Number.isFinite(orderedQty) || orderedQty <= 0) return true;
            const prevReceived = Math.max(0, Number(pi.received_quantity || 0));
            const addedNow =
              resolvedItems.find((r) => String(r.item.ingredientId) === String(pi.ingredient_id))?.receiveQty || 0;
            return prevReceived + addedNow >= orderedQty;
          })
        : true;
    const nextPoStatus = allItemsFullyReceived ? 'received' : 'partially_received';
    const appliedUpdates: Array<{
      poItemId?: string;
      ingredientId: string;
      receiveQty: number;
      movId: string;
      usingCanonical: boolean;
    }> = [];

    const rollbackAppliedUpdates = async () => {
      for (const applied of [...appliedUpdates].reverse()) {
        if (applied.poItemId) {
          await db
            .prepare('UPDATE purchase_order_items SET received_quantity = MAX(0, COALESCE(received_quantity, 0) - ?) WHERE id = ?')
            .bind(applied.receiveQty, applied.poItemId)
            .run()
            .catch(() => null);
        } else {
          await db
            .prepare('UPDATE purchase_order_items SET received_quantity = MAX(0, COALESCE(received_quantity, 0) - ?) WHERE purchase_order_id = ? AND ingredient_id = ?')
            .bind(applied.receiveQty, id, applied.ingredientId)
            .run()
            .catch(() => null);
        }
        if (!applied.usingCanonical) {
          if (effectiveTenant && effectiveTenant !== '*') {
            await db
              .prepare("UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(applied.receiveQty, now, applied.ingredientId, effectiveTenant)
              .run()
              .catch(() => {
                if (effectiveTenant !== 'default') return null;
                return db
                  .prepare('UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ?')
                  .bind(applied.receiveQty, now, applied.ingredientId)
                  .run()
                  .catch(() => null);
              });
          } else {
            await db
              .prepare('UPDATE ingredients SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ?')
              .bind(applied.receiveQty, now, applied.ingredientId)
              .run()
              .catch(() => null);
          }
          await db.prepare('DELETE FROM stock_movements WHERE id = ?').bind(applied.movId).run().catch(() => null);
        }
        if (effectiveTenant && effectiveTenant !== '*') {
          await db
            .prepare("UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(applied.receiveQty, now, applied.ingredientId, effectiveTenant)
            .run()
            .catch(() => {
              if (effectiveTenant !== 'default') return null;
              return db
                .prepare('UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ?')
                .bind(applied.receiveQty, now, applied.ingredientId)
                .run()
                .catch(() => null);
            });
        } else {
          await db
            .prepare('UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) - ?), updated_at = ? WHERE id = ?')
            .bind(applied.receiveQty, now, applied.ingredientId)
            .run()
            .catch(() => null);
        }
        await db.prepare('DELETE FROM inventory_transactions WHERE id = ?').bind(applied.movId).run().catch(() => null);
      }
    };

    for (const { item, orderedItem, receiveQty, ingredient, usingCanonical } of resolvedItems) {
      if (receiveQty <= 0) continue;
      const movId = `mov_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const hasIngTenantCol = Boolean(ingredient && typeof ingredient === 'object' && 'tenant_id' in ingredient);
      const poItemId = orderedItem?.id ? String(orderedItem.id) : undefined;
      let itemUpdate: any = null;
      if (poItemId) {
        itemUpdate = await db
          .prepare('UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + ? WHERE id = ? AND purchase_order_id = ? AND (quantity IS NULL OR COALESCE(received_quantity, 0) + ? <= quantity)')
          .bind(receiveQty, poItemId, id, receiveQty)
          .run()
          .catch((err: unknown) => {
            if (effectiveTenant !== 'default') throw err;
            return db
              .prepare('UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + ? WHERE id = ? AND (quantity IS NULL OR COALESCE(received_quantity, 0) + ? <= quantity)')
              .bind(receiveQty, poItemId, receiveQty)
              .run()
              .catch(() =>
                db
                  .prepare('UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + ? WHERE purchase_order_id = ? AND ingredient_id = ? AND COALESCE(received_quantity, 0) + ? <= quantity')
                  .bind(receiveQty, id, item.ingredientId, receiveQty)
                  .run()
                  .catch(() => null)
              );
          });
      } else {
        itemUpdate = await db
          .prepare('UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + ? WHERE purchase_order_id = ? AND ingredient_id = ? AND (quantity IS NULL OR COALESCE(received_quantity, 0) + ? <= quantity)')
          .bind(receiveQty, id, item.ingredientId, receiveQty)
          .run()
          .catch((err: unknown) => {
            if (effectiveTenant !== 'default') throw err;
            return db
              .prepare('UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + ? WHERE purchase_order_id = ? AND ingredient_id = ? AND COALESCE(received_quantity, 0) + ? <= quantity')
              .bind(receiveQty, id, item.ingredientId, receiveQty)
              .run()
              .catch(() => null);
          });
      }
      if (itemUpdate?.meta && typeof itemUpdate.meta.changes === 'number' && itemUpdate.meta.changes === 0) {
        await rollbackAppliedUpdates();
        return c.json({ success: false, error: `Concurrent receive conflict or over-receive for ingredient ${item.ingredientId}` }, 409);
      }

      if (!usingCanonical) {
        if (effectiveTenant && effectiveTenant !== '*') {
          try {
            await db.prepare(
              "UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(receiveQty, now, item.ingredientId, effectiveTenant).run();
          } catch (err) {
            if (effectiveTenant !== 'default' || hasIngTenantCol) throw err;
            await db.prepare('UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
              .bind(receiveQty, now, item.ingredientId).run();
          }
        } else {
          await db.prepare('UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
            .bind(receiveQty, now, item.ingredientId).run();
        }

        try {
          await db.prepare(
            `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, tenant_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            movId,
            item.ingredientId,
            'purchase_receipt',
            receiveQty,
            id,
            'purchase_order',
            `Received from PO ${id}`,
            user.id,
            effectiveTenant || 'default',
            now
          ).run();
        } catch (err) {
          const msg = String((err as Error)?.message || err || '');
          if (effectiveTenant !== 'default' && !msg.includes('tenant_id')) throw err;
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
        }
        if (effectiveTenant && effectiveTenant !== '*') {
          await db.prepare('UPDATE stock_movements SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, movId).run().catch(() => {});
        }

        if (effectiveTenant && effectiveTenant !== '*') {
          await db.prepare(
            "UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(receiveQty, now, now, item.ingredientId, effectiveTenant).run().catch(() => {
            if (effectiveTenant !== 'default') return null;
            return db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
              .bind(receiveQty, now, now, item.ingredientId).run().catch(() => {});
          });
        } else {
          await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
            .bind(receiveQty, now, now, item.ingredientId).run().catch(() => {});
        }

        await db.prepare(
          `INSERT OR IGNORE INTO inventory_transactions (
            id, item_id, type, quantity, reference_type, reference_id, notes, tenant_id, created_at
          )
          SELECT ?, ?, 'in', ?, 'purchase', ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id = ?)`
        ).bind(
          movId,
          item.ingredientId,
          receiveQty,
          id,
          `Received from PO ${id}`,
          effectiveTenant || 'default',
          now,
          item.ingredientId
        ).run().catch(() => {
          if (effectiveTenant !== 'default') return null;
          return db.prepare(
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
        });
        if (effectiveTenant && effectiveTenant !== '*') {
          await db.prepare('UPDATE inventory_transactions SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, movId).run().catch(() => {});
        }
      } else {
        if (effectiveTenant && effectiveTenant !== '*') {
          try {
            await db.prepare(
              "UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(receiveQty, now, now, item.ingredientId, effectiveTenant).run();
          } catch (err) {
            if (effectiveTenant !== 'default') throw err;
            await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
              .bind(receiveQty, now, now, item.ingredientId).run();
          }
        } else {
          await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, last_restocked_at = ?, updated_at = ? WHERE id = ?')
            .bind(receiveQty, now, now, item.ingredientId).run();
        }

        try {
          await db.prepare(
            `INSERT INTO inventory_transactions (
              id, item_id, type, quantity, reference_type, reference_id, notes, tenant_id, created_at
            ) VALUES (?, ?, 'in', ?, 'purchase', ?, ?, ?, ?)`
          ).bind(
            movId,
            item.ingredientId,
            receiveQty,
            id,
            `Received from PO ${id}`,
            effectiveTenant || 'default',
            now
          ).run();
        } catch (err) {
          if (effectiveTenant !== 'default') throw err;
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
        }
      }

      appliedUpdates.push({
        poItemId,
        ingredientId: String(item.ingredientId),
        receiveQty,
        movId,
        usingCanonical,
      });
    }

    let casRes: any;
    if (effectiveTenant && effectiveTenant !== '*') {
      try {
        casRes = await db.prepare(
          "UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ? AND status NOT IN ('received', 'cancelled') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(nextPoStatus, now, id, effectiveTenant).run();
      } catch (err) {
        if (effectiveTenant !== 'default') throw err;
        casRes = await db.prepare(
          "UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ? AND status NOT IN ('received', 'cancelled')"
        ).bind(nextPoStatus, now, id).run();
      }
    } else {
      casRes = await db.prepare(
        "UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ? AND status NOT IN ('received', 'cancelled')"
      ).bind(nextPoStatus, now, id).run();
    }
    if (casRes && casRes.meta && typeof casRes.meta.changes === 'number' && casRes.meta.changes === 0) {
      await rollbackAppliedUpdates();
      return c.json({ success: false, error: 'Purchase order already received' }, 409);
    }

    await writePoAuditLog(db, user.id, 'purchase_order_receive', id, JSON.stringify({ ...body, tenant_id: effectiveTenant }), now, effectiveTenant);

    const po = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first()) as any;
    const items = await fetchTenantScopedPoItems(db, id, effectiveTenant);
    if (po) po.items = items;

    return c.json({ success: true, data: po });
  });
}

