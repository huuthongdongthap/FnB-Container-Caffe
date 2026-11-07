import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { resolvePilotStore } from '../../lib/pilot-store';
import { updateCustomerProfileSchema, zodErrorResponse } from '../../lib/validators';
import { type CustomerRecord, PROFILE_SQL } from './types';

function resolveCustomerTenantScope(c: {
  get: (k: string) => unknown;
  req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
  env: Env;
}): { tenantId: string; forbidden: boolean } {
  const user = c.get('user') as { tenantId?: string; tenant_id?: string } | undefined;
  const tokenTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
  const queryTenant = String(
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    ''
  ).trim();
  const headerTenant = String(
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Store-ID') ||
    c.req.header('x-store-id') ||
    ''
  ).trim();
  const reqTenant = queryTenant || headerTenant;
  const ctxTenant = String((c.get('tenantId') as string | undefined) || '').trim();

  let pilotTenant = 'default';
  try {
    pilotTenant = resolvePilotStore(c.env);
  } catch {
    pilotTenant = 'default';
  }

  const boundTenant = tokenTenant || ctxTenant || pilotTenant || 'default';
  if (
    boundTenant === '*' ||
    boundTenant.toLowerCase() === 'hq' ||
    reqTenant === '*' ||
    reqTenant.toLowerCase() === 'hq' ||
    ctxTenant === '*' ||
    ctxTenant.toLowerCase() === 'hq' ||
    (queryTenant && headerTenant && queryTenant !== headerTenant) ||
    (tokenTenant && ctxTenant && ctxTenant !== tokenTenant) ||
    (queryTenant && queryTenant !== boundTenant) ||
    (headerTenant && headerTenant !== boundTenant)
  ) {
    return { tenantId: boundTenant === '*' || boundTenant.toLowerCase() === 'hq' ? 'default' : boundTenant, forbidden: true };
  }

  return { tenantId: boundTenant, forbidden: false };
}

export function registerProfileHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/customers/me — get current customer by JWT (customer role only)
  router.get('/me', requireAuth(['customer']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; customer_id?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.customer_id || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const scope = resolveCustomerTenantScope(c as unknown as Parameters<typeof resolveCustomerTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const tenantId = scope.tenantId;

    let customer: CustomerRecord | null = null;
    try {
      customer = await db.prepare(
        `${PROFILE_SQL}WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?`
      ).bind(customerId, tenantId).first<CustomerRecord>();
    } catch {
      if (tenantId === 'default') {
        try {
          customer = await db.prepare(
            `${PROFILE_SQL}WHERE c.id = ?`
          ).bind(customerId).first<CustomerRecord>();
        } catch {
          customer = await db.prepare(
            'SELECT c.* FROM customers c WHERE c.id = ?'
          ).bind(customerId).first<CustomerRecord>();
        }
      } else {
        customer = await db.prepare(
          "SELECT c.* FROM customers c WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?"
        ).bind(customerId, tenantId).first<CustomerRecord>().catch(() => null);
      }
    }

    if (customer) {
      const rec = customer as unknown as Record<string, unknown>;
      if ('tenant_id' in rec && rec.tenant_id !== undefined) {
        const resolvedRowTenant = typeof rec.tenant_id === 'string' && rec.tenant_id.trim() !== '' ? rec.tenant_id.trim() : 'default';
        if (resolvedRowTenant !== tenantId) {
          customer = null;
        }
      } else if (tenantId !== 'default') {
        customer = null;
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
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; customer_id?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.customer_id || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const scope = resolveCustomerTenantScope(c as unknown as Parameters<typeof resolveCustomerTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const tenantId = scope.tenantId;

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

    if (typeof data.phone === 'string' && data.phone.trim() !== '') {
      const trimmedPhone = data.phone.trim();
      let existingPhone: { id?: string; phone?: string | null; tenant_id?: string | null } | null = null;
      try {
        existingPhone = await db
          .prepare(
            `SELECT id, phone, tenant_id FROM customers WHERE phone = ? AND id != ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1`
          )
          .bind(trimmedPhone, customerId, tenantId, tenantId)
          .first<{ id?: string; phone?: string | null; tenant_id?: string | null }>();
      } catch (err) {
        if (tenantId === 'default' && /no such column:\s*tenant_id/i.test(String(err))) {
          existingPhone = await db
            .prepare(`SELECT id, phone FROM customers WHERE phone = ? AND id != ? LIMIT 1`)
            .bind(trimmedPhone, customerId)
            .first<{ id?: string; phone?: string | null }>()
            .catch(() => null);
        }
      }
      if (
        existingPhone &&
        existingPhone.id &&
        existingPhone.id !== customerId &&
        (existingPhone.phone === undefined || String(existingPhone.phone).trim() === trimmedPhone)
      ) {
        const existingTenant =
          existingPhone.tenant_id && String(existingPhone.tenant_id).trim() !== ''
            ? String(existingPhone.tenant_id).trim()
            : 'default';
        if (
          tenantId === '*' ||
          !('tenant_id' in existingPhone) ||
          existingPhone.tenant_id === undefined ||
          existingTenant === tenantId
        ) {
          return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
        }
      }
    }

    const baseUpdates = [...updates];
    updates.push('updated_at = CURRENT_TIMESTAMP');
    try {
      await db.prepare(
        `UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      ).bind(...params, customerId, tenantId).run();
    } catch (err) {
      const msg = String(err);
      if (/UNIQUE constraint failed/i.test(msg)) {
        return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
      }
      const existing = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(customerId).first<{ id?: string; tenant_id?: string | null }>().catch(() => null);
      const existingTenant = existing?.tenant_id && existing.tenant_id.trim() !== '' ? existing.tenant_id.trim() : 'default';
      if ((!existing && tenantId !== 'default') || existingTenant !== tenantId) {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }
      if (!/no such column:\s*tenant_id/i.test(msg)) {
        try {
          await db.prepare(
            `UPDATE customers SET ${baseUpdates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(...params, customerId, tenantId).run();
        } catch (innerErr) {
          const innerMsg = String(innerErr);
          if (/UNIQUE constraint failed/i.test(innerMsg)) {
            return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
          }
          if (tenantId !== 'default' || !/no such column:\s*tenant_id/i.test(innerMsg)) {
            throw innerErr;
          }
          await db.prepare(
            `UPDATE customers SET ${baseUpdates.join(', ')} WHERE id = ?`
          ).bind(...params, customerId).run();
        }
      } else if (tenantId === 'default') {
        try {
          await db.prepare(
            `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
          ).bind(...params, customerId).run();
        } catch (fallbackErr) {
          if (/UNIQUE constraint failed/i.test(String(fallbackErr))) {
            return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
          }
          await db.prepare(
            `UPDATE customers SET ${baseUpdates.join(', ')} WHERE id = ?`
          ).bind(...params, customerId).run();
        }
      } else {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }
    }

    let customer: CustomerRecord | null = null;
    try {
      customer = await db.prepare(
        `${PROFILE_SQL}WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?`
      ).bind(customerId, tenantId).first<CustomerRecord>();
    } catch {
      if (tenantId === 'default') {
        try {
          customer = await db.prepare(
            `${PROFILE_SQL}WHERE c.id = ?`
          ).bind(customerId).first<CustomerRecord>();
        } catch {
          customer = await db.prepare(
            'SELECT c.* FROM customers c WHERE c.id = ?'
          ).bind(customerId).first<CustomerRecord>();
        }
      } else {
        customer = await db.prepare(
          "SELECT c.* FROM customers c WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?"
        ).bind(customerId, tenantId).first<CustomerRecord>().catch(() => null);
      }
    }

    if (customer) {
      const rec = customer as unknown as Record<string, unknown>;
      if ('tenant_id' in rec && rec.tenant_id !== undefined) {
        const resolvedRowTenant = typeof rec.tenant_id === 'string' && rec.tenant_id.trim() !== '' ? rec.tenant_id.trim() : 'default';
        if (resolvedRowTenant !== tenantId) {
          customer = null;
        }
      } else if (tenantId !== 'default') {
        customer = null;
      }
    }

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    return c.json({ success: true, data: customer });
  });
}
