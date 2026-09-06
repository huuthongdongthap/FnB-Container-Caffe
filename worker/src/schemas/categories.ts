import { z } from "zod";
import { openapi } from "@hono/zod-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  SlugSchema,
  CategoryTypeEnum,
  DateTimeSchema,
  MoneySchema,
  ReferenceSchema,
} from "./common";

/**
 * Category schemas
 */

// Category translation (bilingual)
export const CategoryTranslationSchema = z.object({
  locale: LocaleEnum,
  name: z.string().min(1).max(100).openapi({ example: "Cà phê" }),
  description: z.string().max(500).optional().openapi({ example: "Các loại cà phê truyền thống Sa Đéc" }),
});

export const CategoryCreateSchema = z.object({
  slug: SlugSchema,
  type: CategoryTypeEnum,
  parentId: z.string().uuid().nullable().optional(),
  translations: z.array(CategoryTranslationSchema).min(1).openapi({
    description: "At least one translation required (vi or en)",
  }),
  displayOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url().optional().openapi({ example: "https://cdn.aura.cafe/categories/ca-phe.webp" }),
  metadata: z.record(z.unknown()).optional(),
}).openapi("CategoryCreate");

export const CategoryUpdateSchema = z.object({
  slug: SlugSchema.optional(),
  type: CategoryTypeEnum.optional(),
  parentId: z.string().uuid().nullable().optional(),
  translations: z.array(CategoryTranslationSchema).min(1).optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi("CategoryUpdate");

export const CategoryResponseSchema = z.object({
  id: z.string().uuid(),
  slug: SlugSchema,
  type: CategoryTypeEnum,
  parentId: z.string().uuid().nullable(),
  translations: z.array(CategoryTranslationSchema),
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  imageUrl: z.string().url().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  children: z.array(z.lazy(() => CategoryResponseSchema)).optional(),
}).openapi("Category");

export const CategoryListResponseSchema = z.object({
  categories: z.array(CategoryResponseSchema),
  meta: PaginationMetaSchema,
}).openapi("CategoryListResponse");

export const CategoryTreeResponseSchema = z.object({
  categories: z.array(CategoryResponseSchema),
}).openapi("CategoryTreeResponse");

// Export types
export type CategoryTranslation = z.infer<typeof CategoryTranslationSchema>;
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;
export type CategoryTreeResponse = z.infer<typeof CategoryTreeResponseSchema>;

// OpenAPI route definitions
export const CategoryRoutes = {
  list: {
    method: "get",
    path: "/api/categories",
    summary: "List categories with pagination and filtering",
    tags: ["Categories"],
    request: {
      query: PaginationQuerySchema.extend({
        type: CategoryTypeEnum.optional(),
        parentId: z.string().uuid().optional(),
        isActive: z.coerce.boolean().optional(),
        locale: LocaleEnum.optional(),
      }),
    },
    responses: {
      200: { description: "Category list", content: { "application/json": { schema: SuccessResponseSchema(CategoryListResponseSchema) } } },
      400: { description: "Invalid query", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  tree: {
    method: "get",
    path: "/api/categories/tree",
    summary: "Get full category tree (nested)",
    tags: ["Categories"],
    request: {
      query: z.object({
        locale: LocaleEnum.optional(),
        type: CategoryTypeEnum.optional(),
        isActive: z.coerce.boolean().optional(),
      }),
    },
    responses: {
      200: { description: "Category tree", content: { "application/json": { schema: SuccessResponseSchema(CategoryTreeResponseSchema) } } },
    },
  },
  get: {
    method: "get",
    path: "/api/categories/{id}",
    summary: "Get category by ID",
    tags: ["Categories"],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: "Category details", content: { "application/json": { schema: SuccessResponseSchema(CategoryResponseSchema) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: "post",
    path: "/api/categories",
    summary: "Create new category",
    tags: ["Categories"],
    request: { body: { content: { "application/json": { schema: CategoryCreateSchema } } } },
    responses: {
      201: { description: "Created", content: { "application/json": { schema: SuccessResponseSchema(CategoryResponseSchema) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Slug conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: "patch",
    path: "/api/categories/{id}",
    summary: "Update category",
    tags: ["Categories"],
    request: { params: IdParamsSchema, body: { content: { "application/json": { schema: CategoryUpdateSchema } } } },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: SuccessResponseSchema(CategoryResponseSchema) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  delete: {
    method: "delete",
    path: "/api/categories/{id}",
    summary: "Delete category (soft delete if has children/products)",
    tags: ["Categories"],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Has dependent records", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  reorder: {
    method: "post",
    path: "/api/categories/reorder",
    summary: "Reorder categories",
    tags: ["Categories"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number().int().nonnegative() })),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Reordered", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      400: { description: "Invalid input", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
};