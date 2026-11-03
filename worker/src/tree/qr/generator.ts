/**
 * QR Code Generator — bulk slug creation + PNG encoding.
 * Stateless HMAC signing provided by signer.ts; this module handles
 * persistence (table_qr_codes table) and image encoding.
 */

import QRCode from 'qrcode';
import type { CafeTable } from '@aura/domain-table';

/**
 * Generate a URL-safe slug from table number + zone.
 * Normalizes Vietnamese diacritics so "Khu vực VIP" → "khu-vuc-vip".
 * Examples: T01 + indoor → t01-indoor, VIP01 + private → vip01-private, 1 + Khu vực VIP → 1-khu-vuc-vip
 */
export function generateSlug(tableNumber: number | string, zone?: string | null): string {
  const num = String(tableNumber).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const normalized = String(zone || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${num}${normalized ? `-${normalized}` : ''}`;
}

/**
 * Upsert slugs for a list of tables into table_qr_codes.
 * Returns a map of table_id → slug.
 * Idempotent: existing slugs are preserved.
 */
export async function bulkGenerateSlugs(
  db: import('@cloudflare/workers-types').D1Database,
  tables: CafeTable[]
): Promise<Map<number | string, string>> {
  const result = new Map<number | string, string>();
  if (tables.length === 0) return result;

  const prefetchedSlugs = new Map<string, string>();
  if (typeof db.batch === 'function') {
    try {
      const candidateIds = tables.map((t) => {
        const rawId = String(t.id);
        return typeof t.id === 'number' ? t.id : (/^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId);
      });
      const placeholders = candidateIds.map(() => '?').join(', ');
      const allExisting = await db
        .prepare(`SELECT table_id, slug FROM table_qr_codes WHERE table_id IN (${placeholders})`)
        .bind(...candidateIds)
        .all<{ table_id: number | string; slug: string }>();
      for (const row of allExisting?.results || []) {
        if (row.table_id !== undefined && row.slug) {
          prefetchedSlugs.set(String(row.table_id), row.slug);
        }
      }
    } catch {
      // Fall back to per-table lookup when bulk query is unsupported
    }
  }

  const batchUpsertStmts: import('@cloudflare/workers-types').D1PreparedStatement[] = [];
  const pendingUpsertArgs: Array<{ idKey: number | string; slug: string }> = [];

  for (const table of tables) {
    const rawId = String(table.id);
    const idKey: number | string = typeof table.id === 'number'
      ? table.id
      : (/^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId);
    const baseSlug = generateSlug(table.table_number, table.zone);
    const rawTenant = (table as unknown as Record<string, unknown>).tenant_id;
    const tenantPrefix = typeof rawTenant === 'string' && rawTenant.trim() && rawTenant.trim() !== 'default'
      ? `${rawTenant.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-`
      : '';
    const desiredSlug = `${tenantPrefix}${baseSlug}`;

    let existingSlug: string | undefined = prefetchedSlugs.get(String(idKey)) ?? prefetchedSlugs.get(rawId);
    if (!existingSlug) {
      try {
        const existing = await db
          .prepare('SELECT slug FROM table_qr_codes WHERE table_id = ?')
          .bind(idKey)
          .first<{ slug: string }>();
        existingSlug = existing?.slug;
      } catch {
        existingSlug = undefined;
      }
    }

    const slug = existingSlug ?? desiredSlug;
    result.set(idKey, slug);
    result.set(String(table.id), slug);

    if (typeof db.batch === 'function') {
      batchUpsertStmts.push(
        db
          .prepare(
            `INSERT INTO table_qr_codes (table_id, slug, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(table_id) DO UPDATE SET slug = excluded.slug, updated_at = excluded.updated_at`
          )
          .bind(idKey, slug)
      );
      pendingUpsertArgs.push({ idKey, slug });
    } else {
      try {
        await db
          .prepare(
            `INSERT INTO table_qr_codes (table_id, slug, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(table_id) DO UPDATE SET slug = excluded.slug, updated_at = excluded.updated_at`
          )
          .bind(idKey, slug)
          .run();
      } catch (err) {
        if (String((err as Error)?.message || '').includes('column')) {
          await db
            .prepare(
              `INSERT INTO table_qr_codes (table_id, slug, created_at)
               VALUES (?, ?, datetime('now'))
               ON CONFLICT(table_id) DO UPDATE SET slug = excluded.slug`
            )
            .bind(idKey, slug)
            .run()
            .catch(() => {});
        } else if (!String((err as Error)?.message || '').includes('no such table')) {
          throw err;
        }
      }
    }
  }

  if (batchUpsertStmts.length > 0 && typeof db.batch === 'function') {
    try {
      await db.batch(batchUpsertStmts);
    } catch (err) {
      if (String((err as Error)?.message || '').includes('column')) {
        for (const item of pendingUpsertArgs) {
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
      } else if (!String((err as Error)?.message || '').includes('no such table')) {
        throw err;
      }
    }
  }

  return result;
}

/**
 * Generate a QR code PNG buffer for a given slug + base URL.
 * Deep link payload: `https://<baseUrl>?table=<slug>`
 * ⚠️ baseUrl is required — there is no fallback.  A missing baseUrl produces an
 * incorrect link and throws rather than silently generating a dead QR code.
 */
export async function generatePNG(
  slug: string,
  baseUrl: string
): Promise<ArrayBuffer> {
  if (!baseUrl) {
    throw new Error(`generatePNG: baseUrl is required (was: ${baseUrl})`);
  }
  const host = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const payload = `https://${host}?table=${encodeURIComponent(slug)}`;
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M'
  });
  return buffer.buffer as ArrayBuffer;
}

/**
 * Generate a data URL (base64 PNG) for embedding in admin UI.
 */
export async function generateDataURL(
  slug: string,
  baseUrl: string
): Promise<string> {
  const pngBuffer = await generatePNG(slug, baseUrl);
  const base64 = Buffer.from(pngBuffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}
