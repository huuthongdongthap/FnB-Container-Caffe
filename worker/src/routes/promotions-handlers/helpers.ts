import { getTenantId, isHQSuperAdmin, matchesTenantRow, resolvePublicTenantId } from '../../middleware/tenant';
import type { CreatePromotionInput } from './types';

export function normalizePromoPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10) {
    return '0' + digits.slice(2);
  }
  return digits;
}

export function isPlaceholderPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const norm = normalizePromoPhone(phone.trim());
  if (norm.length < 8) return true;
  if (/^0+$/.test(norm)) return true;
  return false;
}

export function resolvePromoReadTenantId(c: Parameters<typeof resolvePublicTenantId>[0]): string {
  const user = (typeof c.get === 'function' ? c.get('user') : undefined) as
    | { role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const userTenant = (user?.tenantId || user?.tenant_id || '').trim();
  const role = String(user?.role || '').toLowerCase();
  const isHq =
    isHQSuperAdmin(c as Parameters<typeof isHQSuperAdmin>[0]) ||
    isHQSuperAdmin(user) ||
    ((role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq'));
  const reqTenant = (
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
  if (isHq) {
    if (reqTenant && reqTenant !== '*' && reqTenant.toLowerCase() !== 'hq') {
      return reqTenant;
    }
    const raw = resolvePublicTenantId(c).trim() || '*';
    return raw === 'default' || raw.toLowerCase() === 'hq' ? '*' : raw;
  }
  const raw = resolvePublicTenantId(c).trim() || 'default';
  return raw === '*' || raw.toLowerCase() === 'hq' ? 'default' : raw;
}

export function resolvePromoWriteTenantId(
  c: Parameters<typeof getTenantId>[0],
  allowHQWildcard = false,
): string {
  const reqTenant = (
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
  const user = (typeof c.get === 'function' ? c.get('user') : undefined) as
    | { role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const userTenant = (user?.tenantId || user?.tenant_id || '').trim();
  const role = String(user?.role || '').toLowerCase();
  const isWildcardHQ = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
  const hqAdmin =
    isHQSuperAdmin(c as Parameters<typeof isHQSuperAdmin>[0]) ||
    isHQSuperAdmin(user) ||
    isWildcardHQ;
  const rawResolved = (hqAdmin && reqTenant ? reqTenant : getTenantId(c).trim()) || 'default';
  const raw = rawResolved.toLowerCase() === 'hq' ? '*' : rawResolved;
  if (raw === '*') {
    return allowHQWildcard && hqAdmin ? '*' : 'default';
  }
  return raw;
}

export function validatePromotionNumericAndDateBounds(
  body: Partial<CreatePromotionInput>,
  existing?: Record<string, unknown> | null,
  requirePercent = false,
): string | null {
  if (requirePercent) {
    if (typeof body.percent !== 'number' || !Number.isFinite(body.percent) || body.percent <= 0 || body.percent > 100) {
      return 'Phần trăm giảm phải từ 1-100';
    }
  } else if (body.percent !== undefined) {
    if (typeof body.percent !== 'number' || !Number.isFinite(body.percent) || body.percent <= 0 || body.percent > 100) {
      return 'Phần trăm giảm phải từ 1-100';
    }
  }

  if (body.min_order !== undefined && body.min_order !== null) {
    if (typeof body.min_order !== 'number' || !Number.isFinite(body.min_order) || body.min_order < 0) {
      return 'Giá trị đơn hàng tối thiểu phải >= 0';
    }
  }

  if (body.max_discount !== undefined && body.max_discount !== null) {
    if (typeof body.max_discount !== 'number' || !Number.isFinite(body.max_discount) || body.max_discount < 0) {
      return 'Mức giảm tối đa phải >= 0';
    }
  }

  if (body.usage_limit !== undefined && body.usage_limit !== null) {
    if (typeof body.usage_limit !== 'number' || !Number.isFinite(body.usage_limit) || body.usage_limit < 0) {
      return 'Giới hạn lượt dùng phải >= 0';
    }
  }

  const effectiveStartsAt =
    body.starts_at !== undefined
      ? body.starts_at
      : (existing?.starts_at as string | null | undefined);
  const effectiveExpiresAt =
    body.expires_at !== undefined
      ? body.expires_at
      : (existing?.expires_at as string | null | undefined);

  if (
    typeof effectiveStartsAt === 'string' &&
    effectiveStartsAt.trim() &&
    typeof effectiveExpiresAt === 'string' &&
    effectiveExpiresAt.trim()
  ) {
    const startMs = Date.parse(effectiveStartsAt.trim());
    const endMs = Date.parse(effectiveExpiresAt.trim());
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
      return 'Thời gian bắt đầu phải trước hoặc bằng thời gian hết hạn';
    }
  }

  return null;
}

export async function findPromoForTenant(
  db: import('@cloudflare/workers-types').D1Database,
  code: string,
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant !== '*') {
    let scopedQueryFailed = false;
    let scoped: Record<string, unknown> | null = null;
    try {
      scoped = await db
        .prepare(
          "SELECT * FROM promotions WHERE (id = ? OR UPPER(code) = UPPER(?)) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(code, code, normTenant)
        .first<Record<string, unknown>>();
    } catch {
      scopedQueryFailed = true;
    }
    if (!scopedQueryFailed) {
      if (scoped && matchesTenantRow(scoped, normTenant)) return scoped;
      return null;
    }
  }
  const row = await db
    .prepare('SELECT * FROM promotions WHERE code = ? OR id = ?')
    .bind(code, code)
    .first<Record<string, unknown>>()
    .catch(() =>
      db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first<Record<string, unknown>>()
    );
  if (row && matchesTenantRow(row, normTenant)) return row;
  return null;
}
