import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';
import { publishOrderEvent } from '@aura/domain-order';
import {
  placeOrder,
  VALID_CHANNELS,
  getFulfillment,
  listPickupPoints,
} from '@aura/domain-crm';

function hasCrmOrderTenantMismatch(c: any): boolean {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const queryTenant = String(
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    ''
  ).trim();
  const headerTenant = String(
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (queryTenant && headerTenant && queryTenant !== headerTenant) return true;
  const reqTenant = queryTenant || headerTenant;
  if (!user) {
    return reqTenant === '*' || reqTenant.toLowerCase() === 'hq';
  }
  if (isHQSuperAdmin(user)) return false;
  const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
  const boundTenant = userTenant || 'default';
  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    reqTenant === '*' ||
    reqTenant.toLowerCase() === 'hq'
  ) {
    return true;
  }
  return Boolean(reqTenant && reqTenant !== boundTenant);
}

function resolveCrmOrderTenantId(c: any, user?: { role?: string; tenantId?: string; tenant_id?: string }): string {
  if (!user) {
    return resolvePublicTenantId(c);
  }
  const raw = user.role === 'customer'
    ? (user.tenantId ?? user.tenant_id ?? getTenantId(c))
    : getTenantId(c);
  const trimmed = String(raw || '').trim() || 'default';
  return trimmed.toLowerCase() === 'hq' && isHQSuperAdmin(user) ? '*' : trimmed;
}

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
    const user = c.get('user') as { id: string; userId?: string; customerId?: string; customer_id?: string; sub?: string; role: string; tenantId?: string; tenant_id?: string } | undefined;

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (hasCrmOrderTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
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
    if (!body.customerPhone || typeof body.customerPhone !== 'string' || !body.customerPhone.trim() || body.customerPhone.trim().length > 20) {
      return c.json({ success: false, error: 'customerPhone is required and must be at most 20 characters' }, 400);
    }

    // Customer role: use own id. Staff/owner: must pass customerId in body.
    const isSelfCustomer = user.role === 'customer';
    const selfIds = [user.id, user.userId, user.customerId, user.customer_id, user.sub]
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    if (isSelfCustomer && typeof body.customerId === 'string' && body.customerId.trim() && !selfIds.includes(body.customerId.trim())) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const rawCustomerId = isSelfCustomer
      ? (user.customerId || user.customer_id || user.id)
      : (typeof body.customerId === 'string' ? body.customerId.trim() : '');
    if (!rawCustomerId) {
      return c.json({ success: false, error: 'customerId is required for staff-placed CRM orders' }, 400);
    }
    const customerId = rawCustomerId;
    const tenantId = resolveCrmOrderTenantId(c, user);
    let effectiveOrderTenant = tenantId;
    if (!isSelfCustomer && customerId) {
      try {
        const custRow = await db.prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1').bind(customerId).first<{ tenant_id?: string | null }>();
        if (custRow) {
          const custTenant = (custRow.tenant_id && String(custRow.tenant_id).trim()) || 'default';
          if (tenantId !== '*' && custTenant !== tenantId) {
            return c.json({ success: false, error: 'Forbidden' }, 403);
          }
          if (tenantId === '*') {
            effectiveOrderTenant = custTenant;
          }
        } else if (tenantId !== 'default' && tenantId !== '*') {
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
      } catch (err) {
        if (tenantId !== '*' && (!/no such column:\s*tenant_id/i.test(String(err)) || tenantId !== 'default')) {
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
      }
    }
    const finalOrderTenant = effectiveOrderTenant === '*' ? 'default' : effectiveOrderTenant;
    const customerPhone = body.customerPhone.trim();

    const result = await placeOrder(db, {
      customerId,
      customerPhone,
      customerName: body.customerName,
      channel: body.channel as 'pickup' | 'delivery',
      items: body.items,
      notes: body.notes,
      tenantId: finalOrderTenant,
    });

    if (!result.ok) {
      const err = result as { ok: false; error: string; code: string; status?: number };
      const statusByCode: Record<string, number> = {
        empty_items: 400,
        invalid_item: 400,
        invalid_items: 400,
        invalid_quantity: 400,
        invalid_channel: 400,
        d1_error: 500,
      };
      return c.json({ success: false, error: err.error }, (err.status ?? statusByCode[err.code] ?? 400) as any);
    }

    if (c.env?.AUTH_KV) {
      await publishOrderEvent(c.env.AUTH_KV, result.orderId, result.status, { tenantId: finalOrderTenant }).catch(() => {});
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
    if (hasCrmOrderTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const user = c.get('user' as any) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
    const tenantId = resolveCrmOrderTenantId(c, user);
    const points = await listPickupPoints(kv, tenantId);
    return c.json({ success: true, data: points });
  });

  /**
   * GET /api/crm/orders/:id/fulfillment
   * Fulfillment status + ETA for one order.
   * Auth: owner/staff/supervisor (same tenant) or customer (own orders only).
   */
  router.get('/orders/:id/fulfillment', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user') as { id: string; userId?: string; customerId?: string; customer_id?: string; role: string; tenantId?: string; tenant_id?: string } | undefined;

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (hasCrmOrderTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const orderId = c.req.param('id');
    if (!orderId) {
      return c.json({ success: false, error: 'order id is required' }, 400);
    }

    const tenantId = resolveCrmOrderTenantId(c, user);
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
    const customerScope = user.role === 'customer' ? (user.customerId || user.customer_id || user.id) : undefined;
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
