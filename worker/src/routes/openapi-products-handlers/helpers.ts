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
  created_at?: string;
  updated_at?: string;
  category_name?: string | null;
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
