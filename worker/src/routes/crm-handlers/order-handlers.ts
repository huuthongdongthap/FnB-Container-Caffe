import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { publishOrderEvent } from '@aura/domain-order';
import {
  placeOrder,
  VALID_CHANNELS,
  getFulfillment,
  listPickupPoints,
} from '@aura/domain-crm';

export function registerOrderHandlers(router: Hono<{ Bindings: Env }>): void {

  /**
   * POST /api/crm/orders
   * Place an online order. Customer role uses their own id/phone;
   * staff/owner may pass customerId + customerPhone in body.
   * Body: { items: [{ menuItemId, quantity, note? }],
   *         channel: 'pickup' | 'delivery',
   *         customerId?, customerPhone?, customerName?, notes? }
   */
  router.post('/orders', requireAuth(['customer', 'staff', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<{
      items: { menuItemId: string; quantity: number; note?: string }[];
      channel?: string;
      customerId?: string;
      customerPhone?: string;
      customerName?: string;
      notes?: string;
    }>();

    if (!body.channel || !VALID_CHANNELS.includes(body.channel as any)) {
      return c.json({ success: false, error: `channel is required and must be one of: ${VALID_CHANNELS.join(', ')}` }, 400);
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return c.json({ success: false, error: 'items array is required' }, 400);
    }
    if (!body.customerPhone) {
      return c.json({ success: false, error: 'customerPhone is required' }, 400);
    }

    // Customer role: use own id. Staff/owner: must pass customerId in body.
    const customerId = user.role === 'customer' ? user.id : (body.customerId ?? user.id);
    const tenantId = user.role === 'customer' ? (user.tenantId || getTenantId(c as any)) : getTenantId(c as any);
    if (user.role !== 'customer' && body.customerId) {
      if (tenantId !== '*') {
        try {
          const custRow = await db.prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1').bind(body.customerId).first<{ tenant_id?: string | null }>();
          if (custRow) {
            const custTenant = (custRow.tenant_id && String(custRow.tenant_id).trim()) || 'default';
            if (custTenant !== tenantId) {
              return c.json({ success: false, error: 'Forbidden' }, 403);
            }
          } else if (tenantId !== 'default') {
            return c.json({ success: false, error: 'Forbidden' }, 403);
          }
        } catch (err) {
          if (!/no such column:\s*tenant_id/i.test(String(err)) || tenantId !== 'default') {
            return c.json({ success: false, error: 'Forbidden' }, 403);
          }
        }
      }
    }
    const customerPhone = body.customerPhone;

    const result = await placeOrder(db, {
      customerId,
      customerPhone,
      customerName: body.customerName,
      channel: body.channel as 'pickup' | 'delivery',
      items: body.items,
      notes: body.notes,
      tenantId,
    });

    if (!result.ok) {
      const err = result as { ok: false; error: string; code: string };
      const statusByCode: Record<string, number> = {
        empty_items: 400,
        invalid_item: 400,
        invalid_quantity: 400,
        invalid_channel: 400,
        d1_error: 500,
      };
      return c.json({ success: false, error: err.error }, (statusByCode[err.code] ?? 400) as any);
    }

    if (c.env?.AUTH_KV) {
      await publishOrderEvent(c.env.AUTH_KV, result.orderId, result.status).catch(() => {});
    }

    return c.json({
      success: true,
      data: {
        orderId: result.orderId,
        status: result.status,
        channel: result.channel,
        totalCents: result.totalCents,
        items: result.items,
      },
    }, 201);
  });

  /**
   * GET /api/crm/fulfillment/locations
   * Public pickup-point list for the ordering surface.
   * No auth — customer needs to see pickup point before ordering.
   */
  router.get('/fulfillment/locations', async (c) => {
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const points = await listPickupPoints(kv);
    return c.json({ success: true, data: points });
  });

  /**
   * GET /api/crm/orders/:id/fulfillment
   * Fulfillment status + ETA for one order.
   * Auth: owner/staff/supervisor (same tenant) or customer (own orders only).
   */
  router.get('/orders/:id/fulfillment', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const orderId = c.req.param('id');
    if (!orderId) {
      return c.json({ success: false, error: 'order id is required' }, 400);
    }

    const tenantId = user.role === 'customer' ? (user.tenantId || getTenantId(c as any)) : getTenantId(c as any);
    if (user.role !== 'customer') {
      if (tenantId !== '*') {
        try {
          const orderRow = await db.prepare('SELECT tenant_id, customer_id FROM orders WHERE id = ? LIMIT 1').bind(orderId).first<{ tenant_id?: string | null; customer_id?: string | null }>();
          if (orderRow) {
            let orderTenant = (orderRow.tenant_id && String(orderRow.tenant_id).trim()) || '';
            if (!orderTenant && orderRow.customer_id) {
              const custRow = await db.prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1').bind(orderRow.customer_id).first<{ tenant_id?: string | null }>().catch(() => null);
              if (custRow?.tenant_id) {
                orderTenant = String(custRow.tenant_id).trim();
              }
            }
            const resolvedTenant = orderTenant || 'default';
            if (resolvedTenant !== tenantId) {
              return c.json({ success: false, error: 'Forbidden' }, 403);
            }
          }
        } catch (err) {
          if (!/no such column:\s*tenant_id/i.test(String(err)) && tenantId !== 'default') {
            return c.json({ success: false, error: 'Forbidden' }, 403);
          }
        }
      }
    }

    // Customer role is scoped to own orders; staff/owner can read any in their tenant.
    const customerScope = user.role === 'customer' ? user.id : undefined;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;

    const result = await getFulfillment(db, orderId, customerScope, kv, tenantId);

    if (!result.ok) {
      const err = result as { ok: false; error: string; code: 'not_found' | 'forbidden' | 'd1_error' };
      const statusByCode = { not_found: 404, forbidden: 403, d1_error: 500 } as const;
      return c.json({ success: false, error: err.error }, statusByCode[err.code]);
    }

    return c.json({ success: true, data: result.fulfillment });
  });
}
