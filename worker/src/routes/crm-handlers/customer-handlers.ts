import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import {
  aggregateEvents,
  getCustomer360,
  getOrCreateReferralCode,
  getReferralStatus,
  redeemReferral,
} from '@aura/domain-crm';

export function registerCustomerHandlers(router: Hono<{ Bindings: Env }>): void {
  /**
   * GET /api/crm/customers/:id/events
   * Returns chronological event feed for a customer.
   * Auth: owner or staff only.
   */
  router.get('/customers/:id/events', requireAuth(['owner', 'staff']), async (c) => {
    const db = c.env.AURA_DB;
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }

    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const result = await aggregateEvents(db, customerId, { limit });

    return c.json({ success: true, data: result });
  });

  /**
   * GET /api/crm/customers/:id/profile
   * Unified CRM profile view (recent activity summary).
   */
  router.get('/customers/:id/profile', requireAuth(['owner', 'staff']), async (c) => {
    const db = c.env.AURA_DB;
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }

    const events = await aggregateEvents(db, customerId, { limit: 10 });
    return c.json({ success: true, data: { customerId, recentEvents: events.events, total: events.total } });
  });

  /**
   * GET /api/crm/customers/:id/360
   * Unified CRM view — account + tier + band + preferences + recent events.
   * Auth: owner or staff only.
   */
  router.get('/customers/:id/360', requireAuth(['owner', 'staff']), async (c) => {
    const db = c.env.AURA_DB;
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }

    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const eventLimitParam = c.req.query('eventLimit');
    const eventLimit = eventLimitParam ? parseInt(eventLimitParam, 10) : undefined;

    const result = await getCustomer360(db, customerId, kv, { eventLimit });

    return c.json({ success: true, data: result });
  });

  /**
   * GET /api/crm/customers/:id/referral
   * Get or create referral code + status for a customer.
   * Auth: owner, staff, or self.
   */
  router.get('/customers/:id/referral', requireAuth, async (c) => {
    const customerId = c.req.param('id');
    const auth = c.get('auth');

    if (auth?.role === 'customer' && auth.customerId !== customerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const db = c.env.AURA_DB;
    const status = await getReferralStatus(db, customerId);
    const code = status.code ?? (await getOrCreateReferralCode(db, customerId)).code;

    return c.json({ success: true, data: { code, status } });
  });

  /**
   * POST /api/crm/customers/:id/referral/redeem
   * Body: { code } — redeem a referral code for the current customer.
   * Auth: self only.
   */
  router.post('/customers/:id/referral/redeem', requireAuth, async (c) => {
    const customerId = c.req.param('id');
    const auth = c.get('auth');

    if (auth?.role !== 'customer' || auth.customerId !== customerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const code = body?.code;

    if (!code || typeof code !== 'string') {
      return c.json({ success: false, error: 'code is required' }, 400);
    }

    const db = c.env.AURA_DB;
    const result = await redeemReferral(db, code, customerId);

    if (!result.success) {
      return c.json({ success: false, error: result.reason }, 400);
    }

    return c.json({ success: true, data: result });
  });
}
