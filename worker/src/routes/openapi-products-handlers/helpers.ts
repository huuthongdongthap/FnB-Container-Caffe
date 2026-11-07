import { isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';
import { matchesTenantRow } from '../../lib/db';

export const FORBIDDEN_TENANT_SENTINEL = '__FORBIDDEN_TENANT__';

export interface ProductRow {
  id: string;
  category_id?: string | null;
  name: string;
  slug?: string | null;
  price: number;
  compare_at_price?: number | null;
  description?: string | null;
  image_url?: string | null;
  tags?: string | null;
  badge?: string | null;
  is_available?: number;
  sort_order?: number;
  tenant_id?: string | null;
  created_at?: string;
  updated_at?: string;
  category_name?: string | null;
}

export function resolveCatalogTenantId(c: any): string {
  const candidateOverrides = [
    c?.req?.query?.('tenant_id'),
    c?.req?.query?.('tenantId'),
    c?.req?.query?.('store_id'),
    c?.req?.query?.('storeId'),
    c?.req?.header?.('X-Tenant-ID'),
    c?.req?.header?.('x-tenant-id'),
    c?.req?.header?.('X-Store-ID'),
    c?.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return FORBIDDEN_TENANT_SENTINEL;
  }
  const requestedOverride = candidateOverrides[0] || '';
  const explicitCtx = (typeof c?.get === 'function' ? (c.get('tenantId') as string | undefined) : undefined)?.trim() || '';
  const user = typeof c?.get === 'function'
    ? (c.get('user') as { id?: string; role?: string; tenant_id?: string; tenantId?: string } | undefined)
    : undefined;

  if (isHQSuperAdmin(c)) {
    const cleanReq = requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq' ? requestedOverride : '';
    const cleanCtx = explicitCtx && explicitCtx !== '*' && explicitCtx.toLowerCase() !== 'hq' ? explicitCtx : '';
    const userTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
    const cleanUser = userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq' ? userTenant : '';
    const raw =
      requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq'
        ? '*'
        : cleanReq || cleanCtx || cleanUser || '*';
    return !raw || raw.toLowerCase() === 'hq' || raw === '*' ? '*' : raw;
  }

  if (user) {
    const userTenant = String(user.tenant_id ?? user.tenantId ?? '').trim() || 'default';
    if (userTenant === '*' || userTenant.toLowerCase() === 'hq') {
      return FORBIDDEN_TENANT_SENTINEL;
    }
    if (
      requestedOverride &&
      (requestedOverride === '*' ||
        requestedOverride.toLowerCase() === 'hq' ||
        requestedOverride !== userTenant)
    ) {
      return FORBIDDEN_TENANT_SENTINEL;
    }
    if (
      explicitCtx &&
      (explicitCtx === '*' ||
        explicitCtx.toLowerCase() === 'hq' ||
        explicitCtx !== userTenant)
    ) {
      return FORBIDDEN_TENANT_SENTINEL;
    }
    return userTenant;
  }

  if (
    (requestedOverride && (requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq')) ||
    (explicitCtx && (explicitCtx === '*' || explicitCtx.toLowerCase() === 'hq'))
  ) {
    return FORBIDDEN_TENANT_SENTINEL;
  }

  if (explicitCtx) return explicitCtx;
  if (requestedOverride) return requestedOverride;
  const raw = resolvePublicTenantId(c);
  return raw && raw.trim().toLowerCase() === 'hq' ? FORBIDDEN_TENANT_SENTINEL : raw;
}

export function matchesCatalogTenant(row: unknown, tenantId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const clean = tenantId ? tenantId.trim() : '';
  if (clean === FORBIDDEN_TENANT_SENTINEL || clean === '403') return false;
  if (clean === '*' || clean.toLowerCase() === 'hq') return true;
  const effectiveTenant = clean || 'default';
  const r = row as Record<string, unknown>;
  if (!('tenant_id' in r) || r.tenant_id === undefined) {
    return effectiveTenant === 'default';
  }
  return matchesTenantRow(r, effectiveTenant);
}

export function formatProduct(row: ProductRow, locale: string = 'vi') {
  let parsedTags: string[] = [];
  try {
    parsedTags = row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [];
  } catch {
    parsedTags = [];
  }

  return {
    ...row,
    slug: row.slug || row.id,
    price: row.price,
    status: row.is_available === 0 ? 'inactive' : 'active',
    translations: [
      {
        locale,
        name: row.name,
        description: row.description || '',
        ingredients: '',
        allergens: [] as string[],
        story: '',
      },
    ],
    category: row.category_id ? { id: row.category_id, name: row.category_name || '' } : null,
    variants: [] as unknown[],
    modifiers: [] as unknown[],
    images: row.image_url ? [{ url: row.image_url, isPrimary: true, displayOrder: 0 }] : [],
    metadata: null,
    tags: parsedTags,
  };
}
