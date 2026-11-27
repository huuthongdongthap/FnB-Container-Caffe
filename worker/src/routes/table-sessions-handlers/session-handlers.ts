import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { resolveOpenApiTablesTenant } from '../openapi-tables-handlers/helpers';
import {
  type TableSession,
  SESSION_STATUSES,
  makeSessionId,
  matchesTenantRow,
  hasExplicitTenantId,
  isTableAccessibleByTenant,
} from './types';

function matchesSessionTenant(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (!row) return false;
  if (hasExplicitTenantId(row)) {
    return matchesTenantRow(row, tenantId);
  }
  return matchesTenantRow(row, tenantId);
}

const endedSessionSql = "('closed', 'completed', 'no_show', 'abandoned', 'cancelled', 'canceled', 'expired')";
const sessionConflict = (error: unknown) => /malformed JSON|session-write-conflict/i.test(String(error));

interface SessionSchemaState {
  seatingTable: 'cafe_tables' | 'tables' | null;
  seatingMissing: Set<string>;
  sessionMissing: Set<string>;
}

async function resolveSeatingSchema(
  db: D1Database,
): Promise<{ seatingTable: 'cafe_tables' | 'tables' | null; seatingMissing: Set<string> }> {
  const seatingMissing = new Set<string>();
  let seatingTable: 'cafe_tables' | 'tables' | null = 'cafe_tables';
  try {
    await db.prepare('SELECT id FROM cafe_tables LIMIT 0').all();
  } catch (error) {
    if (!/no such table:\s*cafe_tables\b/i.test(String(error))) throw error;
    try {
      await db.prepare('SELECT id FROM tables LIMIT 0').all();
      seatingTable = 'tables';
    } catch (legacyError) {
      if (/no such table:\s*tables\b/i.test(String(legacyError))) {
        return { seatingTable: null, seatingMissing };
      }
      throw legacyError;
    }
  }
  for (const field of ['tenant_id', 'is_active', 'current_session_id', 'current_order_id', 'updated_at']) {
    try {
      await db.prepare(`SELECT ${field} FROM ${seatingTable} LIMIT 0`).all();
    } catch (error) {
      if (/no such column:/i.test(String(error))) seatingMissing.add(field);
      else throw error;
    }
  }
  return { seatingTable, seatingMissing };
}

// Retry only missing legacy table_sessions columns; a failed claim never falls back.
async function atomicSessionWrite(
  db: D1Database,
  needsSeatingTable: boolean,
  build: (schema: SessionSchemaState) => { claim: D1PreparedStatement; after: D1PreparedStatement[] },
): Promise<void> {
  const seating = needsSeatingTable
    ? await resolveSeatingSchema(db)
    : { seatingTable: null, seatingMissing: new Set<string>() };
  const schema: SessionSchemaState = {
    ...seating,
    sessionMissing: new Set<string>(),
  };
  for (;;) {
    try {
      const { claim, after } = build(schema);
      if (typeof db.batch === 'function') {
        await db.batch([claim, sessionClaimAssertion(db), ...after]);
      } else {
        const result = await claim.run();
        if (result?.meta && typeof result.meta.changes === 'number' && result.meta.changes === 0) {
          throw new Error('session-write-conflict');
        }
        for (const stmt of after) {
          await stmt.run();
        }
      }
      return;
    } catch (error) {
      const message = String(error);
      const column = message.match(/(?:no such column:\s*|has no column named\s+)(?:\w+\.)?(\w+)/i)?.[1];
      if (!column || schema.sessionMissing.has(column) || schema.sessionMissing.size >= 20) throw error;
      schema.sessionMissing.add(column);
    }
  }
}

function sessionClaimAssertion(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('session-write-conflict') END");
}

function sessionTableWrite(
  db: D1Database, schema: SessionSchemaState, tableId: string, tenant: string, sessionId: string, release: boolean,
): D1PreparedStatement | null {
  if (!schema.seatingTable) return null;
  const table = schema.seatingTable;
  const tableScoped = !schema.seatingMissing.has('tenant_id');
  const sessionScoped = !schema.sessionMissing.has('tenant_id');
  const scope = tableScoped ? " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?" : '';
  const binds: unknown[] = [release ? (table === 'tables' ? 'available' : 'Available') : 'Occupied'];
  let fields = 'status = ?';
  if (!schema.seatingMissing.has('current_session_id')) {
    fields += ', current_session_id = ?';
    binds.push(release ? null : sessionId);
  }
  if (release && !schema.seatingMissing.has('current_order_id')) fields += ', current_order_id = NULL';
  if (!schema.seatingMissing.has('updated_at')) {
    fields += ', updated_at = ?';
    binds.push(new Date().toISOString());
  }
  binds.push(tableId);
  if (tableScoped) binds.push(tenant);
  // Do not release a table that another session already occupies or owns.
  const ownerGuard = release && !schema.seatingMissing.has('current_session_id')
    ? " AND (current_session_id IS NULL OR current_session_id = '' OR current_session_id = ?)"
    : '';
  if (ownerGuard) binds.push(sessionId);
  const guard = release ? ` AND NOT EXISTS (SELECT 1 FROM table_sessions s WHERE s.table_id = ?
    AND LOWER(COALESCE(s.status, 'active')) NOT IN ${endedSessionSql}${sessionScoped ? " AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?" : ''})` : '';
  if (release) {
    binds.push(tableId);
    if (sessionScoped) binds.push(tenant);
  }
  return db.prepare(`UPDATE ${table} SET ${fields} WHERE id = ?${scope}${ownerGuard}${guard}`).bind(...binds);
}

async function mutateSessionAtomically(
  db: D1Database, session: TableSession, tenant: string, values: Record<string, unknown>, release: boolean,
): Promise<void> {
  const row = session as unknown as Record<string, unknown>;
  await atomicSessionWrite(db, release, (schema) => {
    if (schema.sessionMissing.has('tenant_id') && tenant !== 'default') {
      throw new Error('Tenant isolation requires tenant_id');
    }
    const fields = Object.entries(values).filter(([key]) => !schema.sessionMissing.has(key));
    if (schema.sessionMissing.has('closed_at') && values.closed_at != null && !schema.sessionMissing.has('ended_at')) {
      fields.push(['ended_at', values.closed_at]);
    }
    const guard = ['id IS ?', 'table_id IS ?', 'status IS ?'];
    const binds: unknown[] = [...fields.map(([, value]) => value), session.id, session.table_id, session.status];
    if ('updated_at' in row && !schema.sessionMissing.has('updated_at')) { guard.push('updated_at IS ?'); binds.push(row.updated_at); }
    if ('tenant_id' in row && !schema.sessionMissing.has('tenant_id')) {
      guard.push("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"); binds.push(tenant);
    }
    const tableStmt = release ? sessionTableWrite(db, schema, session.table_id, tenant, session.id, true) : null;
    return {
      claim: db.prepare(`UPDATE table_sessions SET ${fields.map(([key]) => `${key} = ?`).join(', ')} WHERE ${guard.join(' AND ')}`).bind(...binds),
      after: tableStmt ? [tableStmt] : [],
    };
  });
}

export function registerSessionHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/table-sessions — list sessions, filterable by table / status
  router.get('/', async (c) => {
    const db = c.env.AURA_DB;
    const tableId = c.req.query('table_id');
    const status = c.req.query('status');

    let query = 'SELECT * FROM table_sessions WHERE 1=1';
    const params: unknown[] = [];

    if (tableId) { query += ' AND table_id = ?'; params.push(tableId); }
    if (status) {
      if (!(SESSION_STATUSES as readonly string[]).includes(status)) {
        return c.json({ success: false, error: `Invalid status. Expected one of: ${SESSION_STATUSES.join(', ')}` }, 400);
      }
      query += ' AND status = ?'; params.push(status);
    }

    const tenantCheck = resolveOpenApiTablesTenant(c, 'read');
    if (!tenantCheck.ok) return tenantCheck.response;
    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const baseQuery = query;
    const baseParams = [...params];
    let scopedBaseQuery = baseQuery;
    const scopedParams = [...baseParams];
    if (tenantId !== '*') {
      scopedBaseQuery += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
      scopedParams.push(tenantId);
    }
    let results: TableSession[] = [];
    try {
      const scopedQuery = `${scopedBaseQuery} ORDER BY opened_at DESC LIMIT 200`;
      const stmt = scopedParams.length ? db.prepare(scopedQuery).bind(...scopedParams) : db.prepare(scopedQuery);
      const res = await stmt.all<TableSession>();
      results = res.results || [];
    } catch {
      try {
        const scopedStartedQuery = `${scopedBaseQuery} ORDER BY started_at DESC LIMIT 200`;
        const stmt = scopedParams.length ? db.prepare(scopedStartedQuery).bind(...scopedParams) : db.prepare(scopedStartedQuery);
        const res = await stmt.all<TableSession>();
        results = res.results || [];
      } catch {
        try {
          const fallbackQuery = `${baseQuery} ORDER BY opened_at DESC LIMIT 200`;
          const stmt = baseParams.length ? db.prepare(fallbackQuery).bind(...baseParams) : db.prepare(fallbackQuery);
          const res = await stmt.all<TableSession>();
          results = res.results || [];
        } catch {
          try {
            const fallbackQuery = `${baseQuery} ORDER BY started_at DESC LIMIT 200`;
            const stmt = baseParams.length ? db.prepare(fallbackQuery).bind(...baseParams) : db.prepare(fallbackQuery);
            const res = await stmt.all<TableSession>();
            results = res.results || [];
          } catch {
            results = [];
          }
        }
      }
    }
    results = results.filter((s) => {
      const row = s as unknown as Record<string, unknown>;
      if (hasExplicitTenantId(row)) {
        return matchesTenantRow(row, tenantId);
      }
      return true;
    });
    try {
      const tablesRes = await db.prepare('SELECT * FROM cafe_tables').all<Record<string, unknown>>();
      const allTables = tablesRes.results || [];
      const foreignTableIds = new Set(
        allTables
          .filter((t) => !matchesTenantRow(t, tenantId))
          .map((t) => String(t.id))
      );
      if (foreignTableIds.size > 0) {
        results = results.filter((s) => {
          const row = s as unknown as Record<string, unknown>;
          if (hasExplicitTenantId(row)) {
            return matchesTenantRow(row, tenantId);
          }
          return !foreignTableIds.has(String(s.table_id));
        });
      }
      if (tenantId !== 'default' && tenantId !== '*') {
        const allowedTableIds = new Set(
          allTables
            .filter((t) => matchesTenantRow(t, tenantId))
            .map((t) => String(t.id))
        );
        results = results.filter((s) => {
          const row = s as unknown as Record<string, unknown>;
          if (hasExplicitTenantId(row) && matchesTenantRow(row, tenantId)) {
            return true;
          }
          return allowedTableIds.has(String(s.table_id));
        });
      }
    } catch {
      if (tenantId !== 'default' && tenantId !== '*') {
        results = results.filter((s) => {
          const row = s as unknown as Record<string, unknown>;
          return hasExplicitTenantId(row) && matchesTenantRow(row, tenantId);
        });
      }
    }
    return c.json({ success: true, data: results });
  });

  // GET /api/table-sessions/stats — session statistics scoped by tenant
  router.get('/stats', async (c) => {
    const tenantCheck = resolveOpenApiTablesTenant(c, 'read');
    if (!tenantCheck.ok) return tenantCheck.response;
    const db = c.env.AURA_DB;
    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    let rows: Record<string, unknown>[] = [];
    try {
      const stmt = tenantId !== '*'
        ? db.prepare("SELECT * FROM table_sessions WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?").bind(tenantId)
        : db.prepare('SELECT * FROM table_sessions');
      const res = await stmt.all<Record<string, unknown>>();
      rows = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
    } catch {
      rows = [];
    }
    let tableRows: Record<string, unknown>[] = [];
    try {
      const tblStmt = tenantId !== '*'
        ? db.prepare("SELECT * FROM cafe_tables WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?").bind(tenantId)
        : db.prepare('SELECT * FROM cafe_tables');
      const tblRes = await tblStmt.all<Record<string, unknown>>();
      tableRows = (tblRes.results || []).filter((r) => matchesTenantRow(r, tenantId));
    } catch {
      try {
        const legacyStmt = tenantId !== '*'
          ? db.prepare("SELECT * FROM tables WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?").bind(tenantId)
          : db.prepare('SELECT * FROM tables');
        const legacyRes = await legacyStmt.all<Record<string, unknown>>();
        tableRows = (legacyRes.results || []).filter((r) => matchesTenantRow(r, tenantId));
      } catch {
        tableRows = [];
      }
    }
    const activeStatuses = new Set(['active', 'seated', 'occupied', 'ordering', 'paying', 'paid']);
    const activeSessions = rows.filter((r) => activeStatuses.has(String(r.status || '').toLowerCase())).length;
    const closedSessions = rows.filter((r) => ['closed', 'completed'].includes(String(r.status || '').toLowerCase())).length;
    const settledRevenueStatuses = new Set(['closed', 'completed', 'paid']);
    const totalRevenue = rows
      .filter((r) => settledRevenueStatuses.has(String(r.status || '').toLowerCase()))
      .reduce((acc, r) => acc + Math.max(0, Number(r.total_amount ?? 0)), 0);
    const totalTables = tableRows.length;
    const statsPayload = {
      total_sessions: rows.length,
      active_sessions: activeSessions,
      closed_sessions: closedSessions,
      total_tables: totalTables,
      total_revenue: totalRevenue,
      totalSessions: rows.length,
      activeSessions,
      closedSessions,
      totalTables,
      totalRevenue,
    };
    return c.json({
      success: true,
      stats: statsPayload,
      data: statsPayload,
    });
  });

  // GET /api/table-sessions/:id
  router.get('/:id', async (c) => {
    const tenantCheck = resolveOpenApiTablesTenant(c, 'read');
    if (!tenantCheck.ok) return tenantCheck.response;
    const db = c.env.AURA_DB;
    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const id = c.req.param('id');
    let session: TableSession | null = null;
    try {
      session = (await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first()) as TableSession | null;
    } catch {
      session = null;
    }
    const sessionRow = session as unknown as Record<string, unknown> | null;
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (sessionRow && hasExplicitTenantId(sessionRow)) {
      if (!matchesTenantRow(sessionRow, tenantId)) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (session.table_id) {
      if (!(await isTableAccessibleByTenant(db, String(session.table_id), tenantId))) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (!matchesTenantRow(sessionRow, tenantId)) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    return c.json({ success: true, data: session });
  });

  // POST /api/table-sessions — open a session for a table
  router.post('/', async (c) => {
    const tenantCheck = resolveOpenApiTablesTenant(c, 'write');
    if (!tenantCheck.ok) return tenantCheck.response;
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const tableId = String(body.table_id || '').trim();
    if (!tableId) {
      return c.json({ success: false, error: 'table_id is required' }, 400);
    }
    if (body.customer_name !== undefined && body.customer_name !== null) {
      if (typeof body.customer_name !== 'string' || String(body.customer_name).length > 200) {
        return c.json({ success: false, error: 'customer_name must be a string of at most 200 characters' }, 400);
      }
    }
    if (body.covers !== undefined && body.covers !== null) {
      const covers = Number(body.covers);
      if (!Number.isInteger(covers) || covers < 1) {
        return c.json({ success: false, error: 'covers must be a positive integer' }, 400);
      }
    }
    if (body.guest_count !== undefined && body.guest_count !== null) {
      const guestCount = Number(body.guest_count);
      if (!Number.isInteger(guestCount) || guestCount < 1) {
        return c.json({ success: false, error: 'guest_count must be an integer >= 1' }, 400);
      }
    }

    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;

    // Refuse to open a second open session on the same table (active, ordering, paid all count).
    let existing: { id: string; tenant_id?: string | null } | null = null;
    try {
      const candidate = await db.prepare(
        "SELECT id, tenant_id FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid')) AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(tableId, tenantId, tenantId).first<{ id: string; tenant_id?: string | null }>();
      if (candidate && matchesSessionTenant(candidate as unknown as Record<string, unknown>, tenantId)) {
        existing = candidate;
      } else if (candidate) {
        const res = await db.prepare(
          "SELECT * FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
        ).bind(tableId).all<{ id: string; table_id?: string; status?: string; tenant_id?: string | null }>().catch(() => ({ results: [] }));
        existing = (res.results || []).find((r) =>
          (r.table_id === undefined || String(r.table_id) === tableId) &&
          (r.status === undefined || ['active', 'ordering', 'paid'].includes(String(r.status))) &&
          matchesSessionTenant(r as unknown as Record<string, unknown>, tenantId)
        ) ?? null;
      }
    } catch {
      try {
        const res = await db.prepare(
          "SELECT * FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
        ).bind(tableId).all<{ id: string; table_id?: string; status?: string; tenant_id?: string | null }>();
        const rows = (res.results || []).filter((r) =>
          (r.table_id === undefined || String(r.table_id) === tableId) &&
          (r.status === undefined || ['active', 'ordering', 'paid'].includes(String(r.status)))
        );
        if (rows.length > 0) {
          existing = rows.find((r) => matchesSessionTenant(r as unknown as Record<string, unknown>, tenantId)) ?? null;
        } else {
          const single = await db.prepare(
            "SELECT * FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
          ).bind(tableId).first<{ id: string; tenant_id?: string | null }>().catch(() => null);
          if (single && matchesSessionTenant(single as unknown as Record<string, unknown>, tenantId)) {
            existing = single;
          }
        }
      } catch {
        try {
          const single = await db.prepare(
            "SELECT id FROM table_sessions WHERE table_id = ? AND (status = 'active' OR status IN ('ordering', 'paid'))"
          ).bind(tableId).first<{ id: string; tenant_id?: string | null }>();
          if (single && matchesSessionTenant(single as unknown as Record<string, unknown>, tenantId)) {
            existing = single;
          }
        } catch {
          existing = null;
        }
      }
    }
    if (existing) {
      if (!(await isTableAccessibleByTenant(db, tableId, tenantId))) {
        return c.json({ success: false, error: 'Table not found' }, 404);
      }
      return c.json(
        { success: false, error: `Table ${tableId} already has an active session (${existing.id}). Close it first.` },
        409
      );
    }

    // Verify the table exists and belongs to the current tenant.
    let table: Record<string, unknown> | null = null;
    if (tenantId !== '*') {
      try {
        table = await db.prepare(
          "SELECT * FROM cafe_tables WHERE id = ? AND (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')))"
        ).bind(tableId, tenantId, tenantId).first<Record<string, unknown>>();
      } catch {
        if (tenantId === 'default') {
          table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(tableId).first<Record<string, unknown>>().catch(() => null);
        }
      }
    } else {
      table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(tableId).first<Record<string, unknown>>().catch(() => null);
    }
    if (!table || !matchesTenantRow(table, tenantId)) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }

    const tableStatus = String(table.status || '').trim().toLowerCase();
    const tableIsActive = table.is_active;
    if (
      ['maintenance', 'out_of_order', 'disabled'].includes(tableStatus) ||
      tableIsActive === 0 ||
      tableIsActive === false
    ) {
      return c.json({ success: false, error: `Table is not available for seating (status: ${table.status || 'inactive'})` }, 400);
    }

    const id = makeSessionId();
    const now = new Date().toISOString();

    const rawTableTenant = typeof table.tenant_id === 'string' ? table.tenant_id.trim() : '';
    const inheritedTableTenant =
      rawTableTenant && rawTableTenant !== '*' && rawTableTenant.toLowerCase() !== 'hq'
        ? rawTableTenant
        : 'default';
    const effectiveSessionTenant = tenantId !== '*' ? tenantId : inheritedTableTenant;
    try {
      await atomicSessionWrite(db, true, (schema) => {
        if (schema.sessionMissing.has('tenant_id') && effectiveSessionTenant !== 'default') {
          throw new Error('Tenant isolation requires tenant_id');
        }
        const values: Record<string, unknown> = {
          id, table_id: tableId, customer_id: body.customer_id || null,
          customer_name: body.customer_name || null, customer_phone: body.customer_phone || null,
          status: 'active', notes: body.notes || null, tenant_id: effectiveSessionTenant,
          opened_at: now, started_at: now, created_at: now, updated_at: now,
        };
        const entries = Object.entries(values).filter(([key]) => !schema.sessionMissing.has(key));
        const sessionScoped = !schema.sessionMissing.has('tenant_id');
        const tableScoped = !schema.seatingMissing.has('tenant_id');
        const binds: unknown[] = [...entries.map(([, value]) => value)];
        let tableGuard = '1 = 1';
        if (schema.seatingTable) {
          const activePointerGuard = schema.seatingMissing.has('current_session_id')
            ? ''
            : `AND (t.current_session_id IS NULL OR t.current_session_id = '' OR NOT EXISTS (
                SELECT 1 FROM table_sessions cs WHERE cs.id = t.current_session_id
                  AND LOWER(COALESCE(cs.status, 'active')) NOT IN ${endedSessionSql}
              ))`;
          tableGuard = `EXISTS (SELECT 1 FROM ${schema.seatingTable} t WHERE t.id = ?
            ${tableScoped ? "AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?" : ''}
            ${schema.seatingMissing.has('is_active') ? '' : 'AND COALESCE(t.is_active, 1) <> 0'}
            ${activePointerGuard}
            AND LOWER(COALESCE(t.status, 'available')) NOT IN ('maintenance', 'out_of_order', 'disabled'))`;
          binds.push(tableId);
          if (tableScoped) binds.push(effectiveSessionTenant);
        }
        binds.push(tableId);
        if (sessionScoped) binds.push(effectiveSessionTenant);
        const tableStmt = sessionTableWrite(db, schema, tableId, effectiveSessionTenant, id, false);
        return {
          claim: db.prepare(`INSERT INTO table_sessions (${entries.map(([key]) => key).join(', ')})
            SELECT ${entries.map(() => '?').join(', ')} WHERE ${tableGuard}
            AND NOT EXISTS (SELECT 1 FROM table_sessions s WHERE s.table_id = ?
              AND LOWER(COALESCE(s.status, 'active')) NOT IN ${endedSessionSql}
              ${sessionScoped ? "AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?" : ''})`).bind(...binds),
          after: tableStmt ? [tableStmt] : [],
        };
      });
    } catch (error) {
      return c.json({ success: false, error: sessionConflict(error)
        ? 'Table availability changed; refresh before retrying' : 'Failed to create table session' }, sessionConflict(error) ? 409 : 500);
    }

    let session: TableSession | null = null;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first<TableSession>();
    } catch {
      session = {
        id,
        table_id: tableId,
        customer_id: (body.customer_id as string) || null,
        customer_name: (body.customer_name as string) || null,
        customer_phone: (body.customer_phone as string) || null,
        status: 'active',
        opened_at: now,
        closed_at: null,
        order_count: 0,
        total_amount: 0,
        notes: (body.notes as string) || null,
        created_at: now,
        updated_at: now,
      };
    }

    return c.json({ success: true, data: session }, 201);
  });

  // PATCH /api/table-sessions/:id and /:id/status — transition status
  const handlePatchSession = async (c: any) => {
    const tenantCheck = resolveOpenApiTablesTenant(c, 'write');
    if (!tenantCheck.ok) return tenantCheck.response;
    const db = c.env.AURA_DB;
    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;

    let session: TableSession | null = null;
    try {
      session = (await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first()) as TableSession | null;
    } catch {
      session = null;
    }
    const sessionRow = session as unknown as Record<string, unknown> | null;
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (sessionRow && hasExplicitTenantId(sessionRow)) {
      if (!matchesTenantRow(sessionRow, tenantId)) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (session.table_id) {
      if (!(await isTableAccessibleByTenant(db, String(session.table_id), tenantId))) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (!matchesTenantRow(sessionRow, tenantId)) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    // Reject updates on terminal sessions (closed, completed, no_show, or abandoned)
    const terminalStatuses = ['closed', 'completed', 'no_show', 'abandoned'];
    if (terminalStatuses.includes(String(session.status || ''))) {
      return c.json({ success: false, error: 'Session already ended' }, 409);
    }

    const allowedStatuses = [...SESSION_STATUSES, 'seated', 'occupied', 'paying', 'completed'];
    const currentStatus = String(session.status || 'active').trim();
    const nextStatus = String(body.status || '').trim();
    if (nextStatus && !allowedStatuses.includes(nextStatus)) {
      return c.json(
        { success: false, error: `Invalid status. Expected one of: ${SESSION_STATUSES.join(', ')}` },
        400
      );
    }
    if (nextStatus && nextStatus !== currentStatus) {
      if (currentStatus === 'paid' && ['active', 'seated', 'occupied', 'ordering', 'paying', 'no_show'].includes(nextStatus)) {
        return c.json({ success: false, error: `Invalid session state transition: ${currentStatus} -> ${nextStatus}` }, 409);
      }
      if (currentStatus === 'paying' && ['active', 'seated', 'occupied', 'ordering'].includes(nextStatus)) {
        return c.json({ success: false, error: `Invalid session state transition: ${currentStatus} -> ${nextStatus}` }, 409);
      }
      if (currentStatus === 'ordering' && ['active', 'seated', 'occupied'].includes(nextStatus)) {
        return c.json({ success: false, error: `Invalid session state transition: ${currentStatus} -> ${nextStatus}` }, 409);
      }
      if (nextStatus === 'no_show' && (currentStatus === 'ordering' || currentStatus === 'paying' || currentStatus === 'paid' || Number((session as any).order_count ?? (session as any).orders_count ?? 0) > 0)) {
        return c.json({ success: false, error: 'Cannot mark session with orders as no_show' }, 409);
      }
    }
    if (body.guest_count !== undefined && body.guest_count !== null) {
      const guestCount = Number(body.guest_count);
      if (!Number.isFinite(guestCount) || !Number.isInteger(guestCount) || guestCount < 1) {
        return c.json({ success: false, error: 'guest_count must be an integer >= 1' }, 400);
      }
    }
    if (body.covers !== undefined && body.covers !== null) {
      const covers = Number(body.covers);
      if (!Number.isFinite(covers) || !Number.isInteger(covers) || covers < 1) {
        return c.json({ success: false, error: 'covers must be a positive integer' }, 400);
      }
    }
    if (body.total_amount !== undefined && body.total_amount !== null) {
      const totalAmount = Number(body.total_amount);
      if (!Number.isFinite(totalAmount) || totalAmount < 0) {
        return c.json({ success: false, error: 'total_amount must be a number >= 0' }, 400);
      }
      const user = (c as any).get?.('user') as { role?: string } | undefined;
      const callerRole = String(user?.role || '').trim().toLowerCase();
      if (callerRole && !['owner', 'admin', 'manager', 'cashier'].includes(callerRole)) {
        return c.json({ success: false, error: 'Insufficient permissions to override session total_amount' }, 403);
      }
    }

    const now = new Date().toISOString();
    const isTerminalTransition = terminalStatuses.includes(nextStatus);
    const requiresPaidOrders = isTerminalTransition || nextStatus === 'paid';
    const closedAt = isTerminalTransition ? now : session.closed_at;
    let effectiveTenant = tenantId === '*' ? '' : tenantId;
    if (!effectiveTenant) {
      const rawSessionTenant = typeof sessionRow?.tenant_id === 'string' ? sessionRow.tenant_id.trim() : '';
      if (rawSessionTenant && rawSessionTenant !== '*' && rawSessionTenant.toLowerCase() !== 'hq') {
        effectiveTenant = rawSessionTenant;
      } else if (session.table_id) {
        const tbl = (await db.prepare('SELECT tenant_id FROM cafe_tables WHERE id = ?').bind(String(session.table_id)).first().catch(() => null)) as { tenant_id?: string | null } | null;
        const rawTblTenant = typeof tbl?.tenant_id === 'string' ? tbl.tenant_id.trim() : '';
        effectiveTenant = rawTblTenant && rawTblTenant !== '*' && rawTblTenant.toLowerCase() !== 'hq' ? rawTblTenant : 'default';
      } else {
        effectiveTenant = 'default';
      }
    }
    const allowUnscopedFallback = effectiveTenant === 'default' || tenantId === '*';

    if (requiresPaidOrders) {
      const user = (c as any).get?.('user') as { role?: string } | undefined;
      const callerRole = String(user?.role || '').trim().toLowerCase();
      const canForceClose = Boolean(body.force) && ['owner', 'manager', 'admin'].includes(callerRole);
      if (!canForceClose) {
        let hasUnpaidOrder = false;
        let unpaidOrderId: string | null = null;
        const sessionOpenedAt = String(
          (session as unknown as Record<string, unknown>).opened_at ??
            (session as unknown as Record<string, unknown>).started_at ??
            (session as unknown as Record<string, unknown>).created_at ??
            ''
        ).trim();
        try {
          const unpaidRow = (await db
            .prepare(
              `SELECT id, status, payment_status FROM orders
               WHERE (session_id = ? OR ((session_id IS NULL OR TRIM(session_id) = '') AND table_id = ? AND (? = '' OR created_at IS NULL OR TRIM(created_at) = '' OR datetime(created_at) >= datetime(?))))
                 AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
                 AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded', 'cancelled', 'canceled')
                 AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
               LIMIT 1`
            )
            .bind(id, String(session.table_id ?? ''), sessionOpenedAt, sessionOpenedAt, effectiveTenant, effectiveTenant)
            .first()) as Record<string, unknown> | null;
          if (unpaidRow && ('id' in unpaidRow || 'status' in unpaidRow || 'payment_status' in unpaidRow)) {
            hasUnpaidOrder = true;
            unpaidOrderId = unpaidRow.id !== undefined ? String(unpaidRow.id) : null;
          }
        } catch {
          try {
            const unpaidRow = (await db
              .prepare(
                `SELECT id, status, payment_status FROM orders
                 WHERE table_id = ?
                   AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
                   AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded', 'cancelled', 'canceled')
                   AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
                 LIMIT 1`
              )
              .bind(String(session.table_id ?? ''), effectiveTenant, effectiveTenant)
              .first()) as Record<string, unknown> | null;
            if (unpaidRow && ('id' in unpaidRow || 'status' in unpaidRow || 'payment_status' in unpaidRow)) {
              hasUnpaidOrder = true;
              unpaidOrderId = unpaidRow.id !== undefined ? String(unpaidRow.id) : null;
            }
          } catch {
            if (allowUnscopedFallback) {
              const unpaidRow = (await db
                .prepare(
                  `SELECT id, status, payment_status FROM orders
                   WHERE table_id = ?
                     AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
                     AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded', 'cancelled', 'canceled')
                   LIMIT 1`
                )
                .bind(String(session.table_id ?? ''))
                .first()
                .catch(() => null)) as Record<string, unknown> | null;
              if (unpaidRow && ('id' in unpaidRow || 'status' in unpaidRow || 'payment_status' in unpaidRow)) {
                hasUnpaidOrder = true;
                unpaidOrderId = unpaidRow.id !== undefined ? String(unpaidRow.id) : null;
              }
            }
          }
        }
        if (hasUnpaidOrder) {
          return c.json(
            {
              success: false,
              error: nextStatus === 'paid'
                ? 'Cannot mark session as paid with unpaid active orders'
                : 'Cannot close session with unpaid active orders',
              unpaid_order_id: unpaidOrderId,
            },
            409
          );
        }
      }
    }

    try {
      const values: Record<string, unknown> = { status: nextStatus || session.status, updated_at: now };
      if (closedAt != null) values.closed_at = closedAt;
      if (body.notes) values.notes = body.notes;
      if (body.total_amount !== undefined && body.total_amount !== null) values.total_amount = Number(body.total_amount);
      if (body.guest_count !== undefined && body.guest_count !== null) values.guest_count = Number(body.guest_count);
      await mutateSessionAtomically(db, session, effectiveTenant, values, isTerminalTransition);
    } catch (error) {
      return c.json({ success: false, error: sessionConflict(error)
        ? 'Session changed; refresh before retrying' : 'Failed to update table session' }, sessionConflict(error) ? 409 : 500);
    }

    const updated = (await db.prepare(
      'SELECT * FROM table_sessions WHERE id = ?'
    ).bind(id).first()) as TableSession | null;
    return c.json({ success: true, data: updated });
  };
  router.patch('/:id', handlePatchSession);
  router.patch('/:id/status', handlePatchSession);

  // POST /api/table-sessions/:id/close and /:id/end — close session with active unpaid order guard
  const handleCloseSession = async (c: any) => {
    const tenantCheck = resolveOpenApiTablesTenant(c, 'write');
    if (!tenantCheck.ok) return tenantCheck.response;
    const db = c.env.AURA_DB;
    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const allowUnscopedFallback = tenantId === 'default' || tenantId === '*';
    const id = c.req.param('id');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

    let session: TableSession | null = null;
    try {
      session = (await db.prepare('SELECT * FROM table_sessions WHERE id = ?').bind(id).first()) as TableSession | null;
    } catch {
      session = null;
    }
    const sessionRow = session as unknown as Record<string, unknown> | null;
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (sessionRow && hasExplicitTenantId(sessionRow)) {
      if (!matchesTenantRow(sessionRow, tenantId)) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (session.table_id) {
      if (!(await isTableAccessibleByTenant(db, String(session.table_id), tenantId))) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (!matchesTenantRow(sessionRow, tenantId)) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    let effectiveTenant = tenantId === '*' ? '' : tenantId;
    if (!effectiveTenant) {
      const rawSessionTenant = typeof sessionRow?.tenant_id === 'string' ? sessionRow.tenant_id.trim() : '';
      if (rawSessionTenant && rawSessionTenant !== '*' && rawSessionTenant.toLowerCase() !== 'hq') {
        effectiveTenant = rawSessionTenant;
      } else if (session.table_id) {
        const tbl = (await db.prepare('SELECT tenant_id FROM cafe_tables WHERE id = ?').bind(String(session.table_id)).first().catch(() =>
          db.prepare('SELECT tenant_id FROM tables WHERE id = ?').bind(String(session.table_id)).first().catch(() => null)
        )) as { tenant_id?: string | null } | null;
        const rawTblTenant = typeof tbl?.tenant_id === 'string' ? tbl.tenant_id.trim() : '';
        effectiveTenant = rawTblTenant && rawTblTenant !== '*' && rawTblTenant.toLowerCase() !== 'hq' ? rawTblTenant : 'default';
      } else {
        effectiveTenant = 'default';
      }
    }

    const terminalStatuses = ['closed', 'completed', 'no_show', 'abandoned'];
    if (terminalStatuses.includes(String(session.status || ''))) {
      return c.json({ success: false, error: 'Session already ended' }, 409);
    }

    const user = (c as any).get?.('user') as { role?: string } | undefined;
    const callerRole = String(user?.role || '').trim().toLowerCase();
    const canForceClose = Boolean(body.force) && ['owner', 'manager', 'admin'].includes(callerRole);
    if (!canForceClose) {
      let hasUnpaidOrder = false;
      let unpaidOrderId: string | null = null;
      const sessionOpenedAt = String(
        (session as unknown as Record<string, unknown>).opened_at ??
          (session as unknown as Record<string, unknown>).started_at ??
          (session as unknown as Record<string, unknown>).created_at ??
          ''
      ).trim();
      try {
        const unpaidRow = (await db
          .prepare(
            `SELECT id, status, payment_status FROM orders
             WHERE (session_id = ? OR ((session_id IS NULL OR TRIM(session_id) = '') AND table_id = ? AND (? = '' OR created_at IS NULL OR TRIM(created_at) = '' OR datetime(created_at) >= datetime(?))))
               AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
               AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded', 'cancelled', 'canceled')
               AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
             LIMIT 1`
          )
          .bind(id, String(session.table_id ?? ''), sessionOpenedAt, sessionOpenedAt, effectiveTenant, effectiveTenant)
          .first()) as Record<string, unknown> | null;
        if (unpaidRow && ('id' in unpaidRow || 'status' in unpaidRow || 'payment_status' in unpaidRow)) {
          hasUnpaidOrder = true;
          unpaidOrderId = unpaidRow.id !== undefined ? String(unpaidRow.id) : null;
        }
      } catch {
        try {
          const unpaidRow = (await db
            .prepare(
              `SELECT id, status, payment_status FROM orders
               WHERE table_id = ?
                 AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
                 AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded', 'cancelled', 'canceled')
                 AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
               LIMIT 1`
            )
            .bind(String(session.table_id ?? ''), effectiveTenant, effectiveTenant)
            .first()) as Record<string, unknown> | null;
        if (unpaidRow && ('id' in unpaidRow || 'status' in unpaidRow || 'payment_status' in unpaidRow)) {
          hasUnpaidOrder = true;
          unpaidOrderId = unpaidRow.id !== undefined ? String(unpaidRow.id) : null;
        }
      } catch {
        if (allowUnscopedFallback) {
          const unpaidRow = (await db
            .prepare(
              `SELECT id, status, payment_status FROM orders
               WHERE table_id = ?
                 AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
                 AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded', 'cancelled', 'canceled')
               LIMIT 1`
            )
            .bind(String(session.table_id ?? ''))
            .first()
            .catch(() => null)) as Record<string, unknown> | null;
          if (unpaidRow && ('id' in unpaidRow || 'status' in unpaidRow || 'payment_status' in unpaidRow)) {
            hasUnpaidOrder = true;
            unpaidOrderId = unpaidRow.id !== undefined ? String(unpaidRow.id) : null;
          }
        }
      }
    }
      if (hasUnpaidOrder) {
        return c.json({ success: false, error: 'Cannot close session with unpaid active orders', unpaid_order_id: unpaidOrderId }, 409);
      }
    }

    const rawCloseStatus = typeof body.status === 'string' ? body.status.trim() : '';
    if (rawCloseStatus && rawCloseStatus !== 'closed' && rawCloseStatus !== 'completed' && rawCloseStatus !== 'no_show') {
      return c.json({ success: false, error: 'Invalid close status. Expected closed or no_show' }, 400);
    }
    const targetCloseStatus = rawCloseStatus === 'no_show' ? 'no_show' : 'closed';
    if (targetCloseStatus === 'no_show' && (String(session.status || '') === 'ordering' || String(session.status || '') === 'paying' || String(session.status || '') === 'paid' || Number((session as any).order_count ?? (session as any).orders_count ?? 0) > 0)) {
      return c.json({ success: false, error: 'Cannot mark session with orders as no_show' }, 409);
    }
    const closeNotes = typeof body.notes === 'string' ? body.notes : (session as any).notes ?? null;

    const now = new Date().toISOString();
    try {
      await mutateSessionAtomically(db, session, effectiveTenant, {
        status: targetCloseStatus, notes: closeNotes, closed_at: now, updated_at: now,
      }, true);
    } catch (error) {
      return c.json({ success: false, error: sessionConflict(error)
        ? 'Session changed; refresh before retrying' : 'Failed to close table session' }, sessionConflict(error) ? 409 : 500);
    }

    const updated = (await db.prepare('SELECT * FROM table_sessions WHERE id = ?').bind(id).first().catch(() => null)) as TableSession | null;
    return c.json({ success: true, data: updated ?? { ...session, status: targetCloseStatus, notes: closeNotes, closed_at: now } });
  };
  router.post('/:id/close', handleCloseSession);
  router.post('/:id/end', handleCloseSession);
}

export const registerSessionRoutes = registerSessionHandlers;
export const registerSessionCrudHandlers = registerSessionHandlers;

