import { getTenantId } from '../../middleware/tenant';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order?: number;
  image_url?: string | null;
  display_name_vi?: string | null;
  display_name_en?: string | null;
  tenant_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function resolveCatalogTenantId(c: any): string {
  if (c.get?.('user')) {
    return getTenantId(c);
  }
  const raw = (c.req.query?.('tenant_id') || c.req.header?.('X-Tenant-ID') || c.req.header?.('x-tenant-id') || '').trim();
  if (!raw || raw === '*') return 'default';
  return raw;
}

export function matchesCatalogTenant(row: unknown, tenantId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  if (!tenantId || tenantId === '*') return true;
  const r = row as Record<string, unknown>;
  if ('tenant_id' in r && r.tenant_id !== undefined) {
    const rowTenant = r.tenant_id ? String(r.tenant_id) : 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

export function formatCategory(row: CategoryRow, locale: string = 'vi') {
  const transName = locale === 'en'
    ? (row.display_name_en || row.name)
    : (row.display_name_vi || row.name);

  return {
    ...row,
    displayOrder: row.sort_order ?? 0,
    isActive: true,
    parentId: null,
    imageUrl: row.image_url ?? null,
    translations: [
      {
        locale,
        name: transName,
        description: row.description ?? '',
      },
    ],
    children: [] as unknown[],
    location: null,
  };
}
