import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
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
  router.get('/account/me', requireAuth(['customer', 'staff', 'owner']), async (c) => {
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
  router.patch('/account/consent', requireAuth(['customer', 'staff', 'owner']), async (c) => {
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
  router.get('/consent-purposes', async (c) => {
    return c.json({ success: true, data: CONSENT_PURPOSES });
  });
}