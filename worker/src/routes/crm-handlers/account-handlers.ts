import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import {
  getCustomerAccount,
  updateConsent,
  CONSENT_PURPOSES,
} from '@aura/domain-crm';

export function registerAccountHandlers(router: Hono<{ Bindings: Env }>): void {
  /**
   * GET /api/crm/account/me
   * Returns the authenticated customer's own account view.
   * Auth: any authenticated user (customer sees own, staff sees any via :id).
   */
  router.get('/account/me', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
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
  router.patch('/account/consent', requireAuth(['customer', 'staff', 'waiter', 'cashier', 'supervisor', 'manager', 'admin', 'owner']), async (c) => {
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
    if (user.role !== 'customer') {
      const tenantId = getTenantId(c as any);
      if (tenantId !== '*') {
        try {
          const custRow = await db.prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1').bind(targetCustomerId).first<{ tenant_id?: string | null }>();
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

    const result = await updateConsent(db, {
      customerId: targetCustomerId,
      purpose: body.purpose,
      granted: body.granted,
      source: user.role === 'customer' ? 'customer_portal' : 'staff_action',
      policyVersion: body.policyVersion,
      actorId: user.id,
      actorRole: (user.role === 'customer' ? 'customer' : user.role) as import('@aura/domain-crm').ConsentUpdate['actorRole'],
    });

    if (!result.ok) {
      const err = result as { ok: false; error: string; code: string };
      const status = (err.code === 'invalid_purpose' ? 400 : 403) as 400 | 403;
      return c.json({ success: false, error: err.error }, status);
    }

    return c.json({ success: true, data: result.consent });
  });

  /**
   * GET /api/crm/consent-purposes
   * Returns the list of valid consent purposes (for UI dropdowns).
   * Public — no auth required.
   */
  router.get('/consent-purposes', async (c) => {
    return c.json({ success: true, data: CONSENT_PURPOSES });
  });
}
