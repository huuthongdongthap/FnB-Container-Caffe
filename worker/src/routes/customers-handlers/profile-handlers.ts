import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { resolvePilotStore } from '../../lib/pilot-store';
import { updateCustomerProfileSchema, zodErrorResponse } from '../../lib/validators';
import { type CustomerRecord, PROFILE_SQL } from './types';

function resolveCustomerTenant(c: { get: (k: string) => unknown; env: Env }): string {
  const user = c.get('user') as { tenantId?: string } | undefined;
  if (user?.tenantId) {
    return user.tenantId;
  }
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

export function registerProfileHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/customers/me — get current customer by JWT (customer role only)
  router.get('/me', requireAuth(['customer']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const tenantId = resolveCustomerTenant(c as unknown as { get: (k: string) => unknown; env: Env });

    let customer: CustomerRecord | null = null;
    try {
      customer = await db.prepare(
        `${PROFILE_SQL}WHERE c.id = ? AND COALESCE(NULLIF(c.tenant_id, ''), 'default') = ?`
      ).bind(customerId, tenantId).first<CustomerRecord>();
    } catch {
      try {
        customer = await db.prepare(
          `${PROFILE_SQL}WHERE c.id = ?`
        ).bind(customerId).first<CustomerRecord>();
      } catch {
        customer = await db.prepare(
          'SELECT c.* FROM customers c WHERE c.id = ?'
        ).bind(customerId).first<CustomerRecord>();
      }
    }

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    return c.json({ success: true, data: customer });
  });

  // PATCH /api/customers/me — update current customer profile (customer role only)
  router.patch('/me', requireAuth(['customer']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const tenantId = resolveCustomerTenant(c as unknown as { get: (k: string) => unknown; env: Env });

    const body = await c.req.json() as Record<string, unknown>;
    const parsed = updateCustomerProfileSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const data = parsed.data;

    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) {
      updates.push('name = ?'); params.push(data.name);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?'); params.push(data.phone);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'Không có trường nào để cập nhật' }, 400);
    }

    const baseUpdates = [...updates];
    updates.push('updated_at = CURRENT_TIMESTAMP');
    try {
      await db.prepare(
        `UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?`
      ).bind(...params, customerId, tenantId).run();
    } catch {
      try {
        await db.prepare(
          `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...params, customerId).run();
      } catch {
        await db.prepare(
          `UPDATE customers SET ${baseUpdates.join(', ')} WHERE id = ?`
        ).bind(...params, customerId).run();
      }
    }

    let customer: CustomerRecord | null = null;
    try {
      customer = await db.prepare(
        `${PROFILE_SQL}WHERE c.id = ? AND COALESCE(NULLIF(c.tenant_id, ''), 'default') = ?`
      ).bind(customerId, tenantId).first<CustomerRecord>();
    } catch {
      try {
        customer = await db.prepare(
          `${PROFILE_SQL}WHERE c.id = ?`
        ).bind(customerId).first<CustomerRecord>();
      } catch {
        customer = await db.prepare(
          'SELECT c.* FROM customers c WHERE c.id = ?'
        ).bind(customerId).first<CustomerRecord>();
      }
    }

    return c.json({ success: true, data: customer });
  });
}
