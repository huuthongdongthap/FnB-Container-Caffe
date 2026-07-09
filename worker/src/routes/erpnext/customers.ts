/**
 * ERPNext Customers Routes — /api/erpnext/customers
 * List, sync (create/update), and retrieve customer sync status.
 *
 * Mock mode: returns { mock: true, data: [...] } when ERPNEXT_MOCK=true env var.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { createErpnextClient } from '../../clients/erpnext-client';
import type { Env } from '../../types/env';

const CustomerSyncSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  tax_id: z.string().optional().or(z.literal(''))
});

const allow = requireAuth(['owner', 'staff']);

export function customerRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  // GET /api/erpnext/customers — list with pagination
  app.get('/api/erpnext/customers', allow, async(c) => {
    try {
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const page = parseInt(c.req.query('page') || '1', 10);
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = (page - 1) * limit;

      const { results } = await db
        .prepare(
          'SELECT id, name, phone, email, tax_id, erpnext_id, sync_status, created_at, updated_at FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
        .bind(limit, offset)
        .all<{ id: string; name: string; phone: string | null; email: string | null; tax_id: string | null; erpnext_id: string | null; sync_status: string; created_at: string; updated_at: string }>();

      const { total } = (await db.prepare('SELECT COUNT(*) as total FROM customers').first<{ total: number }>()) || { total: 0 };

      return c.json({ success: true, data: results, pagination: { page, limit, total: (total as number) ?? 0 } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
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

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({
          success: true,
          data: { name: `mock-cust-${Date.now()}`, mock: true, phone: data.phone, email: data.email, tax_id: data.tax_id },
          synced: true
        });
      }

      const client = createErpnextClient(c.env);
      if (!client) {
        return c.json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const result = await client.create('Customer', { customer_name: data.name, mobile_no: data.phone || '', email_id: data.email || '', tax_id: data.tax_id || '' });

      const db = c.env.AURA_DB;
      if (db && data.name) {
        c.executionCtx.waitUntil(
          db
            .prepare('UPDATE customers SET erpnext_id = ?, sync_status = ? WHERE name = ?')
            .bind((result.data as Record<string, string>)?.name || null, 'synced', data.name)
            .run()
            .catch(() => {})
        );
      }

      return c.json({ success: true, data: result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  // GET /api/erpnext/customers/:id — get single customer with sync status
  app.get('/api/erpnext/customers/:id', allow, async(c) => {
    try {
      const id = c.req.param('id');
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const customer = await db
        .prepare('SELECT id, name, phone, email, tax_id, erpnext_id, sync_status, erpnext_last_synced, created_at, updated_at FROM customers WHERE id = ?')
        .bind(id)
        .first<Record<string, string | number | null>>();

      if (!customer) {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }

      return c.json({ success: true, data: customer });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
