/**
 * ERPNext Customers Routes — /api/erpnext/customers
 * List, sync (create/update), and retrieve customer sync status.
 *
 * Mock mode: returns { mock: true, data: [...] } when ERPNEXT_MOCK=true env var.
 */

import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { createErpnextClient, createErpnextClientWithKv } from '../../clients/erpnext-client';
import type { Env } from '../../types/env';

const CustomerSyncSchema = z.object({
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
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const tenantId = getTenantId(c);
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
      const raw = await c.req.json();
      const parsed = CustomerSyncSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
      }
      const data = parsed.data;
      const tenantId = getTenantId(c);

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({
          success: true,
          data: { name: `mock-cust-${Date.now()}`, mock: true, phone: data.phone, email: data.email, tax_id: data.tax_id },
          synced: true
        });
      }

      const client =
        (c.env.AUTH_KV && typeof createErpnextClientWithKv === 'function'
          ? await createErpnextClientWithKv(c.env, tenantId)
          : null) ?? createErpnextClient(c.env);
      if (!client) {
        return c.json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const result = await client.create('Customer', { customer_name: data.name, mobile_no: data.phone || '', email_id: data.email || '', tax_id: data.tax_id || '' });

      const db = c.env.AURA_DB;
      if (db && data.name) {
        const effectiveTenant = tenantId === '*' ? 'default' : tenantId;
        const updatePromise = db
          .prepare("UPDATE customers SET erpnext_id = ?, sync_status = ? WHERE name = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind((result.data as Record<string, string>)?.name || null, 'synced', data.name, effectiveTenant)
          .run()
          .catch(() =>
            effectiveTenant === 'default'
              ? db.prepare('UPDATE customers SET erpnext_id = ?, sync_status = ? WHERE name = ?')
                  .bind((result.data as Record<string, string>)?.name || null, 'synced', data.name)
                  .run()
                  .catch(() => {})
              : undefined
          );
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
      const id = c.req.param('id');
      const tenantId = getTenantId(c);
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
