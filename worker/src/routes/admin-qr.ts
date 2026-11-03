/**
 * Admin QR Management — /api/admin/qr/*
 * Requires owner or staff role.
 */

import { Hono } from 'hono';
import QRCode from 'qrcode';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import { matchesTenantRow } from '../lib/db';
import { bulkGenerateSlugs } from '../tree/qr/generator';
import { signQRUrl } from '../tree/qr/signer';
import type { Env } from '../types/env';
import type { CafeTable, QrCodeRow } from '@aura/domain-table';

function resolveSafeBaseUrl(c: { req: { header: (name: string) => string | undefined }; env: Env }): string {
  const configured = typeof (c.env as unknown as Record<string, unknown>).PUBLIC_URL === 'string'
    ? String((c.env as unknown as Record<string, unknown>).PUBLIC_URL).trim().replace(/\/+$/, '')
    : '';
  const fallback = configured || 'https://auraspace.cafe';
  const rawHost = c.req.header('host') || c.req.header('Host');
  if (!rawHost) return fallback;
  const trimmed = rawHost.trim().toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(trimmed)) return fallback;
  const hostOnly = trimmed.replace(/:\d+$/, '');
  let configuredHost = '';
  if (configured) {
    try {
      configuredHost = new URL(configured).hostname.toLowerCase();
    } catch { /* ignore */ }
  }
  const isAllowed =
    hostOnly === 'localhost' ||
    hostOnly === '127.0.0.1' ||
    (configuredHost && hostOnly === configuredHost) ||
    hostOnly === 'auraspace.cafe' ||
    hostOnly.endsWith('.auraspace.cafe') ||
    hostOnly === 'auraspace.vn' ||
    hostOnly.endsWith('.auraspace.vn');
  if (!isAllowed) return fallback;
  return `https://${trimmed}`;
}

export const adminQRRouter = new Hono<{ Bindings: Env }>();

// ── Auth gate ──────────────────────────────────────────────────────
adminQRRouter.use('*', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']));

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

  const baseUrl = resolveSafeBaseUrl(c);

  // Fetch all tables scoped to current tenant
  const tenantId = getTenantId(c);
  let allTables: CafeTable[] = [];
  try {
    const res = await db
      .prepare("SELECT * FROM cafe_tables WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY zone, table_number")
      .bind(tenantId, tenantId)
      .all<CafeTable>();
    allTables = res.results || [];
  } catch {
    try {
      const res = await db
        .prepare('SELECT * FROM cafe_tables ORDER BY zone, table_number')
        .all<CafeTable>();
      allTables = res.results || [];
    } catch {
      const res = await db
        .prepare('SELECT * FROM cafe_tables ORDER BY table_number')
        .all<CafeTable>();
      allTables = res.results || [];
    }
  }
  const tables = allTables.filter((t) => matchesTenantRow(t as unknown as Record<string, unknown>, tenantId));

  // Fetch existing QR codes scoped to current tenant's tables
  let qrRows: QrCodeRow[] = [];
  if (tables.length > 0) {
    try {
      if (tenantId === '*') {
        const res = await db
          .prepare('SELECT table_id, slug FROM table_qr_codes')
          .all<QrCodeRow>();
        qrRows = res.results || [];
      } else {
        const placeholders = tables.map(() => '?').join(', ');
        const tableIds = tables.map((t) => t.id);
        const res = await db
          .prepare(`SELECT table_id, slug FROM table_qr_codes WHERE table_id IN (${placeholders})`)
          .bind(...tableIds)
          .all<QrCodeRow>();
        qrRows = res.results || [];
      }
    } catch {
      try {
        const res = await db
          .prepare('SELECT table_id, slug FROM table_qr_codes')
          .all<QrCodeRow>();
        qrRows = res.results || [];
      } catch {
        qrRows = [];
      }
    }
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
      const placeholders = tables.map(() => '?').join(', ');
      const tableIds = tables.map((t) => t.id);
      const { results: updatedQR } = tenantId === '*'
        ? await db.prepare('SELECT table_id, slug FROM table_qr_codes').all<QrCodeRow>()
        : await db
            .prepare(`SELECT table_id, slug FROM table_qr_codes WHERE table_id IN (${placeholders})`)
            .bind(...tableIds)
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

// ── POST /api/admin/qr/regenerate — clear + re-generate tenant slugs ──
adminQRRouter.post('/regenerate', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async(c) => {
  const user = c.get('user' as never) as { role?: string } | undefined;
  if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
  let allTables: CafeTable[] = [];
  try {
    const res = await db
      .prepare("SELECT * FROM cafe_tables WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
      .bind(tenantId, tenantId)
      .all<CafeTable>();
    allTables = res.results || [];
  } catch {
    const res = await db
      .prepare('SELECT * FROM cafe_tables')
      .all<CafeTable>();
    allTables = res.results || [];
  }
  const tables = (allTables || []).filter((t) => matchesTenantRow(t as unknown as Record<string, unknown>, tenantId));
  try {
    if (tenantId === '*') {
      await db.prepare('DELETE FROM table_qr_codes').run();
    } else if (tables.length > 0) {
      const deleteStmts = tables.map((t) =>
        db.prepare('DELETE FROM table_qr_codes WHERE table_id = ?').bind(t.id)
      );
      if (typeof db.batch === 'function') {
        await db.batch(deleteStmts);
      } else {
        for (const stmt of deleteStmts) {
          await stmt.run();
        }
      }
    }
  } catch {
    // ignore if table_qr_codes is missing
  }
  await bulkGenerateSlugs(db, tables);
  return c.json({ success: true, message: 'All QR codes regenerated' });
});

// ── GET /api/admin/qr/:slug/download — PNG download ──────────────
adminQRRouter.get('/:slug/download', async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
  const secret = c.env.QR_SIGNING_SECRET as string | undefined;
  if (!secret) {
    return c.json({ success: false, error: 'Not configured' }, 503);
  }

  const slug = c.req.param('slug');
  const safeSlug = String(slug || '').replace(/[^A-Za-z0-9._-]/g, '_');

  // Verify slug exists and belongs to a table in the current tenant
  let resolvedTableId: number | string | null = null;
  let joinedLookupResolved = false;
  try {
    const joined = await db
      .prepare(
        `SELECT q.table_id, q.slug, t.*
         FROM table_qr_codes q
         JOIN cafe_tables t ON t.id = q.table_id
         WHERE q.slug = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?)`
      )
      .bind(slug, tenantId, tenantId)
      .first<Record<string, unknown>>();
    if (joined && joined.table_id !== undefined && 'table_number' in joined) {
      if (!matchesTenantRow(joined, tenantId)) {
        return c.json({ success: false, error: 'Not found' }, 404);
      }
      resolvedTableId = joined.table_id as number | string;
      joinedLookupResolved = true;
    }
  } catch {
    // Fall back to two-step lookup when join or tenant_id column is unsupported
  }

  if (!joinedLookupResolved) {
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
    try {
      const tbl = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(qrRow.table_id).first();
      if (!tbl || !matchesTenantRow(tbl as Record<string, unknown>, tenantId)) {
        return c.json({ success: false, error: 'Not found' }, 404);
      }
      resolvedTableId = qrRow.table_id;
    } catch {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
  }

  const baseUrl = resolveSafeBaseUrl(c);

  const { generatePNG } = await import('../tree/qr/generator');
  const pngBuffer = await generatePNG(slug, baseUrl);

  return new Response(pngBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${safeSlug}.png"`,
      'X-Slug': safeSlug,
      'X-Table-ID': String(resolvedTableId)
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
  const safeSlug = String(slug || '').replace(/[^A-Za-z0-9._-]/g, '_');
  const tenantId = getTenantId(c);

  let table: CafeTable | null = null;
  let joinedPngResolved = false;
  try {
    const joined = await db
      .prepare(
        `SELECT q.table_id, q.slug, t.*
         FROM table_qr_codes q
         JOIN cafe_tables t ON t.id = q.table_id
         WHERE q.slug = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?)`
      )
      .bind(slug, tenantId, tenantId)
      .first<Record<string, unknown>>();
    if (joined && joined.id !== undefined && 'table_number' in joined) {
      if (!matchesTenantRow(joined, tenantId)) {
        return c.json({ success: false, error: 'Table not found' }, 404);
      }
      table = joined as unknown as CafeTable;
      joinedPngResolved = true;
    }
  } catch {
    // Fall back to two-step lookup when join or tenant_id column is unsupported
  }

  if (!joinedPngResolved) {
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

    const tableRow = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(qrRow.table_id)
      .first<CafeTable>();
    table = tableRow ?? null;
    if (!table || !matchesTenantRow(table as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }
  }

  // QR payload: deep link to public ordering page for that table/slug.
  const baseUrl = resolveSafeBaseUrl(c);
  const qrPayload = `${baseUrl}/order/${slug}`;

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
          'UPDATE table_qr_codes SET updated_at = datetime(\'now\') WHERE slug = ? AND table_id = ?'
        )
          .bind(slug, table!.id)
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
      'X-Table-ID': String(table!.id),
      'X-Slug': safeSlug
    }
  });
});
