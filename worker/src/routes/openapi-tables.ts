import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import { audit } from '../middleware/audit-log';
import type { Env } from '../types/env';
import {
  TableRoutes,
  TableZoneRoutes,
  TableCreateSchema,
  TableUpdateSchema,
  TableListResponseSchema,
  TableResponseSchema,
  TableZoneCreateSchema,
  TableZoneUpdateSchema,
  TableZoneListResponseSchema,
  TableZoneResponseSchema,
  IdParamsSchema,
  TableIdParamsSchema,
} from '../schemas/tables';
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '../schemas/common';

export const openApiTablesRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiTablesRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

// ============================================
// TABLES CRUD
// ============================================

// GET /api/tables - List tables with pagination and filtering
openApiTablesRouter.openapi(TableRoutes.list, async (c: Context<{ Bindings: Env }>) => {
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

  const tables = rows.results.map((row) => ({
    ...row,
    zone: row.zone_id ? { id: row.zone_id, name: row.zone_name } : null,
    position: { x: row.position_x, y: row.position_y },
    dimensions: { width: row.width, height: row.height, rotation: row.rotation },
    capacity: row.capacity,
    isActive: Boolean(row.is_active),
    location: row.location_id ? { id: row.location_id } : null,
    currentSession: row.current_session_id ? { id: row.current_session_id } : null,
  }));

  return c.json({
    success: true,
    data: { tables, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/tables/:id - Get table by ID
openApiTablesRouter.openapi(TableRoutes.get, async (c: Context<{ Bindings: Env }>) => {
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
    data: {
      ...row,
      zone: row.zone_id ? { id: row.zone_id, name: row.zone_name } : null,
      position: { x: row.position_x, y: row.position_y },
      dimensions: { width: row.width, height: row.height, rotation: row.rotation },
      capacity: row.capacity,
      isActive: Boolean(row.is_active),
      location: row.location_id ? { id: row.location_id } : null,
      currentSession: row.current_session_id ? { id: row.current_session_id } : null,
    },
  });
});

// POST /api/tables - Create table
openApiTablesRouter.openapi(TableRoutes.create, async (c: Context<{ Bindings: Env }>) => {
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
    data: {
      ...created,
      zone: created?.zone_id ? { id: created.zone_id, name: created.zone_name } : null,
      position: { x: created?.position_x, y: created?.position_y },
      dimensions: { width: created?.width, height: created?.height, rotation: created?.rotation },
      capacity: created?.capacity,
      isActive: Boolean(created?.is_active),
      location: created?.location_id ? { id: created.location_id } : null,
    },
  }, 201);
});

// PATCH /api/tables/:id - Update table
openApiTablesRouter.openapi(TableRoutes.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const user = c.get('user');
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.code !== undefined) {
    const codeExists = await db.prepare('SELECT id FROM tables WHERE code = ? AND location_id = ? AND id != ?').bind(body.code, body.locationId || existing.location_id, id).first();
    if (codeExists) {
      return c.json({ success: false, error: 'Table code already exists in this location' }, 409);
    }
    updates.push('code = ?');
    params.push(body.code);
  }
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
    data: {
      ...updated,
      zone: updated?.zone_id ? { id: updated.zone_id, name: updated.zone_name } : null,
      position: { x: updated?.position_x, y: updated?.position_y },
      dimensions: { width: updated?.width, height: updated?.height, rotation: updated?.rotation },
      capacity: updated?.capacity,
      isActive: Boolean(updated?.is_active),
      location: updated?.location_id ? { id: updated.location_id } : null,
    },
  });
});

// DELETE /api/tables/:id - Delete table
openApiTablesRouter.openapi(TableRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
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
openApiTablesRouter.openapi(TableRoutes.bulkStatus, async (c: Context<{ Bindings: Env }>) => {
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

// ============================================
// TABLE ZONES CRUD
// ============================================

// GET /api/table-zones - List table zones
openApiTablesRouter.openapi(TableZoneRoutes.list, async (c: Context<{ Bindings: Env }>) => {
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

  const zones = rows.results.map((row) => ({
    ...row,
    location: row.location_id ? { id: row.location_id } : null,
    isActive: Boolean(row.is_active),
    tables: [], // Would be populated separately if needed
  }));

  return c.json({
    success: true,
    data: { zones, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/table-zones/:id - Get table zone by ID
openApiTablesRouter.openapi(TableZoneRoutes.get, async (c: Context<{ Bindings: Env }>) => {
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
openApiTablesRouter.openapi(TableZoneRoutes.create, async (c: Context<{ Bindings: Env }>) => {
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
openApiTablesRouter.openapi(TableZoneRoutes.update, async (c: Context<{ Bindings: Env }>) => {
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
openApiTablesRouter.openapi(TableZoneRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
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

export default openApiTablesRouter;
