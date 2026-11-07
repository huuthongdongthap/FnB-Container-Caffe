import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import {
  getCustomerAccount,
  updateConsent,
  CONSENT_PURPOSES,
} from '@aura/domain-crm';

const CRM_MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor', 'staff']);

function hasCrmAccountTenantMismatch(c: any): boolean {
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

function resolveCrmAccountTenantId(c: any, user: { role?: string; tenantId?: string; tenant_id?: string }): string {
  const raw = user.role === 'customer'
    ? (user.tenantId ?? user.tenant_id ?? getTenantId(c))
    : getTenantId(c);
  const trimmed = String(raw || '').trim() || 'default';
  return trimmed.toLowerCase() === 'hq' && isHQSuperAdmin(user) ? '*' : trimmed;
}

export function registerAccountHandlers(router: Hono<{ Bindings: Env }>): void {
  /**
   * GET /api/crm/account/me
   * Returns the authenticated customer's own account view.
   * Auth: any authenticated user (customer sees own, staff sees any via :id).
   */
  router.get('/account/me', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user') as { id: string; userId?: string; customerId?: string; customer_id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (hasCrmAccountTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const tenantId = resolveCrmAccountTenantId(c, user);
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const accountOwnerId = user.customerId || user.customer_id || user.userId || user.id;
    const account = await getCustomerAccount(db, accountOwnerId, { tenantId, kv });
    return c.json({ success: true, data: account });
  });

  /**
   * PATCH / POST /api/crm/account/consent
   * Update a consent preference. Customer can update their own;
   * staff/owner can update any customer's (pass customerId in body).
   * Body: { purpose: string, granted: boolean, policyVersion?: string }
   */
  const handleUpdateConsent = async (c: any) => {
    const db = c.env.AURA_DB;
    const user = c.get('user') as { id: string; userId?: string; customerId?: string; customer_id?: string; sub?: string; role: string; tenantId?: string; tenant_id?: string } | undefined;

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (hasCrmAccountTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();

    if (!body.purpose || typeof body.granted !== 'boolean') {
      return c.json({ success: false, error: 'purpose and granted are required' }, 400);
    }

    // Customer role can only update their own consents; staff override requires management role.
    if (user.role !== 'customer' && !CRM_MANAGEMENT_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const selfIds = [user.id, user.userId, user.customerId, user.customer_id, user.sub]
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    if (user.role === 'customer' && body.customerId !== undefined && !selfIds.includes(String(body.customerId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const targetCustomerId = user.role === 'customer'
      ? (user.customerId || user.customer_id || user.id)
      : (body.customerId ?? user.id);
    const tenantId = resolveCrmAccountTenantId(c, user);
    let effectiveConsentTenant = tenantId;
    if (user.role !== 'customer') {
      try {
        const custRow = (await db.prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1').bind(targetCustomerId).first()) as { tenant_id?: string | null } | null;
        if (custRow) {
          const custTenant = (custRow.tenant_id && String(custRow.tenant_id).trim()) || 'default';
          if (tenantId !== '*' && custTenant !== tenantId) {
            return c.json({ success: false, error: 'Forbidden' }, 403);
          }
          if (tenantId === '*') {
            effectiveConsentTenant = custTenant;
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
    const finalConsentTenant = effectiveConsentTenant === '*' ? 'default' : effectiveConsentTenant;

    const result = await updateConsent(
      db,
      {
        customerId: targetCustomerId,
        purpose: body.purpose,
        granted: body.granted,
        source: user.role === 'customer' ? 'customer_portal' : 'staff_action',
        policyVersion: body.policyVersion,
        actorId: user.id,
        actorRole: (user.role === 'customer' ? 'customer' : user.role) as import('@aura/domain-crm').ConsentUpdate['actorRole'],
        tenantId: finalConsentTenant,
      },
      finalConsentTenant,
    );

    if (!result.ok) {
      const err = result as { ok: false; error: string; code: string };
      const status = (err.code === 'invalid_purpose' ? 400 : 403) as 400 | 403;
      return c.json({ success: false, error: err.error }, status);
    }

    return c.json({ success: true, data: result.consent });
  };

  router.patch('/account/consent', requireAuth(['customer', 'staff', 'supervisor', 'manager', 'admin', 'owner']), handleUpdateConsent);
  router.post('/account/consent', requireAuth(['customer', 'staff', 'supervisor', 'manager', 'admin', 'owner']), handleUpdateConsent);

  /**
   * GET /api/crm/consent-purposes
   * Returns the list of valid consent purposes (for UI dropdowns).
   * Public — no auth required.
   */
  router.get('/consent-purposes', async (c) => {
    return c.json({ success: true, data: CONSENT_PURPOSES });
  });
}
