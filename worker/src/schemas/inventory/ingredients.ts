import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  DateTimeSchema,
  MoneySchema,
  ReferenceSchema,
} from '../common';

export const IngredientTranslationSchema = z.object({
  locale: LocaleEnum,
  name: z.string().min(1).max(100).openapi({ example: 'Cà phê hạt' }),
  unit: z.string().min(1).max(20).openapi({ example: 'kg' }),
});

export const IngredientCreateSchema = z.object({
  sku: z.string().min(1).max(50).regex(/^[A-Z0-9-_]+$/).openapi({ example: 'COF-BEAN-001' }),
  name: z.string().min(1).max(100),
  unit: z.string().min(1).max(20),
  costPerUnit: MoneySchema,
  currentStock: z.number().default(0),
  minStock: z.number().int().nonnegative().default(10),
  maxStock: z.number().int().nonnegative().optional(),
  locationId: z.string().uuid().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  translations: z.array(IngredientTranslationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('IngredientCreate');

export const IngredientUpdateSchema = z.object({
  sku: z.string().min(1).max(50).regex(/^[A-Z0-9-_]+$/).optional(),
  name: z.string().min(1).max(100).optional(),
  unit: z.string().min(1).max(20).optional(),
  costPerUnit: MoneySchema.optional(),
  currentStock: z.number().optional(),
  minStock: z.number().int().nonnegative().optional(),
  maxStock: z.number().int().nonnegative().optional(),
  locationId: z.string().uuid().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  translations: z.array(IngredientTranslationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('IngredientUpdate');

export const IngredientResponseSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  costPerUnit: MoneySchema,
  currentStock: z.number(),
  minStock: z.number().int().nonnegative(),
  maxStock: z.number().int().nonnegative().nullable(),
  locationId: z.string().uuid().nullable(),
  location: ReferenceSchema.nullable().optional(),
  supplierId: z.string().uuid().nullable(),
  supplier: ReferenceSchema.nullable().optional(),
  translations: z.array(IngredientTranslationSchema),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Ingredient');

export const IngredientListResponseSchema = z.object({
  ingredients: z.array(IngredientResponseSchema),
  meta: PaginationMetaSchema,
}).openapi('IngredientListResponse');

export type IngredientTranslation = z.infer<typeof IngredientTranslationSchema>;
export type IngredientCreate = z.infer<typeof IngredientCreateSchema>;
export type IngredientUpdate = z.infer<typeof IngredientUpdateSchema>;
export type IngredientResponse = z.infer<typeof IngredientResponseSchema>;
export type IngredientListResponse = z.infer<typeof IngredientListResponseSchema>;

export const ingredientRoutes = {
  list: {
    method: 'get' as const,
    path: '/api/inventory/ingredients',
    summary: 'List ingredients with pagination and filtering',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: {
      query: PaginationQuerySchema.extend({
        locationId: z.string().uuid().optional(),
        lowStock: z.coerce.boolean().optional(),
        search: z.string().optional(),
      }),
    },
    responses: {
      200: { description: 'Ingredient list', content: { 'application/json': { schema: SuccessResponseSchema(IngredientListResponseSchema) } } },
      400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  get: {
    method: 'get' as const,
    path: '/api/inventory/ingredients/{id}',
    summary: 'Get ingredient by ID',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Ingredient details', content: { 'application/json': { schema: SuccessResponseSchema(IngredientResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: 'post' as const,
    path: '/api/inventory/ingredients',
    summary: 'Create new ingredient',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: IngredientCreateSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(IngredientResponseSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      409: { description: 'SKU already exists', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: 'patch' as const,
    path: '/api/inventory/ingredients/{id}',
    summary: 'Update ingredient',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: IngredientUpdateSchema } } } },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(IngredientResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  delete: {
    method: 'delete' as const,
    path: '/api/inventory/ingredients/{id}',
    summary: 'Delete ingredient',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Deleted', content: { 'application/json': { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
};
