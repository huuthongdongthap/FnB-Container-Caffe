/**
 * Tables Routes — /api/tables
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/admin-auth.js';

export const tablesRouter = new Hono();

// GET /api/tables?zone=&status=
tablesRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const zone = c.req.query('zone');
  const status = c.req.query('status');

  let query = 'SELECT * FROM cafe_tables WHERE 1=1';
  const params = [];

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

  const { results } = await stmt.all();
  return c.json({ success: true, data: results });
});

// GET /api/tables/:id
tablesRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const row = await db.prepare(
    'SELECT * FROM cafe_tables WHERE id = ?'
  ).bind(id).first();
  if (!row) {return c.json({ success: false, error: 'Table not found' }, 404);}
  return c.json({ success: true, data: row });
});

// PATCH /api/tables/:id/status — staff/owner only
tablesRouter.patch('/:id/status', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;

  const allowed = ['Available', 'Occupied', 'Reserved', 'Overdue'];
  if (!allowed.includes(status)) {
    return c.json({ success: false, error: `status must be one of: ${allowed.join(', ')}` }, 400);
  }

  await db.prepare(
    'UPDATE cafe_tables SET status = ? WHERE id = ?'
  ).bind(status, id).run();

  return c.json({ success: true, message: `Table ${id} → ${status}` });
});
