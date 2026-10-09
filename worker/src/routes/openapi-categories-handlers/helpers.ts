export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order?: number;
  image_url?: string | null;
  display_name_vi?: string | null;
  display_name_en?: string | null;
  created_at?: string;
  updated_at?: string;
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
