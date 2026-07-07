/**
 * QR Code Generator — bulk slug creation + PNG encoding.
 * Stateless HMAC signing provided by signer.ts; this module handles
 * persistence (table_qr_codes table) and image encoding.
 */

import QRCode from 'qrcode';
import type { CafeTable } from '../../routes/tables';
import type { Env } from "../../types/env";

/**
 * Generate a URL-safe slug from table number + zone.
 * Normalizes Vietnamese diacritics so "Khu vực VIP" → "khu-vuc-vip".
 * Examples: T01 + indoor → t01-indoor, VIP01 + private → vip01-private, 1 + Khu vực VIP → 1-khu-vuc-vip
 */
export function generateSlug(tableNumber: number | string, zone: string): string {
  const num = String(tableNumber).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const normalized = zone
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${num}${normalized ? '-' + normalized : ''}`;
}

/**
 * Upsert slugs for a list of tables into table_qr_codes.
 * Returns a map of table_id → slug.
 * Idempotent: existing slugs are preserved.
 */
export async function bulkGenerateSlugs(
  db: import('@cloudflare/workers-types').D1Database,
  tables: CafeTable[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();

  for (const table of tables) {
    const idNum = typeof table.id === 'string' ? parseInt(table.id, 10) : Number(table.id);
    const desiredSlug = generateSlug(table.table_number, table.zone);

    // Try to find existing slug for this table
    const existing = await db
      .prepare('SELECT slug FROM table_qr_codes WHERE table_id = ?')
      .bind(idNum)
      .first<{ slug: string }>();

    const slug = existing?.slug ?? desiredSlug;
    result.set(idNum, slug);

    // Upsert: INSERT OR REPLACE
    await db
      .prepare(
        `INSERT INTO table_qr_codes (table_id, slug, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(table_id) DO UPDATE SET slug = excluded.slug, updated_at = excluded.updated_at`
      )
      .bind(idNum, slug)
      .run();
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
  baseUrl: string,
): Promise<ArrayBuffer> {
  if (!baseUrl) {
    throw new Error('generatePNG: baseUrl is required (was: ' + baseUrl + ')');
  }
  const host = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const payload = `https://${host}?table=${encodeURIComponent(slug)}`;
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  return buffer.buffer as ArrayBuffer;
}

/**
 * Generate a data URL (base64 PNG) for embedding in admin UI.
 */
export async function generateDataURL(
  slug: string,
  baseUrl: string,
): Promise<string> {
  const pngBuffer = await generatePNG(slug, baseUrl);
  const base64 = Buffer.from(pngBuffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}
