import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { TableRoutes } from '../../schemas/tables';
import { formatTable } from './helpers';

export function registerTableCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/tables - List tables with pagination and filtering
  app.openapi(TableRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'name', order = 'asc', zoneId, status, locationId, search } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (search) {
      whereClause += ' AND (t.name LIKE ? OR t.code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (zoneId) {
      whereClause += ' AND t.zone_id = ?';
      params.push(zoneId);
    }
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }
    if (locationId) {
      whereClause += ' AND t.location_id = ?';
      params.push(locationId);
    }

    // Get total count
    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM tables t ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    // Get tables
    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT t.*, z.name as zone_name
       FROM tables t
       LEFT JOIN table_zones z ON t.zone_id = z.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const tables = rows.results.map(formatTable);

    return c.json({
      success: true,
      data: { tables, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/tables/:id - Get table by ID
  app.openapi(TableRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');

    const row = await db.prepare(
      `SELECT t.*, z.name as zone_name
       FROM tables t
       LEFT JOIN table_zones z ON t.zone_id = z.id
       WHERE t.id = ?`
    ).bind(id).first();

    if (!row) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatTable(row),
    });
  });

  // POST /api/tables - Create table
  app.openapi(TableRoutes.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

    // Check code uniqueness
    const existing = await db.prepare('SELECT id FROM tables WHERE code = ? AND location_id = ?').bind(body.code, body.locationId).first();
    if (existing) {
      return c.json({ success: false, error: 'Table code already exists in this location' }, 409);
    }

    await db.prepare(
      `INSERT INTO tables (id, code, name, zone_id, capacity, status, position_x, position_y, width, height, rotation, is_active, location_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.code,
      body.name,
      body.zoneId || null,
      body.capacity || 4,
      body.status || 'available',
      body.position?.x || 0,
      body.position?.y || 0,
      body.dimensions?.width || 80,
      body.dimensions?.height || 80,
      body.dimensions?.rotation || 0,
      body.isActive !== false ? 1 : 0,
      body.locationId,
      JSON.stringify(body.metadata || {}),
      now,
      now
    ).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'table_create', 'table', id, JSON.stringify(body), now).run();

    const created = await db.prepare(
      `SELECT t.*, z.name as zone_name
       FROM tables t
       LEFT JOIN table_zones z ON t.zone_id = z.id
       WHERE t.id = ?`
    ).bind(id).first();

    return c.json({
      success: true,
      data: formatTable(created!),
    }, 201);
  });

  // PATCH /api/tables/:id - Update table
  app.openapi(TableRoutes.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    // Check code uniqueness if code is being changed
    if (body.code && body.code !== existing.code) {
      const codeExists = await db.prepare('SELECT id FROM tables WHERE code = ? AND location_id = ? AND id != ?').bind(body.code, body.locationId || existing.location_id, id).first();
      if (codeExists) {
        return c.json({ success: false, error: 'Table code already exists in this location' }, 409);
      }
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.code !== undefined) { updates.push('code = ?'); params.push(body.code); }
    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.zoneId !== undefined) { updates.push('zone_id = ?'); params.push(body.zoneId); }
    if (body.capacity !== undefined) { updates.push('capacity = ?'); params.push(body.capacity); }
    if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }
    if (body.position?.x !== undefined) { updates.push('position_x = ?'); params.push(body.position.x); }
    if (body.position?.y !== undefined) { updates.push('position_y = ?'); params.push(body.position.y); }
    if (body.dimensions?.width !== undefined) { updates.push('width = ?'); params.push(body.dimensions.width); }
    if (body.dimensions?.height !== undefined) { updates.push('height = ?'); params.push(body.dimensions.height); }
    if (body.dimensions?.rotation !== undefined) { updates.push('rotation = ?'); params.push(body.dimensions.rotation); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
    if (body.locationId !== undefined) { updates.push('location_id = ?'); params.push(body.locationId); }
    if (body.metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(body.metadata)); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.prepare(`UPDATE tables SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'table_update', 'table', id, JSON.stringify(body), now).run();

    const updated = await db.prepare(
      `SELECT t.*, z.name as zone_name
       FROM tables t
       LEFT JOIN table_zones z ON t.zone_id = z.id
       WHERE t.id = ?`
    ).bind(id).first();

    return c.json({
      success: true,
      data: formatTable(updated!),
    });
  });

  // DELETE /api/tables/:id - Delete table
  app.openapi(TableRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    // Check for active sessions
    const sessions = await db.prepare('SELECT COUNT(*) as count FROM table_sessions WHERE table_id = ? AND status IN (\'active\', \'occupied\')').bind(id).first();
    if (sessions && sessions.count > 0) {
      return c.json({ success: false, error: 'Cannot delete table with active sessions' }, 409);
    }

    // Check for orders
    const orders = await db.prepare('SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN (\'completed\', \'cancelled\')').bind(id).first();
    if (orders && orders.count > 0) {
      return c.json({ success: false, error: 'Cannot delete table with active orders' }, 409);
    }

    await db.prepare('DELETE FROM tables WHERE id = ?').bind(id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'table_delete', 'table', id, JSON.stringify({ name: existing.name, code: existing.code }), now).run();

    return c.json({ success: true, data: { success: true } });
  });

  // POST /api/tables/bulk-status - Bulk update table status
  app.openapi(TableRoutes.bulkStatus, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const { tableIds, status } = body;

    if (!tableIds?.length) {
      return c.json({ success: false, error: 'No table IDs provided' }, 400);
    }

    for (const tableId of tableIds) {
      await db.prepare(
        'UPDATE tables SET status = ?, updated_at = ? WHERE id = ?'
      ).bind(status, now, tableId).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'table_bulk_status', 'table', 'multiple', JSON.stringify({ tableIds, status }), now).run();

    return c.json({ success: true, data: { success: true, updated: tableIds.length } });
  });
}