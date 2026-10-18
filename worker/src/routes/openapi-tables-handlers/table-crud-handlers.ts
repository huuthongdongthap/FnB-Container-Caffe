import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { TableRoutes } from '../../schemas/tables';
import { formatTable, writeTableAuditLog } from './helpers';
import { getDatabase } from '../../lib/db';

export function registerTableCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/tables - List tables with pagination and filtering
  app.openapi(TableRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
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

    const offset = (page - 1) * limit;
    const allowedSorts: Record<string, string> = {
      table_number: 't.table_number',
      capacity: 't.capacity',
      status: 't.status',
      sort_order: 't.sort_order',
      created_at: 't.created_at',
      updated_at: 't.updated_at',
    };
    const safeSort = allowedSorts[sort] || 't.table_number';
    const safeDirection = (order?.toLowerCase() === 'desc') ? 'DESC' : 'ASC';
    const orderClause = `${safeSort} ${safeDirection}`;

    let total = 0;
    let tableRows: any[] = [];
    try {
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM tables t ${whereClause}`
      ).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT t.*, z.name as zone_name
         FROM tables t
         LEFT JOIN table_zones z ON t.zone_id = z.id
         ${whereClause}
         ORDER BY ${orderClause}
         LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      tableRows = rows.results || [];
    } catch {
      let cafeWhere = 'WHERE 1=1';
      const cafeParams: (string | number)[] = [];
      if (search) {
        cafeWhere += ' AND (t.name LIKE ? OR CAST(t.table_number AS TEXT) LIKE ?)';
        cafeParams.push(`%${search}%`, `%${search}%`);
      }
      if (zoneId) {
        cafeWhere += ' AND t.zone = ?';
        cafeParams.push(zoneId);
      }
      if (status) {
        cafeWhere += ' AND t.status = ?';
        cafeParams.push(status);
      }
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM cafe_tables t ${cafeWhere}`
      ).bind(...cafeParams).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
         FROM cafe_tables t
         ${cafeWhere}
         ORDER BY t.table_number ${safeDirection}
         LIMIT ? OFFSET ?`
      ).bind(...cafeParams, limit, offset).all()) as { results: any[] };
      tableRows = rows.results || [];
    }

    const tables = tableRows.map(formatTable);

    return c.json({
      success: true,
      data: { tables, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/tables/:id - Get table by ID
  app.openapi(TableRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');

    let row: any = null;
    try {
      row = await db.prepare(
        `SELECT t.*, z.name as zone_name
         FROM tables t
         LEFT JOIN table_zones z ON t.zone_id = z.id
         WHERE t.id = ?`
      ).bind(id).first();
    } catch {
      row = await db.prepare(
        `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
         FROM cafe_tables t
         WHERE t.id = ?`
      ).bind(id).first();
    }

    if (!row) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatTable(row),
    });
  });

  // POST /api/tables - Create table
  app.openapi(TableRoutes.create as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

    // Check code uniqueness
    let existing: unknown = null;
    try {
      existing = await db.prepare('SELECT id FROM tables WHERE code = ? AND location_id = ?').bind(body.code, body.locationId).first();
    } catch {
      const tableNum = parseInt(String(body.code).replace(/\D/g, ''), 10) || 0;
      existing = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? OR name = ?').bind(tableNum, body.name).first().catch(() => null);
    }
    if (existing) {
      return c.json({ success: false, error: 'Table code already exists in this location' }, 409);
    }

    try {
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
    } catch {
      const tableNum = parseInt(String(body.code).replace(/\D/g, ''), 10) || Math.floor(Date.now() % 10000);
      await db.prepare(
        `INSERT INTO cafe_tables (id, table_number, name, capacity, zone, status, qr_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        tableNum,
        body.name,
        body.capacity || 4,
        body.zoneId || 'indoor',
        body.status || 'available',
        body.qrCode || null
      ).run();
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_create', 'table', id, JSON.stringify(body), now);

    let created: any = null;
    try {
      created = await db.prepare(
        `SELECT t.*, z.name as zone_name
         FROM tables t
         LEFT JOIN table_zones z ON t.zone_id = z.id
         WHERE t.id = ?`
      ).bind(id).first();
    } catch {
      created = await db.prepare(
        `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
         FROM cafe_tables t
         WHERE t.id = ?`
      ).bind(id).first();
    }

    return c.json({
      success: true,
      data: formatTable(created!),
    }, 201);
  });

  // PATCH /api/tables/:id - Update table
  app.openapi(TableRoutes.update as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    let existing: any = null;
    try {
      existing = await db.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first();
    } catch {
      existing = await db.prepare('SELECT *, zone as zone_id, CAST(table_number AS TEXT) as code FROM cafe_tables WHERE id = ?').bind(id).first();
    }
    if (!existing) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    // Check code uniqueness if code is being changed
    if (body.code && body.code !== existing.code) {
      let codeExists: unknown = null;
      try {
        codeExists = await db.prepare('SELECT id FROM tables WHERE code = ? AND location_id = ? AND id != ?').bind(body.code, body.locationId || existing.location_id, id).first();
      } catch {
        const tableNum = parseInt(String(body.code).replace(/\D/g, ''), 10) || 0;
        codeExists = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? AND id != ?').bind(tableNum, id).first().catch(() => null);
      }
      if (codeExists) {
        return c.json({ success: false, error: 'Table code already exists in this location' }, 409);
      }
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    const cafeUpdates: string[] = [];
    const cafeParams: (string | number | null)[] = [];

    if (body.code !== undefined) {
      updates.push('code = ?');
      params.push(body.code);
      const tableNum = parseInt(String(body.code).replace(/\D/g, ''), 10);
      if (!Number.isNaN(tableNum)) {
        cafeUpdates.push('table_number = ?');
        cafeParams.push(tableNum);
      }
    }
    if (body.name !== undefined) {
      updates.push('name = ?');
      params.push(body.name);
      cafeUpdates.push('name = ?');
      cafeParams.push(body.name);
    }
    if (body.zoneId !== undefined) {
      updates.push('zone_id = ?');
      params.push(body.zoneId);
      cafeUpdates.push('zone = ?');
      cafeParams.push(body.zoneId);
    }
    if (body.capacity !== undefined) {
      updates.push('capacity = ?');
      params.push(body.capacity);
      cafeUpdates.push('capacity = ?');
      cafeParams.push(body.capacity);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      params.push(body.status);
      cafeUpdates.push('status = ?');
      cafeParams.push(body.status);
    }
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
      try {
        await db.prepare(`UPDATE tables SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      } catch {
        if (cafeUpdates.length > 0) {
          await db.prepare(`UPDATE cafe_tables SET ${cafeUpdates.join(', ')} WHERE id = ?`).bind(...cafeParams, id).run();
        }
      }
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_update', 'table', id, JSON.stringify(body), now);

    let updated: any = null;
    try {
      updated = await db.prepare(
        `SELECT t.*, z.name as zone_name
         FROM tables t
         LEFT JOIN table_zones z ON t.zone_id = z.id
         WHERE t.id = ?`
      ).bind(id).first();
    } catch {
      updated = await db.prepare(
        `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
         FROM cafe_tables t
         WHERE t.id = ?`
      ).bind(id).first();
    }

    return c.json({
      success: true,
      data: formatTable(updated!),
    });
  });

  // DELETE /api/tables/:id - Delete table
  app.openapi(TableRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    let existing: any = null;
    try {
      existing = await db.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first();
    } catch {
      existing = await db.prepare('SELECT *, CAST(table_number AS TEXT) as code FROM cafe_tables WHERE id = ?').bind(id).first();
    }
    if (!existing) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    // Check for active sessions
    let sessions: { count: number } | null = null;
    try {
      sessions = (await db.prepare('SELECT COUNT(*) as count FROM table_sessions WHERE table_id = ? AND status IN (\'active\', \'occupied\')').bind(id).first()) as { count: number } | null;
    } catch {
      sessions = null;
    }
    if (sessions && sessions.count > 0) {
      return c.json({ success: false, error: 'Cannot delete table with active sessions' }, 409);
    }

    // Check for orders
    let orders: { count: number } | null = null;
    try {
      orders = (await db.prepare('SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN (\'completed\', \'cancelled\')').bind(id).first()) as { count: number } | null;
    } catch {
      orders = null;
    }
    if (orders && orders.count > 0) {
      return c.json({ success: false, error: 'Cannot delete table with active orders' }, 409);
    }

    try {
      await db.prepare('DELETE FROM tables WHERE id = ?').bind(id).run();
    } catch {
      await db.prepare('DELETE FROM cafe_tables WHERE id = ?').bind(id).run();
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_delete', 'table', id, JSON.stringify({ name: existing.name, code: existing.code }), now);

    return c.json({ success: true, data: { success: true } });
  });

  // POST /api/tables/bulk-status - Bulk update table status
  app.openapi(TableRoutes.bulkStatus as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const { tableIds, status } = body;

    if (!tableIds?.length) {
      return c.json({ success: false, error: 'No table IDs provided' }, 400);
    }

    for (const tableId of tableIds) {
      try {
        await db.prepare(
          'UPDATE tables SET status = ?, updated_at = ? WHERE id = ?'
        ).bind(status, now, tableId).run();
      } catch {
        await db.prepare(
          'UPDATE cafe_tables SET status = ? WHERE id = ?'
        ).bind(status, tableId).run();
      }
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_bulk_status', 'table', 'multiple', JSON.stringify({ tableIds, status }), now);

    return c.json({ success: true, data: { success: true, updated: tableIds.length } });
  });
}
