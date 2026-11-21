/**
 * Tenant-scoped payload and ownership helpers for Admin Table QR endpoints.
 *
 * Contract:
 * - Flagship `'default'` preserves expiring HMAC-signed `/api/qr/:slug` URLs.
 * - Non-default tenants encode permanent storefront navigation URLs on the
 *   configured trusted frontend origin: `/s/<slug>?table=<tableParam>`.
 * - Non-default tenants without a verified `saas_tenants.slug` fail closed
 *   (never invent a slug and never fall back to flagship URLs).
 */

import type { D1Database } from '@cloudflare/workers-types';
import { signQRUrl } from '../tree/qr/signer';
import type { Env } from '../types/env';

const SAAS_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const DEFAULT_FRONTEND_ORIGIN = 'https://auraspace.cafe';

export type ResolvedQrPayload =
  | { ok: true; url: string; mode: 'flagship_signed' | 'tenant_permanent' }
  | { ok: false; status: 404 | 422 | 503; code: string; error: string };

/**
 * Normalizes a tenant identifier into a concrete tenant ID.
 * Returns `null` for wildcard (`'*'`) or HQ (`'hq'`) markers so they are never
 * treated as concrete store tenants.
 */
export function normalizeConcreteTenantId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*' || trimmed.toLowerCase() === 'hq') return null;
  return trimmed;
}

/**
 * Resolves the actual concrete tenant that owns a `cafe_tables` row.
 * Blank or absent `tenant_id` (legacy schema) normalizes to `'default'`.
 * Explicit wildcard/HQ markers (`'*'`, `'hq'`) on a table row return `null`.
 */
export function resolveActualTableTenant(
  table: Record<string, unknown> | null | undefined,
): string | null {
  if (!table || typeof table !== 'object') return null;
  if ('tenant_id' in table && table.tenant_id !== undefined && table.tenant_id !== null) {
    const trimmed = String(table.tenant_id).trim();
    if (!trimmed) return 'default';
    if (trimmed === '*' || trimmed.toLowerCase() === 'hq') return null;
    return trimmed;
  }
  return 'default';
}

/**
 * Verifies that a `table_qr_codes` row agrees with the owning table's concrete
 * tenant and with the caller's request scope (including HQ wildcard `'*'`).
 */
export function isQrRowAlignedWithTableTenant(
  qrRow: Record<string, unknown> | null | undefined,
  actualTableTenant: string,
  requestScope: string,
): boolean {
  if (!qrRow || !actualTableTenant) return false;
  if (requestScope !== '*' && actualTableTenant !== requestScope) return false;

  const hasTenantField = 'qr_tenant_id' in qrRow || 'tenant_id' in qrRow;
  if (!hasTenantField) return true;

  const rawQrTenant = 'qr_tenant_id' in qrRow ? qrRow.qr_tenant_id : qrRow.tenant_id;
  if (rawQrTenant === undefined || rawQrTenant === null) return true;

  const trimmed = String(rawQrTenant).trim();
  if (!trimmed) return actualTableTenant === 'default';
  if (trimmed === '*' || trimmed.toLowerCase() === 'hq') return false;
  return trimmed === actualTableTenant;
}

function parseTrustedOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const isLocalHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (parsed.protocol !== 'https:' && !isLocalHttp) return null;
    if (!parsed.hostname) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolves the configured trusted frontend origin for permanent tenant QR links.
 * Never derives the storefront origin from untrusted request headers such as Host.
 */
export function resolveTrustedFrontendOrigin(env: Env): string {
  const envMap = env as unknown as Record<string, unknown>;
  const domainCandidate =
    typeof env.SAAS_PLATFORM_DOMAIN === 'string' && env.SAAS_PLATFORM_DOMAIN.trim()
      ? `https://${env.SAAS_PLATFORM_DOMAIN.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')}`
      : '';

  for (const candidate of [env.FE_BASE_URL, envMap.FRONTEND_URL, domainCandidate]) {
    const origin = parseTrustedOrigin(candidate);
    if (origin) return origin;
  }
  return DEFAULT_FRONTEND_ORIGIN;
}

/**
 * Resolves the `?table=` query value supported by `/api/saas/storefront/:slug`
 * and `src/pages/saas/storefront.tsx` (`t.code` case-insensitive or `t.id`).
 * Never uses `table_number`, which the storefront contract does not expose or match.
 */
export function resolveStorefrontTableParam(table: Record<string, unknown>): string | null {
  const code = typeof table.code === 'string' ? table.code.trim() : '';
  if (code) return code;
  if (table.id !== undefined && table.id !== null) {
    const id = String(table.id).trim();
    if (id) return id;
  }
  return null;
}

/**
 * Batch-fetches verified `saas_tenants.slug` values for concrete non-default tenants.
 */
export async function resolveVerifiedTenantSlugs(
  db: D1Database,
  tenantIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const uniqueIds = Array.from(
    new Set(tenantIds.filter((id) => id && id !== 'default' && id !== '*' && id.toLowerCase() !== 'hq')),
  );
  if (uniqueIds.length === 0) return out;
  uniqueIds.forEach((id) => out.set(id, null));

  try {
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const res = await db
      .prepare(`SELECT id, slug FROM saas_tenants WHERE id IN (${placeholders})`)
      .bind(...uniqueIds)
      .all<{ id: string; slug: string | null }>();
    for (const row of res.results || []) {
      const candidate = typeof row.slug === 'string' ? row.slug.trim().toLowerCase() : '';
      out.set(row.id, SAAS_SLUG_PATTERN.test(candidate) ? candidate : null);
    }
  } catch {
    // Fail closed when saas_tenants is unavailable; all entries remain null.
  }

  return out;
}

/**
 * Builds the printable QR payload for a table using its actual owning tenant.
 */
export async function resolveAdminQrPayload(params: {
  actualTableTenant: string | null;
  qrSlug: string;
  table: Record<string, unknown>;
  tenantSlug?: string | null;
  env: Env;
  flagshipBaseUrl: string;
}): Promise<ResolvedQrPayload> {
  const { actualTableTenant, qrSlug, table, tenantSlug, env, flagshipBaseUrl } = params;

  if (!actualTableTenant) {
    return {
      ok: false,
      status: 404,
      code: 'invalid_table_tenant',
      error: 'Table tenant scope is invalid',
    };
  }

  if (actualTableTenant === 'default') {
    const secret = env.QR_SIGNING_SECRET as string | undefined;
    if (!secret) {
      return {
        ok: false,
        status: 503,
        code: 'qr_signing_not_configured',
        error: 'QR_SIGNING_SECRET not configured',
      };
    }
    const url = await signQRUrl(qrSlug, secret, flagshipBaseUrl);
    return { ok: true, url, mode: 'flagship_signed' };
  }

  const normalizedSlug = typeof tenantSlug === 'string' ? tenantSlug.trim().toLowerCase() : '';
  if (!SAAS_SLUG_PATTERN.test(normalizedSlug)) {
    return {
      ok: false,
      status: 404,
      code: 'tenant_slug_not_found',
      error: 'Tenant storefront slug not configured for printable QR',
    };
  }

  const tableParam = resolveStorefrontTableParam(table);
  if (!tableParam) {
    return {
      ok: false,
      status: 422,
      code: 'table_code_missing',
      error: 'Table code not configured for storefront QR',
    };
  }

  const feOrigin = resolveTrustedFrontendOrigin(env);
  const url = `${feOrigin}/s/${encodeURIComponent(normalizedSlug)}?table=${encodeURIComponent(tableParam)}`;
  return { ok: true, url, mode: 'tenant_permanent' };
}
