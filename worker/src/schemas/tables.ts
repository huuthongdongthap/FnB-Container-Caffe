import { z } from "zod";
import { openapi } from "@hono/zod-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  DateTimeSchema,
  TableStatusEnum,
  ReferenceSchema,
  SlugSchema,
} from "./common";

/**
 * Table schemas
 */

export const TableTranslationSchema = z.object({
  locale: LocaleEnum,
  name: z.string().min(1).max(50).openapi({ example: "Bàn 1" }),
  description: z.string().max(200).optional().openapi({ example: "Bàn gần cửa sổ, view đẹp" }),
});

export const TableZoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  slug: SlugSchema,
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  displayOrder: z.number().int().nonnegative(),
}).openapi("TableZone");

export const TableCreateSchema = z.object({
  zoneId: z.string().uuid(),
  code: z.string().min(1).max(20).openapi({ example: "A-01" }),
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().positive().default(4),
  status: TableStatusEnum.default("available"),
  x: z.number().int().default(0),
  y: z.number().int().default(0),
  width: z.number().int().positive().default(80),
  height: z.number().int().positive().default(80),
  rotation: z.number().int().min(0).max(360).default(0),
  translations: z.array(TableTranslationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi("TableCreate");

export const TableUpdateSchema = z.object({
  zoneId: z.string().uuid().optional(),
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().positive().optional(),
  status: TableStatusEnum.optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  rotation: z.number().int().min(0).max(360).optional(),
  translations: z.array(TableTranslationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi("TableUpdate");

export const TableResponseSchema = z.object({
  id: z.string().uuid(),
  zoneId: z.string().uuid(),
  zone: TableZoneSchema.nullable().optional(),
  code: z.string(),
  name: z.string().nullable(),
  capacity: z.number().int().positive(),
  status: TableStatusEnum,
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  rotation: z.number().int(),
  translations: z.array(TableTranslationSchema),
  currentSessionId: z.string().uuid().nullable().optional(),
  currentOrderId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Table");

export const TableListResponseSchema = z.object({
  tables: z.array(TableResponseSchema),
  meta: PaginationMetaSchema,
}).openapi("TableListResponse");

export const TableZoneCreateSchema = z.object({
  name: z.string().min(1).max(50),
  slug: SlugSchema,
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  displayOrder: z.number().int().nonnegative().default(0),
}).openapi("TableZoneCreate");

export const TableZoneUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: SlugSchema.optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  displayOrder: z.number().int().nonnegative().optional(),
}).openapi("TableZoneUpdate");

export const TableZoneResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: SlugSchema,
  description: z.string().nullable(),
  color: z.string().nullable(),
  displayOrder: z.number().int().nonnegative(),
  tableCount: z.number().int().nonnegative(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("TableZone");

// Export types
export type TableTranslation = z.infer<typeof TableTranslationSchema>;
export type TableZone = z.infer<typeof TableZoneSchema>;
export type TableCreate = z.infer<typeof TableCreateSchema>;
export type TableUpdate = z.infer<typeof TableUpdateSchema>;
export type TableResponse = z.infer<typeof TableResponseSchema>;
export type TableListResponse = z.infer<typeof TableListResponseSchema>;
export type TableZoneCreate = z.infer<typeof TableZoneCreateSchema>;
export type TableZoneUpdate = z.infer<typeof TableZoneUpdateSchema>;
export type TableZoneResponse = z.infer<typeof TableZoneResponseSchema>;

// OpenAPI route definitions
export const TableRoutes = {
  list: {
    method: "get",
    path: "/api/tables",
    summary: "List tables with pagination and filtering",
    tags: ["Tables"],
    request: {
      query: PaginationQuerySchema.extend({
        zoneId: z.string().uuid().optional(),
        status: TableStatusEnum.optional(),
        capacity: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: {
      200: { description: "Table list", content: { "application/json": { schema: SuccessResponseSchema(TableListResponseSchema) } } },
      400: { description: "Invalid query", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  get: {
    method: "get",
    path: "/api/tables/{id}",
    summary: "Get table by ID",
    tags: ["Tables"],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: "Table details", content: { "application/json": { schema: SuccessResponseSchema(TableResponseSchema) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: "post",
    path: "/api/tables",
    summary: "Create new table",
    tags: ["Tables"],
    request: { body: { content: { "application/json": { schema: TableCreateSchema } } } },
    responses: {
      201: { description: "Created", content: { "application/json": { schema: SuccessResponseSchema(TableResponseSchema) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: "patch",
    path: "/api/tables/{id}",
    summary: "Update table",
    tags: ["Tables"],
    request: { params: IdParamsSchema, body: { content: { "application/json": { schema: TableUpdateSchema } } } },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: SuccessResponseSchema(TableResponseSchema) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  delete: {
    method: "delete",
    path: "/api/tables/{id}",
    summary: "Delete table",
    tags: ["Tables"],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  zones: {
    list: {
      method: "get",
      path: "/api/table-zones",
      summary: "List table zones",
      tags: ["Tables"],
      responses: {
        200: { description: "Zone list", content: { "application/json": { schema: SuccessResponseSchema(z.array(TableZoneResponseSchema)) } } },
      },
    },
    get: {
      method: "get",
      path: "/api/table-zones/{id}",
      summary: "Get table zone by ID",
      tags: ["Tables"],
      request: { params: IdParamsSchema },
      responses: {
        200: { description: "Zone details", content: { "application/json": { schema: SuccessResponseSchema(TableZoneResponseSchema) } } },
        404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
      },
    },
    create: {
      method: "post",
      path: "/api/table-zones",
      summary: "Create table zone",
      tags: ["Tables"],
      request: { body: { content: { "application/json": { schema: TableZoneCreateSchema } } } },
      responses: {
        201: { description: "Created", content: { "application/json": { schema: SuccessResponseSchema(TableZoneResponseSchema) } } },
      },
    },
    update: {
      method: "patch",
      path: "/api/table-zones/{id}",
      summary: "Update table zone",
      tags: ["Tables"],
      request: { params: IdParamsSchema, body: { content: { "application/json": { schema: TableZoneUpdateSchema } } } },
      responses: {
        200: { description: "Updated", content: { "application/json": { schema: SuccessResponseSchema(TableZoneResponseSchema) } } },
      },
    },
    delete: {
      method: "delete",
      path: "/api/table-zones/{id}",
      summary: "Delete table zone",
      tags: ["Tables"],
      request: { params: IdParamsSchema },
      responses: {
        200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      },
    },
  },
  bulkStatus: {
    method: "post",
    path: "/api/tables/bulk-status",
    summary: "Bulk update table status",
    tags: ["Tables"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              tableIds: z.array(z.string().uuid()).min(1),
              status: TableStatusEnum,
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
};

// Export TableZoneRoutes as a separate object for direct import
export const TableZoneRoutes = TableRoutes.zones;