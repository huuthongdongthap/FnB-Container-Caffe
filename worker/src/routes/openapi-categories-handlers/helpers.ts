import { resolvePublicTenantId } from '../../middleware/tenant';
import { matchesTenantRow } from '../../lib/db';

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
  return resolvePublicTenantId(c);
}

export function matchesCatalogTenant(row: unknown, tenantId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const clean = tenantId ? tenantId.trim() : '';
  if (!clean || clean === '*') return true;
  return matchesTenantRow(row as Record<string, unknown>, clean);
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
