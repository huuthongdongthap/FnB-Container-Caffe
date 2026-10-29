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
        cafeWhere += ' AND (t.name LIKE ? OR COALESCE(t.code, CAST(t.table_number AS TEXT)) LIKE ?)';
        cafeParams.push(`%${search}%`, `%${search}%`);
      }
      if (zoneId) {
        cafeWhere += ' AND (t.zone_id = ? OR LOWER(t.zone) = LOWER(?))';
        cafeParams.push(zoneId, zoneId);
      }
      if (status) {
        cafeWhere += ' AND t.status = ?';
        cafeParams.push(status);
      }
      if (locationId) {
        cafeWhere += ' AND t.location_id = ?';
        cafeParams.push(locationId);
      }
      try {
        const countResult = (await db.prepare(
          `SELECT COUNT(*) as total FROM cafe_tables t ${cafeWhere}`
        ).bind(...cafeParams).first()) as { total: number } | null;
        total = countResult?.total || 0;

        const rows = (await db.prepare(
          `SELECT t.*, COALESCE(t.zone_id, t.zone) as zone_id, COALESCE(z.name, t.zone) as zone_name, COALESCE(t.code, CAST(t.table_number AS TEXT)) as code, COALESCE(t.is_active, 1) as is_active
           FROM cafe_tables t
           LEFT JOIN table_zones z ON COALESCE(t.zone_id, LOWER(t.zone)) = z.id
           ${cafeWhere}
           ORDER BY ${orderClause}
           LIMIT ? OFFSET ?`
        ).bind(...cafeParams, limit, offset).all()) as { results: any[] };
        tableRows = rows.results || [];
      } catch {
        let legacyWhere = 'WHERE 1=1';
        const legacyParams: (string | number)[] = [];
        if (search) {
          legacyWhere += ' AND (t.name LIKE ? OR CAST(t.table_number AS TEXT) LIKE ?)';
          legacyParams.push(`%${search}%`, `%${search}%`);
        }
        if (zoneId) {
          legacyWhere += ' AND t.zone = ?';
          legacyParams.push(zoneId);
        }
        if (status) {
          legacyWhere += ' AND t.status = ?';
          legacyParams.push(status);
        }
        const countResult = (await db.prepare(
          `SELECT COUNT(*) as total FROM cafe_tables t ${legacyWhere}`
        ).bind(...legacyParams).first()) as { total: number } | null;
        total = countResult?.total || 0;

        const rows = (await db.prepare(
          `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
           FROM cafe_tables t
           ${legacyWhere}
           ORDER BY t.table_number ${safeDirection}
           LIMIT ? OFFSET ?`
        ).bind(...legacyParams, limit, offset).all()) as { results: any[] };
        tableRows = rows.results || [];
      }
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
      try {
        row = await db.prepare(
          `SELECT t.*, COALESCE(t.zone_id, t.zone) as zone_id, COALESCE(z.name, t.zone) as zone_name, COALESCE(t.code, CAST(t.table_number AS TEXT)) as code, COALESCE(t.is_active, 1) as is_active
           FROM cafe_tables t
           LEFT JOIN table_zones z ON COALESCE(t.zone_id, LOWER(t.zone)) = z.id
           WHERE t.id = ?`
        ).bind(id).first();
      } catch {
        row = await db.prepare(
          `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
           FROM cafe_tables t
           WHERE t.id = ?`
        ).bind(id).first();
      }
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
      existing = await db.prepare('SELECT id FROM tables WHERE code = ? AND COALESCE(location_id, \'default\') = COALESCE(?, \'default\')').bind(body.code, body.locationId || 'default').first();
    } catch {
      try {
        existing = await db.prepare('SELECT id FROM cafe_tables WHERE code = ? AND COALESCE(location_id, \'default\') = COALESCE(?, \'default\')').bind(body.code, body.locationId || 'default').first();
      } catch {
        const tableNum = parseInt(String(body.code).replace(/\D/g, ''), 10) || 0;
        existing = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? OR name = ?').bind(tableNum, body.name || body.code).first().catch(() => null);
      }
    }
    if (existing) {
      return c.json({ success: false, error: 'Table code already exists in this location' }, 409);
    }

    const posX = body.position?.x ?? body.x ?? 0;
    const posY = body.position?.y ?? body.y ?? 0;
    const dimW = body.dimensions?.width ?? body.width ?? 80;
    const dimH = body.dimensions?.height ?? body.height ?? 80;
    const dimR = body.dimensions?.rotation ?? body.rotation ?? 0;

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
        posX,
        posY,
        dimW,
        dimH,
        dimR,
        body.isActive !== false ? 1 : 0,
        body.locationId || 'default',
        JSON.stringify(body.metadata || {}),
        now,
        now
      ).run();
    } catch {
      const tableNum = parseInt(String(body.code).replace(/\D/g, ''), 10) || Math.floor(Date.now() % 100000);
      try {
        await db.prepare(
          `INSERT INTO cafe_tables (id, table_number, code, name, capacity, zone, zone_id, status, position_x, position_y, width, height, rotation, is_active, location_id, qr_code, metadata, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          tableNum,
          body.code,
          body.name,
          body.capacity || 4,
          body.zoneId || 'indoor',
          body.zoneId || 'indoor',
          body.status || 'available',
          posX,
          posY,
          dimW,
          dimH,
          dimR,
          body.isActive !== false ? 1 : 0,
          body.locationId || 'default',
          body.qrCode || null,
          JSON.stringify(body.metadata || {}),
          now
        ).run();
      } catch {
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
      try {
        created = await db.prepare(
          `SELECT t.*, COALESCE(t.zone_id, t.zone) as zone_id, COALESCE(z.name, t.zone) as zone_name, COALESCE(t.code, CAST(t.table_number AS TEXT)) as code, COALESCE(t.is_active, 1) as is_active
           FROM cafe_tables t
           LEFT JOIN table_zones z ON COALESCE(t.zone_id, LOWER(t.zone)) = z.id
           WHERE t.id = ?`
        ).bind(id).first();
      } catch {
        created = await db.prepare(
          `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
           FROM cafe_tables t
           WHERE t.id = ?`
        ).bind(id).first();
      }
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
        codeExists = await db.prepare('SELECT id FROM tables WHERE code = ? AND COALESCE(location_id, \'default\') = COALESCE(?, \'default\') AND id != ?').bind(body.code, body.locationId || existing.location_id || 'default', id).first();
      } catch {
        try {
          codeExists = await db.prepare('SELECT id FROM cafe_tables WHERE code = ? AND COALESCE(location_id, \'default\') = COALESCE(?, \'default\') AND id != ?').bind(body.code, body.locationId || existing.location_id || 'default', id).first();
        } catch {
          const tableNum = parseInt(String(body.code).replace(/\D/g, ''), 10) || 0;
          codeExists = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? AND id != ?').bind(tableNum, id).first().catch(() => null);
        }
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
    const updX = body.position?.x ?? body.x;
    const updY = body.position?.y ?? body.y;
    const updW = body.dimensions?.width ?? body.width;
    const updH = body.dimensions?.height ?? body.height;
    const updR = body.dimensions?.rotation ?? body.rotation;
    if (updX !== undefined) { updates.push('position_x = ?'); params.push(updX); }
    if (updY !== undefined) { updates.push('position_y = ?'); params.push(updY); }
    if (updW !== undefined) { updates.push('width = ?'); params.push(updW); }
    if (updH !== undefined) { updates.push('height = ?'); params.push(updH); }
    if (updR !== undefined) { updates.push('rotation = ?'); params.push(updR); }
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
        try {
          const fullCafeUpdates = [...updates];
          const fullCafeParams = [...params];
          if (body.zoneId !== undefined) {
            fullCafeUpdates.unshift('zone = ?');
            fullCafeParams.unshift(body.zoneId);
          }
          await db.prepare(`UPDATE cafe_tables SET ${fullCafeUpdates.join(', ')} WHERE id = ?`).bind(...fullCafeParams).run();
        } catch {
          if (cafeUpdates.length > 0) {
            await db.prepare(`UPDATE cafe_tables SET ${cafeUpdates.join(', ')} WHERE id = ?`).bind(...cafeParams, id).run();
          }
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
      try {
        updated = await db.prepare(
          `SELECT t.*, COALESCE(t.zone_id, t.zone) as zone_id, COALESCE(z.name, t.zone) as zone_name, COALESCE(t.code, CAST(t.table_number AS TEXT)) as code, COALESCE(t.is_active, 1) as is_active
           FROM cafe_tables t
           LEFT JOIN table_zones z ON COALESCE(t.zone_id, LOWER(t.zone)) = z.id
           WHERE t.id = ?`
        ).bind(id).first();
      } catch {
        updated = await db.prepare(
          `SELECT t.*, t.zone as zone_id, t.zone as zone_name, CAST(t.table_number AS TEXT) as code, 1 as is_active
           FROM cafe_tables t
           WHERE t.id = ?`
        ).bind(id).first();
      }
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
