export interface ProductRow {
  id: string;
  slug: string;
  category_id?: string | null;
  base_price: number;
  status?: string;
  variants?: string | null;
  modifiers?: string | null;
  images?: string | null;
  preparation_time_minutes?: number;
  calories?: number | null;
  nutrition_info?: string | null;
  tags?: string | null;
  metadata?: string | null;
  created_at?: string;
  updated_at?: string;
  translation_name?: string | null;
  translation_description?: string | null;
  translation_ingredients?: string | null;
  translation_allergens?: string | null;
  translation_story?: string | null;
}

export function formatProduct(row: ProductRow, locale: string = 'vi') {
  return {
    ...row,
    translations: row.translation_name
      ? [
          {
            locale,
            name: row.translation_name,
            description: row.translation_description,
            ingredients: row.translation_ingredients,
            allergens: row.translation_allergens ? JSON.parse(row.translation_allergens) : [],
            story: row.translation_story,
          },
        ]
      : [],
    category: row.category_id ? { id: row.category_id } : null,
    variants: row.variants ? JSON.parse(row.variants) : [],
    modifiers: row.modifiers ? JSON.parse(row.modifiers) : [],
    images: row.images ? JSON.parse(row.images) : [],
    nutritionInfo: row.nutrition_info ? JSON.parse(row.nutrition_info) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    tags: row.tags ? JSON.parse(row.tags) : [],
  };
}
