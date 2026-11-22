import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { resolveOpenApiTablesTenant } from '../openapi-tables-handlers/helpers';

const STAFF_TRANSFER_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'staff',
  'waiter',
  'cashier',
]);

const tenantExpr = (alias: string) => `COALESCE(NULLIF(TRIM(${alias}.tenant_id), ''), 'default')`;
const TERMINAL_SESSION_STATUSES = "('closed', 'cancelled', 'canceled', 'completed', 'no_show', 'expired')";
const TERMINAL_ORDER_STATUSES = "('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')";
const TODAY_VN = "DATE('now', '+7 hours')";

interface SessionRow {
  id: string;
  table_id: string;
  tenant_id: string | null;
  status: string;
  updated_at: string | null;
  guest_count?: number | null;
  covers?: number | null;
  opened_at: string | null;
  created_at: string | null;
}

interface TableRow {
  id: string;
  table_number: string | number;
  capacity: number;
  tenant_id: string | null;
  status: string;
  is_active: number | null;
  current_session_id: string | null;
}

interface SeatedReservationRow {
  id: string;
  guest_count: number | null;
}

async function resolveReservationDateExpr(db: D1Database): Promise<string> {
  try {
    await db
      .prepare("SELECT COALESCE(NULLIF(TRIM(r.date), ''), r.reservation_date) AS d FROM reservations r LIMIT 0")
      .all();
    return "COALESCE(NULLIF(TRIM(r.date), ''), r.reservation_date)";
  } catch (error) {
    const message = String(error);
    if (/no such column:\s*r\.reservation_date\b/i.test(message)) return 'r.date';
    if (/no such column:\s*r\.date\b/i.test(message)) return 'r.reservation_date';
    throw error;
  }
}

export function registerTransferHandler(router: Hono<{ Bindings: Env }>): void {
  // POST /api/table-sessions/:id/transfer — atomically move an active session to another available table
  router.post('/:id/transfer', async (c) => {
    const user = c.get('user') as { id?: string; role?: string } | undefined;
    if (!user) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    if (!user.role || !STAFF_TRANSFER_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }

    const scope = resolveOpenApiTablesTenant(c, 'write');
    if (!scope.ok) return scope.response;

    const body: unknown = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ success: false, error: 'Invalid transfer request' }, 400);
    }

    const input = body as Record<string, unknown>;
    const destinationId =
      typeof input.destination_table_id === 'string' ? input.destination_table_id.trim() : '';
    const explicitSourceId =
      typeof input.source_table_id === 'string' ? input.source_table_id.trim() : '';

    if (
      !destinationId ||
      (input.source_table_id !== undefined && !explicitSourceId) ||
      (input.transfer_reservation !== undefined && typeof input.transfer_reservation !== 'boolean')
    ) {
      return c.json({ success: false, error: 'Valid destination_table_id is required' }, 400);
    }

    const db = c.env.AURA_DB;
    const id = c.req.param('id');

    try {
      const session = await db.prepare('SELECT * FROM table_sessions WHERE id = ?').bind(id).first<SessionRow>();
      const sessionTenant = session?.tenant_id?.trim() || 'default';
      if (!session || (scope.tenantId !== '*' && sessionTenant !== scope.tenantId)) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }

      if (!['active', 'ordering'].includes(String(session.status || '').toLowerCase())) {
        return c.json({ success: false, error: 'Only active or ordering sessions can be transferred' }, 409);
      }

      // Duplicate/stale transfer requests fail closed instead of moving a session twice.
      const sourceId = explicitSourceId || session.table_id;
      if (session.table_id !== sourceId) {
        return c.json({ success: false, error: 'Session already moved; refresh before retrying' }, 409);
      }
      if (sourceId === destinationId) {
        return c.json({ success: false, error: 'Choose a different destination table' }, 400);
      }

      const source = await db
        .prepare(`SELECT * FROM cafe_tables t WHERE t.id = ? AND ${tenantExpr('t')} = ?`)
        .bind(sourceId, sessionTenant)
        .first<TableRow>();
      const destination = await db
        .prepare(`SELECT * FROM cafe_tables t WHERE t.id = ? AND ${tenantExpr('t')} = ?`)
        .bind(destinationId, sessionTenant)
        .first<TableRow>();

      if (!source || !destination) {
        return c.json({ success: false, error: 'Table not found' }, 404);
      }
      if (destination.is_active === 0) {
        return c.json({ success: false, error: 'Destination table is inactive' }, 409);
      }
      if (String(destination.status || '').toLowerCase() !== 'available') {
        return c.json({ success: false, error: 'Destination table is not available' }, 409);
      }
      if (destination.current_session_id && destination.current_session_id.trim() !== '') {
        return c.json({ success: false, error: 'Destination table already has an active session' }, 409);
      }

      const reservationDateExpr = await resolveReservationDateExpr(db);
      let seatedResults: SeatedReservationRow[] = [];
      if (reservationDateExpr) {
        const seated = await db
          .prepare(
            `SELECT r.id, r.guest_count FROM reservations r
             WHERE ${tenantExpr('r')} = ?
               AND (r.table_id = ? OR CAST(r.table_id AS TEXT) = ?)
               AND LOWER(r.status) = 'seated'
               AND ${reservationDateExpr} = ${TODAY_VN}`,
          )
          .bind(sessionTenant, source.id, String(source.table_number))
          .all<SeatedReservationRow>();
        seatedResults = seated.results ?? [];
      }
      if (seatedResults.length > 1) {
        return c.json({ success: false, error: 'Multiple seated reservations require staff reconciliation' }, 409);
      }

      const reservationId = seatedResults[0]?.id ?? null;
      const shouldTransferReservation = input.transfer_reservation !== false && reservationId !== null;
      if (input.transfer_reservation === true && !reservationId) {
        return c.json({ success: false, error: 'No seated reservation is linked to this table today' }, 409);
      }

      // Legacy sessions without guest_count fall back to source table capacity as a safe upper bound.
      const sessionGuests = Number(session.guest_count ?? session.covers ?? source.capacity);
      const reservationGuests = Number(seatedResults[0]?.guest_count ?? 1);
      const requiredCapacity = Math.max(sessionGuests, reservationGuests);
      if (!Number.isInteger(requiredCapacity) || requiredCapacity < 1 || destination.capacity < requiredCapacity) {
        return c.json({ success: false, error: 'Destination capacity is insufficient' }, 409);
      }

      const destReservationGuard = reservationDateExpr
        ? `AND NOT EXISTS (
            SELECT 1 FROM reservations r
            WHERE ${tenantExpr('r')} = ?
              AND (r.table_id = d.id OR CAST(r.table_id AS TEXT) = CAST(d.table_number AS TEXT))
              AND LOWER(COALESCE(r.status, 'pending')) IN ('pending', 'confirmed', 'approved', 'seated')
              AND ${reservationDateExpr} = ${TODAY_VN}
          )`
        : '';
      const sourceReservationCountGuard = reservationDateExpr
        ? `AND (
            SELECT COUNT(*) FROM reservations r
            WHERE ${tenantExpr('r')} = ?
              AND (r.table_id = ? OR CAST(r.table_id AS TEXT) = ?)
              AND LOWER(r.status) = 'seated'
              AND ${reservationDateExpr} = ${TODAY_VN}
          ) = ?${
            reservationId
              ? ` AND EXISTS (
                  SELECT 1 FROM reservations r
                  WHERE r.id = ?
                    AND ${tenantExpr('r')} = ?
                    AND (r.table_id = ? OR CAST(r.table_id AS TEXT) = ?)
                    AND LOWER(r.status) = 'seated'
                    AND ${reservationDateExpr} = ${TODAY_VN}
                    AND COALESCE(r.guest_count, 1) <= ?
                )`
              : ''
          }`
        : '';

      const eligibleDestSql = `SELECT 1 FROM cafe_tables d
        WHERE d.id = ?
          AND ${tenantExpr('d')} = ?
          AND COALESCE(d.is_active, 1) = 1
          AND LOWER(d.status) = 'available'
          AND (d.current_session_id IS NULL OR d.current_session_id = '')
          AND d.capacity >= ? AND d.capacity = ?
          AND NOT EXISTS (
            SELECT 1 FROM table_sessions s
            WHERE ${tenantExpr('s')} = ?
              AND (s.table_id = d.id OR CAST(s.table_id AS TEXT) = CAST(d.table_number AS TEXT))
              AND LOWER(COALESCE(s.status, 'active')) NOT IN ${TERMINAL_SESSION_STATUSES}
          )
          AND NOT EXISTS (
            SELECT 1 FROM orders o
            WHERE ${tenantExpr('o')} = ?
              AND (o.table_id = d.id OR CAST(o.table_id AS TEXT) = CAST(d.table_number AS TEXT))
              AND LOWER(o.status) NOT IN ${TERMINAL_ORDER_STATUSES}
          )
          ${destReservationGuard}`;

      const now = new Date().toISOString();
      const sourceTableNumber = String(source.table_number);
      const claimBinds: unknown[] = [
        destinationId, now, id, sourceId, session.updated_at, sessionTenant,
        destinationId, sessionTenant, requiredCapacity, destination.capacity, sessionTenant, sessionTenant,
      ];
      if (reservationDateExpr) claimBinds.push(sessionTenant);
      claimBinds.push(sourceId, sessionTenant, sourceTableNumber, source.capacity, sessionTenant, id, sourceId, sourceTableNumber);
      if (reservationDateExpr) {
        claimBinds.push(sessionTenant, sourceId, sourceTableNumber, seatedResults.length);
        if (reservationId) {
          claimBinds.push(reservationId, sessionTenant, sourceId, sourceTableNumber, destination.capacity);
        }
      }

      const sourceStatusWhenReserved = reservationDateExpr
        ? `WHEN EXISTS (
            SELECT 1 FROM reservations r
            WHERE ${tenantExpr('r')} = ?
              AND (r.table_id = ? OR CAST(r.table_id AS TEXT) = ?)
              AND ${reservationDateExpr} = ${TODAY_VN}
              AND LOWER(COALESCE(r.status, 'pending')) IN ('pending', 'confirmed', 'approved', 'seated')
          ) THEN 'Reserved'`
        : '';

      const sourceReleaseBinds: unknown[] = [
        sessionTenant, sourceId, sourceTableNumber,
        sessionTenant, sourceId, sourceTableNumber,
      ];
      if (reservationDateExpr) {
        sourceReleaseBinds.push(sessionTenant, sourceId, sourceTableNumber);
      }
      sourceReleaseBinds.push(sessionTenant, sourceId, sourceTableNumber, now, sourceId, sessionTenant);

      const statements: D1PreparedStatement[] = [
        db.prepare(
          `UPDATE table_sessions SET table_id = ?, updated_at = ?
           WHERE id = ? AND table_id = ? AND updated_at IS ?
             AND LOWER(status) IN ('active', 'ordering')
             AND ${tenantExpr('table_sessions')} = ?
             AND EXISTS (${eligibleDestSql})
             AND EXISTS (SELECT 1 FROM cafe_tables t WHERE t.id = ? AND ${tenantExpr('t')} = ?
               AND CAST(t.table_number AS TEXT) = ? AND t.capacity = ?)
             AND NOT EXISTS (SELECT 1 FROM table_sessions s WHERE ${tenantExpr('s')} = ?
               AND s.id <> ? AND (s.table_id = ? OR CAST(s.table_id AS TEXT) = ?)
               AND LOWER(COALESCE(s.status, 'active')) NOT IN ${TERMINAL_SESSION_STATUSES})
             ${sourceReservationCountGuard}`,
        ).bind(...claimBinds),
        // Zero-row claims abort the batch, so no downstream statement can partially run.
        db.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('table-transfer-conflict') END"),
        db.prepare(
          `UPDATE cafe_tables SET status = 'Occupied', current_session_id = ?, updated_at = ?
           WHERE id = ? AND ${tenantExpr('cafe_tables')} = ?`,
        ).bind(id, now, destinationId, sessionTenant),
      ];

      if (shouldTransferReservation && reservationId) {
        statements.push(db.prepare(
          `UPDATE reservations SET table_id = ?, updated_at = ?
           WHERE id = ? AND ${tenantExpr('reservations')} = ? AND LOWER(status) = 'seated'`,
        ).bind(destinationId, now, reservationId, sessionTenant));
      }

      statements.push(db.prepare(
        `UPDATE orders SET table_id = ?, session_id = ?, updated_at = ?
         WHERE ${tenantExpr('orders')} = ? AND LOWER(status) NOT IN ${TERMINAL_ORDER_STATUSES}
           AND (session_id = ? OR ((session_id IS NULL OR session_id = '')
             AND (table_id = ? OR CAST(table_id AS TEXT) = ?)))`,
      ).bind(
        destinationId, id, now, sessionTenant, id, sourceId, sourceTableNumber,
      ));

      statements.push(db.prepare(
        `UPDATE cafe_tables SET status = CASE
           WHEN EXISTS (
             SELECT 1 FROM table_sessions s WHERE ${tenantExpr('s')} = ?
               AND (s.table_id = ? OR CAST(s.table_id AS TEXT) = ?)
               AND LOWER(COALESCE(s.status, 'active')) NOT IN ${TERMINAL_SESSION_STATUSES}
           ) OR EXISTS (
             SELECT 1 FROM orders o WHERE ${tenantExpr('o')} = ?
               AND (o.table_id = ? OR CAST(o.table_id AS TEXT) = ?)
               AND LOWER(o.status) NOT IN ${TERMINAL_ORDER_STATUSES}
           ) THEN 'Occupied'
           ${sourceStatusWhenReserved}
           ELSE 'Available'
         END,
         current_session_id = (
           SELECT s.id FROM table_sessions s WHERE ${tenantExpr('s')} = ?
             AND (s.table_id = ? OR CAST(s.table_id AS TEXT) = ?)
             AND LOWER(COALESCE(s.status, 'active')) NOT IN ${TERMINAL_SESSION_STATUSES} LIMIT 1
         ), updated_at = ?
         WHERE id = ? AND ${tenantExpr('cafe_tables')} = ?`,
      ).bind(...sourceReleaseBinds));

      const batchResults = await db.batch(statements);
      const ordersResult = batchResults[statements.length - 2] as { meta?: { changes?: number } } | undefined;

      return c.json({
        success: true,
        data: {
          session_id: id,
          source_table_id: sourceId,
          table_id: destinationId,
          reservation_id: shouldTransferReservation ? reservationId : null,
          transferred_orders: Number(ordersResult?.meta?.changes ?? 0),
        },
      });
    } catch (error) {
      if (/malformed JSON|UNIQUE constraint/i.test(String(error))) {
        return c.json({ success: false, error: 'Table availability changed; refresh before retrying' }, 409);
      }
      return c.json({ success: false, error: 'Unable to transfer table session' }, 500);
    }
  });
}
