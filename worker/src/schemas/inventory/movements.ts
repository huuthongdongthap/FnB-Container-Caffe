import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  DateTimeSchema,
  MoneySchema,
  ReferenceSchema,
} from '../common';

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

export type StockMovement = z.infer<typeof StockMovementSchema>;
export type StockMovementCreate = z.infer<typeof StockMovementCreateSchema>;
export type StockMovementListResponse = z.infer<typeof StockMovementListResponseSchema>;

export const movementRoutes = {
  list: {
    method: 'get' as const,
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
    method: 'post' as const,
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
};
