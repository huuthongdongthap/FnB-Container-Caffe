import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { InventoryRoutes } from '../../schemas/inventory';

export function registerSupplierHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/inventory/suppliers - List suppliers
  app.openapi(InventoryRoutes.suppliers.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
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

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM suppliers ${whereClause}`).bind(...params).first();
    const total = countResult?.total || 0;

    const items = await db.prepare(
      `SELECT * FROM suppliers ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: items.results,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/inventory/suppliers/{id} - Get supplier by ID
  app.openapi(InventoryRoutes.suppliers.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const { id } = c.req.valid('param');

    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();

    if (!supplier) {
      return c.json({ success: false, error: 'Supplier not found' }, 404);
    }

    return c.json({ success: true, data: supplier });
  });

  // POST /api/inventory/suppliers - Create supplier
  app.openapi(InventoryRoutes.suppliers.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const id = `sup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'supplier_create', 'supplier', id, JSON.stringify(body), now).run();

    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: supplier }, 201);
  });

  // PATCH /api/inventory/suppliers/{id} - Update supplier
  app.openapi(InventoryRoutes.suppliers.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
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

    await db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'supplier_update', 'supplier', id, JSON.stringify(body), now).run();

    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: supplier });
  });
}
