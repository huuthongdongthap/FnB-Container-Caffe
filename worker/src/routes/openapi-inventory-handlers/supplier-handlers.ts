import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';
import { getTenantId } from '../../middleware/tenant';

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

export async function checkSupplierTenant(
  db: any,
  row: Record<string, unknown>,
  tenantId: string
): Promise<boolean> {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    return matchesTenantRow(row, tenantId);
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
        return String(auditRow.tenant_id) === tenantId;
      }
      const rawMeta = String(auditRow.metadata || auditRow.details || '');
      if (rawMeta) {
        try {
          const parsed = JSON.parse(rawMeta);
          if (parsed && typeof parsed.tenant_id === 'string') {
            return parsed.tenant_id === tenantId;
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
          return matchesTenantRow(userRow, tenantId);
        }
      }
    }
  }
  return tenantId === 'default';
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
  try {
    await db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, tenant_id, details, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, userId, userId, action, 'supplier', entityId, 'supplier', entityId, tenantId, metadata, metadata, now).run();
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
  }
}

export function registerSupplierHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/suppliers - List suppliers
  app.openapi(InventoryRoutes.suppliers.list as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c);
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

    let total = 0;
    let supplierResults: any[] = [];
    try {
      const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM suppliers ${whereClause}`).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const items = (await db.prepare(
        `SELECT * FROM suppliers ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
      ).bind(...params, fetchLimit, fetchOffset).all()) as { results: any[] };
      const rawItems = items.results || [];
      if (tenantId === '*') {
        supplierResults = rawItems;
      } else {
        const checked: any[] = [];
        for (const row of rawItems) {
          if (await checkSupplierTenant(db, row, tenantId)) {
            checked.push(row);
          }
        }
        total = checked.length;
        supplierResults = checked.slice(offset, offset + limit);
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
    const db = getDatabase(c);
    const tenantId = getTenantId(c);
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
    const db = getDatabase(c);
    const rawTenantId = getTenantId(c);
    const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const supRand = new Uint8Array(4);
    crypto.getRandomValues(supRand);
    const id = `sup_${Date.now()}_${Array.from(supRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;

    let usingFallback = false;
    try {
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
    } catch {
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
    const db = getDatabase(c);
    const tenantId = getTenantId(c);
    const writeTenant = tenantId === '*' ? 'default' : tenantId;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingFallback = false;
    try {
      existing = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
      if (existing && !(await checkSupplierTenant(db, existing, tenantId))) {
        existing = null;
      }
    } catch {
      usingFallback = true;
      const rows = (await db.prepare('SELECT supplier, tenant_id FROM inventory_items WHERE supplier = ?').bind(id).all().catch(() => ({ results: [] }))) as { results: Array<Record<string, unknown>> };
      const matched = (rows.results || []).find((r) => matchesTenantRow(r, tenantId));
      if (matched) {
        existing = { id, name: id, is_active: 1 };
      }
    }
    if (!existing) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }

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
      await db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    await writeSupplierAuditLog(db, user.id, 'supplier_update', id, JSON.stringify(body), now, writeTenant);

    let supplier: any = null;
    if (!usingFallback) {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    } else {
      supplier = { ...existing, ...body, updated_at: now };
    }
    return c.json({ success: true, data: supplier });
  });
}
