import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  DateTimeSchema,
  MoneySchema,
  ReferenceSchema,
} from '../common';

export const PurchaseOrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string().openapi({ example: 'PO-20260826-001' }),
  supplierId: z.string().uuid(),
  supplier: ReferenceSchema.nullable().optional(),
  locationId: z.string().uuid(),
  status: z.enum(['draft', 'ordered', 'partial', 'received', 'cancelled']).default('draft'),
  items: z.array(z.object({
    ingredientId: z.string().uuid(),
    ingredientName: z.string(),
    quantity: z.number().int().positive(),
    unitCost: MoneySchema,
    receivedQuantity: z.number().int().nonnegative().default(0),
  })),
  subtotal: MoneySchema,
  taxAmount: MoneySchema.default(0),
  totalAmount: MoneySchema,
  expectedDate: z.string().date().nullable(),
  receivedAt: DateTimeSchema.nullable(),
  notes: z.string().max(1000).optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('PurchaseOrder');

export const PurchaseOrderCreateSchema = z.object({
  supplierId: z.string().uuid(),
  locationId: z.string().uuid(),
  items: z.array(z.object({
    ingredientId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitCost: MoneySchema,
  })).min(1),
  expectedDate: z.string().date().optional(),
  notes: z.string().max(1000).optional(),
}).openapi('PurchaseOrderCreate');

export const PurchaseOrderUpdateSchema = z.object({
  status: z.enum(['draft', 'ordered', 'partial', 'received', 'cancelled']).optional(),
  expectedDate: z.string().date().optional(),
  notes: z.string().max(1000).optional(),
}).openapi('PurchaseOrderUpdate');

export const PurchaseOrderListResponseSchema = z.object({
  orders: z.array(PurchaseOrderSchema),
  meta: PaginationMetaSchema,
}).openapi('PurchaseOrderListResponse');

export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;
export type PurchaseOrderCreate = z.infer<typeof PurchaseOrderCreateSchema>;
export type PurchaseOrderUpdate = z.infer<typeof PurchaseOrderUpdateSchema>;
export type PurchaseOrderListResponse = z.infer<typeof PurchaseOrderListResponseSchema>;

export const purchaseOrderRoutes = {
  list: {
    method: 'get' as const,
    path: '/api/inventory/purchase-orders',
    summary: 'List purchase orders',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: {
      query: PaginationQuerySchema.extend({
        supplierId: z.string().uuid().optional(),
        status: z.enum(['draft', 'ordered', 'partial', 'received', 'cancelled']).optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
      }),
    },
    responses: {
      200: { description: 'PO list', content: { 'application/json': { schema: SuccessResponseSchema(PurchaseOrderListResponseSchema) } } },
    },
  },
  get: {
    method: 'get' as const,
    path: '/api/inventory/purchase-orders/{id}',
    summary: 'Get purchase order by ID',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'PO details', content: { 'application/json': { schema: SuccessResponseSchema(PurchaseOrderSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: 'post' as const,
    path: '/api/inventory/purchase-orders',
    summary: 'Create purchase order',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: PurchaseOrderCreateSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(PurchaseOrderSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: 'patch' as const,
    path: '/api/inventory/purchase-orders/{id}',
    summary: 'Update purchase order',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: PurchaseOrderUpdateSchema } } } },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(PurchaseOrderSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  receive: {
    method: 'post' as const,
    path: '/api/inventory/purchase-orders/{id}/receive',
    summary: 'Receive purchase order items',
    tags: ['Inventory'],
    security: [{ BearerAuth: [] }],
    request: {
      params: IdParamsSchema,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              items: z.array(z.object({
                ingredientId: z.string().uuid(),
                receivedQuantity: z.number().int().positive(),
              })).min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: 'Received', content: { 'application/json': { schema: SuccessResponseSchema(PurchaseOrderSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      400: { description: 'Invalid items', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
};
