import { getTenantId } from '../../middleware/tenant';

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
