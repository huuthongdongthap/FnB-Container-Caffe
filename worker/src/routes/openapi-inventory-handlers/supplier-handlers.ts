import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin, matchesTenantRow } from '../../middleware/tenant';

const SUPPLIER_READ_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'staff', 'kitchen', 'barista', 'chef', 'cashier', 'waiter'];
const SUPPLIER_MUTATION_ROLES = ['owner', 'manager', 'admin'];

async function verifySupplierAccess(
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

function resolveOpenApiSupplierTenant(c: any): string {
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

export async function checkSupplierTenant(
  db: any,
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
  const supId = String(row.id || '');
  if (supId) {
    const auditRow = (await db
      .prepare(
        `SELECT user_id, actor_id, tenant_id, metadata, details FROM audit_logs
         WHERE (entity_id = ? OR resource_id = ?) AND action = 'supplier_create'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(supId, supId)
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
      const creatorId = String(auditRow.user_id || auditRow.actor_id || '');
      if (creatorId) {
        const userRow = (await db
          .prepare('SELECT id, tenant_id FROM users WHERE id = ?')
          .bind(creatorId)
          .first()
          .catch(() => null)) as Record<string, unknown> | null;
        if (userRow && 'tenant_id' in userRow && userRow.tenant_id !== undefined) {
          return matchesTenantRow(userRow, normTenant);
        }
      }
    }
  }
  return normTenant === 'default';
}

async function writeSupplierAuditLog(
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
    ).bind(userId, userId, userId, action, 'supplier', entityId, 'supplier', entityId, normTenant, metadata, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, tenant_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'supplier', entityId, normTenant, metadata, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, tenant_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'supplier', entityId, normTenant, metadata, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'supplier', entityId, metadata, now).run();
        } catch {
          try {
            await db.prepare(
              `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(userId, userId, action, 'supplier', entityId, metadata, now).run().catch(() => {});
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
}

export function registerSupplierHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/suppliers - List suppliers
  app.openapi(InventoryRoutes.suppliers.list as any, async (c: any) => {
    const auth = await verifySupplierAccess(c, SUPPLIER_READ_ROLES);
    if (auth.errorResponse) return auth.errorResponse;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiSupplierTenant(c);
    const query = c.req.valid('query');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const fetchLimit = tenantId === '*' ? limit : Math.max(limit * 10, 500);
    const fetchOffset = tenantId === '*' ? offset : 0;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (query.search) {
      whereClause += 'WHERE (name LIKE ? OR contact_person LIKE ? OR email LIKE ?) ';
      params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
    }

    if (query.isActive !== undefined) {
      whereClause += whereClause ? 'AND is_active = ? ' : 'WHERE is_active = ? ';
      params.push(query.isActive ? 1 : 0);
    }

    const scopedWhere = `${whereClause ? whereClause : 'WHERE 1=1 '}AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`;

    let total = 0;
    let supplierResults: any[] = [];
    try {
      let sqlTenantScoped = false;
      let rawItems: any[] = [];
      if (tenantId !== '*') {
        try {
          const scopedCount = (await db.prepare(
            `SELECT COUNT(*) as total FROM suppliers ${scopedWhere}`
          ).bind(...params, tenantId).first()) as { total: number } | null;
          total = scopedCount?.total || 0;

          const scopedItems = (await db.prepare(
            `SELECT * FROM suppliers ${scopedWhere} ORDER BY name ASC LIMIT ? OFFSET ?`
          ).bind(...params, tenantId, limit, offset).all()) as { results: any[] };
          rawItems = scopedItems.results || [];
          sqlTenantScoped = true;
        } catch {
          sqlTenantScoped = false;
        }
      }

      if (!sqlTenantScoped) {
        if (tenantId !== '*' && tenantId !== 'default') {
          rawItems = [];
          total = 0;
        } else {
          const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM suppliers ${whereClause}`).bind(...params).first()) as { total: number } | null;
          total = countResult?.total || 0;

          const items = (await db.prepare(
            `SELECT * FROM suppliers ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
          ).bind(...params, fetchLimit, fetchOffset).all()) as { results: any[] };
          rawItems = items.results || [];
          sqlTenantScoped = false;
        }
      }

      if (tenantId === '*') {
        supplierResults = rawItems;
      } else {
        const checked: any[] = [];
        for (const row of rawItems) {
          if (await checkSupplierTenant(db, row, tenantId)) {
            checked.push(row);
          }
        }
        if (!sqlTenantScoped || checked.length !== rawItems.length || (offset === 0 && checked.length < limit)) {
          total = checked.length;
          supplierResults = checked.slice(offset, offset + limit);
        } else {
          supplierResults = checked;
        }
      }
    } catch {
      try {
        const distinctRows = (await db.prepare(
          'SELECT supplier, tenant_id FROM inventory_items WHERE supplier IS NOT NULL AND supplier != \'\' ORDER BY supplier ASC'
        ).all()) as { results: Array<Record<string, unknown>> };
        const seen = new Set<string>();
        const derived = (distinctRows.results || [])
          .filter((r) => matchesTenantRow(r, tenantId))
          .filter((r) => {
            const sup = String(r.supplier || '');
            if (!sup || seen.has(sup)) return false;
            seen.add(sup);
            return true;
          })
          .map((r) => ({
            id: String(r.supplier),
            name: String(r.supplier),
            contact_person: null,
            phone: null,
            email: null,
            address: null,
            payment_terms: 30,
            is_active: 1,
          }))
          .filter((s) => !query.search || s.name.toLowerCase().includes(String(query.search).toLowerCase()));
        total = derived.length;
        supplierResults = derived.slice(offset, offset + limit);
      } catch {
        total = 0;
        supplierResults = [];
      }
    }

    return c.json({
      success: true,
      data: supplierResults,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/suppliers/{id} - Get supplier by ID
  app.openapi(InventoryRoutes.suppliers.get as any, async (c: any) => {
    const auth = await verifySupplierAccess(c, SUPPLIER_READ_ROLES);
    if (auth.errorResponse) return auth.errorResponse;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiSupplierTenant(c);
    const { id } = c.req.valid('param');

    let supplier: any = null;
    try {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
      if (supplier && !(await checkSupplierTenant(db, supplier, tenantId))) {
        supplier = null;
      }
    } catch {
      const rows = (await db.prepare('SELECT supplier, tenant_id FROM inventory_items WHERE supplier = ?').bind(id).all().catch(() => ({ results: [] }))) as { results: Array<Record<string, unknown>> };
      const matched = (rows.results || []).find((r) => matchesTenantRow(r, tenantId));
      if (matched) {
        supplier = { id, name: id, contact_person: null, phone: null, email: null, address: null, payment_terms: 30, is_active: 1 };
      }
    }

    if (!supplier) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }

    return c.json({ success: true, data: supplier });
  });

  // POST /api/inventory/suppliers - Create supplier
  app.openapi(InventoryRoutes.suppliers.create as any, async (c: any) => {
    const auth = await verifySupplierAccess(c, SUPPLIER_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const rawTenantId = resolveOpenApiSupplierTenant(c);
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

    const supRand = new Uint8Array(4);
    crypto.getRandomValues(supRand);
    const id = `sup_${Date.now()}_${Array.from(supRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;

    let usingFallback = false;
    try {
      try {
        await db.prepare(
          `INSERT INTO suppliers (id, name, contact_person, phone, email, address, payment_terms, is_active, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.contactPerson || null,
          body.phone || null,
          body.email || null,
          body.address || null,
          body.paymentTerms || 30,
          body.isActive !== false ? 1 : 0,
          tenantId,
          now,
          now
        ).run();
      } catch (err) {
        if (tenantId !== 'default') throw err;
        await db.prepare(
          `INSERT INTO suppliers (id, name, contact_person, phone, email, address, payment_terms, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.contactPerson || null,
          body.phone || null,
          body.email || null,
          body.address || null,
          body.paymentTerms || 30,
          body.isActive !== false ? 1 : 0,
          now,
          now
        ).run();
      }
    } catch (err) {
      if (tenantId !== 'default') throw err;
      usingFallback = true;
    }

    await writeSupplierAuditLog(db, user.id, 'supplier_create', id, JSON.stringify({ ...body, tenant_id: tenantId }), now, tenantId);

    let supplier: any = null;
    if (!usingFallback) {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    } else {
      supplier = {
        id,
        name: body.name,
        contact_person: body.contactPerson || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        payment_terms: body.paymentTerms || 30,
        is_active: body.isActive !== false ? 1 : 0,
        created_at: now,
        updated_at: now,
      };
    }
    return c.json({ success: true, data: supplier }, 201);
  });

  // PATCH /api/inventory/suppliers/{id} - Update supplier
  app.openapi(InventoryRoutes.suppliers.update as any, async (c: any) => {
    const auth = await verifySupplierAccess(c, SUPPLIER_MUTATION_ROLES);
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const db = getDatabase(c);
    const tenantId = resolveOpenApiSupplierTenant(c);
    const writeTenant = tenantId === '*' ? 'default' : tenantId;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingFallback = false;
    let hasVerifiedTenantOwnership = false;
    try {
      existing = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
      if (existing) {
        hasVerifiedTenantOwnership = await checkSupplierTenant(db, existing, tenantId);
        if (!hasVerifiedTenantOwnership) {
          existing = null;
        }
      }
    } catch {
      usingFallback = true;
      const rows = (await db.prepare('SELECT supplier, tenant_id FROM inventory_items WHERE supplier = ?').bind(id).all().catch(() => ({ results: [] }))) as { results: Array<Record<string, unknown>> };
      const matched = (rows.results || []).find((r) => matchesTenantRow(r, tenantId));
      if (matched) {
        existing = { id, name: id, is_active: 1 };
        hasVerifiedTenantOwnership = true;
      }
    }
    if (!existing || !hasVerifiedTenantOwnership) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }
    const isLegacyUnscopedRow =
      existing.tenant_id === undefined || existing.tenant_id === null || String(existing.tenant_id).trim() === '';
    let rawExistingTenant = existing?.tenant_id && String(existing.tenant_id).trim() && String(existing.tenant_id).trim() !== '*'
      ? String(existing.tenant_id).trim()
      : undefined;
    if (!rawExistingTenant && tenantId === '*') {
      const auditRow = (await db
        .prepare(
          `SELECT user_id, actor_id, tenant_id, metadata, details FROM audit_logs
           WHERE (entity_id = ? OR resource_id = ?) AND action = 'supplier_create'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(id, id)
        .first()
        .catch(() => null)) as Record<string, unknown> | null;
      if (auditRow) {
        const auditTenant = String(auditRow.tenant_id || '').trim();
        if (auditTenant && auditTenant !== '*' && auditTenant.toLowerCase() !== 'hq') {
          rawExistingTenant = auditTenant;
        } else {
          const rawMeta = String(auditRow.metadata || auditRow.details || '');
          if (rawMeta) {
            try {
              const parsed = JSON.parse(rawMeta);
              const metaTenant = typeof parsed?.tenant_id === 'string' ? parsed.tenant_id.trim() : '';
              if (metaTenant && metaTenant !== '*' && metaTenant.toLowerCase() !== 'hq') {
                rawExistingTenant = metaTenant;
              }
            } catch {
              // Ignore JSON parse error
            }
          }
          if (!rawExistingTenant) {
            const creatorId = String(auditRow.user_id || auditRow.actor_id || '').trim();
            if (creatorId) {
              const userRow = (await db
                .prepare('SELECT tenant_id FROM users WHERE id = ?')
                .bind(creatorId)
                .first()
                .catch(() => null)) as Record<string, unknown> | null;
              const userTenant = String(userRow?.tenant_id || '').trim();
              if (userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq') {
                rawExistingTenant = userTenant;
              }
            }
          }
        }
      }
    }
    const effectiveWriteTenant = tenantId === '*' ? (rawExistingTenant || 'default') : writeTenant;

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.contactPerson !== undefined) { updates.push('contact_person = ?'); params.push(body.contactPerson); }
    if (body.phone !== undefined) { updates.push('phone = ?'); params.push(body.phone); }
    if (body.email !== undefined) { updates.push('email = ?'); params.push(body.email); }
    if (body.address !== undefined) { updates.push('address = ?'); params.push(body.address); }
    if (body.paymentTerms !== undefined) { updates.push('payment_terms = ?'); params.push(body.paymentTerms); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }

    if (updates.length === 0) {
      return c.json({ success: true, data: existing });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (!usingFallback) {
      try {
        const upd = await db.prepare(
          `UPDATE suppliers SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(...params, effectiveWriteTenant).run();
        if (upd?.meta && typeof upd.meta.changes === 'number' && upd.meta.changes === 0) {
          if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
            await db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
            await db.prepare("UPDATE suppliers SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')")
              .bind(effectiveWriteTenant, id).run().catch(() => null);
          } else {
            return c.json({ success: false, error: 'Supplier not found' }, 404);
          }
        }
      } catch {
        if (isLegacyUnscopedRow && hasVerifiedTenantOwnership) {
          await db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        } else {
          return c.json({ success: false, error: 'Supplier not found' }, 404);
        }
      }
    }

    await writeSupplierAuditLog(db, user.id, 'supplier_update', id, JSON.stringify({ ...body, tenant_id: effectiveWriteTenant }), now, effectiveWriteTenant);

    let supplier: any = null;
    if (!usingFallback) {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    } else {
      supplier = { ...existing, ...body, updated_at: now };
    }
    return c.json({ success: true, data: supplier });
  });
}
