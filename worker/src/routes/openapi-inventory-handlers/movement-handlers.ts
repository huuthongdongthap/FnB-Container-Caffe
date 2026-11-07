import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin, matchesTenantRow } from '../../middleware/tenant';

const INVENTORY_READ_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'staff', 'kitchen', 'barista', 'chef', 'cashier', 'waiter'];
const INVENTORY_MUTATION_ROLES = ['owner', 'manager', 'admin'];
const INVENTORY_OUTBOUND_ROLES = ['owner', 'manager', 'admin', 'kitchen', 'barista', 'chef'];

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

async function verifyMovementAccess(
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
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return matchesTenantRow(row, normTenant);
  }
  const ingRow = (await db
    .prepare('SELECT id, tenant_id FROM ingredients WHERE id = ?')
    .bind(id)
    .first()
    .catch(() => null)) as Record<string, unknown> | null;
  if (ingRow && 'tenant_id' in ingRow && ingRow.tenant_id !== undefined) {
    return matchesTenantRow(ingRow, normTenant);
  }
  const invRow = (await db
    .prepare('SELECT id, tenant_id FROM inventory_items WHERE id = ?')
    .bind(id)
    .first()
    .catch(() => null)) as Record<string, unknown> | null;
  if (invRow && 'tenant_id' in invRow && invRow.tenant_id !== undefined) {
    return matchesTenantRow(invRow, normTenant);
  }
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    return matchesTenantRow(row, normTenant);
  }
  return normTenant === 'default';
}

function mapToCanonicalTxType(type: string, quantity: number): string {
  if (type === 'in' || type === 'out' || type === 'waste' || type === 'reserve' || type === 'release') {
    return type;
  }
  if (type === 'adjustment' || type === 'adjust') {
    return 'adjust';
  }
  if (type === 'transfer') {
    return quantity < 0 ? 'out' : 'in';
  }
  return quantity >= 0 ? 'in' : 'adjust';
}

function mapToCanonicalRefType(refType?: string | null): string | null {
  if (!refType) return null;
  if (refType === 'order' || refType === 'purchase' || refType === 'adjustment' || refType === 'waste_report' || refType === 'sync') {
    return refType;
  }
  if (refType === 'sale') return 'order';
  if (refType === 'purchase_order') return 'purchase';
  if (refType === 'waste') return 'waste_report';
  if (refType === 'manual' || refType === 'audit' || refType === 'transfer' || refType === 'production') return 'adjustment';
  return null;
}

export function registerMovementHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/movements - List stock movements
  app.openapi(InventoryRoutes.movements.list as any, async (c: any) => {
    const auth = await verifyMovementAccess(c, INVENTORY_READ_ROLES);
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
    const fetchLimit = tenantId === '*' ? limit : Math.max(limit * 10, 500);
    const fetchOffset = tenantId === '*' ? offset : 0;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (query.ingredientId) {
      whereClause += 'WHERE ingredient_id = ? ';
      params.push(query.ingredientId);
    }

    if (query.type) {
      whereClause += whereClause ? 'AND type = ? ' : 'WHERE type = ? ';
      params.push(query.type);
    }

    if (query.dateFrom) {
      whereClause += whereClause ? 'AND created_at >= ? ' : 'WHERE created_at >= ? ';
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereClause += whereClause ? 'AND created_at <= ? ' : 'WHERE created_at <= ? ';
      params.push(query.dateTo);
    }

    let total = 0;
    let itemsResults: any[] = [];
    let usingCanonical = false;
    let sqlTenantScoped = false;

    const aliasWhere = whereClause
      ? whereClause.replace(/ingredient_id/g, 'sm.ingredient_id').replace(/created_at/g, 'sm.created_at').replace(/\btype =/g, 'sm.type =')
      : '';
    const scopedMovementWhere = `${aliasWhere ? aliasWhere : 'WHERE 1=1 '}AND COALESCE(NULLIF(TRIM(sm.tenant_id), ''), 'default') = ?`;

    if (tenantId !== '*') {
      try {
        const scopedCount = (await db.prepare(
          `SELECT COUNT(*) as total FROM stock_movements sm ${scopedMovementWhere}`
        ).bind(...params, tenantId).first()) as { total: number } | null;
        total = scopedCount?.total || 0;
        let scopedItems: { results: any[] };
        try {
          scopedItems = (await db.prepare(
            `SELECT sm.*, COALESCE(i.name, ii.name) as ingredient_name, COALESCE(i.sku, ii.sku, ii.id) as ingredient_sku, COALESCE(i.unit, ii.unit) as ingredient_unit
             FROM stock_movements sm
             LEFT JOIN ingredients i ON sm.ingredient_id = i.id AND COALESCE(NULLIF(TRIM(i.tenant_id), ''), 'default') = ?
             LEFT JOIN inventory_items ii ON sm.ingredient_id = ii.id AND COALESCE(NULLIF(TRIM(ii.tenant_id), ''), 'default') = ?
             ${scopedMovementWhere}
             ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
          ).bind(tenantId, tenantId, ...params, tenantId, limit, offset).all()) as { results: any[] };
        } catch (joinErr) {
          if (tenantId !== 'default') throw joinErr;
          scopedItems = (await db.prepare(
            `SELECT sm.*, COALESCE(i.name, ii.name) as ingredient_name, COALESCE(i.sku, ii.sku, ii.id) as ingredient_sku, COALESCE(i.unit, ii.unit) as ingredient_unit
             FROM stock_movements sm
             LEFT JOIN ingredients i ON sm.ingredient_id = i.id
             LEFT JOIN inventory_items ii ON sm.ingredient_id = ii.id
             ${scopedMovementWhere}
             ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, tenantId, limit, offset).all()) as { results: any[] };
        }
        itemsResults = scopedItems.results || [];
        sqlTenantScoped = true;
      } catch {
        sqlTenantScoped = false;
      }
    }

    if (!sqlTenantScoped) {
      try {
        const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM stock_movements ${whereClause}`).bind(...params).first()) as { total: number } | null;
        total = countResult?.total || 0;
      } catch {
        usingCanonical = true;
      }

      if (!usingCanonical && total > 0) {
        try {
          if (tenantId !== '*') {
            const items = (await db.prepare(
              `SELECT sm.*, COALESCE(i.name, ii.name) as ingredient_name, COALESCE(i.sku, ii.sku, ii.id) as ingredient_sku, COALESCE(i.unit, ii.unit) as ingredient_unit
               FROM stock_movements sm
               LEFT JOIN ingredients i ON sm.ingredient_id = i.id AND COALESCE(NULLIF(TRIM(i.tenant_id), ''), 'default') = ?
               LEFT JOIN inventory_items ii ON sm.ingredient_id = ii.id AND COALESCE(NULLIF(TRIM(ii.tenant_id), ''), 'default') = ?
               ${aliasWhere}
               ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
            ).bind(tenantId, tenantId, ...params, fetchLimit, fetchOffset).all()) as { results: any[] };
            itemsResults = items.results || [];
          } else {
            const items = (await db.prepare(
              `SELECT sm.*, COALESCE(i.name, ii.name) as ingredient_name, COALESCE(i.sku, ii.sku, ii.id) as ingredient_sku, COALESCE(i.unit, ii.unit) as ingredient_unit
               FROM stock_movements sm
               LEFT JOIN ingredients i ON sm.ingredient_id = i.id
               LEFT JOIN inventory_items ii ON sm.ingredient_id = ii.id
               ${aliasWhere}
               ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
            ).bind(...params, fetchLimit, fetchOffset).all()) as { results: any[] };
            itemsResults = items.results || [];
          }
        } catch {
          try {
            const items = (await db.prepare(
              `SELECT * FROM stock_movements ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
            ).bind(...params, fetchLimit, fetchOffset).all()) as { results: any[] };
            itemsResults = items.results || [];
          } catch {
            itemsResults = [];
          }
        }
      }
    }

    if (usingCanonical) {
      const canonicalParams = params.map((p) => (p === 'adjustment' ? 'adjust' : p));
      const canonicalWhere = whereClause.replace(/ingredient_id/g, 'item_id');
      const canonicalAliasWhere = whereClause
        ? whereClause.replace(/ingredient_id/g, 'sm.item_id').replace(/created_at/g, 'sm.created_at').replace(/\btype =/g, 'sm.type =')
        : '';
      if (tenantId !== '*') {
        try {
          const scopedCanonicalWhere = `${canonicalAliasWhere ? canonicalAliasWhere : 'WHERE 1=1 '}AND COALESCE(NULLIF(TRIM(sm.tenant_id), ''), 'default') = ?`;
          const countResult = (await db.prepare(
            `SELECT COUNT(*) as total FROM inventory_transactions sm ${scopedCanonicalWhere}`
          ).bind(...canonicalParams, tenantId).first()) as { total: number } | null;
          total = countResult?.total || 0;
          const items = (await db.prepare(
            `SELECT sm.*, sm.item_id as ingredient_id, CASE WHEN sm.type = 'adjust' THEN 'adjustment' ELSE sm.type END as type, i.name as ingredient_name, COALESCE(i.sku, i.id) as ingredient_sku, i.unit as ingredient_unit
             FROM inventory_transactions sm
             LEFT JOIN inventory_items i ON sm.item_id = i.id AND COALESCE(NULLIF(TRIM(i.tenant_id), ''), 'default') = ?
             ${scopedCanonicalWhere}
             ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
          ).bind(tenantId, ...canonicalParams, tenantId, limit, offset).all()) as { results: any[] };
          itemsResults = items.results || [];
          sqlTenantScoped = true;
        } catch {
          sqlTenantScoped = false;
        }
      }
      if (!sqlTenantScoped) {
        const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM inventory_transactions ${canonicalWhere}`).bind(...canonicalParams).first().catch(() => null)) as { total: number } | null;
        total = countResult?.total || 0;
        try {
          const items = (await db.prepare(
            `SELECT sm.*, sm.item_id as ingredient_id, CASE WHEN sm.type = 'adjust' THEN 'adjustment' ELSE sm.type END as type, i.name as ingredient_name, COALESCE(i.sku, i.id) as ingredient_sku, i.unit as ingredient_unit
             FROM inventory_transactions sm
             LEFT JOIN inventory_items i ON sm.item_id = i.id
             ${canonicalAliasWhere}
             ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`
          ).bind(...canonicalParams, fetchLimit, fetchOffset).all()) as { results: any[] };
          itemsResults = items.results || [];
        } catch {
          itemsResults = [];
        }
      }
    }

    if (tenantId !== '*' && itemsResults.length > 0) {
      const allowedIngredientIds = new Set<string>();
      for (const row of itemsResults) {
        const ingId = String(row.ingredient_id || row.item_id || '').trim();
        if (ingId && (await checkIngredientTenant(db, ingId, row, tenantId))) {
          allowedIngredientIds.add(ingId);
        }
      }
      const checked = itemsResults.filter((row) => {
        const ingId = String(row.ingredient_id || row.item_id || '').trim();
        return Boolean(ingId) && allowedIngredientIds.has(ingId);
      });
      if (!sqlTenantScoped || checked.length !== itemsResults.length || (offset === 0 && checked.length < limit)) {
        total = checked.length;
        itemsResults = checked.slice(offset, offset + limit);
      } else {
        itemsResults = checked;
      }
    }

    return c.json({
      success: true,
      data: itemsResults,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // POST /api/inventory/movements - Create stock movement (adjustment)
  app.openapi(InventoryRoutes.movements.create as any, async (c: any) => {
    const rawBody = c.req.valid('json') as Record<string, any>;
    const normalizedIngredientId = String(rawBody.ingredientId ?? rawBody.ingredient_id ?? '').trim();
    const body: Record<string, any> = {
      ...rawBody,
      ingredientId: normalizedIngredientId,
      referenceId: rawBody.referenceId ?? rawBody.reference_id,
      referenceType: rawBody.referenceType ?? rawBody.reference_type,
      unitCost: rawBody.unitCost ?? rawBody.unit_cost,
    };
    const rawType = String(body.type || '').toLowerCase();
    const isOutboundType = ['waste', 'usage', 'consumption', 'out'].includes(rawType);
    const allowedRoles = isOutboundType ? INVENTORY_OUTBOUND_ROLES : INVENTORY_MUTATION_ROLES;
    const auth = await verifyMovementAccess(c, allowedRoles);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied', code: 'FORBIDDEN' }, 403);
    }
    const now = new Date().toISOString();

    let ingredient: any = null;
    let usingCanonical = false;
    try {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(body.ingredientId).first();
    } catch {
      usingCanonical = true;
    }
    if (!ingredient) {
      ingredient = await db.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(body.ingredientId).first().catch(() => null);
      if (ingredient) {
        usingCanonical = true;
      }
    }
    const hasIngredientTenantCol = Boolean(ingredient && typeof ingredient === 'object' && 'tenant_id' in ingredient);
    let hasCanonicalTenantRow = false;
    if (ingredient && !usingCanonical && (!hasIngredientTenantCol || !ingredient.tenant_id)) {
      const canonicalRow = (await db
        .prepare('SELECT id, tenant_id FROM inventory_items WHERE id = ?')
        .bind(body.ingredientId)
        .first()
        .catch(() => null)) as Record<string, unknown> | null;
      if (canonicalRow && typeof canonicalRow === 'object' && 'tenant_id' in canonicalRow && canonicalRow.tenant_id !== undefined) {
        hasCanonicalTenantRow = true;
        if (!ingredient.tenant_id && typeof canonicalRow.tenant_id === 'string' && canonicalRow.tenant_id.trim()) {
          ingredient.tenant_id = canonicalRow.tenant_id.trim();
        }
      }
    }
    if (ingredient && !ingredient.tenant_id && tenantId === '*') {
      const auditRow = (await db
        .prepare(
          "SELECT tenant_id FROM audit_logs WHERE (entity_id = ? OR resource_id = ?) AND tenant_id IS NOT NULL AND TRIM(tenant_id) != '' AND TRIM(tenant_id) != '*' ORDER BY created_at DESC LIMIT 1"
        )
        .bind(body.ingredientId, body.ingredientId)
        .first()
        .catch(() => null)) as { tenant_id?: string } | null;
      if (auditRow?.tenant_id && String(auditRow.tenant_id).trim()) {
        ingredient.tenant_id = String(auditRow.tenant_id).trim();
      }
    }
    const hasAnyTenantScope = hasIngredientTenantCol || hasCanonicalTenantRow;
    if (ingredient && !usingCanonical && !hasAnyTenantScope && tenantId !== 'default' && tenantId !== '*') {
      return c.json({ success: false, error: 'Tenant-scoped ingredient schema required' }, 503);
    }
    if (!ingredient || !(await checkIngredientTenant(db, body.ingredientId, ingredient, tenantId))) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    const signedQty = isOutboundType
      ? -Math.abs(body.quantity)
      : (rawType === 'in' || rawType === 'purchase_receipt')
        ? Math.abs(body.quantity)
        : Number(body.quantity);
    const previousStock = Number(ingredient.current_stock || 0);
    const newStock = previousStock + signedQty;
    if (newStock < 0) {
      return c.json({ success: false, error: 'Insufficient stock' }, 400);
    }

    const movRand = new Uint8Array(4);
    crypto.getRandomValues(movRand);
    const id = `mov_${Date.now()}_${Array.from(movRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const canonicalTxType = mapToCanonicalTxType(body.type, signedQty);
    const canonicalRefType = mapToCanonicalRefType(body.referenceType);

    const effectiveTenant = tenantId !== '*'
      ? tenantId
      : ((typeof ingredient?.tenant_id === 'string' && ingredient.tenant_id.trim() && ingredient.tenant_id.trim() !== '*' && ingredient.tenant_id.trim().toLowerCase() !== 'hq' ? ingredient.tenant_id.trim() : '') || 'default');
    const writeTenant = effectiveTenant || 'default';
    if (!hasAnyTenantScope && tenantId !== 'default' && tenantId !== '*') {
      return c.json({ success: false, error: 'Tenant-scoped ingredient schema required' }, 503);
    }
    if (!usingCanonical) {
      if (signedQty < 0) {
        let upd: any;
        if (effectiveTenant && hasIngredientTenantCol) {
          try {
            upd = await db.prepare(
              "UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(signedQty, now, body.ingredientId, signedQty, effectiveTenant).run();
          } catch {
            if (effectiveTenant !== 'default') {
              return c.json({ success: false, error: 'Failed to update stock for tenant' }, 500);
            }
            upd = await db.prepare(
              'UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0'
            ).bind(signedQty, now, body.ingredientId, signedQty).run();
          }
        } else {
          upd = await db.prepare(
            'UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0'
          ).bind(signedQty, now, body.ingredientId, signedQty).run();
        }
        if (upd && upd.meta && typeof upd.meta.changes === 'number' && upd.meta.changes === 0) {
          return c.json({ success: false, error: 'Insufficient stock' }, 400);
        }
        if (effectiveTenant) {
          await db.prepare(
            "UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(signedQty, now, body.ingredientId, signedQty, effectiveTenant).run().catch(() => {
            if (effectiveTenant === 'default') {
              return db.prepare(
                'UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0'
              ).bind(signedQty, now, body.ingredientId, signedQty).run().catch(() => {});
            }
            return null;
          });
        } else {
          await db.prepare(
            'UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0'
          ).bind(signedQty, now, body.ingredientId, signedQty).run().catch(() => {});
        }
      } else {
        if (effectiveTenant && hasIngredientTenantCol) {
          try {
            await db.prepare("UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(signedQty, now, body.ingredientId, effectiveTenant).run();
          } catch {
            if (effectiveTenant !== 'default') {
              return c.json({ success: false, error: 'Failed to update stock for tenant' }, 500);
            }
            await db.prepare('UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
              .bind(signedQty, now, body.ingredientId).run();
          }
        } else {
          await db.prepare('UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
            .bind(signedQty, now, body.ingredientId).run();
        }
        if (effectiveTenant) {
          await db.prepare("UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(signedQty, now, body.ingredientId, effectiveTenant).run().catch(() => {
              if (effectiveTenant === 'default') {
                return db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
                  .bind(signedQty, now, body.ingredientId).run().catch(() => {});
              }
              return null;
            });
        } else {
          await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
            .bind(signedQty, now, body.ingredientId).run().catch(() => {});
        }
      }

      try {
        await db.prepare(
          `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.ingredientId,
          body.type,
          signedQty,
          body.referenceId || null,
          body.referenceType || null,
          body.notes || null,
          user.id,
          writeTenant,
          now
        ).run();
      } catch (err) {
        const msg = String((err as Error)?.message || err || '');
        if ((tenantId !== 'default' || writeTenant !== 'default') && (!hasAnyTenantScope || !msg.includes('tenant_id'))) {
          throw err;
        }
        await db.prepare(
          `INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.ingredientId,
          body.type,
          signedQty,
          body.referenceId || null,
          body.referenceType || null,
          body.notes || null,
          user.id,
          now
        ).run();
      }

      await db.prepare(
        `INSERT OR IGNORE INTO inventory_transactions (
          id, item_id, type, quantity, reference_type, reference_id, notes, tenant_id, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id = ?)`
      ).bind(
        id,
        body.ingredientId,
        canonicalTxType,
        signedQty,
        canonicalRefType,
        body.referenceId || null,
        body.notes || body.type || null,
        writeTenant,
        now,
        body.ingredientId
      ).run().catch(() => {
        if (tenantId !== 'default' || writeTenant !== 'default') return null;
        return db.prepare(
          `INSERT OR IGNORE INTO inventory_transactions (
            id, item_id, type, quantity, reference_type, reference_id, notes, created_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id = ?)`
        ).bind(
          id,
          body.ingredientId,
          canonicalTxType,
          signedQty,
          canonicalRefType,
          body.referenceId || null,
          body.notes || body.type || null,
          now,
          body.ingredientId
        ).run().catch(() => {});
      });
    } else {
      if (signedQty < 0) {
        let upd: any;
        if (effectiveTenant) {
          try {
            upd = await db.prepare(
              "UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(signedQty, now, body.ingredientId, signedQty, effectiveTenant).run();
          } catch {
            if (effectiveTenant !== 'default') {
              return c.json({ success: false, error: 'Failed to update stock for tenant' }, 500);
            }
            upd = await db.prepare(
              'UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0'
            ).bind(signedQty, now, body.ingredientId, signedQty).run();
          }
        } else {
          upd = await db.prepare(
            'UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND (COALESCE(current_stock, 0) + ?) >= 0'
          ).bind(signedQty, now, body.ingredientId, signedQty).run();
        }
        if (upd && upd.meta && typeof upd.meta.changes === 'number' && upd.meta.changes === 0) {
          return c.json({ success: false, error: 'Insufficient stock' }, 400);
        }
      } else {
        if (effectiveTenant) {
          try {
            await db.prepare("UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(signedQty, now, body.ingredientId, effectiveTenant).run();
          } catch {
            if (effectiveTenant !== 'default') {
              return c.json({ success: false, error: 'Failed to update stock for tenant' }, 500);
            }
            await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
              .bind(signedQty, now, body.ingredientId).run();
          }
        } else {
          await db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ? WHERE id = ?')
            .bind(signedQty, now, body.ingredientId).run();
        }
      }

      try {
        await db.prepare(
          `INSERT INTO inventory_transactions (
            id, item_id, type, quantity, reference_type, reference_id, notes, tenant_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.ingredientId,
          canonicalTxType,
          signedQty,
          canonicalRefType,
          body.referenceId || null,
          body.notes || body.type || null,
          writeTenant,
          now
        ).run();
      } catch (err) {
        if (tenantId !== 'default' || writeTenant !== 'default') {
          throw err;
        }
        await db.prepare(
          `INSERT INTO inventory_transactions (
            id, item_id, type, quantity, reference_type, reference_id, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.ingredientId,
          canonicalTxType,
          signedQty,
          canonicalRefType,
          body.referenceId || null,
          body.notes || body.type || null,
          now
        ).run();
      }
    }

    const auditTenant = effectiveTenant || 'default';
    const metaStr = JSON.stringify({ ...body, tenant_id: auditTenant });
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(user.id, user.id, user.id, 'stock_movement_create', 'stock_movement', id, 'stock_movement', id, metaStr, metaStr, auditTenant, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, metadata, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(`audit_${crypto.randomUUID()}`, user.id, 'stock_movement_create', 'stock_movement', id, metaStr, metaStr, auditTenant, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(`audit_${crypto.randomUUID()}`, user.id, 'stock_movement_create', 'stock_movement', id, metaStr, auditTenant, now).run();
        } catch {
          try {
            await db.prepare(
              `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(`audit_${crypto.randomUUID()}`, user.id, 'stock_movement_create', 'stock_movement', id, metaStr, now).run();
          } catch {
            try {
              await db.prepare(
                `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).bind(user.id, user.id, 'stock_movement_create', 'stock_movement', id, metaStr, now).run().catch(() => {});
            } catch {
              // Ignore audit log error
            }
          }
          await db.prepare(
            "UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = 'stock_movement_create' AND created_at = ?"
          ).bind(auditTenant, id, id, now).run().catch(() => {});
        }
      }
    }

    let movement: any = null;
    if (!usingCanonical) {
      movement = await db.prepare('SELECT * FROM stock_movements WHERE id = ?').bind(id).first();
    } else {
      movement = await db.prepare('SELECT *, item_id as ingredient_id FROM inventory_transactions WHERE id = ?').bind(id).first();
    }
    return c.json({ success: true, data: movement }, 201);
  });
}

export const registerMovementRoutes = registerMovementHandlers;

