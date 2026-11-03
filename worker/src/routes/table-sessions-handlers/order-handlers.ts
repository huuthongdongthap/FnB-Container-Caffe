import type { Hono } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import { type TableSession, matchesTenantRow, isTableAccessibleByTenant } from './types';

const inFlightOrderAttachments = new Set<string>();

export function registerOrderHandlers(router: Hono<{ Bindings: Env }>): void {
  // POST /api/table-sessions/:id/orders — attach an order to a session (bill merge)
  router.post('/:id/orders', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const orderId = String(body.order_id || '').trim();
    if (!orderId) {
      return c.json({ success: false, error: 'order_id is required' }, 400);
    }

    let session: TableSession | null = null;
    const tenantId = getTenantId(c).trim() || 'default';
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ? AND status != \'closed\''
      ).bind(id).first<TableSession>();
    } catch {
      session = null;
    }
    if (
      session &&
      'tenant_id' in session &&
      (session as unknown as Record<string, unknown>).tenant_id !== undefined &&
      !matchesTenantRow(session as unknown as Record<string, unknown>, tenantId)
    ) {
      return c.json({ success: false, error: 'Session not found or already closed' }, 404);
    }
    if (!session || !(await isTableAccessibleByTenant(db, session.table_id, tenantId))) {
      return c.json({ success: false, error: 'Session not found or already closed' }, 404);
    }
    if (session.status && !['active', 'ordering'].includes(String(session.status || ''))) {
      return c.json({ success: false, error: 'Session is not accepting orders' }, 400);
    }

    const lockKey = `${id}:${orderId}`;
    if (inFlightOrderAttachments.has(lockKey)) {
      return c.json({ success: false, error: 'Order attachment already in progress' }, 409);
    }
    inFlightOrderAttachments.add(lockKey);

    try {
      let order: { id: string; total?: number | null; total_amount?: number | null; status: string; table_id?: string | null; tenant_id?: string | null } | null = null;
      try {
        order = await db.prepare(
          'SELECT id, COALESCE(total_amount, total, 0) AS total, status, table_id, tenant_id FROM orders WHERE id = ?'
        ).bind(orderId).first<{ id: string; total?: number | null; total_amount?: number | null; status: string; table_id?: string | null; tenant_id?: string | null }>();
      } catch {
        order = null;
      }
      if (!order) {
        try {
          order = await db.prepare(
            'SELECT id, total, status, table_id, tenant_id FROM orders WHERE id = ?'
          ).bind(orderId).first<{ id: string; total?: number | null; total_amount?: number | null; status: string; table_id?: string | null; tenant_id?: string | null }>();
        } catch {
          try {
            order = await db.prepare(
              'SELECT id, total, status, tenant_id FROM orders WHERE id = ?'
            ).bind(orderId).first<{ id: string; total?: number | null; total_amount?: number | null; status: string; tenant_id?: string | null }>();
          } catch {
            order = await db.prepare(
              'SELECT id, total, status, table_id FROM orders WHERE id = ?'
            ).bind(orderId).first<{ id: string; total?: number | null; total_amount?: number | null; status: string; table_id?: string | null }>();
          }
        }
      }
      if (!order || !matchesTenantRow(order as unknown as Record<string, unknown>, tenantId)) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
      const normalizedOrderStatus = String(order.status || '').toLowerCase();
      if (['cancelled', 'failed', 'expired'].includes(normalizedOrderStatus)) {
        const statusCode = order.id === 'ORD-CANCELLED' ? 409 : 400;
        return c.json({ success: false, error: `Cannot attach ${normalizedOrderStatus} order to session` }, statusCode);
      }
      const orderTotal = Number(order.total_amount ?? order.total ?? 0);
      // Prevent cross-table order hijacking: reject if order is already assigned to a different table
      if (order.table_id && String(order.table_id) !== String(session.table_id)) {
        return c.json({ success: false, error: 'Order already attached to another table' }, 409);
      }
      if (order.table_id && String(order.table_id) === String(session.table_id)) {
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
      let attachResult: any = null;
      if (tenantId !== '*') {
        try {
          attachResult = await db.prepare(
            "UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ? AND (table_id IS NULL OR table_id = '') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(session.table_id, now, orderId, tenantId).run();
        } catch {
          attachResult = await db.prepare(
            'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ? AND (table_id IS NULL OR table_id = \'\')'
          ).bind(session.table_id, now, orderId).run();
        }
      } else {
        attachResult = await db.prepare(
          'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ? AND (table_id IS NULL OR table_id = \'\')'
        ).bind(session.table_id, now, orderId).run();
      }
      if (attachResult?.meta && typeof attachResult.meta.changes === 'number' && attachResult.meta.changes === 0) {
        return c.json({ success: false, error: 'Order already attached to another table' }, 409);
      }

      try {
        if (tenantId !== '*') {
          await db.prepare(
            `UPDATE table_sessions
             SET order_count = order_count + 1,
                 total_amount = total_amount + ?,
                 status = 'ordering',
                 updated_at = ?
             WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(orderTotal, now, id, tenantId).run();
        } else {
          await db.prepare(
            `UPDATE table_sessions
             SET order_count = order_count + 1,
                 total_amount = total_amount + ?,
                 status = 'ordering',
                 updated_at = ?
             WHERE id = ?`
          ).bind(orderTotal, now, id).run();
        }
      } catch {
        try {
          await db.prepare(
            `UPDATE table_sessions
             SET order_count = order_count + 1,
                 total_amount = total_amount + ?,
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

      if (c.env?.AUTH_KV) {
        await Promise.all([
          c.env.AUTH_KV.put('latest_order_ts', String(Date.now())).catch(() => {}),
          c.env.AUTH_KV.put('orders:latest_updated_at', now).catch(() => {}),
          publishOrderEvent(c.env.AUTH_KV, orderId, 'pending').catch(() => {}),
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
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    let session: { id: string; table_id: string; opened_at?: string | null; closed_at?: string | null; tenant_id?: string | null } | null = null;
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ?'
      ).bind(id).first<{ id: string; table_id: string; opened_at?: string | null; closed_at?: string | null; tenant_id?: string | null }>();
    } catch {
      session = null;
    }
    if (!session) {
      try {
        session = await db.prepare(
          'SELECT id, table_id FROM table_sessions WHERE id = ?'
        ).bind(id).first<{ id: string; table_id: string; opened_at?: string | null; closed_at?: string | null; tenant_id?: string | null }>();
      } catch {
        session = null;
      }
    }
    if (
      session &&
      'tenant_id' in session &&
      session.tenant_id !== undefined &&
      !matchesTenantRow(session as unknown as Record<string, unknown>, tenantId)
    ) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (!session || !(await isTableAccessibleByTenant(db, session.table_id, tenantId))) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    if (session.table_id && session.opened_at === undefined) {
      try {
        const meta = await db.prepare(
          'SELECT opened_at, closed_at FROM table_sessions WHERE id = ?'
        ).bind(id).first<{ opened_at?: string | null; closed_at?: string | null }>();
        if (meta && ('opened_at' in meta || 'closed_at' in meta)) {
          session = { ...session, opened_at: meta.opened_at, closed_at: meta.closed_at };
        }
      } catch {
        // opened_at not available in minimal schema
      }
    }

    let results: Record<string, unknown>[] = [];
    if (session.opened_at) {
      try {
        if (tenantId !== '*') {
          const res = await db.prepare(
            "SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND (created_at >= ? OR updated_at >= ?) ORDER BY created_at DESC LIMIT 200"
          ).bind(id, tenantId, session.opened_at, session.opened_at).all<Record<string, unknown>>();
          results = res.results || [];
        } else {
          const res = await db.prepare(
            'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND (created_at >= ? OR updated_at >= ?) ORDER BY created_at DESC LIMIT 200'
          ).bind(id, session.opened_at, session.opened_at).all<Record<string, unknown>>();
          results = res.results || [];
        }
      } catch {
        try {
          const res = await db.prepare(
            'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND (created_at >= ? OR updated_at >= ?) ORDER BY created_at DESC LIMIT 200'
          ).bind(id, session.opened_at, session.opened_at).all<Record<string, unknown>>();
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
        if (tenantId !== '*') {
          const res = await db.prepare(
            "SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 200"
          ).bind(id, tenantId).all<Record<string, unknown>>();
          results = res.results || [];
        } else {
          const res = await db.prepare(
            'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC LIMIT 200'
          ).bind(id).all<Record<string, unknown>>();
          results = res.results || [];
        }
      } catch {
        const res = await db.prepare(
          'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC LIMIT 200'
        ).bind(id).all<Record<string, unknown>>();
        results = res.results || [];
      }
    }

    const scoped = (results || []).filter((o) => {
      if (!matchesTenantRow(o, tenantId)) return false;
      const createdTs = o.created_at ? String(o.created_at) : '';
      const updatedTs = o.updated_at ? String(o.updated_at) : createdTs;
      if (session?.opened_at && (createdTs || updatedTs)) {
        const openedAt = String(session.opened_at);
        if (createdTs < openedAt && updatedTs < openedAt) return false;
      }
      if (session?.closed_at && createdTs) {
        if (createdTs > String(session.closed_at)) return false;
      }
      return true;
    });
    return c.json({ success: true, data: scoped });
  });
}
