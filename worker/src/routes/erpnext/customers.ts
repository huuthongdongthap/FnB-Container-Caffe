/**
 * ERPNext Customers Routes — /api/erpnext/customers
 * List, sync (create/update), and retrieve customer sync status.
 *
 * Mock mode: returns { mock: true, data: [...] } when ERPNEXT_MOCK=true env var.
 */

import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { isHQSuperAdmin } from '../../middleware/tenant';
import { createErpnextClient, createErpnextClientWithKv } from '../../clients/erpnext-client';
import type { Env } from '../../types/env';

export const FORBIDDEN_TENANT_SENTINEL = '__forbidden_tenant_override__';

export function resolveErpnextTenant(c: import('hono').Context<{ Bindings: Env }>): string {
  const headerCandidates = [
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const queryCandidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const allCandidates = [...headerCandidates, ...queryCandidates];
  if (new Set(allCandidates).size > 1) {
    return FORBIDDEN_TENANT_SENTINEL;
  }
  const user = (typeof c.get === 'function' ? c.get('user' as never) : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const reqOverride = allCandidates[0] || '';
  const ctxTenant = (typeof c.get === 'function' ? (c.get('tenantId' as never) as string | undefined) : undefined)?.trim() || '';
  if (user) {
    if (isHQSuperAdmin(user)) {
      const target = reqOverride || ctxTenant || getTenantId(c).trim() || '*';
      return target.toLowerCase() === 'hq' ? '*' : target;
    }
    const rawUserTenant = (user.tenantId ?? user.tenant_id ?? '').trim();
    if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') {
      return FORBIDDEN_TENANT_SENTINEL;
    }
    const userTenant = rawUserTenant || 'default';
    const resolvedTenant = getTenantId(c).trim() || 'default';
    if (
      (reqOverride && (reqOverride === '*' || reqOverride.toLowerCase() === 'hq' || reqOverride !== userTenant)) ||
      (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant)) ||
      resolvedTenant !== userTenant
    ) {
      return FORBIDDEN_TENANT_SENTINEL;
    }
    return userTenant;
  }
  const resolved = getTenantId(c).trim() || reqOverride || 'default';
  return resolved.toLowerCase() === 'hq' ? '*' : resolved;
}

const CustomerSyncSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  tax_id: z.string().optional().or(z.literal(''))
});

const allow = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);

export function customerRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  // GET /api/erpnext/customers — list with pagination
  app.get('/api/erpnext/customers', allow, async(c) => {
    try {
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }
      const rawPage = parseInt(c.req.query('page') || '1', 10);
      const rawLimit = parseInt(c.req.query('limit') || '50', 10);
      const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 200) : 50;
      const offset = (page - 1) * limit;

      let results: any[] = [];
      let total = 0;
      try {
        if (tenantId !== '*') {
          const res = await db
            .prepare(
              "SELECT id, name, phone, email, tax_id, erpnext_id, sync_status, tenant_id, created_at, updated_at FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
            )
            .bind(tenantId, limit, offset)
            .all<Record<string, unknown>>();
          results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
          const countRes = await db.prepare("SELECT COUNT(*) as total FROM customers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?").bind(tenantId).first<{ total: number }>();
          total = Number(countRes?.total ?? results.length);
        } else {
          const res = await db
            .prepare(
              'SELECT id, name, phone, email, tax_id, erpnext_id, sync_status, created_at, updated_at FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?'
            )
            .bind(limit, offset)
            .all();
          results = res.results || [];
          const countRes = await db.prepare('SELECT COUNT(*) as total FROM customers').first<{ total: number }>();
          total = Number(countRes?.total ?? 0);
        }
      } catch {
        try {
          const res = await db
            .prepare(
              'SELECT * FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?'
            )
            .bind(limit, offset)
            .all<Record<string, unknown>>();
          results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
          total = results.length;
        } catch {
          results = [];
          total = 0;
        }
      }

      return c.json({ success: true, data: results, pagination: { page, limit, total } });
    } catch {
      return c.json({ success: false, error: 'Failed to list customers' }, 500);
    }
  });

  // POST /api/erpnext/customers/sync — push local customer to ERPNext (fire-and-forget)
  app.post('/api/erpnext/customers/sync', allow, async(c) => {
    try {
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const raw = await c.req.json();
      const parsed = CustomerSyncSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
      }
      const data = parsed.data;
      const db = c.env.AURA_DB;

      let effectiveTenant = tenantId === '*' ? 'default' : tenantId;
      let resolvedCustomerId: string | null = data.id || null;
      if (db && (data.id || data.name)) {
        try {
          if (data.id) {
            const existingRow = await db
              .prepare('SELECT id, name, tenant_id FROM customers WHERE id = ? LIMIT 1')
              .bind(data.id)
              .first<{ id?: string; name?: string; tenant_id?: string | null }>()
              .catch(() => null);
            if (existingRow) {
              if (tenantId !== '*' && !matchesTenantRow(existingRow as unknown as Record<string, unknown>, tenantId)) {
                return c.json({ success: false, error: 'Customer not found' }, 404);
              }
              const rowTenant = typeof existingRow.tenant_id === 'string' ? existingRow.tenant_id.trim() : '';
              if (rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq') {
                effectiveTenant = rowTenant;
              }
            }
          } else if (data.name && tenantId === '*') {
            const byName = await db
              .prepare('SELECT id, name, tenant_id FROM customers WHERE name = ? ORDER BY created_at DESC LIMIT 1')
              .bind(data.name)
              .first<{ id?: string; name?: string; tenant_id?: string | null }>()
              .catch(() => null);
            if (byName) {
              if (byName.id) {
                resolvedCustomerId = String(byName.id);
              }
              const rowTenant = typeof byName.tenant_id === 'string' ? byName.tenant_id.trim() : '';
              if (rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq') {
                effectiveTenant = rowTenant;
              }
            }
          }
        } catch {
          // ignore lookup failure; fall back to effectiveTenant
        }
      }

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({
          success: true,
          data: { name: `mock-cust-${Date.now()}`, mock: true, phone: data.phone, email: data.email, tax_id: data.tax_id },
          synced: true
        });
      }

      const isNonDefaultTenant = Boolean(effectiveTenant && effectiveTenant !== 'default' && effectiveTenant !== '*');
      const envForKv = isNonDefaultTenant
        ? { ...c.env, ERPNEXT_URL: undefined, ERPNEXT_API_KEY: undefined, ERPNEXT_API_SECRET: undefined }
        : c.env;
      const client =
        c.env.AUTH_KV && typeof createErpnextClientWithKv === 'function'
          ? (await createErpnextClientWithKv(envForKv, effectiveTenant)) ??
            (isNonDefaultTenant ? null : createErpnextClient(c.env))
          : createErpnextClient(c.env);
      if (!client) {
        return c.json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const result = await client.create('Customer', { customer_name: data.name, mobile_no: data.phone || '', email_id: data.email || '', tax_id: data.tax_id || '' });

      if (db && (data.id || data.name)) {
        const erpnextName = (result.data as Record<string, string>)?.name || null;
        const updatePromise = (async () => {
          let targetId = resolvedCustomerId;
          if (!targetId && data.name) {
            try {
              const row = await db
                .prepare("SELECT id, name FROM customers WHERE name = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 1")
                .bind(data.name, effectiveTenant)
                .first<{ id?: string }>();
              if (row?.id) {
                targetId = String(row.id);
              }
            } catch {
              if (effectiveTenant === 'default') {
                const row = await db
                  .prepare('SELECT id, name FROM customers WHERE name = ? ORDER BY created_at DESC LIMIT 1')
                  .bind(data.name)
                  .first<{ id?: string }>()
                  .catch(() => null);
                if (row?.id) {
                  targetId = String(row.id);
                }
              }
            }
          }
          if (targetId) {
            await db
              .prepare("UPDATE customers SET erpnext_id = ?, sync_status = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(erpnextName, 'synced', targetId, effectiveTenant)
              .run()
              .catch(() =>
                effectiveTenant === 'default'
                  ? db
                      .prepare('UPDATE customers SET erpnext_id = ?, sync_status = ? WHERE id = ?')
                      .bind(erpnextName, 'synced', targetId)
                      .run()
                      .catch(() => {})
                  : undefined
              );
          } else {
            await db
              .prepare("UPDATE customers SET erpnext_id = ?, sync_status = ? WHERE COALESCE(id, name) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(erpnextName, 'synced', data.name, effectiveTenant)
              .run()
              .catch(() =>
                effectiveTenant === 'default'
                  ? db
                      .prepare('UPDATE customers SET erpnext_id = ?, sync_status = ? WHERE COALESCE(id, name) = ?')
                      .bind(erpnextName, 'synced', data.name)
                      .run()
                      .catch(() => {})
                  : undefined
              );
          }
        })();
        try {
          c.executionCtx.waitUntil(updatePromise);
        } catch {
          await updatePromise;
        }
      }

      return c.json({ success: true, data: result });
    } catch {
      return c.json({ success: false, error: 'Failed to sync customer' }, 500);
    }
  });

  // GET /api/erpnext/customers/:id — get single customer with sync status
  app.get('/api/erpnext/customers/:id', allow, async(c) => {
    try {
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const id = c.req.param('id');
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const customer = await db
        .prepare('SELECT * FROM customers WHERE id = ?')
        .bind(id)
        .first<Record<string, unknown>>();

      if (!customer || !matchesTenantRow(customer, tenantId)) {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }

      return c.json({ success: true, data: customer });
    } catch {
      return c.json({ success: false, error: 'Failed to fetch customer' }, 500);
    }
  });
}
