/**
 * QR Scan — public QR code PNG endpoint
 * Extracted from worker/src/routes/tables.ts (qrRouter portion).
 */
import { Hono } from 'hono';
import QRCode from 'qrcode';
import { verifyQRSignature } from 'worker/src/tree/qr/signer';
import { matchesTenantRow } from 'worker/src/middleware/tenant';
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

  const rawExplicitTenant = (
    c.req.header('x-tenant-id') ||
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-store-id') ||
    c.req.header('X-Store-ID') ||
    c.req.query('tenant') ||
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    ''
  ).trim();
  const explicitTenant = rawExplicitTenant.toLowerCase() === 'hq' ? '*' : rawExplicitTenant;
  const effectiveTenant = explicitTenant && explicitTenant !== '*' ? explicitTenant : 'default';

  // Lookup slug → table mapping and verify QR code is active
  type QrRowRecord = {
    table_id: number | string;
    slug?: string;
    qr_slug?: string;
    status?: string | null;
    is_active?: number | boolean | null;
    tenant_id?: string | null;
  };
  let qrRow: QrRowRecord | null = null;
  if (explicitTenant && explicitTenant !== '*') {
    try {
      qrRow = (await db.prepare(
        "SELECT * FROM table_qr_codes WHERE slug = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
      ).bind(slug, effectiveTenant).first()) as QrRowRecord | null;
    } catch {
      qrRow = null;
    }
    if (!qrRow) {
      try {
        qrRow = (await db.prepare(
          "SELECT * FROM table_qr_codes WHERE qr_slug = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
        ).bind(slug, effectiveTenant).first()) as QrRowRecord | null;
      } catch {
        qrRow = null;
      }
    }
    if (!qrRow && effectiveTenant === 'default') {
      qrRow = (await db.prepare(
        'SELECT * FROM table_qr_codes WHERE slug = ?',
      ).bind(slug).first().catch(() => null)) as QrRowRecord | null;
      if (!qrRow) {
        qrRow = (await db.prepare(
          'SELECT * FROM table_qr_codes WHERE qr_slug = ?',
        ).bind(slug).first().catch(() => null)) as QrRowRecord | null;
      }
    }
  } else {
    qrRow = (await db.prepare(
      'SELECT * FROM table_qr_codes WHERE slug = ?',
    ).bind(slug).first().catch(() => null)) as QrRowRecord | null;
    if (!qrRow) {
      qrRow = (await db.prepare(
        'SELECT * FROM table_qr_codes WHERE qr_slug = ?',
      ).bind(slug).first().catch(() => null)) as QrRowRecord | null;
    }
  }
  if (!qrRow) {
    return c.json({ success: false, error: 'QR code not found' }, 404);
  }
  if (
    (qrRow.is_active !== undefined &&
      qrRow.is_active !== null &&
      (qrRow.is_active === false || Number(qrRow.is_active) === 0)) ||
    (typeof qrRow.status === 'string' && qrRow.status.trim().toLowerCase() === 'inactive')
  ) {
    return c.json({ success: false, error: 'QR code is inactive' }, 404);
  }

  const targetTableTenant =
    explicitTenant && explicitTenant !== '*'
      ? explicitTenant
      : qrRow.tenant_id &&
          String(qrRow.tenant_id).trim() &&
          String(qrRow.tenant_id).trim() !== '*' &&
          String(qrRow.tenant_id).trim().toLowerCase() !== 'hq'
        ? String(qrRow.tenant_id).trim()
        : 'default';

  // Verify table still exists (only fall back to unscoped or padded legacy ID on default tenant)
  let table: (CafeTable & { tenant_id?: string | null; is_active?: number | boolean | null }) | null = null;
  try {
    table = (await db.prepare(
      "SELECT * FROM cafe_tables WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
    ).bind(qrRow.table_id, targetTableTenant).first()) as (CafeTable & { tenant_id?: string | null; is_active?: number | boolean | null }) | null;
  } catch {
    table = null;
  }
  if (!table && targetTableTenant === 'default') {
    table = (await db.prepare(
      'SELECT * FROM cafe_tables WHERE id = ?',
    ).bind(qrRow.table_id).first().catch(() => null)) as (CafeTable & { tenant_id?: string | null; is_active?: number | boolean | null }) | null;
  }
  if (!table && targetTableTenant === 'default' && /^\d+$/.test(String(qrRow.table_id))) {
    const paddedId = `t${String(qrRow.table_id).padStart(2, '0')}`;
    const candidate = (await db.prepare(
      'SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?',
    ).bind(paddedId, qrRow.table_id).first()) as (CafeTable & { tenant_id?: string | null; is_active?: number | boolean | null }) | null;
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
  if (
    'tenant_id' in qrRow &&
    qrRow.tenant_id !== undefined &&
    'tenant_id' in table &&
    table.tenant_id !== undefined
  ) {
    const qrTenant = qrRow.tenant_id !== null && String(qrRow.tenant_id).trim()
      ? String(qrRow.tenant_id).trim()
      : 'default';
    if (!matchesTenantRow(table as unknown as Record<string, unknown>, qrTenant)) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }
  }
  if (explicitTenant && explicitTenant !== '*') {
    if (
      'tenant_id' in qrRow &&
      qrRow.tenant_id !== undefined &&
      !matchesTenantRow(qrRow as unknown as Record<string, unknown>, explicitTenant)
    ) {
      return c.json({ success: false, error: 'Table not found' }, 404);
    }
    if ('tenant_id' in table && table.tenant_id !== undefined) {
      if (!matchesTenantRow(table as unknown as Record<string, unknown>, explicitTenant)) {
        return c.json({ success: false, error: 'Table not found' }, 404);
      }
    }
  }

  const rawTableStatus = String(table.status ?? '').trim().toLowerCase();
  const isTableInactive =
    (table.is_active !== undefined &&
      table.is_active !== null &&
      (table.is_active === false || Number(table.is_active) === 0)) ||
    ['maintenance', 'out_of_order', 'outoforder', 'disabled', 'inactive'].includes(rawTableStatus);
  if (isTableInactive) {
    return c.json({ ok: false, success: false, status: 409, error: 'Table is currently unavailable' }, 409);
  }

  const resolvedTableTenant =
    (qrRow.tenant_id && String(qrRow.tenant_id).trim()) ||
    (table.tenant_id && String(table.tenant_id).trim()) ||
    (explicitTenant && explicitTenant !== '*' ? explicitTenant : 'default');

  // Generate QR payload — deep link to ordering page with validated origin and tenant routing
  const origin = resolveSafeQrOrigin(c);
  const tenantQuery =
    resolvedTableTenant && resolvedTableTenant !== 'default'
      ? `&tenant=${encodeURIComponent(resolvedTableTenant)}`
      : '';
  const qrPayload = `${origin}?table=${encodeURIComponent(slug)}${tenantQuery}`;
  const pngBuffer = await QRCode.toBuffer(qrPayload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  const updateQrTimestamp = async () => {
    try {
      await db.prepare(
        "UPDATE table_qr_codes SET updated_at = datetime('now') WHERE slug = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
      ).bind(slug, resolvedTableTenant || 'default').run();
    } catch (err) {
      if (!resolvedTableTenant || resolvedTableTenant === 'default') {
        await db.prepare(
          "UPDATE table_qr_codes SET updated_at = datetime('now') WHERE slug = ?",
        ).bind(slug).run();
      } else {
        throw err;
      }
    }
  };
  let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
  try {
    if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
      waitUntilFn = c.executionCtx.waitUntil.bind(c.executionCtx);
    }
  } catch {
    waitUntilFn = undefined;
  }
  if (waitUntilFn) {
    waitUntilFn(updateQrTimestamp().catch(() => {}));
  } else {
    await updateQrTimestamp().catch(() => {});
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

export async function scanQrAndResolveTable(
  db: D1Database,
  input: { slug: string; ip?: string; userAgent?: string; tenantId?: string | null },
): Promise<
  | { ok: true; success: true; status: 200; table: Record<string, unknown>; qr: Record<string, unknown> }
  | { ok: false; success: false; status: number; error: string }
> {
  const slug = String(input.slug || '').trim();
  const explicitTenant = String(input.tenantId || '').trim();
  const effectiveTenant = explicitTenant && explicitTenant !== '*' ? explicitTenant : 'default';

  let qrRow: Record<string, unknown> | null = null;
  if (explicitTenant === '*') {
    qrRow = await db
      .prepare('SELECT * FROM table_qr_codes WHERE qr_slug = ?')
      .bind(slug)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (!qrRow) {
      qrRow = await db
        .prepare('SELECT * FROM table_qr_codes WHERE slug = ?')
        .bind(slug)
        .first<Record<string, unknown>>()
        .catch(() => null);
    }
  } else {
    try {
      qrRow = await db
        .prepare("SELECT * FROM table_qr_codes WHERE qr_slug = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(slug, effectiveTenant)
        .first<Record<string, unknown>>();
    } catch {
      qrRow = null;
    }
    if (!qrRow) {
      try {
        qrRow = await db
          .prepare("SELECT * FROM table_qr_codes WHERE slug = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(slug, effectiveTenant)
          .first<Record<string, unknown>>();
      } catch {
        qrRow = null;
      }
    }
    if (!qrRow && effectiveTenant === 'default') {
      qrRow = await db
        .prepare('SELECT * FROM table_qr_codes WHERE qr_slug = ?')
        .bind(slug)
        .first<Record<string, unknown>>()
        .catch(() => null);
      if (!qrRow) {
        qrRow = await db
          .prepare('SELECT * FROM table_qr_codes WHERE slug = ?')
          .bind(slug)
          .first<Record<string, unknown>>()
          .catch(() => null);
      }
    }
  }
  if (!qrRow || (explicitTenant !== '*' && !matchesTenantRow(qrRow, effectiveTenant))) {
    return { ok: false, success: false, status: 404, error: 'QR code not found' };
  }
  if (
    (qrRow.is_active !== undefined &&
      qrRow.is_active !== null &&
      (qrRow.is_active === false || Number(qrRow.is_active) === 0)) ||
    (typeof qrRow.status === 'string' && qrRow.status.trim().toLowerCase() === 'inactive')
  ) {
    return { ok: false, success: false, status: 404, error: 'QR code is inactive' };
  }

  const targetTableTenant =
    explicitTenant && explicitTenant !== '*'
      ? explicitTenant
      : typeof qrRow.tenant_id === 'string' && qrRow.tenant_id.trim() && qrRow.tenant_id.trim() !== '*'
        ? qrRow.tenant_id.trim()
        : 'default';

  let table: Record<string, unknown> | null = null;
  try {
    table = await db
      .prepare("SELECT * FROM cafe_tables WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(qrRow.table_id, targetTableTenant)
      .first<Record<string, unknown>>();
  } catch {
    table = null;
  }
  if (!table && targetTableTenant === 'default') {
    table = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(qrRow.table_id)
      .first<Record<string, unknown>>()
      .catch(() => null);
  }
  if (!table || !matchesTenantRow(table, targetTableTenant)) {
    return { ok: false, success: false, status: 404, error: 'Table not found' };
  }

  const rawTableStatus = String(table.status ?? '').trim().toLowerCase();
  const isTableInactive =
    (table.is_active !== undefined &&
      table.is_active !== null &&
      (table.is_active === false || Number(table.is_active) === 0)) ||
    ['maintenance', 'out_of_order', 'outoforder', 'disabled', 'inactive'].includes(rawTableStatus);
  if (isTableInactive) {
    return { ok: false, success: false, status: 409, error: 'Table is currently unavailable' };
  }

  return { ok: true, success: true, status: 200, table, qr: qrRow };
}

