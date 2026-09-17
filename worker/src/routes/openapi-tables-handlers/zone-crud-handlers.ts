import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { TableZoneRoutes } from '../../schemas/tables';
import { formatZone } from './helpers';

export function registerZoneCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/table-zones - List table zones
  app.openapi(TableZoneRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'sort_order', order = 'asc', locationId, isActive, search } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (search) {
      whereClause += ' AND (name LIKE ? OR slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (locationId) {
      whereClause += ' AND location_id = ?';
      params.push(locationId);
    }
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    // Get total count
    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM table_zones ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    // Get zones
    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT * FROM table_zones ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const zones = rows.results.map(formatZone);

    return c.json({
      success: true,
      data: { zones, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/table-zones/:id - Get table zone by ID
  app.openapi(TableZoneRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');

    const row = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();

    if (!row) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    // Get tables in this zone
    const tables = await db.prepare(
      `SELECT id, code, name, capacity, status, position_x, position_y, width, height, rotation
       FROM tables WHERE zone_id = ? ORDER BY name`
    ).bind(id).all();

    return c.json({
      success: true,
      data: {
        ...row,
        location: row.location_id ? { id: row.location_id } : null,
        isActive: Boolean(row.is_active),
        tables: tables.results.map(t => ({
          ...t,
          position: { x: t.position_x, y: t.position_y },
          dimensions: { width: t.width, height: t.height, rotation: t.rotation },
          isActive: true,
        })),
      },
    });
  });

  // POST /api/table-zones - Create table zone
  app.openapi(TableZoneRoutes.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

    // Check slug uniqueness
    const existing = await db.prepare('SELECT id FROM table_zones WHERE slug = ? AND location_id = ?').bind(body.slug, body.locationId).first();
    if (existing) {
      return c.json({ success: false, error: 'Zone slug already exists in this location' }, 409);
    }

    await db.prepare(
      `INSERT INTO table_zones (id, slug, name, description, sort_order, is_active, location_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.slug,
      body.name,
      body.description || null,
      body.sortOrder || 0,
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
    ).bind(`audit_${Date.now()}`, user.id, 'table_zone_create', 'table_zone', id, JSON.stringify(body), now).run();

    const created = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: {
        ...created,
        location: created?.location_id ? { id: created.location_id } : null,
        isActive: Boolean(created?.is_active),
      },
    }, 201);
  });

  // PATCH /api/table-zones/:id - Update table zone
  app.openapi(TableZoneRoutes.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.slug !== undefined) {
      const slugExists = await db.prepare('SELECT id FROM table_zones WHERE slug = ? AND location_id = ? AND id != ?').bind(body.slug, body.locationId || existing.location_id, id).first();
      if (slugExists) {
        return c.json({ success: false, error: 'Zone slug already exists in this location' }, 409);
      }
      updates.push('slug = ?');
      params.push(body.slug);
    }
    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
    if (body.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(body.sortOrder); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
    if (body.locationId !== undefined) { updates.push('location_id = ?'); params.push(body.locationId); }
    if (body.metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(body.metadata)); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.prepare(`UPDATE table_zones SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'table_zone_update', 'table_zone', id, JSON.stringify(body), now).run();

    const updated = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: {
        ...updated,
        location: updated?.location_id ? { id: updated.location_id } : null,
        isActive: Boolean(updated?.is_active),
      },
    });
  });

  // DELETE /api/table-zones/:id - Delete table zone
  app.openapi(TableZoneRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    // Check for tables in zone
    const tables = await db.prepare('SELECT COUNT(*) as count FROM tables WHERE zone_id = ?').bind(id).first();
    if (tables && tables.count > 0) {
      return c.json({ success: false, error: 'Cannot delete zone with tables' }, 409);
    }

    await db.prepare('DELETE FROM table_zones WHERE id = ?').bind(id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'table_zone_delete', 'table_zone', id, JSON.stringify({ name: existing.name }), now).run();

    return c.json({ success: true, data: { success: true } });
  });
}