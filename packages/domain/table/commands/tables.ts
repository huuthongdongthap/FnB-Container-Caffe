/**
 * Tables — CRUD routes for cafe_tables
 * Extracted from worker/src/routes/tables.ts (tablesRouter portion).
 */
import { Hono } from 'hono';
import { updateTableStatusSchema, zodErrorResponse } from 'worker/src/lib/validators';
import { signQRUrl } from 'worker/src/tree/qr/signer';
import type { Env } from 'worker/src/types/env';
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { getTenantId } from 'worker/src/middleware/tenant';
import { audit } from 'worker/src/middleware/audit-log';
import type { CafeTable, QrCodeRow } from '../model/table-types';
import { canTransitionTo, normalizeTableStatus } from '../policies/status';

export const tablesRouter = new Hono<{ Bindings: Env }>();

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

// GET /api/tables?zone=&status=
tablesRouter.get('/', optionalAuth(), async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
  const zone = c.req.query('zone');
  const status = c.req.query('status');
  let query = 'SELECT * FROM cafe_tables WHERE 1=1';
  const params: unknown[] = [];
  if (zone) {
    query += ' AND zone = ?';
    params.push(zone);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY zone ASC, table_number ASC';

  const stmt = params.length
    ? db.prepare(query).bind(...params)
    : db.prepare(query);

  const { results: rawTables } = await stmt.all<CafeTable>();
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

  const rows = qrSecret
    ? await db.prepare('SELECT table_id, slug FROM table_qr_codes').all<QrCodeRow>()
    : { results: [] as QrCodeRow[] };
  const slugMap = new Map<string | number, string>(rows.results.map((r) => [r.table_id, r.slug]));

  const data = await Promise.all(tables.map(async (t) => {
    const legacyIdMatch = /^(?:t)?(\d+)$/i.exec(String(t.id));
    const idNum = legacyIdMatch ? parseInt(legacyIdMatch[1], 10) : NaN;
    const slug = slugMap.get(t.id) ?? (!Number.isNaN(idNum) ? slugMap.get(idNum) : undefined);
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
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  const row = await db.prepare(
    'SELECT * FROM cafe_tables WHERE id = ?',
  ).bind(id).first<CafeTable>();
  if (!row || !matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

// PATCH helper — read current row then update status, returning the row pre-update.
async function updateTable(db: Env['AURA_DB'], id: string, status: string, tenantId = '*') {
  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable & { tenant_id?: string | null }>();
  if (!table || !matchesTenantRow(table as unknown as Record<string, unknown>, tenantId)) {
    return null;
  }
  const normalizedTarget = normalizeTableStatus(status) ?? (status as CafeTable['status']);
  if (!canTransitionTo(table.status, normalizedTarget)) {
    return null;
  }
  if (tenantId !== '*') {
    const tblTenantClause = tenantId === 'default'
      ? "AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')"
      : 'AND tenant_id = ?';
    await db.prepare(`UPDATE cafe_tables SET status = ? WHERE id = ? ${tblTenantClause}`).bind(normalizedTarget, id, tenantId).run();
  } else {
    await db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind(normalizedTarget, id).run();
  }
  return table;
}

// PATCH /api/tables/:id/occupy — staff/manager-only (QR guests use guest-checkin instead)
tablesRouter.patch('/:id/occupy', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier']), audit('table_occupy'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const table = await updateTable(db, id, 'Occupied', getTenantId(c));
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → Occupied` });
});

// PATCH /api/tables/:id/release — staff/manager-only
tablesRouter.patch('/:id/release', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier']), audit('table_release'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const table = await updateTable(db, id, 'Available', getTenantId(c));
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → Available` });
});

// PATCH /api/tables/:id/status — set arbitrary status (staff/manager-only)
tablesRouter.patch('/:id/status', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier']), audit('table_status_change'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateTableStatusSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { status } = parsed.data;
  const table = await updateTable(db, id, status, getTenantId(c));
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → ${status}` });
});

