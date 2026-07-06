/**
 * ERPNext Vendors Routes — /api/erpnext/vendors
 * List vendors, sync (create/update) vendor to ERPNext.
 *
 * Mock mode: returns { mock: true, data: [...] } when ERPNEXT_MOCK=true env var.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { createErpnextClient } from '../../clients/erpnext-client';

const VendorSyncSchema = z.object({
  name: z.string().min(1),
  tax_id: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});

type VendorSyncInput = z.infer<typeof VendorSyncSchema>;

const allow = requireAuth(['owner', 'staff']);

export function vendorRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  // GET /api/erpnext/vendors — list vendors
  app.get('/api/erpnext/vendors', allow, async (c) => {
    try {
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const limit = parseInt(c.req.query('limit') || '100', 10);

      const { results } = await db
        .prepare(
          'SELECT id, name, tax_id, address, phone, erpnext_id, sync_status, created_at, updated_at FROM vendors ORDER BY created_at DESC LIMIT ?',
        )
        .bind(limit)
        .all<{ id: string; name: string; tax_id: string | null; address: string | null; phone: string | null; erpnext_id: string | null; sync_status: string; created_at: string; updated_at: string }>();

      return c.json({ success: true, data: results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  // POST /api/erpnext/vendors/sync — create/update vendor in ERPNext
  app.post('/api/erpnext/vendors/sync', allow, async (c) => {
    try {
      const raw = await c.req.json();
      const parsed = VendorSyncSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
      }
      const data = parsed.data;

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({ success: true, data: { name: 'mock-vendor-' + Date.now(), mock: true, tax_id: data.tax_id, address: data.address, phone: data.phone }, synced: true });
      }

      const client = createErpnextClient(c.env);
      if (!client) {
        return c.json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const result = await client.create('Supplier', { supplier_name: data.name, tax_id: data.tax_id || '', address_line1: data.address || '', mobile_no: data.phone || '' });

      return c.json({ success: true, data: result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
