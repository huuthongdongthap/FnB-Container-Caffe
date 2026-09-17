export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  image_url?: string | null;
  is_active?: number;
  location_id?: string | null;
  metadata?: string | null;
  created_at?: string;
  updated_at?: string;
  translation_name?: string | null;
  translation_description?: string | null;
}

export function formatCategory(row: CategoryRow, locale: string = 'vi') {
  return {
    ...row,
    translations: row.translation_name
      ? [
          {
            locale,
            name: row.translation_name,
            description: row.translation_description,
          },
        ]
      : [],
    parent_id: row.parent_id,
    children: [] as unknown[],
    location: row.location_id ? { id: row.location_id } : null,
  };
}
