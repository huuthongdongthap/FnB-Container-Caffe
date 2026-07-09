/**
 * ERPNext Expenses Routes — /api/erpnext/expenses
 * List expenses with date filter, sync expense to ERPNext.
 *
 * Mock mode: returns { mock: true, data: [...] } when ERPNEXT_MOCK=true env var.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { createErpnextClient } from '../../clients/erpnext-client';
import type { Env } from '../../types/env';

const ExpenseSyncSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.string().min(1),
  description: z.string().optional().or(z.literal(''))
});

type ExpenseSyncInput = z.infer<typeof ExpenseSyncSchema>;

const allow = requireAuth(['owner', 'staff']);

export function expenseRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  // GET /api/erpnext/expenses — list expenses with date filter
  app.get('/api/erpnext/expenses', allow, async(c) => {
    try {
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const from = c.req.query('from');
      const to = c.req.query('to');
      const limit = parseInt(c.req.query('limit') || '100', 10);

      let query = 'SELECT id, amount, category, date, description, erpnext_id, sync_status, created_at FROM expenses WHERE 1=1';
      const binds: unknown[] = [limit];

      if (from) {
        query += ' AND date >= ?';
        binds.unshift(from);
      }
      if (to) {
        query += ' AND date <= ?';
        binds.unshift(to);
      }

      query += ' ORDER BY date DESC LIMIT ?';

      const stmt = db.prepare(query).bind(...binds);
      const { results } = await stmt.all<{ id: string; amount: number; category: string; date: string; description: string | null; erpnext_id: string | null; sync_status: string; created_at: string }>();

      return c.json({ success: true, data: results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
