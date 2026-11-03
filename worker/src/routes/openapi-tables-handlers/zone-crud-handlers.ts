import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { TableZoneRoutes } from '../../schemas/tables';
import { formatZone, isAllowedLocationForTenant, writeTableAuditLog } from './helpers';
import { getDatabase } from '../../lib/db';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';

function matchesZoneTenant(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  if ('location_id' in row && row.location_id !== undefined) {
    const rowLoc = (row.location_id && String(row.location_id).trim()) || 'default';
    return rowLoc === tenantId;
  }
  return tenantId === 'default';
}

export function registerZoneCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/table-zones - List table zones
  app.openapi(TableZoneRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = getTenantId(c);
    const query = (typeof c.req.valid === 'function' ? c.req.valid('query') : undefined) || c.req.query() || {};
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
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
    const isActiveBool =
      isActive === true || isActive === 'true' || isActive === '1' || isActive === 1;
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActiveBool ? 1 : 0);
    }

    const offset = (page - 1) * limit;
    const fetchLimit = tenantId === '*' ? limit : Math.max(limit + offset, 200);
    const fetchOffset = tenantId === '*' ? offset : 0;
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

    const deriveZonesFromCafeTables = async () => {
      if (isActive !== undefined && !isActiveBool) {
        return { total: 0, zoneRows: [] as any[] };
      }
      let rawRows: Array<Record<string, unknown>> = [];
      try {
        const res = (await db.prepare(
          'SELECT zone, tenant_id FROM cafe_tables WHERE zone IS NOT NULL AND zone != \'\' ORDER BY zone ASC'
        ).all()) as { results: Array<Record<string, unknown>> };
        rawRows = res.results || [];
      } catch {
        const res = (await db.prepare(
          'SELECT DISTINCT zone FROM cafe_tables WHERE zone IS NOT NULL AND zone != \'\' ORDER BY zone ASC'
        ).all()) as { results: Array<Record<string, unknown>> };
        rawRows = res.results || [];
      }
      const seen = new Set<string>();
      const derived = rawRows
        .filter((r) => matchesTenantRow(r, tenantId))
        .filter((r) => {
          const z = String(r.zone || '');
          if (!z || seen.has(z)) return false;
          seen.add(z);
          return true;
        })
        .map((r, idx) => ({
          id: String(r.zone),
          slug: String(r.zone),
          name: String(r.zone),
          description: null,
          sort_order: idx,
          is_active: 1,
          location_id: locationId || (tenantId === '*' ? null : tenantId),
        }))
        .filter((z) => !search || z.name.toLowerCase().includes(String(search).toLowerCase()));
      return {
        total: derived.length,
        zoneRows: derived.slice(offset, offset + limit),
      };
    };

    let total = 0;
    let zoneRows: any[] = [];
    try {
      let querySucceeded = false;
      if (tenantId !== '*') {
        try {
          const tenantWhere = `${whereClause} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`;
          const tenantParams = [...params, tenantId];
          const countResult = (await db.prepare(
            `SELECT COUNT(*) as total FROM table_zones ${tenantWhere}`
          ).bind(...tenantParams).first()) as { total: number } | null;
          total = countResult?.total || 0;

          const rows = (await db.prepare(
            `SELECT * FROM table_zones ${tenantWhere} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
          ).bind(...tenantParams, limit, offset).all()) as { results: any[] };
          const rawZoneRows = rows.results || [];
          const filteredZoneRows = rawZoneRows.filter((r) => matchesZoneTenant(r, tenantId));
          if (filteredZoneRows.length !== rawZoneRows.length) {
            total = filteredZoneRows.length;
          }
          zoneRows = filteredZoneRows;
          querySucceeded = true;
        } catch {
          querySucceeded = false;
        }
      }
      if (!querySucceeded) {
        const countResult = (await db.prepare(
          `SELECT COUNT(*) as total FROM table_zones ${whereClause}`
        ).bind(...params).first()) as { total: number } | null;
        total = countResult?.total || 0;

        const rows = (await db.prepare(
          `SELECT * FROM table_zones ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
        ).bind(...params, fetchLimit, fetchOffset).all()) as { results: any[] };
        const rawZoneRows = rows.results || [];
        if (tenantId === '*') {
          zoneRows = rawZoneRows;
        } else {
          const filteredZoneRows = rawZoneRows.filter((r) => matchesZoneTenant(r, tenantId));
          total = filteredZoneRows.length;
          zoneRows = filteredZoneRows.slice(offset, offset + limit);
        }
      }

      if (total === 0) {
        const allZonesCount = (await db.prepare(
          'SELECT COUNT(*) as total FROM table_zones'
        ).first().catch(() => null)) as { total: number } | null;
        if (!allZonesCount || allZonesCount.total === 0 || zoneRows.length === 0) {
          const fallback = await deriveZonesFromCafeTables().catch(() => ({ total: 0, zoneRows: [] }));
          if (fallback.total > 0 || !allZonesCount || allZonesCount.total === 0) {
            total = fallback.total;
            zoneRows = fallback.zoneRows;
          }
        }
      }
    } catch {
      try {
        const fallback = await deriveZonesFromCafeTables();
        total = fallback.total;
        zoneRows = fallback.zoneRows;
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
    const tenantId = getTenantId(c);
    const { id } = c.req.valid('param');

    let row: any = null;
    try {
      row = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
      if (row && !matchesZoneTenant(row, tenantId)) {
        row = null;
      }
    } catch {
      row = null;
    }
    if (!row) {
      try {
        const cafeTables = (await db.prepare('SELECT zone, tenant_id FROM cafe_tables WHERE LOWER(zone) = LOWER(?)').bind(id).all()) as { results: Array<Record<string, unknown>> };
        const matched = (cafeTables.results || []).find((r) => matchesTenantRow(r, tenantId));
        if (matched) {
          row = { id, slug: id, name: String(matched.zone || id), description: null, sort_order: 0, is_active: 1, location_id: tenantId === '*' ? null : tenantId };
        }
      } catch {
        try {
          const cafeTable = await db.prepare('SELECT zone FROM cafe_tables WHERE LOWER(zone) = LOWER(?) LIMIT 1').bind(id).first() as { zone?: string } | null;
          if (cafeTable && (tenantId === '*' || tenantId === 'default')) {
            row = { id, slug: id, name: cafeTable.zone || id, description: null, sort_order: 0, is_active: 1, location_id: null };
          }
        } catch {
          row = null;
        }
      }
    }

    if (!row) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    // Get tables in this zone
    let tableResults: any[] = [];
    try {
      const tables = (await db.prepare(
        `SELECT id, COALESCE(code, CAST(table_number AS TEXT)) as code, name, capacity, status, COALESCE(position_x, 0) as position_x, COALESCE(position_y, 0) as position_y, COALESCE(width, 80) as width, COALESCE(height, 80) as height, COALESCE(rotation, 0) as rotation, tenant_id
         FROM cafe_tables WHERE zone_id = ? OR LOWER(zone) = LOWER(?) ORDER BY name`
      ).bind(id, id).all()) as { results: any[] };
      tableResults = (tables.results || []).filter((t) => matchesTenantRow(t, tenantId));
    } catch {
      try {
        const tables = (await db.prepare(
          `SELECT * FROM tables WHERE zone_id = ? ORDER BY name`
        ).bind(id).all()) as { results: any[] };
        tableResults = (tables.results || []).filter((t) => matchesTenantRow(t, tenantId));
      } catch {
        try {
          const tables = (await db.prepare(
            `SELECT *, CAST(table_number AS TEXT) as code, 0 as position_x, 0 as position_y, 80 as width, 80 as height, 0 as rotation
             FROM cafe_tables WHERE zone = ? ORDER BY name`
          ).bind(id).all()) as { results: any[] };
          tableResults = (tables.results || []).filter((t) => matchesTenantRow(t, tenantId));
        } catch {
          tableResults = [];
        }
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
    const rawTenantId = getTenantId(c);
    const writeTenant = rawTenantId === '*' ? 'default' : rawTenantId;
    const body = c.req.valid('json');
    const user = c.get('user');
    if (user?.role && !['owner', 'admin', 'manager', 'supervisor'].includes(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const now = new Date().toISOString();

    const id = crypto.randomUUID();

    if (body.locationId !== undefined && !(await isAllowedLocationForTenant(db, body.locationId, rawTenantId))) {
      return c.json({ success: false, error: 'Invalid location for tenant' }, 403);
    }

    const locationId = rawTenantId !== '*' && rawTenantId !== 'default' ? (body.locationId || rawTenantId) : (body.locationId || writeTenant);
    const sortOrder = body.sortOrder ?? body.displayOrder ?? 0;

    // Check slug uniqueness within tenant and location
    let existing: unknown = null;
    try {
      const candidates = await db.prepare('SELECT * FROM table_zones WHERE slug = ? AND COALESCE(location_id, \'default\') = ?').bind(body.slug, locationId).all<Record<string, unknown>>();
      if (candidates && Array.isArray(candidates.results)) {
        existing = candidates.results.find((r) => matchesZoneTenant(r, writeTenant)) ?? null;
      } else {
        existing = await db.prepare('SELECT id FROM table_zones WHERE slug = ? AND COALESCE(location_id, \'default\') = ?').bind(body.slug, locationId).first();
      }
    } catch {
      existing = null;
    }
    if (existing) {
      return c.json({ success: false, error: 'Zone slug already exists in this location' }, 409);
    }

    let insertFailed = false;
    let insertedWithTenant = false;
    if (writeTenant) {
      try {
        await db.prepare(
          `INSERT INTO table_zones (id, slug, name, description, sort_order, is_active, location_id, metadata, tenant_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.slug,
          body.name,
          body.description || null,
          sortOrder,
          body.isActive !== false ? 1 : 0,
          locationId,
          JSON.stringify(body.metadata || {}),
          writeTenant,
          now,
          now
        ).run();
        insertedWithTenant = true;
      } catch {
        insertedWithTenant = false;
      }
    }
    if (!insertedWithTenant) {
      try {
        await db.prepare(
          `INSERT INTO table_zones (id, slug, name, description, sort_order, is_active, location_id, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.slug,
          body.name,
          body.description || null,
          sortOrder,
          body.isActive !== false ? 1 : 0,
          locationId,
          JSON.stringify(body.metadata || {}),
          now,
          now
        ).run();
      } catch {
        insertFailed = true;
      }
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_zone_create', 'table_zone', id, JSON.stringify(body), now, writeTenant);

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
    const tenantId = getTenantId(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    if (user?.role && !['owner', 'admin', 'manager', 'supervisor'].includes(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const now = new Date().toISOString();

    let existing: any = null;
    let usingFallback = false;
    try {
      existing = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
      if (existing && !matchesZoneTenant(existing, tenantId)) {
        existing = null;
      }
    } catch {
      usingFallback = true;
    }
    if (!existing) {
      const cafeTables = (await db.prepare('SELECT zone, tenant_id FROM cafe_tables WHERE LOWER(zone) = LOWER(?)').bind(id).all().catch(() => ({ results: [] }))) as { results: Array<Record<string, unknown>> };
      const matched = (cafeTables.results || []).find((r) => matchesTenantRow(r, tenantId));
      if (matched) {
        usingFallback = true;
        existing = { id, slug: id, name: String(matched.zone || id), is_active: 1, location_id: tenantId === '*' ? null : tenantId };
      }
    }
    if (!existing) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    if (body.locationId !== undefined && !(await isAllowedLocationForTenant(db, body.locationId, tenantId))) {
      return c.json({ success: false, error: 'Invalid location for tenant' }, 403);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.slug !== undefined) {
      if (!usingFallback) {
        let slugExists: unknown = null;
        try {
          const targetLoc = body.locationId || existing.location_id || 'default';
          const candidates = await db.prepare('SELECT * FROM table_zones WHERE slug = ? AND COALESCE(location_id, \'default\') = COALESCE(?, \'default\') AND id != ?').bind(body.slug, targetLoc, id).all<Record<string, unknown>>();
          if (candidates && Array.isArray(candidates.results)) {
            slugExists = candidates.results.find((r) => matchesZoneTenant(r, tenantId === '*' ? 'default' : tenantId)) ?? null;
          } else {
            slugExists = await db.prepare('SELECT id FROM table_zones WHERE slug = ? AND COALESCE(location_id, \'default\') = COALESCE(?, \'default\') AND id != ?').bind(body.slug, targetLoc, id).first();
          }
        } catch {
          slugExists = null;
        }
        if (slugExists) {
          return c.json({ success: false, error: 'Zone slug already exists in this location' }, 409);
        }
      }
      updates.push('slug = ?');
      params.push(body.slug);
    }
    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
    const updSortOrder = body.sortOrder ?? body.displayOrder;
    if (updSortOrder !== undefined) { updates.push('sort_order = ?'); params.push(updSortOrder); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
    if (body.locationId !== undefined) { updates.push('location_id = ?'); params.push(body.locationId); }
    if (body.metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(body.metadata)); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (!usingFallback && updates.length > 1) {
      if (tenantId !== '*') {
        try {
          await db.prepare(
            `UPDATE table_zones SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(...params, tenantId).run();
        } catch {
          await db.prepare(`UPDATE table_zones SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
      } else {
        await db.prepare(`UPDATE table_zones SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      }
    } else if (usingFallback && body.name !== undefined) {
      const oldZoneName = String(existing.name || id);
      if (tenantId !== '*') {
        try {
          await db.prepare(
            "UPDATE cafe_tables SET zone = ? WHERE (zone = ? OR LOWER(zone) = LOWER(?)) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(body.name, oldZoneName, id, tenantId).run();
        } catch {
          await db.prepare(
            'UPDATE cafe_tables SET zone = ? WHERE zone = ?'
          ).bind(body.name, oldZoneName).run().catch(() => {});
        }
      } else {
        await db.prepare(
          'UPDATE cafe_tables SET zone = ? WHERE zone = ?'
        ).bind(body.name, oldZoneName).run().catch(() => {});
      }
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_zone_update', 'table_zone', id, JSON.stringify(body), now, tenantId);

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
    const tenantId = getTenantId(c);
    const { id } = c.req.valid('param');
    const user = c.get('user');
    if (user?.role && !['owner', 'admin', 'manager', 'supervisor'].includes(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const now = new Date().toISOString();

    let existing: any = null;
    let usingFallback = false;
    try {
      existing = await db.prepare('SELECT * FROM table_zones WHERE id = ?').bind(id).first();
      if (existing && !matchesZoneTenant(existing, tenantId)) {
        existing = null;
      }
    } catch {
      usingFallback = true;
    }
    if (!existing) {
      const cafeTables = (await db.prepare('SELECT zone, tenant_id FROM cafe_tables WHERE LOWER(zone) = LOWER(?)').bind(id).all().catch(() => ({ results: [] }))) as { results: Array<Record<string, unknown>> };
      const matched = (cafeTables.results || []).find((r) => matchesTenantRow(r, tenantId));
      if (matched) {
        usingFallback = true;
        existing = { id, name: String(matched.zone || id) };
      }
    }
    if (!existing) {
      return c.json({ success: false, error: 'Table zone not found' }, 404);
    }

    // Check for tables in zone
    let tables: { count: number } | null = null;
    try {
      if (tenantId === '*') {
        tables = (await db.prepare('SELECT COUNT(*) as count FROM cafe_tables WHERE zone_id = ? OR LOWER(zone) = LOWER(?)').bind(id, id).first()) as { count: number } | null;
      } else {
        const rows = (await db.prepare('SELECT id, tenant_id FROM cafe_tables WHERE zone_id = ? OR LOWER(zone) = LOWER(?)').bind(id, id).all()) as { results: Array<Record<string, unknown>> };
        if (rows && Array.isArray(rows.results) && rows.results.length > 0) {
          tables = { count: rows.results.filter((r) => matchesTenantRow(r, tenantId)).length };
        } else {
          tables = (await db.prepare('SELECT COUNT(*) as count FROM cafe_tables WHERE zone_id = ? OR LOWER(zone) = LOWER(?)').bind(id, id).first()) as { count: number } | null;
        }
      }
    } catch {
      try {
        tables = (await db.prepare('SELECT COUNT(*) as count FROM tables WHERE zone_id = ?').bind(id).first()) as { count: number } | null;
      } catch {
        tables = (await db.prepare('SELECT COUNT(*) as count FROM cafe_tables WHERE zone = ?').bind(id).first().catch(() => null)) as { count: number } | null;
      }
    }
    if (tables && tables.count > 0) {
      return c.json({ success: false, error: 'Cannot delete zone with tables' }, 409);
    }

    if (!usingFallback) {
      if (tenantId !== '*') {
        try {
          await db.prepare(
            "DELETE FROM table_zones WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, tenantId).run();
        } catch {
          await db.prepare('DELETE FROM table_zones WHERE id = ?').bind(id).run();
        }
      } else {
        await db.prepare('DELETE FROM table_zones WHERE id = ?').bind(id).run();
      }
    }

    // Audit log
    await writeTableAuditLog(db, user.id, 'table_zone_delete', 'table_zone', id, JSON.stringify({ name: existing.name }), now, tenantId);

    return c.json({ success: true, data: { success: true } });
  });
}
