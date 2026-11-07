import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';

const INGREDIENT_STAFF_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
const INGREDIENT_READ_ROLES = [...INGREDIENT_STAFF_ROLES, 'staff', 'kitchen', 'barista', 'chef', 'cashier', 'waiter'];
const INGREDIENT_MUTATION_ROLES = ['owner', 'manager', 'admin'];

async function verifyIngredientAccess(
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
  const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
  const isWildcardHQ = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
  const hqAdmin = isHQSuperAdmin(c) || isWildcardHQ;
  const boundTenant = userTenant || 'default';
  const reqTenant = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
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

function resolveOpenApiIngredientTenant(c: any): string {
  const reqTenant = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (reqTenant) {
    return reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant;
  }
  const resolved = getTenantId(c).trim() || 'default';
  return resolved.toLowerCase() === 'hq' ? '*' : resolved;
}

export async function checkIngredientTenant(
  db: any,
  id: string,
  row: Record<string, unknown>,
  tenantId: string
): Promise<boolean> {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') return true;
  if (
    'tenant_id' in row &&
    row.tenant_id !== undefined &&
    row.tenant_id !== null &&
    String(row.tenant_id).trim() !== ''
  ) {
    return matchesTenantRow(row, normTenant);
  }
  const invRow = (await db
    .prepare('SELECT id, tenant_id FROM inventory_items WHERE id = ?')
    .bind(id)
    .first()
    .catch(() => null)) as Record<string, unknown> | null;
  if (
    invRow &&
    'tenant_id' in invRow &&
    invRow.tenant_id !== undefined &&
    invRow.tenant_id !== null &&
    String(invRow.tenant_id).trim() !== ''
  ) {
    return matchesTenantRow(invRow, normTenant);
  }
  if (id) {
    const auditRow = (await db
      .prepare(
        `SELECT user_id, actor_id, tenant_id, metadata, details FROM audit_logs
         WHERE (entity_id = ? OR resource_id = ?) AND action = 'ingredient_create'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(id, id)
      .first()
      .catch(() => null)) as Record<string, unknown> | null;
    if (auditRow) {
      if (auditRow.tenant_id) {
        return (String(auditRow.tenant_id).trim() || 'default') === normTenant;
      }
      const rawMeta = String(auditRow.metadata || auditRow.details || '');
      if (rawMeta) {
        try {
          const parsed = JSON.parse(rawMeta);
          if (parsed && typeof parsed.tenant_id === 'string') {
            return (parsed.tenant_id.trim() || 'default') === normTenant;
          }
        } catch {
          // Ignore JSON parse error
        }
      }
    }
  }
  return normTenant === 'default';
}

async function writeIngredientAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId = 'default'
): Promise<void> {
  const normTenant = !tenantId || !tenantId.trim() || tenantId.trim() === '*' ? 'default' : tenantId.trim();
  try {
    await db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, tenant_id, details, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, userId, userId, action, 'ingredient', entityId, 'ingredient', entityId, normTenant, metadata, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, tenant_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'ingredient', entityId, normTenant, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'ingredient', entityId, metadata, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, userId, action, 'ingredient', entityId, metadata, now).run().catch(() => {});
        } catch {
          // Ignore audit log error
        }
      }
      await db.prepare(
        'UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?'
      ).bind(normTenant, entityId, entityId, action, now).run().catch(() => {});
    }
  }
}

export function registerIngredientHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/ingredients - List ingredients
  app.openapi(InventoryRoutes.ingredients.list as any, async (c: any) => {
    const auth = await verifyIngredientAccess(c, INGREDIENT_READ_ROLES);
    if (auth.errorResponse) return auth.errorResponse;

    const db = getDatabase(c);
    const query = c.req.valid('query');

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (query.search) {
      whereClause += 'WHERE (name LIKE ? OR sku LIKE ?) ';
      params.push(`%${query.search}%`, `%${query.search}%`);
    }

    if (query.category) {
      whereClause += whereClause ? 'AND category = ? ' : 'WHERE category = ? ';
      params.push(query.category);
    }

    if (query.isActive !== undefined) {
      whereClause += whereClause ? 'AND is_active = ? ' : 'WHERE is_active = ? ';
      params.push(query.isActive ? 1 : 0);
    }

    const tenantId = resolveOpenApiIngredientTenant(c);
    const fetchLimit = tenantId === '*' ? limit : Math.max(limit * 10, 500);
    const fetchOffset = tenantId === '*' ? offset : 0;
    const scopedWhere = `${whereClause ? whereClause : 'WHERE 1=1 '}AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`;

    let total = 0;
    let itemResults: any[] = [];
    let sqlTenantScoped = false;
    try {
      if (tenantId !== '*') {
        try {
          const scopedCount = (await db.prepare(
            `SELECT COUNT(*) as total FROM ingredients ${scopedWhere}`
          ).bind(...params, tenantId).first()) as { total?: number } | null;
          total = Number(scopedCount?.total || 0);

          const scopedItems = await db.prepare(
            `SELECT * FROM ingredients ${scopedWhere} ORDER BY name ASC LIMIT ? OFFSET ?`
          ).bind(...params, tenantId, limit, offset).all();
          itemResults = scopedItems.results || [];
          sqlTenantScoped = true;
        } catch {
          sqlTenantScoped = false;
        }
      }

      if (!sqlTenantScoped) {
        if (tenantId !== '*' && tenantId !== 'default') {
          itemResults = [];
          total = 0;
        } else {
          const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM ingredients ${whereClause}`).bind(...params).first()) as { total?: number } | null;
          total = Number(countResult?.total || 0);

          const items = await db.prepare(
            `SELECT * FROM ingredients ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
          ).bind(...params, fetchLimit, fetchOffset).all();
          itemResults = items.results || [];
        }
      }
    } catch {
      let invWhere = '';
      const invParams: (string | number)[] = [];
      if (query.search) {
        invWhere += 'WHERE (name LIKE ? OR id LIKE ?) ';
        invParams.push(`%${query.search}%`, `%${query.search}%`);
      }
      if (query.category) {
        invWhere += invWhere ? 'AND category = ? ' : 'WHERE category = ? ';
        invParams.push(query.category);
      }
      if (query.isActive !== undefined) {
        invWhere += invWhere ? 'AND is_active = ? ' : 'WHERE is_active = ? ';
        invParams.push(query.isActive ? 1 : 0);
      }
      if (tenantId !== '*') {
        try {
          const scopedInvWhere = `${invWhere ? invWhere : 'WHERE 1=1 '}AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`;
          const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM inventory_items ${scopedInvWhere}`).bind(...invParams, tenantId).first()) as { total?: number } | null;
          total = Number(countResult?.total || 0);

          const items = await db.prepare(
            `SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items ${scopedInvWhere} ORDER BY name ASC LIMIT ? OFFSET ?`
          ).bind(...invParams, tenantId, limit, offset).all();
          itemResults = items.results || [];
          sqlTenantScoped = true;
        } catch {
          sqlTenantScoped = false;
        }
      }
      if (!sqlTenantScoped) {
        if (tenantId !== '*' && tenantId !== 'default') {
          itemResults = [];
          total = 0;
        } else {
          const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM inventory_items ${invWhere}`).bind(...invParams).first()) as { total?: number } | null;
          total = Number(countResult?.total || 0);

          const items = await db.prepare(
            `SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items ${invWhere} ORDER BY name ASC LIMIT ? OFFSET ?`
          ).bind(...invParams, fetchLimit, fetchOffset).all();
          itemResults = items.results || [];
        }
      }
    }

    if (tenantId !== '*' && itemResults.length > 0) {
      const filtered: any[] = [];
      for (const item of itemResults) {
        if (await checkIngredientTenant(db, String(item.id), item, tenantId)) {
          filtered.push(item);
        }
      }
      if (!sqlTenantScoped || filtered.length !== itemResults.length || (offset === 0 && filtered.length < limit)) {
        total = filtered.length;
        itemResults = filtered.slice(offset, offset + limit);
      } else {
        itemResults = filtered;
      }
    }

    return c.json({
      success: true,
      data: itemResults,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/ingredients/{id} - Get ingredient by ID
  app.openapi(InventoryRoutes.ingredients.get as any, async (c: any) => {
    const auth = await verifyIngredientAccess(c, INGREDIENT_READ_ROLES);
    if (auth.errorResponse) return auth.errorResponse;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    const { id } = c.req.valid('param');

    let ingredient: any = null;
    try {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } catch {
      ingredient = null;
    }
    if (!ingredient) {
      ingredient = await db.prepare('SELECT *, COALESCE(sku, id) as sku, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first().catch(() => null);
    }

    if (!ingredient || !(await checkIngredientTenant(db, id, ingredient, tenantId))) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }

    return c.json({ success: true, data: ingredient });
  });

  // POST /api/inventory/ingredients - Create ingredient
  app.openapi(InventoryRoutes.ingredients.create as any, async (c: any) => {
    const auth = await verifyIngredientAccess(c, INGREDIENT_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const rawTenantId = resolveOpenApiIngredientTenant(c);
    const body = c.req.valid('json');
    const rawBody = (await c.req?.json?.().catch(() => null)) as Record<string, unknown> | null;
    const bodyTenant =
      typeof (body?.tenant_id ?? body?.tenantId ?? body?.store_id ?? body?.storeId ?? rawBody?.tenant_id ?? rawBody?.tenantId ?? rawBody?.store_id ?? rawBody?.storeId) === 'string'
        ? String(body?.tenant_id ?? body?.tenantId ?? body?.store_id ?? body?.storeId ?? rawBody?.tenant_id ?? rawBody?.tenantId ?? rawBody?.store_id ?? rawBody?.storeId).trim()
        : '';
    const resolvedBodyTenant = bodyTenant && bodyTenant !== '*' && bodyTenant.toLowerCase() !== 'hq' ? bodyTenant : '';
    const tenantId =
      rawTenantId === '*' || rawTenantId.toLowerCase() === 'hq'
        ? resolvedBodyTenant || 'default'
        : rawTenantId;
    const now = new Date().toISOString();

    // Check SKU uniqueness within tenant scope
    let existing: unknown = null;
    let usingCanonical = false;
    try {
      const skuRes = await db.prepare('SELECT * FROM ingredients WHERE sku = ?').bind(body.sku).all();
      const candidates = (skuRes?.results as Array<Record<string, unknown>> | undefined) || [];
      if (candidates.length > 0) {
        for (const cand of candidates) {
          if (await checkIngredientTenant(db, String(cand.id), cand, tenantId)) {
            existing = cand;
            break;
          }
        }
      } else {
        const firstCand = (await db.prepare('SELECT * FROM ingredients WHERE sku = ?').bind(body.sku).first()) as Record<string, unknown> | null;
        if (firstCand && (await checkIngredientTenant(db, String(firstCand.id), firstCand, tenantId))) {
          existing = firstCand;
        }
      }
    } catch {
      usingCanonical = true;
      const firstCand = (await db.prepare('SELECT * FROM inventory_items WHERE id = ? OR name = ?').bind(body.sku, body.name).first().catch(() => null)) as Record<string, unknown> | null;
      if (firstCand && (await checkIngredientTenant(db, String(firstCand.id), firstCand, tenantId))) {
        existing = firstCand;
      }
    }
    if (existing) {
      return c.json({ success: false, error: 'SKU already exists' }, 409);
    }

    const id = `ing_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const isActiveInt = body.isActive !== false ? 1 : 0;
    const writeTenant = tenantId;

    if (!usingCanonical) {
      try {
        await db.prepare(
          `INSERT INTO ingredients (id, name, sku, category, unit, cost_per_unit, current_stock, min_stock, max_stock, is_active, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.sku,
          body.category || 'raw',
          body.unit,
          body.costPerUnit ?? 0,
          body.currentStock || 0,
          body.minStock || 0,
          body.maxStock || 0,
          isActiveInt,
          writeTenant,
          now,
          now
        ).run();
      } catch (err) {
        if (tenantId !== 'default') {
          try {
            await db.prepare(
              `INSERT INTO inventory_items (
                id, sku, tenant_id, name, category, unit, current_stock, min_stock, max_stock,
                cost_per_unit, unit_cost, active, is_active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              id,
              body.sku,
              tenantId,
              body.name,
              body.category || 'raw_materials',
              body.unit,
              body.currentStock || 0,
              body.minStock || 0,
              body.maxStock || 0,
              body.costPerUnit || 0,
              body.costPerUnit || 0,
              isActiveInt,
              isActiveInt,
              now,
              now
            ).run();
          } catch {
            throw err;
          }
        }
        await db.prepare(
          `INSERT INTO ingredients (id, name, sku, category, unit, cost_per_unit, current_stock, min_stock, max_stock, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.sku,
          body.category || 'raw',
          body.unit,
          body.costPerUnit ?? 0,
          body.currentStock || 0,
          body.minStock || 0,
          body.maxStock || 0,
          isActiveInt,
          now,
          now
        ).run();
      }

      await db.prepare(
        `INSERT OR IGNORE INTO inventory_items (
          id, sku, tenant_id, name, category, unit, current_stock, min_stock, max_stock,
          cost_per_unit, unit_cost, active, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.sku,
        tenantId,
        body.name,
        body.category || 'raw_materials',
        body.unit,
        body.currentStock || 0,
        body.minStock || 0,
        body.maxStock || 0,
        body.costPerUnit || 0,
        body.costPerUnit || 0,
        isActiveInt,
        isActiveInt,
        now,
        now
      ).run().catch(() => {});
    } else {
      try {
        await db.prepare(
          `INSERT INTO inventory_items (id, tenant_id, name, unit, category, current_stock, min_stock, max_stock, unit_cost, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          tenantId,
          body.name,
          body.unit,
          body.category || 'general',
          body.currentStock || 0,
          body.minStock || 0,
          body.maxStock || 0,
          body.costPerUnit || 0,
          isActiveInt,
          now,
          now
        ).run();
      } catch (err) {
        if (tenantId !== 'default') throw err;
        await db.prepare(
          `INSERT INTO inventory_items (id, name, unit, category, current_stock, min_stock, max_stock, unit_cost, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.unit,
          body.category || 'general',
          body.currentStock || 0,
          body.minStock || 0,
          body.maxStock || 0,
          body.costPerUnit || 0,
          isActiveInt,
          now,
          now
        ).run();
      }
    }

    await writeIngredientAuditLog(
      db,
      user.id,
      'ingredient_create',
      id,
      JSON.stringify({ ...body, tenant_id: tenantId }),
      now,
      tenantId
    );

    let ingredient: any = null;
    if (!usingCanonical) {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } else {
      ingredient = await db.prepare('SELECT *, id as sku, unit_cost as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first();
      if (ingredient) {
        ingredient = { ...ingredient, sku: body.sku };
      }
    }
    return c.json({ success: true, data: ingredient }, 201);
  });

  // PATCH /api/inventory/ingredients/{id} - Update ingredient
  app.openapi(InventoryRoutes.ingredients.update as any, async (c: any) => {
    const auth = await verifyIngredientAccess(c, INGREDIENT_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } catch {
      usingCanonical = true;
    }
    if (!existing) {
      existing = await db.prepare('SELECT *, COALESCE(sku, id) as sku, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first().catch(() => null);
      if (existing) {
        usingCanonical = true;
      }
    }
    const hasIngredientTenant = Boolean(existing && typeof existing === 'object' && 'tenant_id' in existing);
    if (!hasIngredientTenant && tenantId !== 'default') {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }
    const hasVerifiedTenantOwnership = existing
      ? await checkIngredientTenant(db, id, existing, tenantId)
      : false;
    if (!existing || !hasVerifiedTenantOwnership) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }
    const isLegacyUnscopedRow =
      existing.tenant_id === undefined || existing.tenant_id === null;
    const rawExistingTenant = existing?.tenant_id && String(existing.tenant_id).trim() && String(existing.tenant_id).trim() !== '*'
      ? String(existing.tenant_id).trim()
      : undefined;
    const effectiveRowTenant = rawExistingTenant || (tenantId === '*' ? 'default' : tenantId);

    // Check SKU uniqueness within tenant scope if changing
    if (body.sku && body.sku !== existing.sku && !usingCanonical) {
      let skuExists: Record<string, unknown> | null = null;
      const skuRes = await db.prepare('SELECT * FROM ingredients WHERE sku = ? AND id != ?').bind(body.sku, id).all().catch(() => ({ results: [] }));
      const candidates = (skuRes?.results as Array<Record<string, unknown>> | undefined) || [];
      if (candidates.length > 0) {
        for (const cand of candidates) {
          if (await checkIngredientTenant(db, String(cand.id), cand, effectiveRowTenant)) {
            skuExists = cand;
            break;
          }
        }
      } else {
        const firstCand = (await db.prepare('SELECT * FROM ingredients WHERE sku = ? AND id != ?').bind(body.sku, id).first().catch(() => null)) as Record<string, unknown> | null;
        if (firstCand && (await checkIngredientTenant(db, String(firstCand.id), firstCand, effectiveRowTenant))) {
          skuExists = firstCand;
        }
      }
      if (skuExists) {
        return c.json({ success: false, error: 'SKU already exists' }, 409);
      }
    }

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    const canonicalUpdates: string[] = [];
    const canonicalParams: (string | number | boolean)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?'); params.push(body.name);
      canonicalUpdates.push('name = ?'); canonicalParams.push(body.name);
    }
    if (body.sku !== undefined) {
      updates.push('sku = ?'); params.push(body.sku);
      canonicalUpdates.push('sku = ?'); canonicalParams.push(body.sku);
    }
    if (body.category !== undefined) {
      updates.push('category = ?'); params.push(body.category);
      canonicalUpdates.push('category = ?'); canonicalParams.push(body.category);
    }
    if (body.unit !== undefined) {
      updates.push('unit = ?'); params.push(body.unit);
      canonicalUpdates.push('unit = ?'); canonicalParams.push(body.unit);
    }
    if (body.costPerUnit !== undefined) {
      updates.push('cost_per_unit = ?'); params.push(body.costPerUnit);
      canonicalUpdates.push('cost_per_unit = ?', 'unit_cost = ?'); canonicalParams.push(body.costPerUnit, body.costPerUnit);
    }
    if (body.currentStock !== undefined) {
      updates.push('current_stock = ?'); params.push(body.currentStock);
      canonicalUpdates.push('current_stock = ?'); canonicalParams.push(body.currentStock);
    }
    if (body.minStock !== undefined) {
      updates.push('min_stock = ?'); params.push(body.minStock);
      canonicalUpdates.push('min_stock = ?'); canonicalParams.push(body.minStock);
    }
    if (body.maxStock !== undefined) {
      updates.push('max_stock = ?'); params.push(body.maxStock);
      canonicalUpdates.push('max_stock = ?'); canonicalParams.push(body.maxStock);
    }
    if (body.isActive !== undefined) {
      const isActiveInt = body.isActive ? 1 : 0;
      updates.push('is_active = ?'); params.push(isActiveInt);
      canonicalUpdates.push('active = ?', 'is_active = ?'); canonicalParams.push(isActiveInt, isActiveInt);
    }

    if (updates.length === 0) {
      return c.json({ success: true, data: existing });
    }

    updates.push('updated_at = ?');
    params.push(now, id);

    if (!usingCanonical) {
      try {
        const upd = await db.prepare(
          `UPDATE ingredients SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(...params, effectiveRowTenant).run();
        if (upd?.meta && typeof upd.meta.changes === 'number' && upd.meta.changes === 0) {
          if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
            await db.prepare(`UPDATE ingredients SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
          } else {
            return c.json({ success: false, error: 'Ingredient not found' }, 404);
          }
        }
      } catch {
        if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
          await db.prepare(`UPDATE ingredients SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        } else {
          return c.json({ success: false, error: 'Ingredient not found' }, 404);
        }
      }
    }

    if (canonicalUpdates.length > 0) {
      canonicalUpdates.push('updated_at = ?');
      canonicalParams.push(now, id);
      try {
        await db.prepare(
          `UPDATE inventory_items SET ${canonicalUpdates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(...canonicalParams, effectiveRowTenant).run();
      } catch {
        if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
          await db.prepare(`UPDATE inventory_items SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run().catch(() => {});
        }
      }
    }

    const writeTenant = effectiveRowTenant;
    await writeIngredientAuditLog(db, user.id, 'ingredient_update', id, JSON.stringify({ ...body, tenant_id: writeTenant }), now, writeTenant);

    let ingredient: any = null;
    if (!usingCanonical) {
      ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    }
    if (!ingredient) {
      ingredient = await db.prepare('SELECT *, COALESCE(sku, id) as sku, COALESCE(cost_per_unit, unit_cost, 0) as cost_per_unit FROM inventory_items WHERE id = ?').bind(id).first();
    }
    return c.json({ success: true, data: ingredient });
  });

  // DELETE /api/inventory/ingredients/{id} - Delete ingredient
  app.openapi(InventoryRoutes.ingredients.delete as any, async (c: any) => {
    const auth = await verifyIngredientAccess(c, INGREDIENT_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiIngredientTenant(c);
    const { id } = c.req.valid('param');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingCanonical = false;
    try {
      existing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
    } catch {
      usingCanonical = true;
    }
    if (!existing) {
      existing = await db.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(id).first().catch(() => null);
      if (existing) {
        usingCanonical = true;
      }
    }
    const hasIngredientTenant = Boolean(existing && typeof existing === 'object' && 'tenant_id' in existing);
    if (!hasIngredientTenant && tenantId !== 'default') {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }
    const hasVerifiedTenantOwnership = existing
      ? await checkIngredientTenant(db, id, existing, tenantId)
      : false;
    if (!existing || !hasVerifiedTenantOwnership) {
      return c.json({ success: false, error: 'Ingredient not found' }, 404);
    }
    const isLegacyUnscopedRow =
      existing.tenant_id === undefined || existing.tenant_id === null;
    const rawExistingTenant = existing?.tenant_id && String(existing.tenant_id).trim() && String(existing.tenant_id).trim() !== '*'
      ? String(existing.tenant_id).trim()
      : undefined;
    const effectiveRowTenant = rawExistingTenant || (tenantId === '*' ? 'default' : tenantId);

    // Check if ingredient is used in recipes or purchase orders within the target ingredient's tenant
    let usedInRecipe = null;
    try {
      usedInRecipe = await db.prepare(
        `SELECT 1 FROM recipe_items ri
         INNER JOIN recipes r ON r.id = ri.recipe_id
         WHERE ri.ingredient_id = ? AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?
         LIMIT 1`
      ).bind(id, effectiveRowTenant).first();
    } catch {
      usedInRecipe = null;
    }
    if (!usedInRecipe) {
      try {
        usedInRecipe = await db.prepare(
          "SELECT 1 FROM recipe_items WHERE ingredient_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, effectiveRowTenant).first();
      } catch {
        if (effectiveRowTenant === 'default') {
          usedInRecipe = await db.prepare('SELECT 1 FROM recipe_items WHERE ingredient_id = ? LIMIT 1').bind(id).first().catch(() => null);
        }
      }
    }
    if (!usedInRecipe) {
      try {
        usedInRecipe = await db.prepare(
          `SELECT 1 FROM recipe_ingredients ri
           INNER JOIN products p ON p.id = ri.product_id
           WHERE ri.ingredient_id = ? AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?
           LIMIT 1`
        ).bind(id, effectiveRowTenant).first();
      } catch {
        try {
          usedInRecipe = await db.prepare(
            "SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
          ).bind(id, effectiveRowTenant).first();
        } catch {
          if (effectiveRowTenant === 'default') {
            usedInRecipe = await db.prepare('SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ? LIMIT 1').bind(id).first().catch(() => null);
          }
        }
      }
    }
    if (!usedInRecipe) {
      try {
        usedInRecipe = await db.prepare(
          "SELECT 1 FROM recipes WHERE (item_id = ? OR ingredient_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, id, effectiveRowTenant).first();
      } catch {
        if (effectiveRowTenant === 'default') {
          usedInRecipe = await db.prepare('SELECT 1 FROM recipes WHERE item_id = ? LIMIT 1').bind(id).first().catch(() => null);
        }
      }
    }
    if (usedInRecipe) {
      return c.json({ success: false, error: 'Cannot delete ingredient used in recipes' }, 409);
    }

    let usedInPO = null;
    try {
      usedInPO = await db.prepare(
        `SELECT 1 FROM purchase_order_items poi
         INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
         WHERE poi.ingredient_id = ? AND COALESCE(NULLIF(TRIM(po.tenant_id), ''), 'default') = ?
         LIMIT 1`
      ).bind(id, effectiveRowTenant).first();
    } catch {
      usedInPO = null;
    }
    if (!usedInPO) {
      try {
        usedInPO = await db.prepare(
          "SELECT 1 FROM purchase_order_items WHERE ingredient_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, effectiveRowTenant).first();
      } catch {
        if (effectiveRowTenant === 'default') {
          usedInPO = await db.prepare('SELECT 1 FROM purchase_order_items WHERE ingredient_id = ? LIMIT 1').bind(id).first().catch(() => null);
        }
      }
    }
    if (usedInPO) {
      return c.json({ success: false, error: 'Cannot delete ingredient used in purchase orders' }, 409);
    }

    if (!usingCanonical) {
      try {
        const del = await db.prepare(
          "DELETE FROM ingredients WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, effectiveRowTenant).run();
        if (del?.meta && typeof del.meta.changes === 'number' && del.meta.changes === 0) {
          if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
            await db.prepare('DELETE FROM ingredients WHERE id = ?').bind(id).run();
          } else {
            return c.json({ success: false, error: 'Ingredient not found' }, 404);
          }
        }
      } catch {
        if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
          await db.prepare('DELETE FROM ingredients WHERE id = ?').bind(id).run();
        } else {
          return c.json({ success: false, error: 'Ingredient not found' }, 404);
        }
      }
    }
    try {
      await db.prepare(
        "DELETE FROM inventory_items WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, effectiveRowTenant).run();
    } catch {
      if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
        await db.prepare('DELETE FROM inventory_items WHERE id = ?').bind(id).run().catch(() => {});
      }
    }

    const writeTenant = effectiveRowTenant;
    await writeIngredientAuditLog(db, user.id, 'ingredient_delete', id, JSON.stringify({ tenant_id: writeTenant }), now, writeTenant);

    return c.json({ success: true, data: { id, deleted: true } });
  });
}
