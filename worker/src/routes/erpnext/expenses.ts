/**
 * ERPNext Expenses Routes — /api/erpnext/expenses
 * List expenses with date filter, sync expense to ERPNext.
 *
 * Mock mode: returns { mock: true, data: [...] } when ERPNEXT_MOCK=true env var.
 */

import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { createErpnextClient } from '../../clients/erpnext-client';
import type { Env } from '../../types/env';

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
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const tenantId = getTenantId(c);
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

      query += ' ORDER BY date DESC LIMIT ?';
      binds.push(limit);

      let results: any[] = [];
      try {
        const stmt = db.prepare(query).bind(...binds);
        const res = await stmt.all<Record<string, unknown>>();
        results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
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
      const raw = await c.req.json();
      const parsed = ExpenseSyncSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
      }
      const data = parsed.data;

      if (c.env.ERPNEXT_MOCK === 'true') {
        return c.json({ success: true, data: { name: `mock-expense-${Date.now()}`, mock: true, ...data }, synced: true });
      }

      const client = createErpnextClient(c.env);
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
