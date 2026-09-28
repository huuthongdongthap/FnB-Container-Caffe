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

export const createProductSchema = z.object({
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

export const updateProductSchema = createProductSchema.partial();

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
