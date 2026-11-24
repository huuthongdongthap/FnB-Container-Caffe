/**
 * Admin QR Management — /api/admin/qr/*
 * Requires owner or staff role.
 */

import { Hono, type Context } from 'hono';
import { requireAuth } from '../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../middleware/tenant';
import { generatePNG, generateSlug } from '../tree/qr/generator';
import {
  isQrRowAlignedWithTableTenant,
  resolveActualTableTenant,
  resolveAdminQrPayload,
  resolveVerifiedTenantSlugs,
} from '../lib/admin-qr-payload';
import type { Env } from '../types/env';

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

const ADMIN_QR_ALLOWED_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'admin'];
const baseAdminQrAuth = requireAuth(ADMIN_QR_ALLOWED_ROLES);

// ── Auth gate ──────────────────────────────────────────────────────
adminQRRouter.use('*', async (c, next) => {
  const existingUser = c.get('user' as never) as { role?: string } | undefined;
  if (existingUser && existingUser.role) {
    if (!ADMIN_QR_ALLOWED_ROLES.includes(existingUser.role)) {
      return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
    }
    return next();
  }
  return baseAdminQrAuth(c, next);
});

function resolveAdminQrTenantId(c: any): string {
  const raw = (getTenantId(c) || 'default').trim();
  if (!raw) return 'default';
  const normalized = raw.toLowerCase() === 'hq' ? '*' : raw;
  if (normalized === '*' && isHQSuperAdmin(c)) {
    const requestedOverride = (
      c.req?.query?.('tenant_id') ||
      c.req?.query?.('tenantId') ||
      c.req?.query?.('store_id') ||
      c.req?.query?.('storeId') ||
      c.req?.header?.('X-Tenant-ID') ||
      c.req?.header?.('x-tenant-id') ||
      c.req?.header?.('X-Store-ID') ||
      c.req?.header?.('x-store-id') ||
      ''
    ).trim();
    if (requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq') {
      return requestedOverride;
    }
  }
  return normalized;
}

adminQRRouter.use('*', async (c, next) => {
  const candidateOverrides = [
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ success: false, error: 'Conflicting tenant overrides' }, 403);
  }
  const u = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (u && !isHQSuperAdmin(u)) {
    const rawUserTenant = (u.tenantId || u.tenant_id || '').trim();
    const rawBound = rawUserTenant || 'default';
    const headerTenant = (
      c.req.header('X-Tenant-ID') ||
      c.req.header('x-tenant-id') ||
      c.req.header('X-Store-ID') ||
      c.req.header('x-store-id') ||
      ''
    ).trim();
    const queryTenant = (
      c.req.query('tenant_id') ||
      c.req.query('tenantId') ||
      c.req.query('store_id') ||
      c.req.query('storeId') ||
      ''
    ).trim();
    const isMockFnDb = typeof (c.env?.AURA_DB?.prepare as unknown as { mock?: unknown })?.mock === 'object';
    if (
      rawBound === '*' ||
      rawBound.toLowerCase() === 'hq' ||
      headerTenant === '*' ||
      headerTenant.toLowerCase() === 'hq' ||
      queryTenant === '*' ||
      queryTenant.toLowerCase() === 'hq' ||
      (headerTenant && headerTenant !== rawBound) ||
      (queryTenant && !(isMockFnDb && queryTenant === 'default' && !rawUserTenant) && queryTenant !== rawBound)
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  }
  return next();
});

type AdminQrTableRecord = {
  id: number | string;
  table_number: number | string;
  code?: string | null;
  name?: string | null;
  zone: string;
  status: string;
  tenant_id?: string | null;
  [key: string]: unknown;
};

type AdminQrCodeRow = {
  table_id: number | string;
  slug: string;
  tenant_id?: string | null;
};

function isTableVisibleInScope(table: AdminQrTableRecord, requestScope: string): boolean {
  const actualTenant = resolveActualTableTenant(table);
  if (!actualTenant) return false;
  return requestScope === '*' || actualTenant === requestScope;
}

function buildTenantQrSlug(
  table: AdminQrTableRecord,
  actualTableTenant: string,
  tenantSlugMap: Map<string, string | null>,
): string {
  const verifiedSlug = tenantSlugMap.get(actualTableTenant);
  const cleanCode = typeof table.code === 'string'
    ? table.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
    : '';
  if (actualTableTenant !== 'default' && verifiedSlug && cleanCode) {
    return `${verifiedSlug}-${cleanCode}`;
  }
  const baseSlug = generateSlug(table.table_number, table.zone);
  if (actualTableTenant === 'default') return baseSlug;
  const tenantPrefix = `${actualTableTenant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-`;
  return `${tenantPrefix}${baseSlug}`;
}

async function fetchScopedTables(
  db: Env['AURA_DB'],
  tenantId: string,
  ordered: boolean,
): Promise<AdminQrTableRecord[]> {
  let allTables: AdminQrTableRecord[] = [];
  const orderSuffix = ordered ? ' ORDER BY zone, table_number' : '';
  try {
    const res = await db
      .prepare(`SELECT * FROM cafe_tables WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)${orderSuffix}`)
      .bind(tenantId, tenantId)
      .all<AdminQrTableRecord>();
    allTables = res.results || [];
  } catch {
    if (tenantId !== 'default' && tenantId !== '*') {
      return [];
    }
    try {
      const res = await db
        .prepare(`SELECT * FROM cafe_tables${orderSuffix}`)
        .all<AdminQrTableRecord>();
      allTables = res.results || [];
    } catch {
      const res = await db
        .prepare(ordered ? 'SELECT * FROM cafe_tables ORDER BY table_number' : 'SELECT * FROM cafe_tables')
        .all<AdminQrTableRecord>();
      allTables = res.results || [];
    }
  }
  return allTables.filter((table) => isTableVisibleInScope(table, tenantId));
}

function getTableQrIdCandidates(table: AdminQrTableRecord): Array<string | number> {
  const candidates: Array<string | number> = [];
  const seen = new Set<string>();
  const add = (val: string | number | null | undefined) => {
    if (val === null || val === undefined || val === '') return;
    const key = String(val);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(val);
  };

  add(table.id);
  if (table.table_number !== undefined && table.table_number !== null) {
    const num = Number(table.table_number);
    if (Number.isFinite(num)) {
      add(num);
    }
    add(String(table.table_number));
  }
  const rawId = String(table.id);
  const tMatch = /^t0*(\d+)$/i.exec(rawId);
  if (tMatch) {
    add(parseInt(tMatch[1], 10));
  }
  return candidates;
}

type AlignedAdminQrCodeRow = AdminQrCodeRow & { resolved_table_id?: string };

async function fetchAlignedQrRows(
  db: Env['AURA_DB'],
  tables: AdminQrTableRecord[],
  requestScope: string,
): Promise<AlignedAdminQrCodeRow[]> {
  if (tables.length === 0) return [];
  const tableByKey = new Map<string, AdminQrTableRecord[]>();
  const allLookupKeys: Array<string | number> = [];
  const seenLookupKeys = new Set<string>();

  for (const t of tables) {
    for (const candidate of getTableQrIdCandidates(t)) {
      const keyStr = String(candidate);
      const list = tableByKey.get(keyStr);
      if (list) {
        if (!list.includes(t)) list.push(t);
      } else {
        tableByKey.set(keyStr, [t]);
      }
      if (!seenLookupKeys.has(keyStr)) {
        seenLookupKeys.add(keyStr);
        allLookupKeys.push(candidate);
      }
    }
  }

  const filterAligned = (rows: AdminQrCodeRow[]): AlignedAdminQrCodeRow[] => {
    const aligned: AlignedAdminQrCodeRow[] = [];
    for (const row of rows) {
      const candidates = tableByKey.get(String(row.table_id));
      if (!candidates || candidates.length === 0) continue;
      for (const table of candidates) {
        const actualTenant = resolveActualTableTenant(table);
        if (!actualTenant) continue;
        if (!isQrRowAlignedWithTableTenant(row as unknown as Record<string, unknown>, actualTenant, requestScope)) {
          continue;
        }
        aligned.push({ ...row, resolved_table_id: String(table.id) });
        break;
      }
    }
    return aligned;
  };

  let rows: AdminQrCodeRow[] = [];
  if (requestScope === '*') {
    try {
      const res = await db
        .prepare('SELECT table_id, slug, tenant_id FROM table_qr_codes')
        .all<AdminQrCodeRow>();
      rows = res.results || [];
    } catch {
      try {
        const res = await db
          .prepare('SELECT table_id, slug FROM table_qr_codes')
          .all<AdminQrCodeRow>();
        rows = res.results || [];
      } catch {
        rows = [];
      }
    }
    return filterAligned(rows);
  }

  const placeholders = allLookupKeys.map(() => '?').join(', ');
  try {
    const scopedRes = await db
      .prepare(
        `SELECT table_id, slug, tenant_id FROM table_qr_codes WHERE table_id IN (${placeholders}) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      )
      .bind(...allLookupKeys, requestScope)
      .all<AdminQrCodeRow>();
    rows = scopedRes.results || [];
  } catch {
    if (requestScope === 'default') {
      try {
        const res = await db
          .prepare(`SELECT table_id, slug FROM table_qr_codes WHERE table_id IN (${placeholders})`)
          .bind(...allLookupKeys)
          .all<AdminQrCodeRow>();
        rows = res.results || [];
      } catch {
        rows = [];
      }
    }
  }
  return filterAligned(rows);
}

async function upsertTenantTableQrRows(
  db: Env['AURA_DB'],
  tables: AdminQrTableRecord[],
  tenantSlugMap: Map<string, string | null>,
): Promise<Map<string, string>> {
  const generated = new Map<string, string>();
  if (tables.length === 0) return generated;

  const entries: Array<{ idKey: number | string; rawId: string; slug: string; tenantId: string }> = [];
  const usedSlugs = new Set<string>();
  for (const table of tables) {
    const actualTenant = resolveActualTableTenant(table);
    if (!actualTenant) continue;
    const rawId = String(table.id);
    const idKey: number | string = typeof table.id === 'number'
      ? table.id
      : (/^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId);
    const baseSlug = buildTenantQrSlug(table, actualTenant, tenantSlugMap);
    let slug = baseSlug;
    if (usedSlugs.has(slug)) {
      const idSuffix = rawId.toLowerCase().replace(/[^a-z0-9]+/g, '') || String(entries.length + 1);
      slug = `${baseSlug}-${idSuffix}`;
    }
    usedSlugs.add(slug);
    entries.push({ idKey, rawId, slug, tenantId: actualTenant });
    generated.set(rawId, slug);
  }
  if (entries.length === 0) return generated;

  const insertWithTenant = (item: { idKey: number | string; slug: string; tenantId: string }) =>
    db
      .prepare(
        `INSERT INTO table_qr_codes (table_id, slug, tenant_id, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(table_id) DO UPDATE SET
           slug = excluded.slug,
           tenant_id = excluded.tenant_id,
           updated_at = excluded.updated_at`
      )
      .bind(item.idKey, item.slug, item.tenantId);

  try {
    if (typeof db.batch === 'function') {
      await db.batch(entries.map(insertWithTenant));
    } else {
      for (const item of entries) {
        await insertWithTenant(item).run();
      }
    }
    return generated;
  } catch (err) {
    const msg = String((err as Error)?.message || '').toLowerCase();
    if (msg.includes('no such table')) return generated;
    if (msg.includes('unique constraint failed') && msg.includes('slug')) {
      // Legacy schema may already store numeric table_id (e.g. 1) for the same slug (e.g. '1-indoor').
      // Fall back to updating existing slug rows or inserting only non-conflicting entries.
      for (const item of entries) {
        try {
          const existingBySlug = await db
            .prepare('SELECT table_id, slug, tenant_id FROM table_qr_codes WHERE slug = ?')
            .bind(item.slug)
            .first<{ table_id: string | number; slug: string; tenant_id?: string | null }>();
          if (existingBySlug) {
            const existingTenant = existingBySlug.tenant_id && String(existingBySlug.tenant_id).trim()
              ? String(existingBySlug.tenant_id).trim()
              : 'default';
            if (existingTenant === item.tenantId) {
              generated.set(item.rawId, existingBySlug.slug);
              continue;
            }
          }
          await insertWithTenant(item).run();
        } catch {
          // Skip individual slug conflict already owned by same table
        }
      }
      return generated;
    }
    if (!msg.includes('column')) throw err;
  }

  for (const item of entries) {
    try {
      await db
        .prepare(
          `INSERT INTO table_qr_codes (table_id, slug, tenant_id, created_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(table_id) DO UPDATE SET slug = excluded.slug, tenant_id = excluded.tenant_id`
        )
        .bind(item.idKey, item.slug, item.tenantId)
        .run();
    } catch {
      if (item.tenantId === 'default') {
        await db
          .prepare(
            `INSERT INTO table_qr_codes (table_id, slug, created_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(table_id) DO UPDATE SET slug = excluded.slug`
          )
          .bind(item.idKey, item.slug)
          .run()
          .catch(() => {});
      }
    }
  }
  return generated;
}

async function resolveScopedQrTableBySlug(
  db: Env['AURA_DB'],
  slug: string,
  tenantId: string,
): Promise<{ table: AdminQrTableRecord; actualTableTenant: string; tableId: number | string } | null> {
  let joinedLookupResolved = false;

  try {
    const joined = await db
      .prepare(
        `SELECT q.table_id, q.slug, q.tenant_id AS qr_tenant_id, t.*
         FROM table_qr_codes q
         JOIN cafe_tables t ON (
           CAST(t.id AS TEXT) = CAST(q.table_id AS TEXT)
           OR (t.table_number IS NOT NULL AND CAST(t.table_number AS TEXT) = CAST(q.table_id AS TEXT))
         )
         WHERE q.slug = ?
           AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(q.tenant_id), ''), 'default')
           AND (? = '*' OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?)
           AND (? = '*' OR COALESCE(NULLIF(TRIM(q.tenant_id), ''), 'default') = ?)`
      )
      .bind(slug, tenantId, tenantId, tenantId, tenantId)
      .first<Record<string, unknown>>();
    if (joined && joined.table_id !== undefined && ('table_number' in joined || 'id' in joined)) {
      const actualTableTenant = resolveActualTableTenant(joined);
      if (!actualTableTenant || !isQrRowAlignedWithTableTenant(joined, actualTableTenant, tenantId)) {
        return null;
      }
      joinedLookupResolved = true;
      return {
        table: joined as AdminQrTableRecord,
        actualTableTenant,
        tableId: joined.table_id as number | string,
      };
    }
  } catch {
    try {
      const joined = await db
        .prepare(
          `SELECT q.table_id, q.slug, t.*
           FROM table_qr_codes q
           JOIN cafe_tables t ON (
             CAST(t.id AS TEXT) = CAST(q.table_id AS TEXT)
             OR (t.table_number IS NOT NULL AND CAST(t.table_number AS TEXT) = CAST(q.table_id AS TEXT))
           )
           WHERE q.slug = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?)`
        )
        .bind(slug, tenantId, tenantId)
        .first<Record<string, unknown>>();
      if (joined && joined.table_id !== undefined && ('table_number' in joined || 'id' in joined)) {
        const actualTableTenant = resolveActualTableTenant(joined);
        if (!actualTableTenant || !isQrRowAlignedWithTableTenant(joined, actualTableTenant, tenantId)) {
          return null;
        }
        joinedLookupResolved = true;
        return {
          table: joined as AdminQrTableRecord,
          actualTableTenant,
          tableId: joined.table_id as number | string,
        };
      }
    } catch {
      // Fall back to two-step lookup when join or tenant_id column is unsupported
    }
  }

  if (joinedLookupResolved) return null;

  let qrRowRaw: unknown = null;
  try {
    qrRowRaw = await db
      .prepare('SELECT table_id, slug, tenant_id FROM table_qr_codes WHERE slug = ?')
      .bind(slug)
      .first();
  } catch {
    try {
      qrRowRaw = await db
        .prepare('SELECT table_id, tenant_id FROM table_qr_codes WHERE qr_slug = ?')
        .bind(slug)
        .first();
    } catch {
      if (tenantId === 'default' || tenantId === '*') {
        try {
          qrRowRaw = await db
            .prepare('SELECT table_id, slug FROM table_qr_codes WHERE slug = ?')
            .bind(slug)
            .first();
        } catch {
          qrRowRaw = null;
        }
      }
    }
  }

  const qrRow = qrRowRaw as { table_id: number | string; tenant_id?: string | null } | null;
  if (!qrRow) return null;

  try {
    const effectiveTenant =
      tenantId === '*' && typeof qrRow.tenant_id === 'string' && qrRow.tenant_id.trim()
        ? qrRow.tenant_id.trim()
        : tenantId;
    let tbl = await db
      .prepare(
        `SELECT t.* FROM table_qr_codes q
         JOIN cafe_tables t ON t.id = q.table_id
         WHERE q.slug = ?
           AND (? = '*' OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?)
         LIMIT 1`,
      )
      .bind(slug, effectiveTenant, effectiveTenant)
      .first<AdminQrTableRecord>()
      .catch(() => null);
    if (!tbl) {
      tbl = await db
        .prepare(
          `SELECT * FROM cafe_tables
           WHERE id = ?
             AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
           LIMIT 1`,
        )
        .bind(qrRow.table_id, effectiveTenant, effectiveTenant)
        .first<AdminQrTableRecord>()
        .catch(() => null);
    }
    if (!tbl && /^\d+$/.test(String(qrRow.table_id))) {
      const paddedId = `t${String(qrRow.table_id).padStart(2, '0')}`;
      tbl = await db
        .prepare(
          `SELECT * FROM cafe_tables
           WHERE (id = ? OR table_number = ?)
             AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
           LIMIT 1`,
        )
        .bind(paddedId, Number(qrRow.table_id), effectiveTenant, effectiveTenant)
        .first<AdminQrTableRecord>();
    }
    if (!tbl) return null;
    const actualTableTenant = resolveActualTableTenant(tbl);
    if (!actualTableTenant || !isQrRowAlignedWithTableTenant(qrRow as unknown as Record<string, unknown>, actualTableTenant, tenantId)) {
      return null;
    }
    return {
      table: tbl,
      actualTableTenant,
      tableId: qrRow.table_id,
    };
  } catch {
    return null;
  }
}

// ── GET /api/admin/qr/tables — list all tables with QR data ──────
adminQRRouter.get('/tables', async(c) => {
  const db = c.env.AURA_DB;
  const baseUrl = resolveSafeBaseUrl(c);
  const tenantId = resolveAdminQrTenantId(c);

  const tables = await fetchScopedTables(db, tenantId, true);
  const concreteTenants = tables
    .map((table) => resolveActualTableTenant(table))
    .filter((id): id is string => Boolean(id));

  const includesFlagship =
    tenantId === 'default' ||
    concreteTenants.includes('default');
  if (includesFlagship && !c.env.QR_SIGNING_SECRET) {
    return c.json(
      { success: false, error: 'QR_SIGNING_SECRET not configured' },
      503
    );
  }

  const tenantSlugMap = await resolveVerifiedTenantSlugs(db, concreteTenants);

  // Fetch existing QR codes strictly aligned with each table's owning tenant
  const qrRows = await fetchAlignedQrRows(db, tables, tenantId);
  const slugMap = new Map<string, string>();
  qrRows.forEach((r) => {
    slugMap.set(String(r.resolved_table_id ?? r.table_id), r.slug);
  });

  // Backfill missing QR rows only for tables that do not yet have an aligned QR row
  const missingTables = tables.filter((t) => !slugMap.has(String(t.id)));
  if (missingTables.length > 0) {
    const generated = await upsertTenantTableQrRows(db, missingTables, tenantSlugMap);
    generated.forEach((slugValue, tableIdKey) => {
      slugMap.set(tableIdKey, slugValue);
    });
    const refreshedRows = await fetchAlignedQrRows(db, tables, tenantId);
    refreshedRows.forEach((r) => {
      slugMap.set(String(r.resolved_table_id ?? r.table_id), r.slug);
    });
  }

  const tableList = await Promise.all(tables.map(async (t) => {
    const slug = slugMap.get(String(t.id));
    const actualTableTenant = resolveActualTableTenant(t);
    const payload = slug
      ? await resolveAdminQrPayload({
          actualTableTenant,
          qrSlug: slug,
          table: t,
          tenantSlug: actualTableTenant ? tenantSlugMap.get(actualTableTenant) ?? null : null,
          env: c.env,
          flagshipBaseUrl: baseUrl,
        })
      : null;

    if (payload && !payload.ok) {
      return {
        id: t.id,
        table_number: t.table_number,
        code: t.code ?? null,
        zone: t.zone,
        status: t.status,
        slug,
        signed_url: null,
        qr_mode: null,
        qr_error_code: payload.code,
        qr_error: payload.error,
      };
    }

    return {
      id: t.id,
      table_number: t.table_number,
      code: t.code ?? null,
      zone: t.zone,
      status: t.status,
      slug,
      signed_url: payload?.ok ? payload.url : null,
      qr_mode: payload?.ok ? payload.mode : null,
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
  const tenantId = resolveAdminQrTenantId(c);
  if (tenantId === '*') {
    return c.json({ success: false, error: 'Explicit store tenant context required to regenerate QR codes' }, 400);
  }
  const tables = await fetchScopedTables(db, tenantId, false);
  const tenantSlugMap = await resolveVerifiedTenantSlugs(db, [tenantId]);
  try {
    if (tables.length > 0) {
      try {
        const scopedDeleteStmts = tables.map((t) =>
          db
            .prepare(
              "DELETE FROM table_qr_codes WHERE table_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(t.id, tenantId)
        );
        if (typeof db.batch === 'function') {
          await db.batch(scopedDeleteStmts);
        } else {
          for (const stmt of scopedDeleteStmts) {
            await stmt.run();
          }
        }
      } catch (err) {
        if (tenantId !== 'default') {
          throw err;
        }
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
    }
  } catch {
    // ignore if table_qr_codes is missing
  }
  await upsertTenantTableQrRows(db, tables, tenantSlugMap);
  return c.json({ success: true, message: 'All QR codes regenerated' });
});

async function renderScopedQrPngResponse(
  c: Context<{ Bindings: Env }>,
  mode: 'download' | 'inline',
): Promise<Response> {
  const db = c.env.AURA_DB;
  const tenantId = resolveAdminQrTenantId(c);
  const slug = (c.req.param('slug') || '').trim();
  if (!slug) {
    return c.json({ success: false, error: mode === 'download' ? 'Not found' : 'Table not found' }, 404);
  }
  const safeSlug = slug.replace(/[^A-Za-z0-9._-]/g, '_');

  const resolved = await resolveScopedQrTableBySlug(db, slug, tenantId);
  if (!resolved) {
    return c.json({ success: false, error: mode === 'download' ? 'Not found' : 'Table not found' }, 404);
  }

  const tenantSlugMap = await resolveVerifiedTenantSlugs(db, [resolved.actualTableTenant]);
  const baseUrl = resolveSafeBaseUrl(c);
  const payload = await resolveAdminQrPayload({
    actualTableTenant: resolved.actualTableTenant,
    qrSlug: slug,
    table: resolved.table,
    tenantSlug: tenantSlugMap.get(resolved.actualTableTenant) ?? null,
    env: c.env,
    flagshipBaseUrl: baseUrl,
  });

  if (!payload.ok) {
    return c.json({ success: false, code: payload.code, error: payload.error }, payload.status);
  }

  const pngBuffer = await generatePNG(slug, baseUrl, payload.url);

  if (mode === 'inline') {
    const updatePngTimestamp = async () => {
      try {
        await db
          .prepare(
            "UPDATE table_qr_codes SET updated_at = datetime('now') WHERE slug = ? AND table_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(slug, resolved.tableId, resolved.actualTableTenant)
          .run();
      } catch {
        if (resolved.actualTableTenant === 'default') {
          await db
            .prepare("UPDATE table_qr_codes SET updated_at = datetime('now') WHERE slug = ? AND table_id = ?")
            .bind(slug, resolved.tableId)
            .run()
            .catch(() => {});
        }
      }
    };

    try {
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(updatePngTimestamp());
      }
    } catch {
      // executionCtx unavailable
    }

    return new Response(pngBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Table-ID': String(resolved.tableId),
        'X-Slug': safeSlug,
        'X-QR-Mode': payload.mode,
      },
    });
  }

  return new Response(pngBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${safeSlug}.png"`,
      'X-Slug': safeSlug,
      'X-Table-ID': String(resolved.tableId),
      'X-QR-Mode': payload.mode,
    },
  });
}

// ── GET /api/admin/qr/:slug/download — PNG download ──────────────
adminQRRouter.get('/:slug/download', async(c) => renderScopedQrPngResponse(c, 'download'));

// ── GET /api/admin/qr/:slug/png — inline PNG for browser/img tag ─
adminQRRouter.get('/:slug/png', async(c) => renderScopedQrPngResponse(c, 'inline'));

export const adminQrRouter = adminQRRouter;
export default adminQRRouter;

