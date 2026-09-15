/**
 * Tables — CRUD routes for cafe_tables
 * Extracted from worker/src/routes/tables.ts (tablesRouter portion).
 */
import { Hono } from 'hono';
import { updateTableStatusSchema, zodErrorResponse } from 'worker/src/lib/validators';
import { signQRUrl } from 'worker/src/tree/qr/signer';
import type { Env } from 'worker/src/types/env';
import { requireAuth } from 'worker/src/middleware/auth';
import { audit } from 'worker/src/middleware/audit-log';
import type { CafeTable, QrCodeRow } from '../model/table-types';
import { canTransitionTo } from '../policies/status';

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

  const { results: tables } = await stmt.all<CafeTable>();

  // Lookup QR slugs for all tables
  const baseUrl = c.req.header('x-forwarded-proto') === 'https'
    ? `https://${c.req.header('host')}`
    : `${c.req.header('x-forwarded-proto') || 'http'}://${c.req.header('host') || 'localhost:3000'}`;
  const qrSecret = c.env.QR_SIGNING_SECRET || '';

  const rows = qrSecret
    ? await db.prepare('SELECT table_id, slug FROM table_qr_codes').all<QrCodeRow>()
    : { results: [] as QrCodeRow[] };
  const slugMap = new Map(rows.results.map((r) => [r.table_id, r.slug]));

  const data = await Promise.all(tables.map(async (t) => {
    const idNum = typeof t.id === 'string' ? parseInt(t.id, 10) : Number(t.id);
    const slug = slugMap.get(idNum);
    return {
      ...t,
      qr_code_url: slug && qrSecret
        ? await signQRUrl(slug, qrSecret, baseUrl)
        : null,
    };
  }));
  return c.json({ success: true, data });
});

// GET /api/tables/:id
tablesRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const row = await db.prepare(
    'SELECT * FROM cafe_tables WHERE id = ?',
  ).bind(id).first<CafeTable>();
  if (!row) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, data: row });
});

// PATCH helper — read current row then update status, returning the row pre-update.
async function updateTable(db: Env['AURA_DB'], id: string, status: string) {
  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!table) {
    return null;
  }
  if (!canTransitionTo(table.status, status as CafeTable['status'])) {
    return null;
  }
  await db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind(status, id).run();
  return table;
}

// PATCH /api/tables/:id/occupy — staff-only (QR guests use guest-checkin instead)
tablesRouter.patch('/:id/occupy', requireAuth(['owner', 'staff']), audit('table_occupy'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const table = await updateTable(db, id, 'Occupied');
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → Occupied` });
});

// PATCH /api/tables/:id/release — staff-only
tablesRouter.patch('/:id/release', requireAuth(['owner', 'staff']), audit('table_release'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const table = await updateTable(db, id, 'Available');
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → Available` });
});

// PATCH /api/tables/:id/status — set arbitrary status (staff-only)
tablesRouter.patch('/:id/status', requireAuth(['owner', 'staff']), audit('table_status_change'), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateTableStatusSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { status } = parsed.data;
  const table = await updateTable(db, id, status);
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  return c.json({ success: true, message: `Table ${id} → ${status}` });
});

