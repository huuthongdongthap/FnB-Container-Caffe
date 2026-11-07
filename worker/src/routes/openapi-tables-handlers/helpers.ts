
import { getTenantId, isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';

export function resolveOpenApiTablesTenant(
  c: any,
  mode: 'read' | 'write' = 'read'
): { ok: true; tenantId: string } | { ok: false; response: Response } {
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-store-id'),
    c.req?.header?.('X-Store-ID'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return {
      ok: false,
      response: typeof c.json === 'function'
        ? c.json({ success: false, error: 'Forbidden: conflicting tenant overrides', code: 'FORBIDDEN' }, 403)
        : new Response(JSON.stringify({ success: false, error: 'Forbidden: conflicting tenant overrides', code: 'FORBIDDEN' }), { status: 403 }),
    };
  }
  const reqTenant = candidateOverrides[0] || '';
  const user = c.get?.('user') as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  if (user) {
    const rawUserTenant =
      typeof user.tenantId === 'string' && user.tenantId.trim()
        ? user.tenantId.trim()
        : typeof user.tenant_id === 'string' && user.tenant_id.trim()
          ? user.tenant_id.trim()
          : '';
    const role = (user.role || '').trim().toLowerCase();
    const hqAdmin =
      isHQSuperAdmin(user) ||
      isHQSuperAdmin(c) ||
      ((role === 'owner' || role === 'admin') && (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq'));
    const ctxTenant = typeof c.get?.('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
    const boundTenant = rawUserTenant || (!reqTenant && ctxTenant ? ctxTenant : 'default');

    if (!hqAdmin) {
      if (
        boundTenant === '*' ||
        boundTenant.toLowerCase() === 'hq' ||
        (reqTenant && (reqTenant === '*' || reqTenant.toLowerCase() === 'hq' || reqTenant !== boundTenant)) ||
        (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant))
      ) {
        return {
          ok: false,
          response: typeof c.json === 'function'
            ? c.json({ success: false, error: 'Forbidden: tenant mismatch', code: 'FORBIDDEN' }, 403)
            : new Response(JSON.stringify({ success: false, error: 'Forbidden: tenant mismatch', code: 'FORBIDDEN' }), { status: 403 }),
        };
      }
      return { ok: true, tenantId: boundTenant };
    }

    const cleanReq = reqTenant && reqTenant !== '*' && reqTenant.toLowerCase() !== 'hq' ? reqTenant : '';
    const cleanCtx = ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '';
    const rawMid = getTenantId(c);
    const cleanMid = rawMid && rawMid !== '*' && rawMid.toLowerCase() !== 'hq' ? rawMid : '';
    const resolved =
      reqTenant === '*' || reqTenant.toLowerCase() === 'hq'
        ? '*'
        : cleanReq || cleanCtx || cleanMid || '*';
    return {
      ok: true,
      tenantId: resolved,
    };
  }

  if (reqTenant === '*' || reqTenant.toLowerCase() === 'hq') {
    return {
      ok: false,
      response: typeof c.json === 'function'
        ? c.json({ success: false, error: 'Forbidden: tenant mismatch', code: 'FORBIDDEN' }, 403)
        : new Response(JSON.stringify({ success: false, error: 'Forbidden: tenant mismatch', code: 'FORBIDDEN' }), { status: 403 }),
    };
  }
  if (mode === 'read') {
    return { ok: true, tenantId: resolvePublicTenantId(c) };
  }
  const resolved = getTenantId(c) || 'default';
  return { ok: true, tenantId: resolved === '*' || resolved.toLowerCase() === 'hq' ? 'default' : resolved };
}

export function hasOpenApiTablesTenantMismatch(c: any): boolean {
  return !resolveOpenApiTablesTenant(c, 'read').ok;
}

export function formatTable(row: Record<string, any>) {
  const zoneId = row.zone_id ?? row.zone ?? null;
  const zoneName = row.zone_name ?? row.zone ?? null;
  return {
    ...row,
    code: row.code ?? (row.table_number !== undefined ? String(row.table_number) : row.id),
    zone: zoneId ? { id: zoneId, name: zoneName } : null,
    position: { x: row.position_x ?? 0, y: row.position_y ?? 0 },
    dimensions: { width: row.width ?? 80, height: row.height ?? 80, rotation: row.rotation ?? 0 },
    capacity: row.capacity,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    location: row.location_id ? { id: row.location_id } : null,
    currentSession: row.current_session_id ? { id: row.current_session_id } : null,
  };
}

export function formatZone(row: Record<string, any>) {
  return {
    ...row,
    location: row.location_id ? { id: row.location_id } : null,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    tables: [], // Would be populated separately if needed
  };
}

export async function isAllowedLocationForTenant(
  db: any,
  locationId: unknown,
  tenantId: string
): Promise<boolean> {
  if (locationId === undefined || locationId === null || String(locationId).trim() === '') {
    return true;
  }
  const cleanTenant = (tenantId || '').trim() || 'default';
  if (!cleanTenant || cleanTenant === '*' || cleanTenant.toLowerCase() === 'hq') return true;
  const locId = String(locationId).trim();
  if (locId === '*' || locId.toLowerCase() === 'hq') return false;
  if (locId === cleanTenant) return true;
  try {
    const locRow = await db
      .prepare('SELECT tenant_id FROM locations WHERE id = ? LIMIT 1')
      .bind(locId)
      .first();
    if (locRow && locRow.tenant_id !== undefined && locRow.tenant_id !== null && String(locRow.tenant_id).trim() !== '') {
      return String(locRow.tenant_id).trim() === cleanTenant;
    }
  } catch {
    // Optional locations table
  }
  if (cleanTenant !== 'default') {
    return false;
  }
  if (/^(tenant|store|branch|fran)[-_]/i.test(locId) && locId !== 'default') {
    return false;
  }
  return true;
}

export async function writeTableAuditLog(
  db: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId: string = 'default'
): Promise<void> {
  const rawTenant = tenantId ? tenantId.trim() : '';
  const effectiveTenant = !rawTenant || rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? 'default' : rawTenant;
  const auditId = `audit_${crypto.randomUUID()}`;
  let _targetAuditId: string | number = auditId;
  let enrichedMeta = metadata;
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tenant_id === undefined) {
      enrichedMeta = JSON.stringify({ ...parsed, tenant_id: effectiveTenant });
    }
  } catch { /* non-JSON metadata */ }
  try {
    const res = await db.prepare(
      `INSERT INTO audit_logs (id, actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(null, userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, effectiveTenant, now).run();
    _targetAuditId = res?.meta?.last_row_id ?? res?.lastInsertRowid ?? auditId;
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(auditId, userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, effectiveTenant, now).run();
      _targetAuditId = auditId;
    } catch {
      try {
        const res = await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, effectiveTenant, now).run();
        _targetAuditId = res?.meta?.last_row_id ?? res?.lastInsertRowid ?? auditId;
      } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(auditId, userId, action, entityType, entityId, enrichedMeta, effectiveTenant, now).run();
        _targetAuditId = auditId;
      } catch {
        if (effectiveTenant === 'default') {
          try {
            const res = await db.prepare(
              `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, now).run();
            _targetAuditId = res?.meta?.last_row_id ?? res?.lastInsertRowid ?? auditId;
          } catch {
            try {
              await db.prepare(
                `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).bind(auditId, userId, action, entityType, entityId, enrichedMeta, now).run();
              _targetAuditId = auditId;
            } catch {
              try {
                const res = await db.prepare(
                  `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(userId, userId, action, entityType, entityId, enrichedMeta, now).run().catch(() => null);
                if (res) {
                  _targetAuditId = res?.meta?.last_row_id ?? res?.lastInsertRowid ?? auditId;
                }
              } catch {
                // Ignore audit log error
              }
            }
          }
        }
      }
      }
    }
  }
  await db
    .prepare('UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?')
    .bind(effectiveTenant, entityId, entityId, action, now)
    .run()
    .catch(() => {});
}
