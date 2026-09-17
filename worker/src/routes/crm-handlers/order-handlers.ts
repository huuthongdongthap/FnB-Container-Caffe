import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import {
  placeOrder,
  VALID_CHANNELS,
  getFulfillment,
  listPickupPoints,
} from '@aura/domain-crm';
import { getCustomerMenu } from '@aura/domain-catalog';

export function registerOrderHandlers(router: Hono<{ Bindings: Env }>): void {
  /**
   * GET /api/crm/menu
   * Public customer-facing menu for online ordering. Strips internal fields
   * (cost/sku/supplier). Query: ?category=&include_unavailable=true
   */
  router.get('/menu', async (c) => {
    const db = c.env.AURA_DB;
    const category = c.req.query('category');
    const includeUnavailable = c.req.query('include_unavailable') === 'true';

    const menu = await getCustomerMenu(db, { category, includeUnavailable });
    return c.json({ success: true, data: menu });
  });

  /**
   * POST /api/crm/orders
   * Place an online order. Customer role uses their own id/phone;
   * staff/owner may pass customerId + customerPhone in body.
   * Body: { items: [{ menuItemId, quantity, note? }],
   *         channel: 'pickup' | 'delivery',
   *         customerId?, customerPhone?, customerName?, notes? }
   */
  router.post('/orders', requireAuth(['customer', 'staff', 'owner']), async (c) => {
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
    const customerPhone = body.customerPhone;

    const result = await placeOrder(db, {
      customerId,
      customerPhone,
      customerName: body.customerName,
      channel: body.channel as 'pickup' | 'delivery',
      items: body.items,
      notes: body.notes,
    });

    if (!result.ok) {
      const statusByCode: Record<string, number> = {
        empty_items: 400,
        invalid_item: 400,
        invalid_quantity: 400,
        invalid_channel: 400,
        d1_error: 500,
      };
      return c.json({ success: false, error: result.error }, statusByCode[result.code] ?? 400);
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
   * Auth: owner/staff (any order) or customer (own orders only).
   */
  router.get('/orders/:id/fulfillment', requireAuth(['customer', 'staff', 'owner']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const orderId = c.req.param('id');
    if (!orderId) {
      return c.json({ success: false, error: 'order id is required' }, 400);
    }

    // Customer role is scoped to own orders; staff/owner can read any.
    const customerScope = user.role === 'customer' ? user.id : undefined;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;

    const result = await getFulfillment(db, orderId, customerScope, kv);

    if (!result.ok) {
      const statusByCode = { not_found: 404, forbidden: 403, d1_error: 500 } as const;
      return c.json({ success: false, error: result.error }, statusByCode[result.code]);
    }

    return c.json({ success: true, data: result.fulfillment });
  });
}
