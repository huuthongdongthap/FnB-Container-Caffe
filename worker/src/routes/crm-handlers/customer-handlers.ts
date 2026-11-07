import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import {
  aggregateEvents,
  getCustomer360,
  getOrCreateReferralCode,
  getReferralStatus,
  redeemReferral,
} from '@aura/domain-crm';

const CRM_MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor']);

function hasCrmCustomerTenantMismatch(c: any): boolean {
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
  if (reqTenant && reqTenant !== boundTenant) return true;
  return false;
}

function resolveCrmCustomerTenantId(c: any): string {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const raw = user?.role === 'customer'
    ? (user.tenantId ?? user.tenant_id ?? getTenantId(c))
    : getTenantId(c);
  const trimmed = String(raw || '').trim() || 'default';
  if (trimmed.toLowerCase() === 'hq' && isHQSuperAdmin(user)) {
    return '*';
  }
  return trimmed;
}

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
   * Auth: owner, admin, manager, supervisor only.
   */
  router.get('/customers/:id/events', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    if (user?.role && !CRM_MANAGEMENT_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    if (hasCrmCustomerTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    const tenantId = resolveCrmCustomerTenantId(c);
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
  router.get('/customers/:id/profile', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    if (user?.role && !CRM_MANAGEMENT_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    if (hasCrmCustomerTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    const tenantId = resolveCrmCustomerTenantId(c);
    if (!(await assertCustomerInTenant(db, customerId, tenantId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const events = await aggregateEvents(db, customerId, { limit: 10, tenantId });
    return c.json({ success: true, data: { customerId, recentEvents: events.events, total: events.total } });
  });

  /**
   * GET /api/crm/customers/:id/360
   * Unified CRM view — account + tier + band + preferences + recent events.
   * Auth: owner, admin, manager, supervisor only.
   */
  router.get('/customers/:id/360', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    if (user?.role && !CRM_MANAGEMENT_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    if (hasCrmCustomerTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const customerId = c.req.param('id');

    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    const tenantId = resolveCrmCustomerTenantId(c);
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
   * Auth: owner, admin, manager, supervisor, or self.
   */
  router.get('/customers/:id/referral', requireAuth(['customer', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const customerId = c.req.param('id');
    const auth = c.get('user') as { id?: string; userId?: string; customerId?: string; customer_id?: string; sub?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
    const authIds = [auth?.id, auth?.userId, auth?.customerId, auth?.customer_id, auth?.sub]
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

    if (auth?.role === 'customer' && !authIds.includes(customerId)) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (auth?.role && auth.role !== 'customer' && !CRM_MANAGEMENT_ROLES.has(auth.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    if (hasCrmCustomerTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = resolveCrmCustomerTenantId(c);
    if (!(await assertCustomerInTenant(db, customerId, tenantId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const status = await getReferralStatus(db, customerId, tenantId);
    let effectiveReferralTenant = tenantId;
    if (!status.code) {
      const normalizedRefTenant = (tenantId && String(tenantId).trim()) || 'default';
      const custExists = await (normalizedRefTenant !== '*'
        ? db
            .prepare("SELECT id, tenant_id FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
            .bind(customerId, normalizedRefTenant)
            .first<{ id?: string; tenant_id?: string | null }>()
            .catch(() =>
              normalizedRefTenant === 'default'
                ? db.prepare('SELECT id FROM customers WHERE id = ? LIMIT 1').bind(customerId).first<{ id?: string; tenant_id?: string | null }>()
                : null
            )
        : db.prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1').bind(customerId).first<{ id?: string; tenant_id?: string | null }>().catch(() =>
            db.prepare('SELECT id FROM customers WHERE id = ? LIMIT 1').bind(customerId).first<{ id?: string; tenant_id?: string | null }>()
          ))
        .catch(() => null);
      const loyaltyExists = custExists
        ? custExists
        : await (normalizedRefTenant !== '*'
            ? db
                .prepare("SELECT customer_id AS id, tenant_id FROM loyalty_accounts WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
                .bind(customerId, normalizedRefTenant)
                .first<{ id?: string; tenant_id?: string | null }>()
                .catch(() =>
                  normalizedRefTenant === 'default'
                    ? db.prepare('SELECT customer_id AS id FROM loyalty_accounts WHERE customer_id = ? LIMIT 1').bind(customerId).first<{ id?: string; tenant_id?: string | null }>()
                    : null
                )
            : db.prepare('SELECT customer_id AS id, tenant_id FROM loyalty_accounts WHERE customer_id = ? LIMIT 1').bind(customerId).first<{ id?: string; tenant_id?: string | null }>().catch(() =>
                db.prepare('SELECT customer_id AS id FROM loyalty_accounts WHERE customer_id = ? LIMIT 1').bind(customerId).first<{ id?: string; tenant_id?: string | null }>()
              ))
            .catch(() => null);
      if (!loyaltyExists) {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }
      if (effectiveReferralTenant === '*' && loyaltyExists.tenant_id && String(loyaltyExists.tenant_id).trim() && String(loyaltyExists.tenant_id).trim() !== '*') {
        effectiveReferralTenant = String(loyaltyExists.tenant_id).trim();
      }
    }
    const code = status.code ?? (await getOrCreateReferralCode(db, customerId, effectiveReferralTenant === '*' ? 'default' : effectiveReferralTenant)).code;

    return c.json({ success: true, data: { code, status } });
  });

  /**
   * POST /api/crm/customers/:id/referral/redeem
   * Body: { code } — redeem a referral code for the current customer.
   * Auth: self only.
   */
  router.post('/customers/:id/referral/redeem', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const customerId = c.req.param('id');
    const auth = c.get('user') as { id?: string; userId?: string; customerId?: string; customer_id?: string; sub?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
    const authIds = [auth?.id, auth?.userId, auth?.customerId, auth?.customer_id, auth?.sub]
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

    if (auth?.role !== 'customer' || !authIds.includes(customerId)) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (hasCrmCustomerTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const code = body?.code;

    if (!code || typeof code !== 'string') {
      return c.json({ success: false, error: 'code is required' }, 400);
    }

    const db = c.env.AURA_DB;
    const tenantId = resolveCrmCustomerTenantId(c);
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
