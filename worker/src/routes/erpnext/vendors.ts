/**
 * ERPNext Vendors Routes — /api/erpnext/vendors
 * List vendors, sync (create/update) vendor to ERPNext.
 *
 * Mock mode: returns { mock: true, data: [...] } when ERPNEXT_MOCK=true env var.
 */

import { z } from 'zod';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { createErpnextClient } from '../../clients/erpnext-client';

const VendorSyncSchema = z.object({
  name: z.string().min(1),
  tax_id: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal(''))
});


const allow = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);

export function vendorRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  // GET /api/erpnext/vendors — list vendors
  app.get('/api/erpnext/vendors', allow, async(c) => {
    try {
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const tenantId = getTenantId(c);
      const parsedLimit = parseInt(c.req.query('limit') || '100', 10);
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);

      let results: any[] = [];
      try {
        const res = await db
          .prepare(
            'SELECT * FROM suppliers ORDER BY created_at DESC LIMIT ?'
          )
          .bind(500)
          .all<Record<string, unknown>>();
        results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
      } catch {
        try {
          const res = await db
            .prepare(
              'SELECT * FROM vendors ORDER BY created_at DESC LIMIT ?'
            )
            .bind(500)
            .all<Record<string, unknown>>();
          results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
        } catch {
          results = [];
        }
      }

      return c.json({ success: true, data: results });
    } catch {
      return c.json({ success: false, error: 'Failed to list vendors' }, 500);
    }
  });

  // POST /api/erpnext/vendors/sync — create/update vendor in ERPNext
  app.post('/api/erpnext/vendors/sync', allow, async(c) => {
    try {
      const raw = await c.req.json();
      const parsed = VendorSyncSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
      }
      const data = parsed.data;

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({ success: true, data: { name: `mock-vendor-${Date.now()}`, mock: true, tax_id: data.tax_id, address: data.address, phone: data.phone }, synced: true });
      }

      const client = createErpnextClient(c.env);
      if (!client) {
        return c.json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const result = await client.create('Supplier', { supplier_name: data.name, tax_id: data.tax_id || '', address_line1: data.address || '', mobile_no: data.phone || '' });

      return c.json({ success: true, data: result });
    } catch {
      return c.json({ success: false, error: 'Failed to sync vendor' }, 500);
    }
  });
}
