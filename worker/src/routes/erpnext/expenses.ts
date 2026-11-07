/**
 * ERPNext Expenses Routes — /api/erpnext/expenses
 * List expenses with date filter, sync expense to ERPNext.
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

const ExpenseSyncSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.string().min(1),
  description: z.string().optional().or(z.literal(''))
});


const DATE_FILTER_REGEX = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const allow = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);

export function expenseRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  // GET /api/erpnext/expenses — list expenses with date filter
  app.get('/api/erpnext/expenses', allow, async(c) => {
    try {
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }
      const from = c.req.query('from');
      const to = c.req.query('to');
      if ((from && !DATE_FILTER_REGEX.test(from)) || (to && !DATE_FILTER_REGEX.test(to))) {
        return c.json({ success: false, error: 'Invalid date filter' }, 400);
      }
      const rawLimit = parseInt(c.req.query('limit') || '100', 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 500) : 100;

      let query = 'SELECT * FROM expenses WHERE 1=1';
      const binds: unknown[] = [];

      if (from) {
        query += ' AND date >= ?';
        binds.push(from);
      }
      if (to) {
        query += ' AND date <= ?';
        binds.push(to);
      }

      let results: any[] = [];
      try {
        if (tenantId !== '*') {
          try {
            const tenantQuery = `${query} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY date DESC LIMIT ?`;
            const stmt = db.prepare(tenantQuery).bind(...binds, tenantId, limit);
            const res = await stmt.all<Record<string, unknown>>();
            results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
          } catch {
            const fallbackQuery = `${query} ORDER BY date DESC LIMIT ?`;
            const stmt = db.prepare(fallbackQuery).bind(...binds, limit);
            const res = await stmt.all<Record<string, unknown>>();
            results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
          }
        } else {
          const wildcardQuery = `${query} ORDER BY date DESC LIMIT ?`;
          const stmt = db.prepare(wildcardQuery).bind(...binds, limit);
          const res = await stmt.all<Record<string, unknown>>();
          results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
        }
      } catch {
        results = [];
      }

      return c.json({ success: true, data: results });
    } catch {
      return c.json({ success: false, error: 'Failed to list expenses' }, 500);
    }
  });

  // POST /api/erpnext/expenses/sync — push expense to ERPNext
  app.post('/api/erpnext/expenses/sync', allow, async(c) => {
    try {
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const raw = await c.req.json();
      const parsed = ExpenseSyncSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
      }
      const data = parsed.data;

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({ success: true, data: { name: `mock-expense-${Date.now()}`, mock: true, ...data }, synced: true });
      }

      const isNonDefaultTenant = Boolean(tenantId && tenantId !== 'default' && tenantId !== '*');
      const envForKv = isNonDefaultTenant
        ? { ...c.env, ERPNEXT_URL: undefined, ERPNEXT_API_KEY: undefined, ERPNEXT_API_SECRET: undefined }
        : c.env;
      const client =
        c.env.AUTH_KV && typeof createErpnextClientWithKv === 'function'
          ? (await createErpnextClientWithKv(envForKv, tenantId)) ??
            (isNonDefaultTenant ? null : createErpnextClient(c.env))
          : createErpnextClient(c.env);
      if (!client) {
        return c.json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const result = await client.create('Expense Claim', {
        employee: '',
        employee_name: 'System',
        posting_date: data.date,
        total_claimed_amount: data.amount,
        expenses: [
          {
            expense_type: data.category,
            description: data.description || data.category,
            amount: data.amount,
            from_date: data.date,
            to_date: data.date
          }
        ]
      });

      return c.json({ success: true, data: result });
    } catch {
      return c.json({ success: false, error: 'Failed to sync expense' }, 500);
    }
  });
}
