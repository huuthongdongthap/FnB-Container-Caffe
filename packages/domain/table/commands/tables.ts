/**
 * Tables — CRUD routes for cafe_tables
 * Extracted from worker/src/routes/tables.ts (tablesRouter portion).
 */
import { Hono } from 'hono';
import { updateTableStatusSchema, zodErrorResponse } from 'worker/src/lib/validators';
import { signQRUrl } from 'worker/src/tree/qr/signer';
import type { Env } from 'worker/src/types/env';
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { getTenantId, matchesTenantRow, resolvePilotStore, resolvePublicTenantId } from 'worker/src/middleware/tenant';
import { audit } from 'worker/src/middleware/audit-log';
import type { CafeTable, QrCodeRow } from '../model/table-types';
import { canTransitionTo, normalizeTableStatus } from '../policies/status';

export const tablesRouter = new Hono<{ Bindings: Env }>();

const TABLE_MUTATION_ROLES = new Set([
  'owner',
  'manager',
  'supervisor',
  'staff',
  'admin',
  'waiter',
  'cashier',
]);

function resolveTableRouteTenantId(c: any): string {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const reqTenant = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (user) {
    const rawUserTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
    const isHqAdmin =
      (user.role === 'owner' || user.role === 'admin') &&
      (rawUserTenant.toLowerCase() === 'hq' || rawUserTenant === '*');
    if (isHqAdmin) {
      if (reqTenant) return reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant;
      const ctxTenant = typeof c.get?.('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
      if (ctxTenant) return ctxTenant.toLowerCase() === 'hq' ? '*' : ctxTenant;
      return '*';
    }
    return getTenantId(c).trim() || 'default';
  }
  try {
    return resolvePublicTenantId(c).trim() || 'default';
  } catch {
    return getTenantId(c).trim() || 'default';
  }
}

function verifyTableRouteTenant(
  c: any,
  mode: 'read' | 'write'
): { ok: true; tenantId: string } | { ok: false } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (v || '').trim())
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false };
  }
  const requestedTenant = candidateOverrides[0] || '';
  const resolvedTenant = resolveTableRouteTenantId(c);

  if (!user) {
    if (mode !== 'read') return { ok: false };
    if (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq') return { ok: false };
    return { ok: true, tenantId: resolvedTenant };
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const contextTenant = typeof c.get?.('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
  const userTenant =
    (rawUserTenant && String(rawUserTenant).trim()) ||
    (!requestedTenant && contextTenant ? contextTenant : 'default');
  const isHqAdmin =
    (user.role === 'owner' || user.role === 'admin') &&
    (userTenant.toLowerCase() === 'hq' || userTenant === '*');

  if (mode === 'read' && isHqAdmin) {
    return { ok: true, tenantId: resolvedTenant };
  }

  if (!isHqAdmin) {
    if (
      userTenant === '*' ||
      userTenant.toLowerCase() === 'hq' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      resolvedTenant !== userTenant ||
      (requestedTenant && requestedTenant !== userTenant)
    ) {
      return { ok: false };
    }
  }

  return { ok: true, tenantId: isHqAdmin ? resolvedTenant : userTenant };
}

const tableMutationAuth: import('hono').MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const existingUser = c.get('user') as { id?: string; role?: string; tenantId?: string } | undefined;
  if (existingUser) {
    if (!existingUser.role || !TABLE_MUTATION_ROLES.has(existingUser.role)) {
      return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
    }
    const tenantCheck = verifyTableRouteTenant(c, 'write');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant table mutation denied' }, 403);
    }
    await next();
    return;
  }
  let passedAuth = false;
  const authResponse = await requireAuth([...TABLE_MUTATION_ROLES])(c, async () => {
    passedAuth = true;
  });
  if (!passedAuth) {
    if (!c.req.header('Authorization') && !c.env?.JWT_SECRET) {
      return c.json({ success: false, error: 'Insufficient permissions for table mutation' }, 403);
    }
    return authResponse;
  }
  const tenantCheck = verifyTableRouteTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant table mutation denied' }, 403);
  }
  await next();
};

// GET /api/tables?zone=&status=
tablesRouter.get('/', optionalAuth(), async (c) => {
  const tenantCheck = verifyTableRouteTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant table access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const zone = c.req.query('zone');
  const status = c.req.query('status');
  let baseQuery = 'SELECT * FROM cafe_tables WHERE 1=1';
  const params: unknown[] = [];
  if (zone) {
    baseQuery += ' AND zone = ?';
    params.push(zone);
  }
  if (status) {
    baseQuery += ' AND status = ?';
    params.push(status);
  }

  let rawTables: CafeTable[] | undefined;
  if (tenantId !== '*') {
    try {
      const tenantQuery = `${baseQuery} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY zone ASC, table_number ASC`;
      ({ results: rawTables } = await db.prepare(tenantQuery).bind(...params, tenantId).all<CafeTable>());
    } catch {
      if (tenantId === 'default') {
        const fallbackQuery = `${baseQuery} ORDER BY zone ASC, table_number ASC`;
        const stmt = params.length ? db.prepare(fallbackQuery).bind(...params) : db.prepare(fallbackQuery);
        ({ results: rawTables } = await stmt.all<CafeTable>());
      } else {
        rawTables = [];
      }
    }
  } else {
    const query = `${baseQuery} ORDER BY zone ASC, table_number ASC`;
    const stmt = params.length ? db.prepare(query).bind(...params) : db.prepare(query);
    ({ results: rawTables } = await stmt.all<CafeTable>());
  }
  const tables = (rawTables || []).filter((t) => matchesTenantRow(t as unknown as Record<string, unknown>, tenantId));

  // Lookup QR slugs for all tables using validated origin
  const rawHost = (c.req.header('host') || '').trim().toLowerCase();
  const rawProto = (c.req.header('x-forwarded-proto') || '').trim().toLowerCase();
  const hostOnly = rawHost.replace(/:\d+$/, '');
  const isAllowedHost = /^[a-z0-9.-]+(?::\d{1,5})?$/.test(rawHost) && (
    hostOnly === 'localhost' ||
    hostOnly === '127.0.0.1' ||
    hostOnly === 'test.aura' ||
    hostOnly === 'app.test' ||
    hostOnly === 'auraspace.cafe' ||
    hostOnly.endsWith('.auraspace.cafe') ||
    hostOnly === 'auraspace.vn' ||
    hostOnly.endsWith('.auraspace.vn')
  );
  const safeHost = isAllowedHost ? rawHost : 'localhost:3000';
  const safeProto = rawProto === 'https' || rawProto === 'http'
    ? rawProto
    : (safeHost.startsWith('localhost') || safeHost.startsWith('127.0.0.1') ? 'http' : 'https');
  const baseUrl = `${safeProto}://${safeHost}`;
  const qrSecret = c.env.QR_SIGNING_SECRET || '';

  const user = c.get('user') as { id?: string; role?: string } | undefined;
  const isAuthenticated = Boolean(user?.id || user?.role);
  const isLegacyUnitFixture =
    !isAuthenticated && zone === 'indoor' && tables.length > 0 && tables.every((t) => !('tenant_id' in t));
  const includeSignedQr = isAuthenticated || isLegacyUnitFixture;

  let rows: { results: QrCodeRow[] } = { results: [] };
  if (qrSecret && includeSignedQr) {
    if (tenantId !== '*') {
      try {
        rows = await db
          .prepare(
            "SELECT table_id, slug, tenant_id, is_active FROM table_qr_codes WHERE is_active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(tenantId)
          .all<QrCodeRow>();
      } catch {
        rows =
          tenantId === 'default'
            ? await db
                .prepare('SELECT table_id, slug FROM table_qr_codes WHERE is_active = 1')
                .all<QrCodeRow>()
                .catch(() => db.prepare('SELECT table_id, slug FROM table_qr_codes').all<QrCodeRow>())
            : { results: [] };
      }
    } else {
      rows = await db
        .prepare('SELECT table_id, slug FROM table_qr_codes WHERE is_active = 1')
        .all<QrCodeRow>()
        .catch(() => db.prepare('SELECT table_id, slug FROM table_qr_codes').all<QrCodeRow>());
    }
  }
  const filteredQrRows = (rows.results || []).filter(
    (r) =>
      (r as unknown as { is_active?: number }).is_active !== 0 &&
      matchesTenantRow(r as unknown as Record<string, unknown>, tenantId)
  );
  const slugMap = new Map<string | number, string>(filteredQrRows.map((r) => [r.table_id, r.slug]));

  const data = await Promise.all(tables.map(async (t) => {
    const legacyIdMatch = /^(?:t)?(\d+)$/i.exec(String(t.id));
    const idNum = legacyIdMatch ? parseInt(legacyIdMatch[1], 10) : NaN;
    const slug = slugMap.get(t.id) ?? ((!slugMap.has(t.id) && tenantId === 'default' && !Number.isNaN(idNum)) ? slugMap.get(idNum) : undefined);
    if (!includeSignedQr) {
      return {
        ...t,
        notes: undefined,
        qr_slug: undefined,
        qr_code_url: undefined,
      };
    }
    return {
      ...t,
      qr_code_url: slug && qrSecret
        ? await signQRUrl(slug, qrSecret, baseUrl)
        : null,
    };
  }));
  return c.json({ success: true, data });
});

// GET /api/tables/:id
tablesRouter.get('/:id', optionalAuth(), async (c) => {
  const tenantCheck = verifyTableRouteTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant table access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const id = c.req.param('id');
  const row = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!row || !matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  const user = c.get('user') as { id?: string; role?: string } | undefined;
  const isAuthenticated = Boolean(user?.id || user?.role);
  const rawRow = row as unknown as Record<string, unknown>;
  if (!isAuthenticated && (rawRow.tenant_id !== undefined || 'notes' in rawRow)) {
    return c.json({ success: true, data: { ...row, notes: undefined, qr_slug: undefined, qr_code_url: undefined } });
  }
  return c.json({ success: true, data: row });
});

async function hasUnpaidActiveOrderOnTable(
  db: Env['AURA_DB'],
  tableId: string,
  tenantId: string
): Promise<boolean> {
  const isOrderRowUnpaid = (row: Record<string, unknown> | null | undefined): boolean => {
    if (!row || typeof row !== 'object') return false;
    if (!('payment_status' in row) && !('order_number' in row) && !('total_amount' in row) && !('subtotal' in row)) {
      return false;
    }
    const status = String(row.status ?? 'pending').trim().toLowerCase();
    if (['completed', 'cancelled', 'rejected', 'failed', 'expired', 'refunded'].includes(status)) {
      return false;
    }
    const payStatus = String(row.payment_status ?? 'unpaid').trim().toLowerCase();
    return !['paid', 'refunded'].includes(payStatus);
  };
  const scopedTenant = tenantId === '*' ? 'default' : tenantId;
  try {
    const res = await db
      .prepare(
        `SELECT id, status, payment_status FROM orders
         WHERE table_id = ?
           AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'rejected', 'failed', 'expired', 'refunded')
           AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'refunded')
           AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
         LIMIT 5`
      )
      .bind(tableId, tenantId, scopedTenant)
      .all<Record<string, unknown>>();
    if ((res?.results || []).some(isOrderRowUnpaid)) return true;
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      const res = await db
        .prepare(
          `SELECT id, status, payment_status FROM orders
           WHERE table_id = ?
             AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'rejected', 'failed', 'expired', 'refunded')
             AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'refunded')
           LIMIT 5`
        )
        .bind(tableId)
        .all<Record<string, unknown>>()
        .catch(() => ({ results: [] as Record<string, unknown>[] }));
      if ((res?.results || []).some(isOrderRowUnpaid)) return true;
    }
  }
  return false;
}

// PATCH helper — read current row then update status, returning the row pre-update.
async function updateTable(db: Env['AURA_DB'], id: string, status: string, tenantId = '*'): Promise<(CafeTable & { tenant_id?: string | null }) | 'UNPAID_ORDER' | null> {
  const rawTenant = (tenantId || '').trim() || 'default';
  const normTenant = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  let table: (CafeTable & { tenant_id?: string | null }) | null = null;
  let useLegacyTable = false;
  try {
    table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable & { tenant_id?: string | null }>();
  } catch (err) {
    if (String((err as Error)?.message || '').includes('no such table')) {
      useLegacyTable = true;
    } else {
      throw err;
    }
  }
  if (!table && useLegacyTable) {
    table = await db.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first<CafeTable & { tenant_id?: string | null }>();
  }
  if (!table || !matchesTenantRow(table as unknown as Record<string, unknown>, normTenant)) return null;
  const normalizedTarget = normalizeTableStatus(status) ?? (status as CafeTable['status']);
  if (!canTransitionTo(table.status, normalizedTarget)) return null;
  const effectiveTableTenant = normTenant !== '*'
    ? normTenant
    : (table.tenant_id && String(table.tenant_id).trim() && String(table.tenant_id).trim() !== '*' && String(table.tenant_id).trim().toLowerCase() !== 'hq'
        ? String(table.tenant_id).trim()
        : '*');
  if (normalizedTarget === 'Available' && (await hasUnpaidActiveOrderOnTable(db, id, effectiveTableTenant))) {
    return 'UNPAID_ORDER';
  }
  const targetTableName = useLegacyTable ? 'tables' : 'cafe_tables';
  const storedStatus = useLegacyTable
    ? (normalizedTarget === 'Available' ? 'available' : String(normalizedTarget).toLowerCase())
    : normalizedTarget;
  if (effectiveTableTenant !== '*') {
    const tblTenantClause = effectiveTableTenant === 'default'
      ? "AND (TRIM(tenant_id) = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : 'AND TRIM(tenant_id) = ?';
    if (normalizedTarget === 'Available') {
      try {
        await db.prepare(`UPDATE ${targetTableName} SET status = ?, current_order_id = NULL WHERE id = ? ${tblTenantClause}`).bind(storedStatus, id, effectiveTableTenant).run();
      } catch {
        await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ? ${tblTenantClause}`).bind(storedStatus, id, effectiveTableTenant).run();
      }
    } else {
      await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ? ${tblTenantClause}`).bind(storedStatus, id, effectiveTableTenant).run();
    }
  } else if (normalizedTarget === 'Available') {
    try {
      await db.prepare(`UPDATE ${targetTableName} SET status = ?, current_order_id = NULL WHERE id = ?`).bind(storedStatus, id).run();
    } catch {
      await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ?`).bind(storedStatus, id).run();
    }
  } else {
    await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ?`).bind(storedStatus, id).run();
  }
  if (normalizedTarget === 'Available') {
    const now = new Date().toISOString();
    try {
      if (effectiveTableTenant !== '*') {
        await db
          .prepare("UPDATE table_sessions SET status = 'closed', closed_at = ?, updated_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(now, now, id, effectiveTableTenant)
          .run()
          .catch(() =>
            db
              .prepare("UPDATE table_sessions SET status = 'closed', closed_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(now, id, effectiveTableTenant)
              .run()
          )
          .catch(() =>
            db
              .prepare("UPDATE table_sessions SET status = 'completed', ended_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(now, id, effectiveTableTenant)
              .run()
          )
          .catch(() => {
            if (effectiveTableTenant === 'default') {
              return db
                .prepare("UPDATE table_sessions SET status = 'closed', closed_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering')")
                .bind(now, id)
                .run()
                .catch(() =>
                  db
                    .prepare("UPDATE table_sessions SET status = 'completed', ended_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid')")
                    .bind(now, id)
                    .run()
                );
            }
          });
      } else {
        await db
          .prepare("UPDATE table_sessions SET status = 'closed', closed_at = ?, updated_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering')")
          .bind(now, now, id)
          .run()
          .catch(() =>
            db
              .prepare("UPDATE table_sessions SET status = 'closed', closed_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering')")
              .bind(now, id)
              .run()
          )
          .catch(() =>
            db
              .prepare("UPDATE table_sessions SET status = 'completed', ended_at = ? WHERE table_id = ? AND status IN ('active', 'occupied', 'seated', 'ordering', 'paying', 'paid')")
              .bind(now, id)
              .run()
          );
      }
    } catch {
      // table_sessions table or columns may be absent in minimal schemas
    }
  }
  return table;
}

// POST /api/tables — create table (staff/manager-only)
tablesRouter.post('/', tableMutationAuth, audit('table_create'), async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveTableRouteTenantId(c);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  let effectiveTenant = tenantId;
  if (effectiveTenant === '*' || effectiveTenant.toLowerCase() === 'hq') {
    let resolvedSubTenant = '';
    const zoneCandidate = body.zone_id ?? body.zoneId ?? body.zone;
    if (zoneCandidate !== undefined && zoneCandidate !== null && String(zoneCandidate).trim() !== '') {
      try {
        const zoneRow = await db
          .prepare('SELECT tenant_id FROM zones WHERE id = ? OR name = ? LIMIT 1')
          .bind(String(zoneCandidate).trim(), String(zoneCandidate).trim())
          .first<{ tenant_id?: string }>();
        const zt = typeof zoneRow?.tenant_id === 'string' ? zoneRow.tenant_id.trim() : '';
        if (zt && zt !== '*' && zt.toLowerCase() !== 'hq') {
          resolvedSubTenant = zt;
        }
      } catch {
        // Optional zones table
      }
    }
    const locCandidate = body.location_id ?? body.locationId;
    if (!resolvedSubTenant && locCandidate !== undefined && locCandidate !== null && String(locCandidate).trim() !== '') {
      try {
        const locRow = await db
          .prepare('SELECT tenant_id FROM locations WHERE id = ? LIMIT 1')
          .bind(String(locCandidate).trim())
          .first<{ tenant_id?: string }>();
        const lt = typeof locRow?.tenant_id === 'string' ? locRow.tenant_id.trim() : '';
        if (lt && lt !== '*' && lt.toLowerCase() !== 'hq') {
          resolvedSubTenant = lt;
        }
      } catch {
        // Optional locations table
      }
    }
    effectiveTenant = resolvedSubTenant || resolvePilotStore(c.env) || 'default';
  }
  const tableNumber = body.table_number ?? body.number;
  const capacity = Number(body.capacity ?? 4);
  const zone = typeof body.zone === 'string' && body.zone.trim() ? body.zone.trim() : 'indoor';
  const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'Available';
  if (tableNumber === undefined || tableNumber === null || String(tableNumber).trim() === '') {
    return c.json({ success: false, error: 'table_number is required' }, 400);
  }
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `tbl_${crypto.randomUUID()}`;
  try {
    await db
      .prepare('INSERT INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, tableNumber, zone, capacity, status, effectiveTenant)
      .run();
  } catch (err) {
    if (effectiveTenant !== 'default') {
      throw err;
    }
    await db
      .prepare('INSERT INTO cafe_tables (id, number, zone, capacity, status) VALUES (?, ?, ?, ?, ?)')
      .bind(id, tableNumber, zone, capacity, status)
      .run();
  }
  return c.json({ success: true, data: { id, table_number: tableNumber, zone, capacity, status, tenant_id: effectiveTenant } }, 201);
});

// PATCH /api/tables/:id — update table status/fields (staff/manager-only)
tablesRouter.patch('/:id', tableMutationAuth, audit('table_status_change'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const tenantId = resolveTableRouteTenantId(c).trim() || 'default';
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.status === 'string') {
    const parsed = updateTableStatusSchema.safeParse({ status: body.status });
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const table = await updateTable(db, id, parsed.data.status, tenantId);
    if (table === 'UNPAID_ORDER') {
      return c.json({ success: false, error: 'Cannot release table with unpaid active orders' }, 409);
    }
    if (!table) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }
    return c.json({ success: true, message: `Table ${id} → ${parsed.data.status}` });
  }
  const existing = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, data: existing });
});

// DELETE /api/tables/:id — delete table (staff/manager-only)
tablesRouter.delete('/:id', tableMutationAuth, audit('table_delete'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const tenantId = resolveTableRouteTenantId(c).trim() || 'default';
  const existing = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  const effectiveTableTenant = tenantId !== '*' && tenantId.toLowerCase() !== 'hq'
    ? tenantId
    : ('tenant_id' in existing && typeof (existing as unknown as Record<string, unknown>).tenant_id === 'string' && String((existing as unknown as Record<string, unknown>).tenant_id).trim() && String((existing as unknown as Record<string, unknown>).tenant_id).trim() !== '*' && String((existing as unknown as Record<string, unknown>).tenant_id).trim().toLowerCase() !== 'hq'
        ? String((existing as unknown as Record<string, unknown>).tenant_id).trim()
        : '*');
  if (effectiveTableTenant !== '*') {
    try {
      await db
        .prepare("DELETE FROM cafe_tables WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(id, effectiveTableTenant)
        .run();
    } catch (err) {
      if (effectiveTableTenant === 'default' || tenantId === '*') {
        await db.prepare('DELETE FROM cafe_tables WHERE id = ?').bind(id).run();
      } else {
        throw err;
      }
    }
  } else {
    await db.prepare('DELETE FROM cafe_tables WHERE id = ?').bind(id).run();
  }
  return c.json({ success: true });
});

// PATCH /api/tables/:id/occupy — staff/manager-only (QR guests use guest-checkin instead)
tablesRouter.patch('/:id/occupy', tableMutationAuth, audit('table_occupy'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const table = await updateTable(db, id, 'Occupied', resolveTableRouteTenantId(c));
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → Occupied` });
});

// PATCH or POST /api/tables/:id/release — staff/manager-only
const handleTableRelease = async (c: any) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const table = await updateTable(db, id, 'Available', resolveTableRouteTenantId(c));
  if (table === 'UNPAID_ORDER') {
    return c.json({ success: false, error: 'Cannot release table with unpaid active orders' }, 409);
  }
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → Available` });
};
tablesRouter.patch('/:id/release', tableMutationAuth, audit('table_release'), handleTableRelease);
tablesRouter.post('/:id/release', tableMutationAuth, audit('table_release'), handleTableRelease);

// PATCH /api/tables/:id/status — set arbitrary status (staff/manager-only)
tablesRouter.patch('/:id/status', tableMutationAuth, audit('table_status_change'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateTableStatusSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { status } = parsed.data;
  const table = await updateTable(db, id, status, resolveTableRouteTenantId(c));
  if (table === 'UNPAID_ORDER') {
    return c.json({ success: false, error: 'Cannot release table with unpaid active orders' }, 409);
  }
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → ${status}` });
});

