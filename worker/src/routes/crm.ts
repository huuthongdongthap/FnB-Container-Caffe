/**
 * CRM Routes — /api/crm
 * Aggregated customer event timeline + self-service account endpoints.
 */
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { aggregateEvents, getCustomerAccount, updateConsent, CONSENT_PURPOSES, placeOrder, VALID_CHANNELS, getFulfillment, listPickupPoints, getCustomer360, listSegments, buildSegment, getOrCreateReferralCode, getReferralCode, redeemReferral, getReferralStatus } from '@aura/domain-crm';
import { getCustomerMenu } from '@aura/domain-catalog';

export const crmRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/crm/customers/:id/events
 * Returns chronological event feed for a customer.
 * Auth: owner or staff only.
 */
crmRouter.get('/customers/:id/events', requireAuth(['owner', 'staff']), async (c) => {
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
crmRouter.get('/customers/:id/profile', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const customerId = c.req.param('id');

  if (!customerId) {
    return c.json({ success: false, error: 'customerId is required' }, 400);
  }

  const events = await aggregateEvents(db, customerId, { limit: 10 });
  return c.json({ success: true, data: { customerId, recentEvents: events.events, total: events.total } });
});

// ─────────────────────────────────────────────────────────────────────
// M4 Online — Customer self-service account endpoints.
// Auth: customer role (own account only) or staff/owner.
// ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/crm/account/me
 * Returns the authenticated customer's own account view.
 * Auth: any authenticated user (customer sees own, staff sees any via :id).
 */
crmRouter.get('/account/me', requireAuth(['customer', 'staff', 'owner']), async (c) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const account = await getCustomerAccount(db, user.id);
  return c.json({ success: true, data: account });
});

/**
 * PATCH /api/crm/account/consent
 * Update a consent preference. Customer can update their own;
 * staff/owner can update any customer's (pass customerId in body).
 * Body: { purpose: string, granted: boolean, policyVersion?: string }
 */
crmRouter.patch('/account/consent', requireAuth(['customer', 'staff', 'owner']), async (c) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<{ purpose: string; granted: boolean; policyVersion?: string; customerId?: string }>();

  if (!body.purpose || typeof body.granted !== 'boolean') {
    return c.json({ success: false, error: 'purpose and granted are required' }, 400);
  }

  // Customer role can only update their own consents.
  const targetCustomerId = user.role === 'customer' ? user.id : (body.customerId ?? user.id);

  const result = await updateConsent(db, {
    customerId: targetCustomerId,
    purpose: body.purpose,
    granted: body.granted,
    source: user.role === 'customer' ? 'customer_portal' : 'staff_action',
    policyVersion: body.policyVersion,
    actorId: user.id,
    actorRole: user.role as 'customer' | 'staff' | 'owner',
  });

  if (!result.ok) {
    const status = result.code === 'invalid_purpose' ? 400 : 403;
    return c.json({ success: false, error: result.error }, status);
  }

  return c.json({ success: true, data: result.consent });
});

/**
 * GET /api/crm/consent-purposes
 * Returns the list of valid consent purposes (for UI dropdowns).
 * Public — no auth required.
 */
crmRouter.get('/consent-purposes', async (c) => {
  return c.json({ success: true, data: CONSENT_PURPOSES });
});

// ─────────────────────────────────────────────────────────────────────
// M4 Online — Public Digital Menu (customer-facing, no auth).
// ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/crm/menu
 * Public customer-facing menu for online ordering. Strips internal fields
 * (cost/sku/supplier). Query: ?category=&include_unavailable=true
 */
crmRouter.get('/menu', async (c) => {
  const db = c.env.AURA_DB;
  const category = c.req.query('category');
  const includeUnavailable = c.req.query('include_unavailable') === 'true';

  const menu = await getCustomerMenu(db, { category, includeUnavailable });
  return c.json({ success: true, data: menu });
});

// ─────────────────────────────────────────────────────────────────────
// M4 Online — Online Order (customer self-service).
// Auth: customer (own orders) or staff/owner (on behalf of customer).
// ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/crm/orders
 * Place an online order. Customer role uses their own id/phone;
 * staff/owner may pass customerId + customerPhone in body.
 * Body: { items: [{ menuItemId, quantity, note? }],
 *         channel: 'pickup' | 'delivery',
 *         customerId?, customerPhone?, customerName?, notes? }
 */
crmRouter.post('/orders', requireAuth(['customer', 'staff', 'owner']), async (c) => {
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

// ─────────────────────────────────────────────────────────────────────
// M4 Online — Pickup / Delivery fulfillment view.
// ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/crm/fulfillment/locations
 * Public pickup-point list for the ordering surface.
 * No auth — customer needs to see pickup point before ordering.
 */
crmRouter.get('/fulfillment/locations', async (c) => {
  const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
  const points = await listPickupPoints(kv);
  return c.json({ success: true, data: points });
});

/**
 * GET /api/crm/orders/:id/fulfillment
 * Fulfillment status + ETA for one order.
 * Auth: owner/staff (any order) or customer (own orders only).
 */
crmRouter.get('/orders/:id/fulfillment', requireAuth(['customer', 'staff', 'owner']), async (c) => {
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

/**
 * GET /api/crm/customers/:id/360
 * Unified CRM view — account + tier + band + preferences + recent events.
 * Auth: owner or staff only.
 */
crmRouter.get('/customers/:id/360', requireAuth(['owner', 'staff']), async (c) => {
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
 * GET /api/crm/segments
 * List all segment definitions with counts (no member list).
 * Auth: owner or staff only.
 */
crmRouter.get('/segments', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;

  const segments = await listSegments(db, kv);

  return c.json({ success: true, data: segments });
});

/**
 * GET /api/crm/segments/:key/customers
 * Paginated member list for a segment.
 * Auth: owner or staff only.
 */
crmRouter.get('/segments/:key/customers', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
  const key = c.req.param('key');

  if (!key) {
    return c.json({ success: false, error: 'segment key is required' }, 400);
  }

  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  const result = await buildSegment(db, key, kv, { limit, offset });

  return c.json({ success: true, data: result });
});

/**
 * GET /api/crm/customers/:id/referral
 * Get or create referral code + status for a customer.
 * Auth: owner, staff, or self.
 */
crmRouter.get('/customers/:id/referral', requireAuth, async (c) => {
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
crmRouter.post('/customers/:id/referral/redeem', requireAuth, async (c) => {
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
