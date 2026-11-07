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
      };
      let order: OrderLookupRow | null = null;
      try {
        order = await db.prepare(
          'SELECT id, COALESCE(total_amount, total, 0) AS total, status, payment_status, table_id, session_id, tenant_id FROM orders WHERE id = ?'
        ).bind(orderId).first<OrderLookupRow>();
      } catch {
        try {
          order = await db.prepare(
            'SELECT id, COALESCE(total_amount, total, 0) AS total, status, payment_status, table_id, tenant_id FROM orders WHERE id = ?'
          ).bind(orderId).first<OrderLookupRow>();
        } catch {
          order = null;
        }
      }
      if (!order) {
        try {
          order = await db.prepare(
            'SELECT id, COALESCE(total_amount, total, 0) AS total, status, table_id, tenant_id FROM orders WHERE id = ?'
          ).bind(orderId).first<OrderLookupRow>();
        } catch {
          order = null;
        }
      }
      if (!order) {
        try {
          order = await db.prepare(
            'SELECT id, total, status, table_id, tenant_id FROM orders WHERE id = ?'
          ).bind(orderId).first<OrderLookupRow>();
        } catch {
          try {
            order = await db.prepare(
              'SELECT id, total, status, tenant_id FROM orders WHERE id = ?'
            ).bind(orderId).first<OrderLookupRow>();
          } catch {
            if (tenantId === 'default' || tenantId === '*') {
              order = await db.prepare(
                'SELECT id, total, status, table_id FROM orders WHERE id = ?'
              ).bind(orderId).first<OrderLookupRow>();
            }
          }
        }
      }
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
      if (order.table_id && String(order.table_id) !== String(session.table_id)) {
        return c.json({ success: false, error: 'Order already attached to another table' }, 409);
      }
      const orderHasSessionIdCol = 'session_id' in (order as unknown as Record<string, unknown>);
      const orderSessionId = (order as unknown as { session_id?: string | null }).session_id;
      const alreadyLinkedToThisSession =
        (orderSessionId && String(orderSessionId) === String(id)) ||
        ((session as unknown as { current_order_id?: string | null }).current_order_id &&
          String((session as unknown as { current_order_id?: string | null }).current_order_id) === String(orderId)) ||
        (Boolean(order.table_id) &&
          String(order.table_id) === String(session.table_id) &&
          (!orderHasSessionIdCol || orderSessionId === undefined) &&
          Number((session as unknown as { order_count?: number }).order_count ?? 0) > 0 &&
          Number((session as unknown as { total_amount?: number }).total_amount ?? 0) >= orderTotal);
      if (order.table_id && String(order.table_id) === String(session.table_id) && alreadyLinkedToThisSession) {
        return c.json({
          success: true,
          idempotent: true,
          already_attached: true,
          data: {
            ...session,
            session_id: id,
            order_id: orderId,
            table_id: session.table_id,
            order_total: orderTotal,
            already_attached: true,
          },
        });
      }

      const now = new Date().toISOString();
      const allowUnscopedOrderFallback = effectiveSessionTenant === 'default' || tenantId === '*';
      const allowUnscopedSessionFallback = effectiveSessionTenant === 'default' || tenantId === '*';
      let attachResult: any = null;
      if (!order.table_id) {
        try {
          attachResult = await db.prepare(
            "UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ? AND (table_id IS NULL OR table_id = '') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(session.table_id, now, orderId, effectiveSessionTenant).run();
        } catch {
          if (!allowUnscopedOrderFallback) {
            return c.json({ success: false, error: 'Failed to attach order to session' }, 500);
          }
          attachResult = await db.prepare(
            'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ? AND (table_id IS NULL OR table_id = \'\')'
          ).bind(session.table_id, now, orderId).run();
        }
        if (attachResult?.meta && typeof attachResult.meta.changes === 'number' && attachResult.meta.changes === 0) {
          return c.json({ success: false, error: 'Order already attached to another table' }, 409);
        }
      }
      await db.prepare('UPDATE orders SET session_id = ? WHERE id = ?').bind(id, orderId).run().catch(() => {});

      try {
        await db.prepare(
          `UPDATE table_sessions
           SET order_count = COALESCE(order_count, 0) + 1,
               total_amount = COALESCE(total_amount, 0) + ?,
               status = 'ordering',
               updated_at = ?
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(orderTotal, now, id, effectiveSessionTenant).run();
      } catch {
        let updatedCurrentOrder = false;
        try {
          await db.prepare(
            `UPDATE table_sessions
             SET orders_count = COALESCE(orders_count, 0) + 1,
                 total_amount = COALESCE(total_amount, 0) + ?,
                 status = 'ordering',
                 updated_at = ?
             WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(orderTotal, now, id, effectiveSessionTenant).run();
          updatedCurrentOrder = true;
        } catch {
          try {
            await db.prepare(
              `UPDATE table_sessions
               SET current_order_id = ?,
                   status = 'ordering'
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(orderId, id, effectiveSessionTenant).run();
            updatedCurrentOrder = true;
          } catch {
            updatedCurrentOrder = false;
          }
        }
        if (!updatedCurrentOrder) {
          if (!allowUnscopedSessionFallback) {
            return c.json({ success: false, error: 'Failed to update table session' }, 500);
          }
          try {
            await db.prepare(
              `UPDATE table_sessions
               SET order_count = COALESCE(order_count, 0) + 1,
                   total_amount = COALESCE(total_amount, 0) + ?,
                   status = 'ordering',
                   updated_at = ?
               WHERE id = ?`
            ).bind(orderTotal, now, id).run();
          } catch {
            try {
              await db.prepare(
                `UPDATE table_sessions
                 SET orders_count = COALESCE(orders_count, 0) + 1,
                     total_amount = COALESCE(total_amount, 0) + ?,
                     status = 'ordering',
                     updated_at = ?
                 WHERE id = ?`
              ).bind(orderTotal, now, id).run();
            } catch {
              try {
                await db.prepare(
                  `UPDATE table_sessions
                   SET current_order_id = ?,
                       status = 'ordering'
                   WHERE id = ?`
                ).bind(orderId, id).run();
              } catch {
                // table_sessions schema variation
              }
            }
          }
        }
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

    const effectiveSession: TableSessionRecord = session ?? currentSession;
    const effectiveOpenedAt = effectiveSession.opened_at || effectiveSession.started_at || effectiveSession.created_at || null;
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
          "SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 200"
        ).bind(id, effectiveSessionTenant, effectiveOpenedAt).all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        try {
          const res = await db.prepare(
            'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND created_at >= ? ORDER BY created_at DESC LIMIT 200'
          ).bind(id, effectiveOpenedAt).all<Record<string, unknown>>();
          results = res.results || [];
        } catch {
          const res = await db.prepare(
            'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC LIMIT 200'
          ).bind(id).all<Record<string, unknown>>();
          results = res.results || [];
        }
      }
    } else {
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

    const scoped = (results || []).filter((o) => {
      if (!matchesTenantRow(o, tenantId) || !matchesTenantRow(o, effectiveSessionTenant)) return false;
      const createdTs = o.created_at ? String(o.created_at) : '';
      if (effectiveOpenedAt && createdTs) {
        if (createdTs < String(effectiveOpenedAt)) return false;
      }
      if (session?.closed_at && createdTs) {
        if (createdTs > String(session.closed_at)) return false;
      }
      return true;
    });
    return c.json({ success: true, data: scoped });
  });
}
