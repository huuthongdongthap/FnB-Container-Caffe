import { z } from 'zod';
import { openapi } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  SlugSchema,
  ProductStatusEnum,
  DateTimeSchema,
  MoneySchema,
  CategoryTypeEnum,
  ReferenceSchema,
} from './common';

/**
 * Product schemas
 */

// Product translation (bilingual)
export const ProductTranslationSchema = z.object({
  locale: LocaleEnum,
  name: z.string().min(1).max(150).openapi({ example: 'Cà phê đen đá' }),
  description: z.string().max(1000).optional().openapi({ example: 'Cà phê robusta rang xay truyền thống, uống đá mát lạnh' }),
  ingredients: z.string().max(2000).optional().openapi({ example: 'Cà phê rang xay, đá, đường (tùy chọn)' }),
  allergens: z.array(z.string()).optional().openapi({ example: ['caffeine'] }),
  story: z.string().max(2000).optional().openapi({ example: 'Hạt cà phê từ vườn 30 năm tuổi tại Sa Đéc...' }),
});

export const ProductVariantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(50).openapi({ example: 'Size L' }),
  priceAdjustment: z.number().int().openapi({ example: 5000, description: 'Price adjustment in VND (can be negative)' }),
  isDefault: z.boolean().default(false),
  displayOrder: z.number().int().nonnegative().default(0),
  sku: z.string().max(50).optional(),
  stock: z.number().int().nonnegative().optional(),
}).openapi('ProductVariant');

export const ProductModifierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(50).openapi({ example: 'Đường' }),
  type: z.enum(['single', 'multi']).openapi({ example: 'single' }),
  required: z.boolean().default(false),
  options: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(50),
    priceAdjustment: z.number().int().default(0),
    isDefault: z.boolean().default(false),
    stock: z.number().int().nonnegative().optional(),
  })).min(1),
}).openapi('ProductModifier');

export const ProductCreateSchema = z.object({
  slug: SlugSchema,
  categoryId: z.string().uuid(),
  translations: z.array(ProductTranslationSchema).min(1),
  basePrice: MoneySchema,
  status: ProductStatusEnum.default('active'),
  variants: z.array(ProductVariantSchema).optional(),
  modifiers: z.array(ProductModifierSchema).optional(),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    isPrimary: z.boolean().default(false),
    displayOrder: z.number().int().nonnegative().default(0),
  })).optional(),
  preparationTimeMinutes: z.number().int().positive().default(5),
  calories: z.number().int().nonnegative().optional(),
  nutritionInfo: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('ProductCreate');

export const ProductUpdateSchema = z.object({
  slug: SlugSchema.optional(),
  categoryId: z.string().uuid().optional(),
  translations: z.array(ProductTranslationSchema).min(1).optional(),
  basePrice: MoneySchema.optional(),
  status: ProductStatusEnum.optional(),
  variants: z.array(ProductVariantSchema).optional(),
  modifiers: z.array(ProductModifierSchema).optional(),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    isPrimary: z.boolean().default(false),
    displayOrder: z.number().int().nonnegative().default(0),
  })).optional(),
  preparationTimeMinutes: z.number().int().positive().optional(),
  calories: z.number().int().nonnegative().optional(),
  nutritionInfo: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('ProductUpdate');

export const ProductResponseSchema = z.object({
  id: z.string().uuid(),
  slug: SlugSchema,
  categoryId: z.string().uuid(),
  category: ReferenceSchema.optional(),
  translations: z.array(ProductTranslationSchema),
  basePrice: MoneySchema,
  status: ProductStatusEnum,
  variants: z.array(ProductVariantSchema),
  modifiers: z.array(ProductModifierSchema),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().nullable(),
    isPrimary: z.boolean(),
    displayOrder: z.number().int().nonnegative(),
  })),
  preparationTimeMinutes: z.number().int().positive(),
  calories: z.number().int().nonnegative().nullable(),
  nutritionInfo: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Product');

export const ProductListResponseSchema = z.object({
  products: z.array(ProductResponseSchema),
  meta: PaginationMetaSchema,
}).openapi('ProductListResponse');

// Export types
export type ProductTranslation = z.infer<typeof ProductTranslationSchema>;
export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type ProductModifier = z.infer<typeof ProductModifierSchema>;
export type ProductCreate = z.infer<typeof ProductCreateSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
export type ProductResponse = z.infer<typeof ProductResponseSchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

// OpenAPI route definitions
export const ProductRoutes = {
  list: {
    method: 'get',
    path: '/api/products',
    summary: 'List products with pagination, filtering, and search',
    tags: ['Products'],
    request: {
      query: PaginationQuerySchema.extend({
        categoryId: z.string().uuid().optional(),
        status: ProductStatusEnum.optional(),
        locale: LocaleEnum.optional(),
        minPrice: z.coerce.number().int().nonnegative().optional(),
        maxPrice: z.coerce.number().int().nonnegative().optional(),
        tags: z.string().optional(),
      }),
    },
    responses: {
      200: { description: 'Product list', content: { 'application/json': { schema: SuccessResponseSchema(ProductListResponseSchema) } } },
      400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  get: {
    method: 'get',
    path: '/api/products/{id}',
    summary: 'Get product by ID',
    tags: ['Products'],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Product details', content: { 'application/json': { schema: SuccessResponseSchema(ProductResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  getBySlug: {
    method: 'get',
    path: '/api/products/slug/{slug}',
    summary: 'Get product by slug',
    tags: ['Products'],
    request: { params: z.object({ slug: SlugSchema }) },
    responses: {
      200: { description: 'Product details', content: { 'application/json': { schema: SuccessResponseSchema(ProductResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: 'post',
    path: '/api/products',
    summary: 'Create new product',
    tags: ['Products'],
    request: { body: { content: { 'application/json': { schema: ProductCreateSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(ProductResponseSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      409: { description: 'Slug conflict', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: 'patch',
    path: '/api/products/{id}',
    summary: 'Update product',
    tags: ['Products'],
    request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: ProductUpdateSchema } } } },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(ProductResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  delete: {
    method: 'delete',
    path: '/api/products/{id}',
    summary: 'Delete product (soft delete)',
    tags: ['Products'],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Deleted', content: { 'application/json': { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
};
