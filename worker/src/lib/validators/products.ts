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

const imageUrlSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val === null || val === undefined ? undefined : val.trim()))
  .refine(
    (val) =>
      val === undefined ||
      val === '' ||
      (val.startsWith('/') && !val.startsWith('//')) ||
      /^https?:\/\/\S+$/i.test(val),
    { message: 'URL hình ảnh không hợp lệ (chấp nhận http(s):// hoặc đường dẫn /...)' }
  );

const baseProductSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được để trống'),
  price: z.number().positive('Giá phải lớn hơn 0'),
  slug: z.string().optional(),
  description: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val === null ? undefined : val)),
  compare_at_price: z.number().nullable().optional().transform((val) => (val === null ? undefined : val)),
  category_id: z.union([z.string(), z.number().transform(String)]).optional(),
  image_url: imageUrlSchema,
  is_available: z
    .boolean()
    .or(z.number().transform((v) => v !== 0))
    .optional(),
  sort_order: z.number().int().optional()
});

function normalizeProductPayload(val: unknown): unknown {
  if (val && typeof val === 'object') {
    const raw = val as Record<string, unknown>;
    const translations = Array.isArray(raw.translations) ? (raw.translations as Array<Record<string, unknown>>) : undefined;
    const images = Array.isArray(raw.images) ? (raw.images as Array<Record<string, unknown>>) : undefined;
    const name = raw.name ?? translations?.[0]?.name;
    const price = raw.price ?? raw.basePrice;
    const category_id = raw.category_id ?? raw.categoryId;
    const rawImageUrl = raw.image_url !== undefined ? raw.image_url : (raw.imageUrl ?? images?.[0]?.url);
    const image_url = rawImageUrl === null ? undefined : rawImageUrl;
    const description = raw.description === null ? undefined : raw.description;
    const is_available = raw.is_available !== undefined
      ? raw.is_available
      : (raw.status ? raw.status !== 'inactive' : undefined);
    const next: Record<string, unknown> = { ...raw };
    if (description === undefined) delete next.description;
    else next.description = description;
    if (image_url === undefined) delete next.image_url;
    else next.image_url = image_url;
    if (name !== undefined) next.name = name;
    if (price !== undefined) next.price = price;
    if (category_id !== undefined) next.category_id = category_id;
    if (is_available !== undefined) next.is_available = is_available;
    return next;
  }
  return val;
}

export const createProductSchema = z.preprocess(normalizeProductPayload, baseProductSchema);

export const updateProductSchema = z.preprocess(normalizeProductPayload, baseProductSchema.partial());

// ══════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được để trống'),
  slug: z.string().optional(),
  sort_order: z.number().int().optional(),
  image_url: imageUrlSchema
});

export const updateCategorySchema = createCategorySchema.partial();
