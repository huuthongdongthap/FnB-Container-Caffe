/**
 * Tables Routes — /api/tables + /api/qr/:slug
 * Converted from routes/tables.js with TypeScript.
 */

import { Hono } from 'hono';
import QRCode from 'qrcode';
import { updateTableStatusSchema } from '../lib/validators.js';
import { signQRUrl, verifyQRSignature, WINDOW_SECONDS } from '../tree/qr/signer.js';
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

export interface QrCodeRow {
  table_id: number;
  slug: string;
}

export const tablesRouter = new Hono<{ Bindings: Env }>();
export const qrRouter = new Hono<{ Bindings: Env }>();

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

  const data = tables.map((t) => {
    const idNum = typeof t.id === 'string' ? parseInt(t.id, 10) : Number(t.id);
    const slug = slugMap.get(idNum);
    return {
      ...t,
      qr_code_url: slug && qrSecret
        ? signQRUrl(slug, qrSecret, baseUrl)
        : null,
    };
  });

  return c.json({ success: true, data });
});

// GET /api/qr/:slug — serve QR code PNG (public) — mounted via qrRouter in index.ts
qrRouter.get('/:slug', async (c) => {
  const db = c.env.AURA_DB;
  const secret = c.env.QR_SIGNING_SECRET as string | undefined;
  if (!secret) {
    return c.json({ success: false, error: 'QR signing not configured' }, 503);
  }

  const slug = c.req.param('slug');
  const ts = Number(c.req.query('ts'));
  const sig = c.req.query('sig') as string | undefined;

  if (!sig || Number.isNaN(ts)) {
    return c.json({ success: false, error: 'Missing ts or sig' }, 401);
  }

  if (!verifyQRSignature(slug, ts, sig, secret)) {
    return c.json({ success: false, error: 'Invalid or expired QR signature' }, 401);
  }

  // Lookup slug → table mapping
  const qrRow = (await db.prepare(
    'SELECT table_id, slug FROM table_qr_codes WHERE slug = ?'
  ).bind(slug).first()) as { table_id: number; slug: string } | null;
  if (!qrRow) {
    return c.json({ success: false, error: 'QR code not found' }, 404);
  }

  // Verify table still exists
  const table = (await db.prepare(
    'SELECT id, table_number, zone, status FROM cafe_tables WHERE id = ?'
  ).bind(qrRow.table_id).first()) as CafeTable | null;
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  // Generate QR payload — deep link to ordering page
  const qrPayload = `${c.req.header('host') || 'localhost:3000'}?table=${slug}`;
  const pngBuffer = await QRCode.toBuffer(qrPayload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(
      db.prepare(
        'UPDATE table_qr_codes SET updated_at = datetime(\'now\') WHERE slug = ?'
      ).bind(slug).run(),
    );
  }

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Table-ID': String(table.id),
      'X-Slug': slug,
    },
  });
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
