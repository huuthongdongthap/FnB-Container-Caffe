import { z } from 'zod';
import { openapi } from '@hono/zod-openapi';
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
} from './common';

/**
 * Inventory management schemas
 */

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

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  ingredientId: z.string().uuid(),
  ingredient: ReferenceSchema.nullable().optional(),
  type: z.enum(['in', 'out', 'adjustment', 'waste', 'transfer']),
  quantity: z.number(),
  unitCost: MoneySchema.nullable(),
  referenceId: z.string().uuid().nullable(),
  referenceType: z.enum(['purchase', 'sale', 'adjustment', 'transfer', 'waste', 'production']).nullable(),
  notes: z.string().max(500).optional(),
  performedBy: z.string().uuid().nullable(),
  createdAt: DateTimeSchema,
}).openapi('StockMovement');

export const StockMovementCreateSchema = z.object({
  ingredientId: z.string().uuid(),
  type: z.enum(['in', 'out', 'adjustment', 'waste', 'transfer']),
  quantity: z.number(),
  unitCost: MoneySchema.optional(),
  referenceId: z.string().uuid().optional(),
  referenceType: z.enum(['purchase', 'sale', 'adjustment', 'transfer', 'waste', 'production']).optional(),
  notes: z.string().max(500).optional(),
}).openapi('StockMovementCreate');

export const StockMovementListResponseSchema = z.object({
  movements: z.array(StockMovementSchema),
  meta: PaginationMetaSchema,
}).openapi('StockMovementListResponse');

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

// Export types
export type IngredientTranslation = z.infer<typeof IngredientTranslationSchema>;
export type IngredientCreate = z.infer<typeof IngredientCreateSchema>;
export type IngredientUpdate = z.infer<typeof IngredientUpdateSchema>;
export type IngredientResponse = z.infer<typeof IngredientResponseSchema>;
export type IngredientListResponse = z.infer<typeof IngredientListResponseSchema>;
export type StockMovement = z.infer<typeof StockMovementSchema>;
export type StockMovementCreate = z.infer<typeof StockMovementCreateSchema>;
export type StockMovementListResponse = z.infer<typeof StockMovementListResponseSchema>;
export type Supplier = z.infer<typeof SupplierSchema>;
export type SupplierCreate = z.infer<typeof SupplierCreateSchema>;
export type SupplierUpdate = z.infer<typeof SupplierUpdateSchema>;
export type SupplierListResponse = z.infer<typeof SupplierListResponseSchema>;
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;
export type PurchaseOrderCreate = z.infer<typeof PurchaseOrderCreateSchema>;
export type PurchaseOrderUpdate = z.infer<typeof PurchaseOrderUpdateSchema>;
export type PurchaseOrderListResponse = z.infer<typeof PurchaseOrderListResponseSchema>;

// OpenAPI route definitions
export const InventoryRoutes = {
  ingredients: {
    list: {
      method: 'get',
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
      method: 'get',
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
      method: 'post',
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
      method: 'patch',
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
      method: 'delete',
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
  },
  movements: {
    list: {
      method: 'get',
      path: '/api/inventory/movements',
      summary: 'List stock movements',
      tags: ['Inventory'],
      security: [{ BearerAuth: [] }],
      request: {
        query: PaginationQuerySchema.extend({
          ingredientId: z.string().uuid().optional(),
          type: z.enum(['in', 'out', 'adjustment', 'waste', 'transfer']).optional(),
          dateFrom: z.string().date().optional(),
          dateTo: z.string().date().optional(),
        }),
      },
      responses: {
        200: { description: 'Movement list', content: { 'application/json': { schema: SuccessResponseSchema(StockMovementListResponseSchema) } } },
        400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    create: {
      method: 'post',
      path: '/api/inventory/movements',
      summary: 'Record stock movement',
      tags: ['Inventory'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: StockMovementCreateSchema } } } },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(StockMovementSchema) } } },
        400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
  suppliers: {
    list: {
      method: 'get',
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
      method: 'get',
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
      method: 'post',
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
      method: 'patch',
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
  },
  purchaseOrders: {
    list: {
      method: 'get',
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
      method: 'get',
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
      method: 'post',
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
      method: 'patch',
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
      method: 'post',
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
  },
};
