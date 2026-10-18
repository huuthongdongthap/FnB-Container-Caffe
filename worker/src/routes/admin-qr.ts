/**
 * Admin QR Management — /api/admin/qr/*
 * Requires owner or staff role.
 */

import { Hono } from 'hono';
import QRCode from 'qrcode';
import { requireAuth } from '../middleware/auth';
import { bulkGenerateSlugs } from '../tree/qr/generator';
import { signQRUrl } from '../tree/qr/signer';
import type { Env } from '../types/env';
import type { CafeTable, QrCodeRow } from '@aura/domain-table';

export const adminQRRouter = new Hono<{ Bindings: Env }>();

// ── Auth gate ──────────────────────────────────────────────────────
adminQRRouter.use('*', requireAuth(['owner', 'manager', 'staff', 'admin']));

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
  let qrRows: QrCodeRow[] = [];
  try {
    const res = await db
      .prepare('SELECT table_id, slug FROM table_qr_codes')
      .all<QrCodeRow>();
    qrRows = res.results || [];
  } catch {
    qrRows = [];
  }

  const slugMap = new Map<string | number, string>();
  qrRows.forEach((r) => {
    slugMap.set(r.table_id, r.slug);
    slugMap.set(String(r.table_id), r.slug);
    const n = Number(r.table_id);
    if (!Number.isNaN(n)) slugMap.set(n, r.slug);
  });

  // Auto-generate slugs for tables missing them
  if (tables.some((t) => !(slugMap.get(String(t.id)) ?? slugMap.get(Number(t.id))))) {
    const generated = await bulkGenerateSlugs(db, tables);
    generated.forEach((v, k) => slugMap.set(k, v));
    // Re-fetch after upsert
    try {
      const { results: updatedQR } = await db
        .prepare('SELECT table_id, slug FROM table_qr_codes')
        .all<QrCodeRow>();
      (updatedQR || []).forEach((r) => {
        slugMap.set(r.table_id, r.slug);
        slugMap.set(String(r.table_id), r.slug);
        const n = Number(r.table_id);
        if (!Number.isNaN(n)) slugMap.set(n, r.slug);
      });
    } catch {
      // table_qr_codes optional in fallback mode
    }
  }

  const tableList = await Promise.all(tables.map(async (t) => {
    const slug = slugMap.get(String(t.id)) ?? slugMap.get(Number(t.id));
    const signedUrl = slug ? await signQRUrl(slug, secret, baseUrl) : null;
    return {
      id: t.id,
      table_number: t.table_number,
      zone: t.zone,
      status: t.status,
      slug,
      signed_url: signedUrl
    };
  }));

  return c.json({ success: true, data: tableList });
});

// ── POST /api/admin/qr/regenerate — clear + re-generate all slugs ──
adminQRRouter.post('/regenerate', async(c) => {
  const db = c.env.AURA_DB;
  try {
    await db.prepare('DELETE FROM table_qr_codes').run();
  } catch {
    // ignore if table_qr_codes is missing
  }
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
  let qrRowRaw: unknown = null;
  try {
    qrRowRaw = await db
      .prepare('SELECT table_id FROM table_qr_codes WHERE slug = ?')
      .bind(slug)
      .first();
  } catch {
    qrRowRaw = null;
  }
  const qrRow = qrRowRaw as { table_id: number | string } | null;
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

  return new Response(pngBuffer as unknown as BodyInit, {
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
  let qrRow: { table_id: number | string } | null = null;
  try {
    qrRow = await db
      .prepare('SELECT table_id, slug FROM table_qr_codes WHERE slug = ?')
      .bind(slug)
      .first<{ table_id: number | string }>();
  } catch {
    qrRow = null;
  }
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

  try {
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(
        db.prepare(
          'UPDATE table_qr_codes SET updated_at = datetime(\'now\') WHERE slug = ?'
        )
          .bind(slug)
          .run()
          .catch(() => {})
      );
    }
  } catch {
    // executionCtx unavailable
  }

  return new Response(pngBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Table-ID': String(table.id),
      'X-Slug': slug
    }
  });
});
