import type { Hono } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import type { TableSession } from './types';

function matchesTenantRow(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (!row) return false;
  if (!('tenant_id' in row) || row.tenant_id === undefined) return true;
  const rowTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default';
  return rowTenant === tenantId;
}

async function isTableAccessibleByTenant(db: D1Database, tableId: string, tenantId: string): Promise<boolean> {
  try {
    const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(tableId).first<Record<string, unknown>>();
    if (!table) return true;
    return matchesTenantRow(table, tenantId);
  } catch {
    return true;
  }
}

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
    const tenantId = getTenantId(c);
    try {
      session = await db.prepare(
        'SELECT * FROM table_sessions WHERE id = ? AND status != \'closed\''
      ).bind(id).first<TableSession>();
    } catch {
      session = null;
    }
    if (!session || !(await isTableAccessibleByTenant(db, session.table_id, tenantId))) {
      return c.json({ success: false, error: 'Session not found or already closed' }, 404);
    }

    const order = await db.prepare(
      'SELECT * FROM orders WHERE id = ?'
    ).bind(orderId).first<{ id: string; total: number; status: string; table_id?: string | null; tenant_id?: string | null }>();
    if (!order || !matchesTenantRow(order as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    if (order.status === 'cancelled') {
      return c.json({ success: false, error: 'Cannot attach cancelled order to session' }, 409);
    }
    if (order.table_id && order.table_id === session.table_id) {
      return c.json({ success: true, data: session, idempotent: true });
    }

    const now = new Date().toISOString();
    await db.prepare(
      'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ?'
    ).bind(session.table_id, now, orderId).run();

    try {
      await db.prepare(
        `UPDATE table_sessions
         SET order_count = order_count + 1,
             total_amount = total_amount + ?,
             status = 'ordering',
             updated_at = ?
         WHERE id = ?`
      ).bind(order.total, now, id).run();
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
  });

  // GET /api/table-sessions/:id/orders — list orders attached to a session
  router.get('/:id/orders', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const id = c.req.param('id');
    let session: { id: string; table_id: string } | null = null;
    try {
      session = await db.prepare(
        'SELECT id, table_id FROM table_sessions WHERE id = ?'
      ).bind(id).first<{ id: string; table_id: string }>();
    } catch {
      session = null;
    }
    if (!session || !(await isTableAccessibleByTenant(db, session.table_id, tenantId))) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    const { results } = await db.prepare(
      'SELECT * FROM orders WHERE table_id = (SELECT table_id FROM table_sessions WHERE id = ?) ORDER BY created_at DESC'
    ).bind(id).all<Record<string, unknown>>();
    const scoped = (results || []).filter((r) => matchesTenantRow(r, tenantId));
    return c.json({ success: true, data: scoped });
  });
}
