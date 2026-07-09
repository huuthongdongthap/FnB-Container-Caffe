/**
 * Admin QR Management — /api/admin/qr/*
 * Requires owner or staff role.
 */

import { Hono } from 'hono';
import QRCode from 'qrcode';
import { requireAuth } from '../middleware/auth';
import { bulkGenerateSlugs, generateDataURL } from '../tree/qr/generator';
import { signQRUrl } from '../tree/qr/signer';
import type { Env } from '../types/env';
import type { CafeTable, QrCodeRow } from './tables';

export const adminQRRouter = new Hono<{ Bindings: Env }>();

// ── Auth gate ──────────────────────────────────────────────────────
adminQRRouter.use('*', requireAuth(['owner', 'staff']));

// ── GET /api/admin/qr/tables — list all tables with QR data ──────
adminQRRouter.get('/tables', async(c) => {
  const db = c.env.AURA_DB;
  const secret = c.env.QR_SIGNING_SECRET as string | undefined;
  if (!secret) {
    return c.json(
      { success: false, error: 'QR_SIGNING_SECRET not configured' },
      503
    );
  }

  const host = c.req.header('host') || 'localhost:3000';
  const baseUrl =
    c.req.header('x-forwarded-proto') === 'https'
      ? `https://${host}`
      : `https://${host}`;

  // Fetch all tables
  const { results: tables } = await db
    .prepare('SELECT * FROM cafe_tables ORDER BY zone, table_number')
    .all<CafeTable>();

  // Fetch existing QR codes
  const { results: qrRows } = await db
    .prepare('SELECT table_id, slug FROM table_qr_codes')
    .all<QrCodeRow>();

  const slugMap = new Map(qrRows.map((r) => [r.table_id, r.slug]));

  // Auto-generate slugs for tables missing them
  if (tables.some((t) => !slugMap.has(Number(t.id)))) {
    await bulkGenerateSlugs(db, tables);
    // Re-fetch after upsert
    const { results: updatedQR } = await db
      .prepare('SELECT table_id, slug FROM table_qr_codes')
      .all<QrCodeRow>();
    updatedQR.forEach((r) => slugMap.set(r.table_id, r.slug));
  }

  const tableList = tables.map((t) => {
    const idNum = Number(t.id);
    const slug = slugMap.get(idNum);
    const signedUrl = slug ? signQRUrl(slug, secret, baseUrl) : null;
    return {
      id: t.id,
      table_number: t.table_number,
      zone: t.zone,
      status: t.status,
      slug,
      signed_url: signedUrl
    };
  });

  return c.json({ success: true, data: tableList });
});

// ── POST /api/admin/qr/regenerate — clear + re-generate all slugs ──
adminQRRouter.post('/regenerate', async(c) => {
  const db = c.env.AURA_DB;
  await db.prepare('DELETE FROM table_qr_codes').run();
  const { results: tables } = await db
    .prepare('SELECT * FROM cafe_tables')
    .all<CafeTable>();
  await bulkGenerateSlugs(db, tables);
  return c.json({ success: true, message: 'All QR codes regenerated' });
});

// ── GET /api/admin/qr/:slug/download — PNG download ──────────────
adminQRRouter.get('/:slug/download', async(c) => {
  const db = c.env.AURA_DB;
  const secret = c.env.QR_SIGNING_SECRET as string | undefined;
  if (!secret) {
    return c.json({ success: false, error: 'Not configured' }, 503);
  }

  const slug = c.req.param('slug');

  // Verify slug exists
  const qrRowRaw = await db
    .prepare('SELECT table_id FROM table_qr_codes WHERE slug = ?')
    .bind(slug)
    .first();
  const qrRow =
    (qrRowRaw as { table_id: number } | null) ?? { table_id: -1 };
  if (!qrRow) {
    return c.json({ success: false, error: 'Not found' }, 404);
  }

  const host = c.req.header('host') || 'localhost:3000';
  const baseUrl =
    c.req.header('x-forwarded-proto') === 'https'
      ? `https://${host}`
      : `https://${host}`;

  const { generatePNG } = await import('../tree/qr/generator');
  const pngBuffer = await generatePNG(slug, baseUrl);

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${slug}.png"`,
      'X-Slug': slug,
      'X-Table-ID': String(qrRow.table_id)
    }
  });
});

// ── GET /api/admin/qr/:slug/png — inline PNG for browser/img tag ─
adminQRRouter.get('/:slug/png', async(c) => {
  const db = c.env.AURA_DB;
  const secret = c.env.QR_SIGNING_SECRET as string | undefined;
  if (!secret) {
    return c.json({ success: false, error: 'Not configured' }, 503);
  }

  const slug = c.req.param('slug');

  // Verify slug exists
  const qrRow = await db
    .prepare('SELECT table_id, slug FROM table_qr_codes WHERE slug = ?')
    .bind(slug)
    .first<{ table_id: number }>();
  if (!qrRow) {
    return c.json({ success: false, error: 'Not found' }, 404);
  }

  // Verify table still exists
  const tableRow = await db
    .prepare(
      'SELECT id, table_number, zone, status FROM cafe_tables WHERE id = ?'
    )
    .bind(qrRow.table_id)
    .first<CafeTable>();
  const table = (tableRow ?? null);
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  // QR payload: deep link to public ordering page for that table/slug.
  const host = c.req.header('host') || 'localhost:3000';
  const qrPayload = `${c.req.header('x-forwarded-proto') === 'https' ? 'https' : 'https'}://${host}/order/${slug}`;

  const pngBuffer = await QRCode.toBuffer(qrPayload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M'
  });

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(
      db.prepare(
        'UPDATE table_qr_codes SET updated_at = datetime(\'now\') WHERE slug = ?'
      )
        .bind(slug)
        .run()
    );
  }

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Table-ID': String(table.id),
      'X-Slug': slug
    }
  });
});
