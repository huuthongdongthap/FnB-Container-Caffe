/**
 * QR Scan — public QR code PNG endpoint
 * Extracted from worker/src/routes/tables.ts (qrRouter portion).
 */
import { Hono } from 'hono';
import QRCode from 'qrcode';
import { verifyQRSignature } from 'worker/src/tree/qr/signer';
import type { Env } from 'worker/src/types/env';
import type { CafeTable } from '../model/table-types';

export const qrRouter = new Hono<{ Bindings: Env }>();

// GET /api/qr/:slug — serve QR code PNG (public)
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

  if (!(await verifyQRSignature(slug, ts, sig, secret))) {
    return c.json({ success: false, error: 'Invalid or expired QR signature' }, 401);
  }

  // Lookup slug → table mapping
  const qrRow = (await db.prepare(
    'SELECT table_id, slug FROM table_qr_codes WHERE slug = ?',
  ).bind(slug).first()) as { table_id: number; slug: string } | null;
  if (!qrRow) {
    return c.json({ success: false, error: 'QR code not found' }, 404);
  }

  // Verify table still exists
  const table = (await db.prepare(
    'SELECT id, table_number, zone, status FROM cafe_tables WHERE id = ?',
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
        'UPDATE table_qr_codes SET updated_at = datetime(\'now\') WHERE slug = ?',
      ).bind(slug).run(),
    );
  }

  return new Response(pngBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Table-ID': String(table.id),
      'X-Slug': slug,
    },
  });
});
