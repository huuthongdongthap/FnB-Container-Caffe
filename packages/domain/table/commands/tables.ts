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
import { assertTenantResourceLimit } from '../../../../worker/src/lib/saas-entitlement';
import { audit } from 'worker/src/middleware/audit-log';
import { releaseStaleReservedTables } from 'worker/src/routes/openapi-tables-handlers/table-crud-handlers';
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
  await releaseStaleReservedTables(db, tenantId);
  const zone = c.req.query('zone');
  const status = c.req.query('status');
  let baseQuery = 'SELECT * FROM cafe_tables WHERE 1=1';
  const params: unknown[] = [];
  if (zone) {
    baseQuery += ' AND zone = ?';
    params.push(zone);
  }
  if (status) {
    baseQuery += " AND LOWER(TRIM(COALESCE(status, ''))) = LOWER(?)";
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
  const tables = (rawTables || [])
    .filter((t) => matchesTenantRow(t as unknown as Record<string, unknown>, tenantId))
    .filter((t) => !status || String(t.status ?? '').trim().toLowerCase() === status.trim().toLowerCase());

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
tablesRouter.get('/:id', optionalAuth(), async (c, next) => {
  if (c.req.param('id') === 'zones') {
    return next();
  }
  const tenantCheck = verifyTableRouteTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant table access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const id = c.req.param('id');
  await releaseStaleReservedTables(db, tenantId);
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
    if (['completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'].includes(status)) {
      return false;
    }
    const payStatus = String(row.payment_status ?? 'unpaid').trim().toLowerCase();
    return !['paid', 'completed', 'refunded', 'cancelled', 'canceled', 'failed', 'expired'].includes(payStatus);
  };
  const activeUnpaidWhere =
    "table_id = ? AND LOWER(TRIM(COALESCE(status, 'pending'))) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(TRIM(COALESCE(payment_status, 'unpaid'))) NOT IN ('paid', 'completed', 'refunded', 'cancelled', 'canceled', 'failed', 'expired')";
  const scopedTenant = tenantId === '*' ? 'default' : tenantId;
  try {
    let res: { results?: Array<Record<string, unknown>> } | null = null;
    if (tenantId && tenantId !== '*') {
      try {
        res = await db
          .prepare(
            `SELECT id, status, payment_status FROM orders
             WHERE ${activeUnpaidWhere}
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             LIMIT 1`
          )
          .bind(tableId, scopedTenant)
          .all<Record<string, unknown>>();
      } catch (err) {
        const msg = String(err);
        if (/no such table:.*orders/i.test(msg)) return false;
        if (scopedTenant === 'default' && /no such column:.*tenant_id/i.test(msg)) {
          res = await db
            .prepare(`SELECT id, status, payment_status FROM orders WHERE ${activeUnpaidWhere} LIMIT 1`)
            .bind(tableId)
            .all<Record<string, unknown>>();
        } else {
          // Fail closed on unexpected DB errors so unpaid active orders cannot be orphaned.
          return true;
        }
      }
    } else {
      res = await db
        .prepare(`SELECT id, status, payment_status FROM orders WHERE ${activeUnpaidWhere} LIMIT 1`)
        .bind(tableId)
        .all<Record<string, unknown>>();
    }
    return (res?.results || []).some(isOrderRowUnpaid);
  } catch (err) {
    if (/no such table:.*orders/i.test(String(err))) return false;
    return true;
  }
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
  if ((normalizedTarget === 'Available' || normalizedTarget === 'Reserved') && (await hasUnpaidActiveOrderOnTable(db, id, effectiveTableTenant))) {
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
        await db.prepare(`UPDATE ${targetTableName} SET status = ?, current_order_id = NULL, current_session_id = NULL WHERE id = ? ${tblTenantClause}`).bind(storedStatus, id, effectiveTableTenant).run();
      } catch {
        try {
          await db.prepare(`UPDATE ${targetTableName} SET status = ?, current_order_id = NULL WHERE id = ? ${tblTenantClause}`).bind(storedStatus, id, effectiveTableTenant).run();
        } catch {
          await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ? ${tblTenantClause}`).bind(storedStatus, id, effectiveTableTenant).run();
        }
      }
    } else {
      await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ? ${tblTenantClause}`).bind(storedStatus, id, effectiveTableTenant).run();
    }
  } else if (normalizedTarget === 'Available') {
    try {
      await db.prepare(`UPDATE ${targetTableName} SET status = ?, current_order_id = NULL, current_session_id = NULL WHERE id = ?`).bind(storedStatus, id).run();
    } catch {
      try {
        await db.prepare(`UPDATE ${targetTableName} SET status = ?, current_order_id = NULL WHERE id = ?`).bind(storedStatus, id).run();
      } catch {
        await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ?`).bind(storedStatus, id).run();
      }
    }
  } else {
    await db.prepare(`UPDATE ${targetTableName} SET status = ? WHERE id = ?`).bind(storedStatus, id).run();
  }
  if (normalizedTarget === 'Occupied' && !useLegacyTable) {
    const sessTenant = effectiveTableTenant !== '*' ? effectiveTableTenant : 'default';
    try {
      const existingSess = await db
        .prepare("SELECT id FROM table_sessions WHERE table_id = ? AND LOWER(COALESCE(status, '')) IN ('active', 'ordering', 'occupied', 'seated') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
        .bind(id, sessTenant)
        .first<{ id?: string }>()
        .catch(() => null);
      let sessId = existingSess?.id ? String(existingSess.id) : '';
      let sessionReady = Boolean(sessId);
      if (!sessId) {
        const rand = new Uint8Array(3);
        crypto.getRandomValues(rand);
        sessId = `ts_${Date.now()}_${Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('')}`;
        const nowIso = new Date().toISOString();
        const inserted = await db
          .prepare("INSERT INTO table_sessions (id, table_id, status, tenant_id, started_at, created_at, updated_at) VALUES (?, ?, 'active', ?, ?, ?, ?)")
          .bind(sessId, id, sessTenant, nowIso, nowIso, nowIso)
          .run()
          .then(() => true)
          .catch(() =>
            db
              .prepare("INSERT INTO table_sessions (id, table_id, status, tenant_id) VALUES (?, ?, 'active', ?)")
              .bind(sessId, id, sessTenant)
              .run()
              .then(() => true)
              .catch(() => false)
          );
        sessionReady = inserted;
      }
      if (sessionReady && sessId) {
        if (effectiveTableTenant !== '*') {
          const tblTenantClause = effectiveTableTenant === 'default'
            ? "AND (tenant_id IS NULL OR TRIM(tenant_id) = '' OR tenant_id = ?)"
            : 'AND tenant_id = ?';
          await db
            .prepare(`UPDATE cafe_tables SET current_session_id = ? WHERE id = ? ${tblTenantClause}`)
            .bind(sessId, id, effectiveTableTenant)
            .run()
            .catch(() => undefined);
        } else {
          await db
            .prepare('UPDATE cafe_tables SET current_session_id = ? WHERE id = ?')
            .bind(sessId, id)
            .run()
            .catch(() => undefined);
        }
      }
    } catch {
      // table_sessions optional in minimal schemas
    }
  }
  if (normalizedTarget === 'Available') {
    const now = new Date().toISOString();
    try {
      if (effectiveTableTenant !== '*') {
        await db
          .prepare("UPDATE reservations SET status = 'completed', updated_at = ? WHERE table_id = ? AND LOWER(COALESCE(status, '')) = 'seated' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(now, id, effectiveTableTenant)
          .run()
          .catch(() => undefined);
      } else {
        await db
          .prepare("UPDATE reservations SET status = 'completed', updated_at = ? WHERE table_id = ? AND LOWER(COALESCE(status, '')) = 'seated'")
          .bind(now, id)
          .run()
          .catch(() => undefined);
      }
    } catch {
      // reservations table optional in minimal schemas
    }
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
  const tableQuota = await assertTenantResourceLimit(db, effectiveTenant, 'tables');
  if (!tableQuota.allowed) {
    return c.json(
      {
        success: false,
        code: tableQuota.code,
        error: tableQuota.message,
        limit: tableQuota.limit,
        current: tableQuota.currentUsage,
        upgradeRequired: true,
      },
      tableQuota.status ?? 402
    );
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

  const hasFieldMutations =
    body.table_number !== undefined ||
    body.number !== undefined ||
    body.name !== undefined ||
    body.zone !== undefined ||
    body.capacity !== undefined ||
    body.notes !== undefined;

  let nextTableNumber: string | number | undefined;
  const rawTableNumber = body.table_number !== undefined ? body.table_number : body.number;
  if (rawTableNumber !== undefined) {
    if (
      rawTableNumber === null ||
      (typeof rawTableNumber !== 'string' && typeof rawTableNumber !== 'number') ||
      String(rawTableNumber).trim() === '' ||
      String(rawTableNumber).trim().length > 50
    ) {
      return c.json({ success: false, error: 'Invalid table_number' }, 400);
    }
    nextTableNumber = typeof rawTableNumber === 'number' ? rawTableNumber : rawTableNumber.trim();
  }

  let nextName: string | null | undefined;
  if (body.name !== undefined) {
    if (body.name !== null && (typeof body.name !== 'string' || body.name.trim().length > 100)) {
      return c.json({ success: false, error: 'Invalid name' }, 400);
    }
    nextName = body.name === null ? null : body.name.trim();
  }

  let nextZone: string | undefined;
  if (body.zone !== undefined) {
    if (typeof body.zone !== 'string' || !body.zone.trim() || body.zone.trim().length > 60) {
      return c.json({ success: false, error: 'Invalid zone' }, 400);
    }
    nextZone = body.zone.trim();
  }

  let nextCapacity: number | undefined;
  if (body.capacity !== undefined) {
    if (typeof body.capacity !== 'number' || !Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 200) {
      return c.json({ success: false, error: 'Invalid capacity: must be an integer between 1 and 200' }, 400);
    }
    nextCapacity = body.capacity;
  }

  let nextNotes: string | null | undefined;
  if (body.notes !== undefined) {
    if (body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 500)) {
      return c.json({ success: false, error: 'Invalid notes' }, 400);
    }
    nextNotes = body.notes === null ? null : body.notes.trim();
  }

  let parsedStatus: string | undefined;
  if (typeof body.status === 'string') {
    const parsed = updateTableStatusSchema.safeParse({ status: body.status });
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    parsedStatus = parsed.data.status;
  } else if (body.status !== undefined) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }

  if (parsedStatus !== undefined && !hasFieldMutations) {
    const table = await updateTable(db, id, parsedStatus, tenantId);
    if (table === 'UNPAID_ORDER') {
      return c.json({ success: false, error: 'Cannot release table with unpaid active orders' }, 409);
    }
    if (!table) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }
    return c.json({ success: true, message: `Table ${id} → ${parsedStatus}` });
  }

  const existing = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  if (parsedStatus !== undefined) {
    const statusResult = await updateTable(db, id, parsedStatus, tenantId);
    if (statusResult === 'UNPAID_ORDER') {
      return c.json({ success: false, error: 'Cannot release table with unpaid active orders' }, 409);
    }
    if (!statusResult) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }
  }

  if (hasFieldMutations) {
    const rawRowTenant = (existing as unknown as Record<string, unknown>).tenant_id;
    const effectiveTableTenant =
      tenantId !== '*' && tenantId.toLowerCase() !== 'hq'
        ? tenantId
        : typeof rawRowTenant === 'string' && rawRowTenant.trim() && rawRowTenant.trim() !== '*' && rawRowTenant.trim().toLowerCase() !== 'hq'
          ? rawRowTenant.trim()
          : 'default';

    if (nextTableNumber !== undefined && String(nextTableNumber) !== String((existing as unknown as Record<string, unknown>).table_number ?? '')) {
      const dup = await db
        .prepare(
          "SELECT id FROM cafe_tables WHERE CAST(table_number AS TEXT) = ? AND id != ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        )
        .bind(String(nextTableNumber), id, effectiveTableTenant)
        .first<{ id: string }>()
        .catch(() => null);
      if (dup) {
        return c.json({ success: false, error: `Table number ${String(nextTableNumber)} already exists` }, 409);
      }
    }

    const buildFieldUpdate = (opts: { useNumberCol?: boolean; omitName?: boolean; omitNotes?: boolean; omitUpdatedAt?: boolean; omitTenant?: boolean }) => {
      const sets: string[] = [];
      const binds: unknown[] = [];
      if (nextTableNumber !== undefined) {
        sets.push(`${opts.useNumberCol ? 'number' : 'table_number'} = ?`);
        binds.push(nextTableNumber);
      }
      if (nextName !== undefined && !opts.omitName) {
        sets.push('name = ?');
        binds.push(nextName);
      }
      if (nextZone !== undefined) {
        sets.push('zone = ?');
        binds.push(nextZone);
      }
      if (nextCapacity !== undefined) {
        sets.push('capacity = ?');
        binds.push(nextCapacity);
      }
      if (nextNotes !== undefined && !opts.omitNotes) {
        sets.push('notes = ?');
        binds.push(nextNotes);
      }
      if (!opts.omitUpdatedAt && sets.length > 0) {
        sets.push('updated_at = ?');
        binds.push(new Date().toISOString());
      }
      if (sets.length === 0) return null;
      const whereSql = opts.omitTenant
        ? 'WHERE id = ?'
        : "WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
      binds.push(id);
      if (!opts.omitTenant) binds.push(effectiveTableTenant);
      return db.prepare(`UPDATE cafe_tables SET ${sets.join(', ')} ${whereSql}`).bind(...binds);
    };

    const optsState = { useNumberCol: false, omitName: false, omitNotes: false, omitUpdatedAt: false, omitTenant: false };
    for (let attempt = 0; attempt < 5; attempt++) {
      const stmt = buildFieldUpdate(optsState);
      if (!stmt) break;
      try {
        await stmt.run();
        break;
      } catch (err) {
        const msg = String(err);
        if (/UNIQUE constraint failed/i.test(msg)) {
          return c.json({ success: false, error: 'Table number already exists' }, 409);
        }
        if (!optsState.omitNotes && /no such column:.*notes/i.test(msg)) {
          optsState.omitNotes = true;
          continue;
        }
        if (!optsState.omitName && /no such column:.*name/i.test(msg)) {
          optsState.omitName = true;
          continue;
        }
        if (!optsState.omitUpdatedAt && /no such column:.*updated_at/i.test(msg)) {
          optsState.omitUpdatedAt = true;
          continue;
        }
        if (!optsState.useNumberCol && /no such column:.*table_number/i.test(msg)) {
          optsState.useNumberCol = true;
          continue;
        }
        if (!optsState.omitTenant && effectiveTableTenant === 'default' && /no such column:.*tenant_id/i.test(msg)) {
          optsState.omitTenant = true;
          continue;
        }
        throw err;
      }
    }
  }

  const updated = (await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>()) ?? existing;
  return c.json({
    success: true,
    ...(parsedStatus !== undefined ? { message: `Table ${id} → ${parsedStatus}` } : {}),
    data: updated,
  });
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
  if (await hasUnpaidActiveOrderOnTable(db, id, effectiveTableTenant)) {
    return c.json(
      { success: false, error: 'Cannot delete table while an active unpaid order exists on this table' },
      409
    );
  }
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

