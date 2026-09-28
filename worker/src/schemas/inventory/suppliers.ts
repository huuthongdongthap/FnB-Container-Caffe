import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  DateTimeSchema,
  ReferenceSchema,
} from '../common';

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  contactName: z.string().max(100).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().max(20).nullable(),
  address: z.string().max(500).nullable(),
  taxId: z.string().max(50).nullable(),
  paymentTerms: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Supplier');

export const SupplierCreateSchema = z.object({
  name: z.string().min(1).max(100),
  contactName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  taxId: z.string().max(50).optional(),
  paymentTerms: z.number().int().nonnegative().default(0),
  notes: z.string().max(1000).optional(),
}).openapi('SupplierCreate');

export const SupplierUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contactName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  taxId: z.string().max(50).optional(),
  paymentTerms: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
}).openapi('SupplierUpdate');

export const SupplierListResponseSchema = z.object({
  suppliers: z.array(SupplierSchema),
  meta: PaginationMetaSchema,
}).openapi('SupplierListResponse');

export type Supplier = z.infer<typeof SupplierSchema>;
export type SupplierCreate = z.infer<typeof SupplierCreateSchema>;
export type SupplierUpdate = z.infer<typeof SupplierUpdateSchema>;
export type SupplierListResponse = z.infer<typeof SupplierListResponseSchema>;

export const supplierRoutes = {
  list: {
    method: 'get' as const,
    path: '/api/inventory/suppliers',
    summary: 'List suppliers',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { query: PaginationQuerySchema.extend({ isActive: z.coerce.boolean().optional() }) },
    responses: {
      200: { description: 'Supplier list', content: { 'application/json': { schema: SuccessResponseSchema(SupplierListResponseSchema) } } },
    },
  },
  get: {
    method: 'get' as const,
    path: '/api/inventory/suppliers/{id}',
    summary: 'Get supplier by ID',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Supplier details', content: { 'application/json': { schema: SuccessResponseSchema(SupplierSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: 'post' as const,
    path: '/api/inventory/suppliers',
    summary: 'Create new supplier',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: SupplierCreateSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(SupplierSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: 'patch' as const,
    path: '/api/inventory/suppliers/{id}',
    summary: 'Update supplier',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: SupplierUpdateSchema } } } },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(SupplierSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
};
