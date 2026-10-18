import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';
import { getDatabase } from '../../lib/db';

async function writeSupplierAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, userId, action, 'supplier', entityId, metadata, now).run();
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

export function registerSupplierHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/suppliers - List suppliers
  app.openapi(InventoryRoutes.suppliers.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

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
      ).bind(...params, limit, offset).all()) as { results: any[] };
      supplierResults = items.results || [];
    } catch {
      try {
        const distinctRows = (await db.prepare(
          'SELECT DISTINCT supplier FROM inventory_items WHERE supplier IS NOT NULL AND supplier != \'\' ORDER BY supplier ASC'
        ).all()) as { results: Array<{ supplier: string }> };
        const derived = (distinctRows.results || [])
          .map((r) => ({
            id: r.supplier,
            name: r.supplier,
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
    const { id } = c.req.valid('param');

    let supplier: any = null;
    try {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    } catch {
      const row = await db.prepare('SELECT supplier FROM inventory_items WHERE supplier = ? LIMIT 1').bind(id).first().catch(() => null);
      if (row) {
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
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const id = `sup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    await writeSupplierAuditLog(db, user.id, 'supplier_create', id, JSON.stringify(body), now);

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
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingFallback = false;
    try {
      existing = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    } catch {
      usingFallback = true;
      const row = await db.prepare('SELECT supplier FROM inventory_items WHERE supplier = ? LIMIT 1').bind(id).first().catch(() => null);
      if (row) {
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

    await writeSupplierAuditLog(db, user.id, 'supplier_update', id, JSON.stringify(body), now);

    let supplier: any = null;
    if (!usingFallback) {
      supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    } else {
      supplier = { ...existing, ...body, updated_at: now };
    }
    return c.json({ success: true, data: supplier });
  });
}
