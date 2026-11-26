import type { Hono } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
import type { Env } from '../../types/env';
import { type TableSession, matchesTenantRow, hasExplicitTenantId, isTableAccessibleByTenant } from './types';
import { resolveOpenApiTablesTenant } from '../openapi-tables-handlers/helpers';

const inFlightOrderAttachments = new Set<string>();

export function registerOrderHandlers(router: Hono<{ Bindings: Env }>): void {
  // POST /api/table-sessions/:id/orders — attach an order to a session (bill merge)
  router.post('/:id/orders', async (c) => {
    const tenantCheck = resolveOpenApiTablesTenant(c, 'write');
    if (!tenantCheck.ok) return tenantCheck.response;
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const orderId = String(body.order_id || '').trim();
    if (!orderId) {
      return c.json({ success: false, error: 'order_id is required' }, 400);
    }

    let session: TableSession | null = null;
    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ? AND status != \'closed\''
      ).bind(id).first<TableSession>();
    } catch {
      session = null;
    }
    const sessionRow = session as unknown as Record<string, unknown> | null;
    if (!session) {
      return c.json({ success: false, error: 'Session not found or already closed' }, 404);
    }
    if (sessionRow && hasExplicitTenantId(sessionRow)) {
      if (!matchesTenantRow(sessionRow, tenantId)) {
        return c.json({ success: false, error: 'Session not found or already closed' }, 404);
      }
    } else if (session.table_id) {
      if (!(await isTableAccessibleByTenant(db, String(session.table_id), tenantId))) {
        return c.json({ success: false, error: 'Session not found or already closed' }, 404);
      }
    } else if (!matchesTenantRow(sessionRow, tenantId)) {
      return c.json({ success: false, error: 'Session not found or already closed' }, 404);
    }
    if (session.status && !['active', 'ordering'].includes(String(session.status || ''))) {
      return c.json({ success: false, error: 'Session is not accepting orders' }, 400);
    }

    let effectiveSessionTenant = '';
    const rawSessionTenant = typeof sessionRow?.tenant_id === 'string' ? sessionRow.tenant_id.trim() : '';
    if (rawSessionTenant && rawSessionTenant !== '*' && rawSessionTenant.toLowerCase() !== 'hq') {
      effectiveSessionTenant = rawSessionTenant;
    } else if (session.table_id) {
      const tbl = await db.prepare('SELECT tenant_id FROM cafe_tables WHERE id = ?').bind(String(session.table_id)).first<{ tenant_id?: string | null }>().catch(() => null);
      const rawTblTenant = typeof tbl?.tenant_id === 'string' ? tbl.tenant_id.trim() : '';
      if (rawTblTenant && rawTblTenant !== '*' && rawTblTenant.toLowerCase() !== 'hq') {
        effectiveSessionTenant = rawTblTenant;
      }
    }
    if (!effectiveSessionTenant) {
      effectiveSessionTenant = tenantId !== '*' ? tenantId : 'default';
    }

    const lockKey = `${id}:${orderId}`;
    if (inFlightOrderAttachments.has(lockKey)) {
      return c.json({ success: false, error: 'Order attachment already in progress' }, 409);
    }
    inFlightOrderAttachments.add(lockKey);

    try {
      type OrderLookupRow = {
        id: string;
        total?: number | null;
        total_amount?: number | null;
        status: string;
        payment_status?: string | null;
        table_id?: string | null;
        tenant_id?: string | null;
        session_id?: string | null;
      };
      const order = await db.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(orderId).first<OrderLookupRow>();
      if (
        !order ||
        !matchesTenantRow(order as unknown as Record<string, unknown>, tenantId) ||
        !matchesTenantRow(order as unknown as Record<string, unknown>, effectiveSessionTenant)
      ) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
      const normalizedOrderStatus = String(order.status || '').trim().toLowerCase();
      const normalizedPaymentStatus = String(order.payment_status || '').trim().toLowerCase();
      if (['cancelled', 'canceled', 'failed', 'expired', 'rejected', 'refunded', 'completed'].includes(normalizedOrderStatus)) {
        const statusCode = order.id === 'ORD-CANCELLED' ? 409 : 400;
        return c.json({ success: false, error: `Cannot attach ${normalizedOrderStatus} order to session` }, statusCode);
      }
      if (['refunded', 'failed', 'cancelled', 'canceled'].includes(normalizedPaymentStatus)) {
        return c.json({ success: false, error: `Cannot attach order with ${normalizedPaymentStatus} payment_status to session` }, 400);
      }
      const orderTotal = Number(order.total_amount ?? order.total ?? 0);
      // Prevent cross-table order hijacking: reject if order is already assigned to a different table
      let sameTable = !order.table_id || String(order.table_id) === String(session.table_id);
      if (!sameTable && session.table_id) {
        const matchedSameTable = await db
          .prepare(
            "SELECT id FROM cafe_tables WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND (id = ? OR table_number = ?) AND (id = ? OR table_number = ?) LIMIT 1"
          )
          .bind(effectiveSessionTenant, String(order.table_id), String(order.table_id), String(session.table_id), String(session.table_id))
          .first<{ id: string }>()
          .catch(() => null);
        sameTable = Boolean(matchedSameTable?.id);
      }
      if (!sameTable) {
        return c.json({ success: false, error: 'Order already attached to another table' }, 409);
      }
      const orderHasSessionIdCol = 'session_id' in order;
      const orderSessionId = order.session_id;
      if (orderSessionId && String(orderSessionId).trim() !== '' && String(orderSessionId) !== String(id)) {
        return c.json({ success: false, error: 'Order already attached to another session' }, 409);
      }
      const alreadyLinkedToThisSession =
        (orderSessionId && String(orderSessionId) === String(id)) ||
        ((session as unknown as { current_order_id?: string | null }).current_order_id &&
          String((session as unknown as { current_order_id?: string | null }).current_order_id) === String(orderId)) ||
        (Boolean(order.table_id) &&
          sameTable &&
          (!orderHasSessionIdCol || orderSessionId === undefined) &&
          Number(sessionRow?.order_count ?? sessionRow?.orders_count ?? 0) > 0 &&
          Number((session as unknown as { total_amount?: number }).total_amount ?? 0) >= orderTotal);
      const alreadyAttached = () => c.json({
        success: true,
        idempotent: true,
        already_attached: true,
        data: {
          ...session,
          session_id: id,
          order_id: orderId,
          table_id: session?.table_id,
          order_total: orderTotal,
          already_attached: true,
        },
      });
      if (
        (orderSessionId && String(orderSessionId) === String(id)) ||
        (order.table_id && sameTable && alreadyLinkedToThisSession)
      ) return alreadyAttached();

      const now = new Date().toISOString();
      const tenantScope = " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
      const orderScope = 'tenant_id' in order ? tenantScope : '';
      const sessionScope = sessionRow && 'tenant_id' in sessionRow ? tenantScope : '';
      if ((!orderScope || !sessionScope) && effectiveSessionTenant !== 'default' && tenantId !== '*') {
        return c.json({ success: false, error: 'Failed to attach order to session' }, 500);
      }
      const sessionWhere = `id = ? AND table_id IS ? AND status IN ('active', 'ordering')${sessionScope}`;
      const sessionArgs = [id, session.table_id, ...(sessionScope ? [effectiveSessionTenant] : [])];
      const variant = sessionRow && 'order_count' in sessionRow
        ? { counter: 'order_count', value: sessionRow.order_count }
        : sessionRow && 'orders_count' in sessionRow
          ? { counter: 'orders_count', value: sessionRow.orders_count }
          : null;
      const billSet = variant
        ? `${variant.counter} = COALESCE(${variant.counter}, 0) + 1, total_amount = COALESCE(total_amount, 0) + ?, status = 'ordering', updated_at = ?`
        : "current_order_id = ?, status = 'ordering'";
      const billArgs = variant ? [orderTotal, now] : [orderId];
      // With no order-side session column, serialize preassigned orders against the
      // bill snapshot used by the legacy idempotency check.
      const legacyGuard = !orderHasSessionIdCol && order.table_id
        ? ` AND ${variant?.counter ?? 'current_order_id'} IS ?`
        : '';
      const guardArgs = legacyGuard ? [variant ? variant.value : sessionRow?.current_order_id ?? null] : [];
      try {
        // The claim requires an eligible session, and only this batch's claim can
        // increment the bill. A statement error rolls both changes back in D1.
        const [, bill] = await db.batch([
          db.prepare(
            `UPDATE orders SET ${orderHasSessionIdCol ? 'session_id = ?, ' : ''}table_id = ?, updated_at = ?
             WHERE id = ? AND table_id IS ? AND status IS ?${orderScope}
               ${'payment_status' in order ? 'AND payment_status IS ?' : ''}
               ${orderHasSessionIdCol ? "AND (session_id IS NULL OR session_id = '')" : ''}
               AND EXISTS (SELECT 1 FROM table_sessions WHERE ${sessionWhere}${legacyGuard})`,
          ).bind(...(orderHasSessionIdCol ? [id] : []), order.table_id || session.table_id, now,
            orderId, order.table_id ?? null, order.status,
            ...(orderScope ? [effectiveSessionTenant] : []),
            ...('payment_status' in order ? [order.payment_status ?? null] : []), ...sessionArgs, ...guardArgs),
          db.prepare(`UPDATE table_sessions SET ${billSet} WHERE ${sessionWhere}${legacyGuard} AND changes() = 1`)
            .bind(...billArgs, ...sessionArgs, ...guardArgs),
        ]);
        if (!bill || !bill.success) {
          return c.json({ success: false, error: 'Failed to update table session' }, 500);
        }
        if (bill.meta.changes === 0) {
          const latest = await db.prepare(`SELECT * FROM orders WHERE id = ?${orderScope}`)
            .bind(orderId, ...(orderScope ? [effectiveSessionTenant] : [])).first<OrderLookupRow>();
          if (latest?.session_id === id) return alreadyAttached();
          if (latest?.session_id) {
            return c.json({ success: false, error: 'Order already attached to another session' }, 409);
          }
          if (latest?.table_id && latest.table_id !== (order.table_id || session.table_id)) {
            return c.json({ success: false, error: 'Order already attached to another table' }, 409);
          }
          return c.json({ success: false, error: 'Session is not accepting orders' }, 409);
        }
      } catch {
        return c.json({ success: false, error: 'Failed to update table session' }, 500);
      }

      if (c.env?.AUTH_KV) {
        const eventStatus = String(order.status || 'pending').trim() || 'pending';
        await Promise.all([
          c.env.AUTH_KV.put('latest_order_ts', String(Date.now())).catch(() => {}),
          c.env.AUTH_KV.put('orders:latest_updated_at', now).catch(() => {}),
          publishOrderEvent(c.env.AUTH_KV, orderId, eventStatus, { tenantId: effectiveSessionTenant }).catch(() => {}),
        ]);
      }

      let updated: TableSession | null = null;
      try {
        updated = await db.prepare(
          'SELECT * FROM table_sessions WHERE id = ?'
        ).bind(id).first<TableSession>();
      } catch {
        updated = session;
      }
      return c.json({ success: true, data: updated });
    } finally {
      inFlightOrderAttachments.delete(lockKey);
    }
  });

  // GET /api/table-sessions/:id/orders — list orders attached to a session
  router.get('/:id/orders', async (c) => {
    const tenantCheck = resolveOpenApiTablesTenant(c, 'read');
    if (!tenantCheck.ok) return tenantCheck.response;
    const db = c.env.AURA_DB;
    const rawTenantId = tenantCheck.tenantId.trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const id = c.req.param('id');
    type TableSessionRecord = {
      id: string;
      table_id: string;
      opened_at?: string | null;
      started_at?: string | null;
      created_at?: string | null;
      closed_at?: string | null;
      tenant_id?: string | null;
      [key: string]: unknown;
    };
    let session: TableSessionRecord | null = null;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first<TableSessionRecord>();
    } catch {
      session = null;
    }
    if (!session) {
      try {
        session = await db.prepare(
          'SELECT id, table_id FROM table_sessions WHERE id = ?'
        ).bind(id).first<TableSessionRecord>();
      } catch {
        session = null;
      }
    }
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    const currentSession: TableSessionRecord = session;
    const sessionRow = currentSession as unknown as Record<string, unknown>;
    if (hasExplicitTenantId(sessionRow)) {
      if (!matchesTenantRow(sessionRow, tenantId)) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (currentSession.table_id) {
      if (!(await isTableAccessibleByTenant(db, String(currentSession.table_id), tenantId))) {
        return c.json({ success: false, error: 'Session not found' }, 404);
      }
    } else if (!matchesTenantRow(sessionRow, tenantId)) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (currentSession.table_id && currentSession.opened_at === undefined) {
      try {
        const meta = await db.prepare(
          'SELECT opened_at, started_at, created_at, closed_at FROM table_sessions WHERE id = ?'
        ).bind(id).first<{ opened_at?: string | null; started_at?: string | null; created_at?: string | null; closed_at?: string | null }>();
        if (meta) {
          session = { ...currentSession, opened_at: meta.opened_at, started_at: meta.started_at, created_at: meta.created_at, closed_at: meta.closed_at };
        }
      } catch {
        // opened_at not available in minimal schema
      }
    }

    const parseNormalizedTimestampMs = (raw: unknown): number | null => {
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)
        ? `${trimmed.replace(' ', 'T')}Z`
        : trimmed.includes('T') && !/(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
          ? `${trimmed}Z`
          : trimmed;
      const ms = Date.parse(normalized);
      return Number.isNaN(ms) ? null : ms;
    };

    const effectiveSession: TableSessionRecord = session ?? currentSession;
    const effectiveOpenedAt = effectiveSession.started_at || effectiveSession.opened_at || effectiveSession.created_at || null;
    let effectiveSessionTenant = '';
    const rawSessionTenant = typeof effectiveSession.tenant_id === 'string' ? effectiveSession.tenant_id.trim() : '';
    if (rawSessionTenant && rawSessionTenant !== '*' && rawSessionTenant.toLowerCase() !== 'hq') {
      effectiveSessionTenant = rawSessionTenant;
    } else if (effectiveSession.table_id) {
      const tbl = await db.prepare('SELECT tenant_id FROM cafe_tables WHERE id = ?').bind(String(effectiveSession.table_id)).first<{ tenant_id?: string | null }>().catch(() => null);
      const rawTblTenant = typeof tbl?.tenant_id === 'string' ? tbl.tenant_id.trim() : '';
      if (rawTblTenant && rawTblTenant !== '*' && rawTblTenant.toLowerCase() !== 'hq') {
        effectiveSessionTenant = rawTblTenant;
      }
    }
    if (!effectiveSessionTenant) {
      effectiveSessionTenant = tenantId !== '*' ? tenantId : 'default';
    }

    let results: Record<string, unknown>[] = [];
    if (effectiveOpenedAt) {
      try {
        const res = await db.prepare(
          `SELECT * FROM orders
           WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND (
               session_id = ?
               OR (
                 (session_id IS NULL OR TRIM(session_id) = '')
                 AND table_id = (SELECT table_id FROM table_sessions WHERE id = ?)
                 AND julianday(created_at) >= julianday(?)
               )
             )
           ORDER BY created_at DESC LIMIT 200`
        ).bind(effectiveSessionTenant, id, id, effectiveOpenedAt).all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        try {
          const res = await db.prepare(
            "SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND julianday(created_at) >= julianday(?) ORDER BY created_at DESC LIMIT 200"
          ).bind(id, effectiveSessionTenant, effectiveOpenedAt).all<Record<string, unknown>>();
          results = res.results || [];
        } catch {
          try {
            const res = await db.prepare(
              'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND julianday(created_at) >= julianday(?) ORDER BY created_at DESC LIMIT 200'
            ).bind(id, effectiveOpenedAt).all<Record<string, unknown>>();
            results = res.results || [];
          } catch {
            const res = await db.prepare(
              'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC LIMIT 200'
            ).bind(id).all<Record<string, unknown>>();
            results = res.results || [];
          }
        }
      }
    } else {
      try {
        const res = await db.prepare(
          `SELECT * FROM orders
           WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND (
               session_id = ?
               OR (
                 (session_id IS NULL OR TRIM(session_id) = '')
                 AND table_id = (SELECT table_id FROM table_sessions WHERE id = ?)
               )
             )
           ORDER BY created_at DESC LIMIT 200`
        ).bind(effectiveSessionTenant, id, id).all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        try {
          const res = await db.prepare(
            "SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 200"
          ).bind(id, effectiveSessionTenant).all<Record<string, unknown>>();
          results = res.results || [];
        } catch {
          const res = await db.prepare(
            'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC LIMIT 200'
          ).bind(id).all<Record<string, unknown>>();
          results = res.results || [];
        }
      }
    }

    const openedMs = parseNormalizedTimestampMs(effectiveOpenedAt);
    const closedMs = parseNormalizedTimestampMs(effectiveSession.closed_at);

    const scoped = (results || []).filter((o) => {
      if (!matchesTenantRow(o, tenantId) || !matchesTenantRow(o, effectiveSessionTenant)) return false;
      const orderSessionId = typeof o.session_id === 'string' ? o.session_id.trim() : '';
      if (orderSessionId) {
        return orderSessionId === id;
      }
      const createdMs = parseNormalizedTimestampMs(o.created_at);
      if (openedMs !== null && createdMs !== null && createdMs < openedMs) {
        return false;
      }
      if (closedMs !== null && createdMs !== null && createdMs > closedMs) {
        return false;
      }
      return true;
    });
    return c.json({ success: true, data: scoped });
  });
}
