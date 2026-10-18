import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { TableZoneRoutes } from '../../schemas/tables';
import { formatZone, writeTableAuditLog } from './helpers';
import { getDatabase } from '../../lib/db';

export function registerZoneCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/table-zones - List table zones
  app.openapi(TableZoneRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = (typeof c.req.valid === 'function' ? c.req.valid('query') : undefined) || c.req.query() || {};
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { sort = 'sort_order', order = 'asc', locationId, isActive, search } = query;

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

    const offset = (page - 1) * limit;
    const allowedSorts: Record<string, string> = {
      sort_order: 'sort_order',
      sortOrder: 'sort_order',
      name: 'name',
      created_at: 'created_at',
      createdAt: 'created_at',
    };
    const sortCol = allowedSorts[sort] || 'sort_order';
    const sortDir = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderClause = `${sortCol} ${sortDir}`;

    let total = 0;
    let zoneRows: any[] = [];
    try {
      const countResult = (await db.prepare(
        `SELECT COUNT(*) as total FROM table_zones ${whereClause}`
      ).bind(...params).first()) as { total: number } | null;
      total = countResult?.total || 0;

      const rows = (await db.prepare(
        `SELECT * FROM table_zones ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()) as { results: any[] };
      zoneRows = rows.results || [];
    } catch {
      try {
        const distinctRows = (await db.prepare(
          'SELECT DISTINCT zone FROM cafe_tables WHERE zone IS NOT NULL AND zone != \'\' ORDER BY zone ASC'
        ).all()) as { results: Array<{ zone: string }> };
        const derived = (distinctRows.results || [])
          .map((r, idx) => ({
            id: r.zone,
            slug: r.zone,
            name: r.zone,
            description: null,
            sort_order: idx,
            is_active: 1,
            location_id: locationId || null,
          }))
          .filter((z) => !search || z.name.toLowerCase().includes(String(search).toLowerCase()));
        total = derived.length;
        zoneRows = derived.slice(offset, offset + limit);
      } catch {
        total = 0;
        zoneRows = [];
      }
    }

    const zones = zoneRows.map(formatZone);

    return c.json({
      success: true,
      data: { zones, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/table-zones/:id - Get table zone by ID
  app.openapi(TableZoneRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');

    let row: any = null;
    try {
      row = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
    } catch {
      try {
        const cafeTable = await db.prepare('SELECT zone FROM cafe_tables WHERE zone = ? LIMIT 1').bind(id).first();
        if (cafeTable) {
          row = { id, slug: id, name: id, description: null, sort_order: 0, is_active: 1, location_id: null };
        }
      } catch {
        row = null;
      }
    }

    if (!row) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    // Get tables in this zone
    let tableResults: any[] = [];
    try {
      const tables = (await db.prepare(
        `SELECT id, code, name, capacity, status, position_x, position_y, width, height, rotation
         FROM tables WHERE zone_id = ? ORDER BY name`
      ).bind(id).all()) as { results: any[] };
      tableResults = tables.results || [];
    } catch {
      try {
        const tables = (await db.prepare(
          `SELECT id, CAST(table_number AS TEXT) as code, name, capacity, status, 0 as position_x, 0 as position_y, 80 as width, 80 as height, 0 as rotation
           FROM cafe_tables WHERE zone = ? ORDER BY name`
        ).bind(id).all()) as { results: any[] };
        tableResults = tables.results || [];
      } catch {
        tableResults = [];
      }
    }

    return c.json({
      success: true,
      data: {
        ...row,
        location: row.location_id ? { id: row.location_id } : null,
        isActive: Boolean(row.is_active),
        tables: tableResults.map((t: any) => ({
          ...t,
          position: { x: t.position_x, y: t.position_y },
          dimensions: { width: t.width, height: t.height, rotation: t.rotation },
          isActive: true,
        })),
      },
    });
  });

  // POST /api/table-zones - Create table zone
  app.openapi(TableZoneRoutes.create as any, async (c: any) => {
    const db = getDatabase(c);
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

    // Check slug uniqueness
    let existing: unknown = null;
    try {
      existing = await db.prepare('SELECT id FROM table_zones WHERE slug = ? AND location_id = ?').bind(body.slug, body.locationId).first();
    } catch {
      existing = null;
    }
    if (existing) {
      return c.json({ success: false, error: 'Zone slug already exists in this location' }, 409);
    }

    let insertFailed = false;
    try {
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
    } catch {
      insertFailed = true;
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_zone_create', 'table_zone', id, JSON.stringify(body), now);

    let created: any = null;
    if (!insertFailed) {
      try {
        created = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
      } catch {
        created = null;
      }
    }
    if (!created) {
      created = {
        id,
        slug: body.slug,
        name: body.name,
        description: body.description || null,
        sort_order: body.sortOrder || 0,
        is_active: body.isActive !== false ? 1 : 0,
        location_id: body.locationId || null,
        metadata: JSON.stringify(body.metadata || {}),
        created_at: now,
        updated_at: now,
      };
    }

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
  app.openapi(TableZoneRoutes.update as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingFallback = false;
    try {
      existing = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
    } catch {
      usingFallback = true;
      const cafeTable = await db.prepare('SELECT zone FROM cafe_tables WHERE zone = ? LIMIT 1').bind(id).first().catch(() => null);
      if (cafeTable) {
        existing = { id, slug: id, name: id, is_active: 1, location_id: null };
      }
    }
    if (!existing) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.slug !== undefined) {
      if (!usingFallback) {
        const slugExists = await db.prepare('SELECT id FROM table_zones WHERE slug = ? AND location_id = ? AND id != ?').bind(body.slug, body.locationId || existing.location_id, id).first();
        if (slugExists) {
          return c.json({ success: false, error: 'Zone slug already exists in this location' }, 409);
        }
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

    if (!usingFallback && updates.length > 1) {
      await db.prepare(`UPDATE table_zones SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_zone_update', 'table_zone', id, JSON.stringify(body), now);

    let updated: any = null;
    if (!usingFallback) {
      updated = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
    } else {
      updated = {
        ...existing,
        slug: body.slug ?? existing.slug,
        name: body.name ?? existing.name,
        description: body.description ?? existing.description ?? null,
        sort_order: body.sortOrder ?? existing.sort_order ?? 0,
        is_active: body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
        location_id: body.locationId ?? existing.location_id ?? null,
        updated_at: now,
      };
    }

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
  app.openapi(TableZoneRoutes.delete as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    let existing: any = null;
    let usingFallback = false;
    try {
      existing = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
    } catch {
      usingFallback = true;
      const cafeTable = await db.prepare('SELECT zone FROM cafe_tables WHERE zone = ? LIMIT 1').bind(id).first().catch(() => null);
      if (cafeTable) {
        existing = { id, name: id };
      }
    }
    if (!existing) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    // Check for tables in zone
    let tables: { count: number } | null = null;
    try {
      tables = (await db.prepare('SELECT COUNT(*) as count FROM tables WHERE zone_id = ?').bind(id).first()) as { count: number } | null;
    } catch {
      tables = (await db.prepare('SELECT COUNT(*) as count FROM cafe_tables WHERE zone = ?').bind(id).first().catch(() => null)) as { count: number } | null;
    }
    if (tables && tables.count > 0) {
      return c.json({ success: false, error: 'Cannot delete zone with tables' }, 409);
    }

    if (!usingFallback) {
      await db.prepare('DELETE FROM table_zones WHERE id = ?').bind(id).run();
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_zone_delete', 'table_zone', id, JSON.stringify({ name: existing.name }), now);

    return c.json({ success: true, data: { success: true } });
  });
}
