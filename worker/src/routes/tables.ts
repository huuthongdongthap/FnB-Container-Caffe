/**
 * Tables Routes — /api/tables
 * Converted from routes/tables.js with TypeScript.
 */

import { Hono } from 'hono';
import { updateTableStatusSchema } from '../lib/validators';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth.js';

export interface CafeTable {
  id: string;
  table_number: number;
  zone: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Overdue';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const tablesRouter = new Hono<{ Bindings: Env }>();

// GET /api/tables?zone=&status=
tablesRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const zone = c.req.query('zone');
  const status = c.req.query('status');

  let query = 'SELECT * FROM cafe_tables WHERE 1=1';
  const params: unknown[] = [];

  if (zone) {
    query += ' AND zone = ?';
    params.push(zone);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY zone ASC, table_number ASC';

  const stmt = params.length
    ? db.prepare(query).bind(...params)
    : db.prepare(query);

  const { results } = await stmt.all<CafeTable>();
  return c.json({ success: true, data: results });
});

// GET /api/tables/:id
tablesRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const row = await db.prepare(
    'SELECT * FROM cafe_tables WHERE id = ?'
  ).bind(id).first<CafeTable>();
  if (!row) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

// PATCH /api/tables/:id/occupy — public (QR ordering)
tablesRouter.patch('/:id/occupy', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  await db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind('Occupied', id).run();
  return c.json({ success: true, message: `Table ${id} → Occupied` });
});

// PATCH /api/tables/:id/release — public (QR ordering)
tablesRouter.patch('/:id/release', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  await db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind('Available', id).run();
  return c.json({ success: true, message: `Table ${id} → Available` });
});

// PATCH /api/tables/:id/status — staff/owner only
tablesRouter.patch('/:id/status', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateTableStatusSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const { status } = parsed.data;

  await db.prepare(
    'UPDATE cafe_tables SET status = ? WHERE id = ?'
  ).bind(status, id).run();

  return c.json({ success: true, message: `Table ${id} → ${status}` });
});
