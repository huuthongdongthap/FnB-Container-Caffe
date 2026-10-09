/**
 * Products and categories validators
 */

import { z } from 'zod';

// ── Menu query ──
export const menuQuerySchema = z.object({
  category: z.string().optional(),
  available: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional()
});

// ══════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════

const baseProductSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được để trống'),
  price: z.number().positive('Giá phải lớn hơn 0'),
  slug: z.string().optional(),
  description: z.string().optional(),
  compare_at_price: z.number().optional(),
  category_id: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  is_available: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

export const createProductSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object') {
    const name = val.name ?? val.translations?.[0]?.name;
    const price = val.price ?? val.basePrice;
    const category_id = val.category_id ?? val.categoryId;
    const image_url = val.image_url ?? val.imageUrl ?? val.images?.[0]?.url;
    const is_available = val.is_available !== undefined
      ? val.is_available
      : (val.status ? val.status !== 'inactive' : undefined);
    return {
      ...val,
      ...(name !== undefined ? { name } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(category_id !== undefined ? { category_id } : {}),
      ...(image_url !== undefined ? { image_url } : {}),
      ...(is_available !== undefined ? { is_available } : {}),
    };
  }
  return val;
}, baseProductSchema);

export const updateProductSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object') {
    const name = val.name ?? val.translations?.[0]?.name;
    const price = val.price ?? val.basePrice;
    const category_id = val.category_id ?? val.categoryId;
    const image_url = val.image_url ?? val.imageUrl ?? val.images?.[0]?.url;
    const is_available = val.is_available !== undefined
      ? val.is_available
      : (val.status ? val.status !== 'inactive' : undefined);
    return {
      ...val,
      ...(name !== undefined ? { name } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(category_id !== undefined ? { category_id } : {}),
      ...(image_url !== undefined ? { image_url } : {}),
      ...(is_available !== undefined ? { is_available } : {}),
    };
  }
  return val;
}, baseProductSchema.partial());

// ══════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được để trống'),
  slug: z.string().optional(),
  sort_order: z.number().int().optional(),
  image_url: z.string().url().optional().or(z.literal(''))
});

export const updateCategorySchema = createCategorySchema.partial();
