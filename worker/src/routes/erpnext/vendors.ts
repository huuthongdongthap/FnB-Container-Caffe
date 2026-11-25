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
import { isHQSuperAdmin } from '../../middleware/tenant';
import { createErpnextClient, createErpnextClientWithKv } from '../../clients/erpnext-client';

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

const VendorSyncSchema = z.object({
  id: z.string().optional(),
  erpnext_id: z.string().optional(),
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
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }
      const parsedLimit = parseInt(c.req.query('limit') || '100', 10);
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);

      let results: Record<string, unknown>[] = [];
      try {
        if (tenantId !== '*') {
          try {
            const res = await db
              .prepare(
                "SELECT * FROM suppliers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?"
              )
              .bind(tenantId, limit)
              .all<Record<string, unknown>>();
            results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
          } catch {
            const res = await db
              .prepare(
                'SELECT * FROM suppliers ORDER BY created_at DESC LIMIT ?'
              )
              .bind(500)
              .all<Record<string, unknown>>();
            results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
          }
        } else {
          const res = await db
            .prepare(
              'SELECT * FROM suppliers ORDER BY created_at DESC LIMIT ?'
            )
            .bind(500)
            .all<Record<string, unknown>>();
          results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
        }
      } catch {
        try {
          if (tenantId !== '*') {
            try {
              const res = await db
                .prepare(
                  "SELECT * FROM vendors WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?"
                )
                .bind(tenantId, limit)
                .all<Record<string, unknown>>();
              results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
            } catch {
              const res = await db
                .prepare(
                  'SELECT * FROM vendors ORDER BY created_at DESC LIMIT ?'
                )
                .bind(500)
                .all<Record<string, unknown>>();
              results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
            }
          } else {
            const res = await db
              .prepare(
                'SELECT * FROM vendors ORDER BY created_at DESC LIMIT ?'
              )
              .bind(500)
              .all<Record<string, unknown>>();
            results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);
          }
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
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const raw = await c.req.json();
      const parsed = VendorSyncSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
      }
      const data = parsed.data;

      const db = c.env.AURA_DB;
      let effectiveTenant = tenantId === '*' ? 'default' : tenantId;
      let targetVendorId: string | null = data.id?.trim() || null;
      let existingErpnextId: string | null = data.erpnext_id?.trim() || null;

      if (db) {
        try {
          if (targetVendorId) {
            const supRow = await db
              .prepare('SELECT id, name, tenant_id FROM suppliers WHERE id = ? LIMIT 1')
              .bind(targetVendorId)
              .first<{ id?: string; name?: string; tenant_id?: string | null; erpnext_id?: string | null }>()
              .catch(() => null);
            if (supRow) {
              if (tenantId !== '*' && !matchesTenantRow(supRow as unknown as Record<string, unknown>, tenantId)) {
                return c.json({ success: false, error: 'Vendor not found' }, 404);
              }
              const rowTenant = typeof supRow.tenant_id === 'string' ? supRow.tenant_id.trim() : '';
              if (rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq') {
                effectiveTenant = rowTenant;
              }
            }
          } else {
            const byName = await db
              .prepare(
                "SELECT id, name, tenant_id FROM suppliers WHERE name = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT 1"
              )
              .bind(data.name, effectiveTenant)
              .first<{ id?: string; name?: string; tenant_id?: string | null }>()
              .catch(() => null);
            if (byName?.id) {
              targetVendorId = String(byName.id);
            }
          }
          if (!existingErpnextId && targetVendorId) {
            const mapRow = await db
              .prepare(
                "SELECT erpnext_id FROM erpnext_mappings WHERE local_type IN ('supplier', 'vendor') AND local_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
              )
              .bind(targetVendorId, effectiveTenant)
              .first<{ erpnext_id?: string | null }>()
              .catch(() => null);
            if (mapRow?.erpnext_id) {
              existingErpnextId = String(mapRow.erpnext_id).trim();
            }
          }
        } catch {
          // Optional lookup on minimal mock DBs
        }
      }

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({ success: true, data: { name: `mock-vendor-${Date.now()}`, mock: true, tax_id: data.tax_id, address: data.address, phone: data.phone }, synced: true });
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

      const supplierPayload = {
        supplier_name: data.name,
        tax_id: data.tax_id || '',
        address_line1: data.address || '',
        mobile_no: data.phone || '',
      };

      let result: { data?: unknown };
      if (existingErpnextId) {
        result = await client.update('Supplier', existingErpnextId, supplierPayload);
      } else {
        try {
          result = await client.create('Supplier', supplierPayload);
        } catch (createErr) {
          const msg = createErr instanceof Error ? createErr.message : String(createErr);
          if (/duplicate|already exists|409/i.test(msg)) {
            const listed = await client.list('Supplier', {
              fields: ['name'],
              filters: [['supplier_name', '=', data.name]],
              limit: 1,
            });
            const foundName = Array.isArray(listed?.data)
              ? (listed.data[0] as Record<string, string> | undefined)?.name
              : undefined;
            const targetErpName = foundName || data.name;
            result = await client.update('Supplier', targetErpName, supplierPayload);
            existingErpnextId = targetErpName;
          } else {
            throw createErr;
          }
        }
      }

      const erpnextName =
        (result?.data as Record<string, string> | undefined)?.name ||
        existingErpnextId ||
        data.name;

      if (db) {
        const now = new Date().toISOString();
        const localVendorId = targetVendorId || `sup_${crypto.randomUUID()}`;
        if (!targetVendorId) {
          await db
            .prepare(
              'INSERT INTO suppliers (id, name, phone, address, tax_id, is_active, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)'
            )
            .bind(localVendorId, data.name, data.phone || null, data.address || null, data.tax_id || null, effectiveTenant, now, now)
            .run()
            .catch(() => {});
        } else {
          await db
            .prepare(
              "UPDATE suppliers SET phone = COALESCE(NULLIF(?, ''), phone), address = COALESCE(NULLIF(?, ''), address), tax_id = COALESCE(NULLIF(?, ''), tax_id), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(data.phone || '', data.address || '', data.tax_id || '', now, localVendorId, effectiveTenant)
            .run()
            .catch(() => {});
        }
        await db
          .prepare(
            "UPDATE suppliers SET erpnext_id = ?, sync_status = 'synced' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(erpnextName, localVendorId, effectiveTenant)
          .run()
          .catch(() => {});
        await db
          .prepare(
            "UPDATE vendors SET erpnext_id = ?, sync_status = 'synced' WHERE (id = ? OR name = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(erpnextName, localVendorId, data.name, effectiveTenant)
          .run()
          .catch(() => {});
        const mappingId = `map_supplier_${effectiveTenant}_${localVendorId}`;
        await db
          .prepare(
            `INSERT INTO erpnext_mappings (id, local_type, local_id, erpnext_id, erpnext_model, sync_status, last_synced_at, tenant_id)
             VALUES (?, 'supplier', ?, ?, 'Supplier', 'synced', ?, ?)
             ON CONFLICT(id) DO UPDATE SET erpnext_id = excluded.erpnext_id, sync_status = 'synced', last_synced_at = excluded.last_synced_at`
          )
          .bind(mappingId, localVendorId, erpnextName, now, effectiveTenant)
          .run()
          .catch(() => {});
      }

      return c.json({ success: true, data: result, erpnext_id: erpnextName, sync_status: 'synced' });
    } catch {
      return c.json({ success: false, error: 'Failed to sync vendor' }, 500);
    }
  });
}
