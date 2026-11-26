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
  id: z.string().optional(),
  erpnext_id: z.string().optional(),
  employee: z.string().optional(),
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

      let results: Record<string, unknown>[] = [];
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

      const db = c.env.AURA_DB;
      let effectiveTenant = tenantId === '*' ? 'default' : tenantId;
      let existingExpenseId: string | null = data.id?.trim() || null;
      let existingErpnextId: string | null = data.erpnext_id?.trim() || null;

      if (db && existingExpenseId) {
        const existingRow = await db
          .prepare('SELECT id, erpnext_id, tenant_id FROM expenses WHERE id = ? LIMIT 1')
          .bind(existingExpenseId)
          .first<{ id?: string; erpnext_id?: string | null; tenant_id?: string | null }>()
          .catch(() => null);
        if (existingRow) {
          if (tenantId !== '*' && !matchesTenantRow(existingRow as unknown as Record<string, unknown>, tenantId)) {
            return c.json({ success: false, error: 'Expense not found' }, 404);
          }
          const rowTenant = typeof existingRow.tenant_id === 'string' ? existingRow.tenant_id.trim() : '';
          if (rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq') {
            effectiveTenant = rowTenant;
          }
          if (!existingErpnextId && typeof existingRow.erpnext_id === 'string' && existingRow.erpnext_id.trim()) {
            existingErpnextId = existingRow.erpnext_id.trim();
          }
        }
      }

      if (c.env.ERPNEXT_MOCK === 'true') {
        const mockErpId = existingErpnextId || `mock-expense-${Date.now()}`;
        if (db) {
          const targetId = existingExpenseId || `exp_${crypto.randomUUID()}`;
          await db
            .prepare(
              `INSERT INTO expenses (id, amount, category, date, description, erpnext_id, sync_status, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)
               ON CONFLICT(id) DO UPDATE SET erpnext_id = excluded.erpnext_id, sync_status = 'synced'`
            )
            .bind(targetId, data.amount, data.category, data.date, data.description || '', mockErpId, effectiveTenant)
            .run()
            .catch(() => {});
        }
        return c.json({ success: true, data: { name: mockErpId, mock: true, ...data }, synced: true });
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

      let resolvedEmployee = (data.employee || '').trim();
      if (!resolvedEmployee) {
        const envWithEmployee = c.env as Env & { ERPNEXT_DEFAULT_EMPLOYEE?: string };
        if (typeof envWithEmployee.ERPNEXT_DEFAULT_EMPLOYEE === 'string' && envWithEmployee.ERPNEXT_DEFAULT_EMPLOYEE.trim()) {
          resolvedEmployee = envWithEmployee.ERPNEXT_DEFAULT_EMPLOYEE.trim();
        }
      }
      if (!resolvedEmployee && c.env.AUTH_KV && typeof c.env.AUTH_KV.get === 'function') {
        const kvEmpKey =
          effectiveTenant === 'default'
            ? 'erpnext:default_employee'
            : `erpnext:${effectiveTenant}:default_employee`;
        const kvEmp = await c.env.AUTH_KV.get(kvEmpKey).catch(() => null);
        if (kvEmp && kvEmp.trim()) {
          resolvedEmployee = kvEmp.trim();
        }
      }
      if (!resolvedEmployee) {
        try {
          const empList = await client.list('Employee', { fields: ['name'], filters: [['status', '=', 'Active']], limit: 1 });
          const firstEmp = Array.isArray(empList?.data) ? (empList.data[0] as Record<string, unknown> | undefined) : undefined;
          if (firstEmp && typeof firstEmp.name === 'string' && firstEmp.name.trim()) {
            resolvedEmployee = firstEmp.name.trim();
          }
        } catch {
          // Fall back to canonical ERPNext default employee ID below
        }
      }
      if (!resolvedEmployee) {
        resolvedEmployee = 'HR-EMP-00001';
      }

      const claimPayload = {
        employee: resolvedEmployee,
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
      };

      const result = existingErpnextId
        ? await client.update('Expense Claim', existingErpnextId, claimPayload)
        : await client.create('Expense Claim', claimPayload);

      const erpnextName =
        (result?.data as Record<string, string> | undefined)?.name ||
        (typeof (result as unknown as { name?: string })?.name === 'string'
          ? (result as unknown as { name: string }).name
          : existingErpnextId);

      if (db) {
        const targetExpenseId = existingExpenseId || `exp_${crypto.randomUUID()}`;
        if (existingExpenseId) {
          const upd = await db
            .prepare(
              "UPDATE expenses SET erpnext_id = ?, sync_status = 'synced' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(erpnextName, existingExpenseId, effectiveTenant)
            .run()
            .catch(() => null);
          if (!upd?.meta?.changes) {
            await db
              .prepare(
                `INSERT INTO expenses (id, amount, category, date, description, erpnext_id, sync_status, tenant_id)
                 VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`
              )
              .bind(
                existingExpenseId,
                data.amount,
                data.category,
                data.date,
                data.description || '',
                erpnextName,
                effectiveTenant
              )
              .run()
              .catch(() => {});
          }
        } else {
          await db
            .prepare(
              `INSERT INTO expenses (id, amount, category, date, description, erpnext_id, sync_status, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`
            )
            .bind(
              targetExpenseId,
              data.amount,
              data.category,
              data.date,
              data.description || '',
              erpnextName,
              effectiveTenant
            )
            .run()
            .catch(() => {});
        }
      }

      return c.json({ success: true, data: result, erpnext_id: erpnextName, sync_status: 'synced' });
    } catch {
      return c.json({ success: false, error: 'Failed to sync expense' }, 500);
    }
  });
}
