import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import {
  aggregateEvents,
  getCustomer360,
  getOrCreateReferralCode,
  getReferralStatus,
  redeemReferral,
} from '@aura/domain-crm';

export function registerCustomerHandlers(router: Hono<{ Bindings: Env }>): void {
  async function assertCustomerInTenant(db: import('@cloudflare/workers-types').D1Database, customerId: string, tenantId?: string): Promise<boolean> {
    if (!tenantId || tenantId === '*') return true;
    try {
      const row = await db.prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1').bind(customerId).first<{ tenant_id?: string | null }>();
      if (row) {
        const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
        return rowTenant === tenantId;
      }
      const orderRow = await db.prepare('SELECT tenant_id FROM orders WHERE customer_id = ? LIMIT 1').bind(customerId).first<{ tenant_id?: string | null }>().catch(() => null);
      if (orderRow) {
        const orderTenant = (orderRow.tenant_id && String(orderRow.tenant_id).trim()) || 'default';
        return orderTenant === tenantId;
      }
    } catch (err) {
      if (/no such column:\s*tenant_id/i.test(String(err))) {
        return tenantId === 'default';
      }
      return false;
    }
    return tenantId === 'default';
  }

  /**
   * GET /api/crm/customers/:id/events
   * Returns chronological event feed for a customer.
   * Auth: owner, manager, supervisor or staff only.
   */
  router.get('/customers/:id/events', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin']), async (c) => {
    const db = c.env.AURA_DB;
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    const tenantId = getTenantId(c as any);
    if (!(await assertCustomerInTenant(db, customerId, tenantId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 100) : undefined;

    const result = await aggregateEvents(db, customerId, { limit, tenantId });

    return c.json({ success: true, data: result });
  });

  /**
   * GET /api/crm/customers/:id/profile
   * Unified CRM profile view (recent activity summary).
   */
  router.get('/customers/:id/profile', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin']), async (c) => {
    const db = c.env.AURA_DB;
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    const tenantId = getTenantId(c as any);
    if (!(await assertCustomerInTenant(db, customerId, tenantId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const events = await aggregateEvents(db, customerId, { limit: 10, tenantId });
    return c.json({ success: true, data: { customerId, recentEvents: events.events, total: events.total } });
  });

  /**
   * GET /api/crm/customers/:id/360
   * Unified CRM view — account + tier + band + preferences + recent events.
   * Auth: owner, manager, supervisor or staff only.
   */
  router.get('/customers/:id/360', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin']), async (c) => {
    const db = c.env.AURA_DB;
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    const tenantId = getTenantId(c as any);
    if (!(await assertCustomerInTenant(db, customerId, tenantId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const eventLimitParam = c.req.query('eventLimit');
    const eventLimit = eventLimitParam ? Math.min(Math.max(1, parseInt(eventLimitParam, 10) || 20), 100) : undefined;

    const result = await getCustomer360(db, customerId, kv, { eventLimit, tenantId });

    return c.json({ success: true, data: result });
  });

  /**
   * GET /api/crm/customers/:id/referral
   * Get or create referral code + status for a customer.
   * Auth: owner, staff, supervisor, or self.
   */
  router.get('/customers/:id/referral', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const customerId = c.req.param('id');
    const auth = c.get('user');

    if (auth?.role === 'customer' && auth.id !== customerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    const db = c.env.AURA_DB;
    const tenantId = auth?.role === 'customer' ? auth?.tenantId : getTenantId(c as any);
    if (!(await assertCustomerInTenant(db, customerId, tenantId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const status = await getReferralStatus(db, customerId);
    const code = status.code ?? (await getOrCreateReferralCode(db, customerId)).code;

    return c.json({ success: true, data: { code, status } });
  });

  /**
   * POST /api/crm/customers/:id/referral/redeem
   * Body: { code } — redeem a referral code for the current customer.
   * Auth: self only.
   */
  router.post('/customers/:id/referral/redeem', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const customerId = c.req.param('id');
    const auth = c.get('user');

    if (auth?.role !== 'customer' || auth.id !== customerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const code = body?.code;

    if (!code || typeof code !== 'string') {
      return c.json({ success: false, error: 'code is required' }, 400);
    }

    const db = c.env.AURA_DB;
    const tenantId = auth?.tenantId || getTenantId(c as any);
    if (!(await assertCustomerInTenant(db, customerId, tenantId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const result = await redeemReferral(db, code, customerId, tenantId);

    if (!result.success) {
      return c.json({ success: false, error: result.reason }, 400);
    }

    return c.json({ success: true, data: result });
  });
}
