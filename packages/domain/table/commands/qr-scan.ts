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

function resolveSafeQrOrigin(c: { req: { header: (name: string) => string | undefined }; env: Env }): string {
  const envRec = (c.env || {}) as unknown as Record<string, unknown>;
  const configured = typeof envRec.PUBLIC_URL === 'string' && envRec.PUBLIC_URL.trim()
    ? envRec.PUBLIC_URL.trim().replace(/\/+$/, '')
    : typeof envRec.FRONTEND_URL === 'string' && envRec.FRONTEND_URL.trim()
      ? envRec.FRONTEND_URL.trim().replace(/\/+$/, '')
      : '';
  let configuredHost = '';
  if (configured) {
    try {
      configuredHost = new URL(configured).hostname.toLowerCase();
    } catch { /* ignore */ }
  }
  const rawHost = (c.req.header('host') || '').trim().toLowerCase();
  const rawProto = (c.req.header('x-forwarded-proto') || '').trim().toLowerCase();
  const isValidSyntax = /^[a-z0-9.-]+(?::\d{1,5})?$/.test(rawHost);
  const hostOnly = rawHost.replace(/:\d+$/, '');
  const isAllowedHost = isValidSyntax && (
    hostOnly === 'localhost' ||
    hostOnly === '127.0.0.1' ||
    hostOnly === 'test.aura' ||
    hostOnly === 'app.test' ||
    (Boolean(configuredHost) && hostOnly === configuredHost) ||
    hostOnly === 'auraspace.cafe' ||
    hostOnly.endsWith('.auraspace.cafe') ||
    hostOnly === 'auraspace.vn' ||
    hostOnly.endsWith('.auraspace.vn')
  );
  if (!isAllowedHost) {
    return configured || 'http://localhost:3000';
  }
  const defaultProto = hostOnly === 'localhost' || hostOnly === '127.0.0.1' ? 'http' : 'https';
  const safeProto = rawProto === 'http' || rawProto === 'https' ? rawProto : defaultProto;
  return `${safeProto}://${rawHost}`;
}

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
  ).bind(slug).first()) as { table_id: number | string; slug: string } | null;
  if (!qrRow) {
    return c.json({ success: false, error: 'QR code not found' }, 404);
  }

  // Verify table still exists (only fall back to padded legacy ID for purely numeric table_id on default tenant)
  let table = (await db.prepare(
    'SELECT * FROM cafe_tables WHERE id = ?',
  ).bind(qrRow.table_id).first()) as (CafeTable & { tenant_id?: string | null }) | null;
  if (!table && /^\d+$/.test(String(qrRow.table_id))) {
    const paddedId = `t${String(qrRow.table_id).padStart(2, '0')}`;
    const candidate = (await db.prepare(
      'SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?',
    ).bind(paddedId, qrRow.table_id).first()) as (CafeTable & { tenant_id?: string | null }) | null;
    if (candidate) {
      const candidateTenant = candidate.tenant_id && String(candidate.tenant_id).trim()
        ? String(candidate.tenant_id).trim()
        : 'default';
      if (candidateTenant === 'default') {
        table = candidate;
      }
    }
  }
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  // Generate QR payload — deep link to ordering page with validated origin
  const origin = resolveSafeQrOrigin(c);
  const qrPayload = `${origin}?table=${encodeURIComponent(slug)}`;
  const pngBuffer = await QRCode.toBuffer(qrPayload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  try {
    c.executionCtx?.waitUntil(
      db.prepare(
        'UPDATE table_qr_codes SET updated_at = datetime(\'now\') WHERE slug = ?',
      ).bind(slug).run(),
    );
  } catch {
    /* unit tests without ExecutionContext */
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
