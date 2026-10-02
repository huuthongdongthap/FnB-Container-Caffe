import { z, createRoute } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  DateTimeSchema,
  MoneySchema,
  OrderStatusEnum,
  PaymentStatusEnum,
  PaymentMethodEnum,
  ReferenceSchema,
} from './common';

/**
 * Order schemas
 */

/**
 * Line item snapshot, mirroring `EvaluatedOrderItem` from the order snapshot policy.
 * Every money field here is server-evaluated at order creation time; client-supplied
 * prices are never echoed back.
 */
export const OrderItemSchema = z.object({
  id: z.string().uuid().optional(),
  menuItemId: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: MoneySchema,
  subtotalCents: MoneySchema,
  modifiers: z.array(z.object({
    modifierId: z.string().uuid(),
    modifierName: z.string(),
    optionId: z.string().uuid(),
    optionName: z.string(),
    priceAdjustment: z.number().int(),
  })).optional(),
  notes: z.string().max(500).nullable().optional(),
  status: OrderStatusEnum.default('pending'),
}).openapi('OrderItem');

export const OrderPaymentSchema = z.object({
  id: z.string().uuid(),
  amount: MoneySchema,
  method: PaymentMethodEnum,
  status: PaymentStatusEnum,
  transactionId: z.string().optional(),
  payosOrderCode: z.number().optional(),
  paidAt: DateTimeSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).openapi('OrderPayment');

export const OrderCustomerSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  loyaltyTier: z.string().optional(),
  loyaltyPointsEarned: z.number().int().nonnegative().default(0),
  locale: LocaleEnum.default('vi'),
}).openapi('OrderCustomer');

/**
 * Sales channel the order was priced against. Mirrors `Channel` from
 * `@aura/domain-catalog` pricing policy.
 */
export const OrderChannelEnum = z.enum(['dine_in', 'takeaway', 'delivery']).openapi({
  example: 'dine_in',
  description: 'Sales channel used for server-side price evaluation',
});

/**
 * Client-supplied line item — intent only. Prices are intentionally absent:
 * the server evaluates the canonical price per channel, modifier and active
 * happy-hour window, then snapshots the result into the order.
 */
export const OrderItemInputSchema = z.object({
  menuItemId: z.string().min(1).openapi({ example: 'prod_cafe_den' }),
  quantity: z.number().int().positive().openapi({ example: 2 }),
  modifiers: z.array(z.string()).optional().openapi({ description: 'Selected modifier choice IDs' }),
  notes: z.string().max(500).optional(),
}).openapi('OrderItemInput');

export const OrderCreateSchema = z.object({
  tableId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  customer: OrderCustomerSchema.optional(),
  items: z.array(OrderItemInputSchema).min(1),
  channel: OrderChannelEnum.default('dine_in'),
  notes: z.string().max(1000).optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  idempotencyKey: z.string().uuid().optional(),
  source: z.enum(['pos', 'mobile', 'kiosk', 'admin', 'api']).default('pos'),
}).openapi('OrderCreate');

export const OrderUpdateSchema = z.object({
  status: OrderStatusEnum.optional(),
  notes: z.string().max(1000).optional(),
  customer: OrderCustomerSchema.partial().optional(),
}).openapi('OrderUpdate');

export const OrderResponseSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string().openapi({ example: 'ORD-20260826-001' }),
  tableId: z.string().uuid().nullable(),
  table: ReferenceSchema.nullable().optional(),
  locationId: z.string().uuid(),
  customer: OrderCustomerSchema,
  items: z.array(OrderItemSchema),
  channel: OrderChannelEnum.default('dine_in'),
  happyHourApplied: z.boolean().default(false).openapi({
    description: 'True when at least one line item was priced inside an active happy-hour window',
  }),
  subtotal: MoneySchema,
  discountAmount: MoneySchema.default(0),
  taxAmount: MoneySchema.default(0),
  totalAmount: MoneySchema,
  status: OrderStatusEnum,
  paymentStatus: PaymentStatusEnum,
  payments: z.array(OrderPaymentSchema),
  notes: z.string().nullable(),
  source: z.string(),
  servedAt: DateTimeSchema.nullable(),
  completedAt: DateTimeSchema.nullable(),
  cancelledAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Order');

/**
 * Customer-safe order line item. Positive projection: only fields a guest is
 * allowed to see are declared, so internal evaluation detail (channel deltas,
 * margin inputs, procurement references) can never leak through a stray spread.
 */
export const CustomerOrderItemSchema = z.object({
  name: z.string().openapi({ example: 'Cà phê đen đá' }),
  quantity: z.number().int().positive().openapi({ example: 2 }),
  unitPriceCents: MoneySchema.openapi({ example: 25000 }),
  subtotalCents: MoneySchema.openapi({ example: 50000 }),
  modifiers: z.array(z.object({
    name: z.string(),
    priceAdjustment: z.number().int(),
  })).optional(),
  notes: z.string().nullable().optional(),
  status: OrderStatusEnum,
}).openapi('CustomerOrderItem');

/**
 * Customer-safe order projection used by guest-facing surfaces. Deliberately
 * omits staff/audit fields (source, payments, actor identity) and exposes the
 * server-evaluated totals only — never a client-supplied price.
 */
export const CustomerOrderResponseSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string().openapi({ example: 'ORD-20260826-001' }),
  table: ReferenceSchema.nullable().optional(),
  items: z.array(CustomerOrderItemSchema),
  channel: OrderChannelEnum.default('dine_in'),
  subtotal: MoneySchema,
  discountAmount: MoneySchema.default(0),
  taxAmount: MoneySchema.default(0),
  totalAmount: MoneySchema,
  status: OrderStatusEnum,
  paymentStatus: PaymentStatusEnum,
  notes: z.string().nullable().optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('CustomerOrder');

/**
 * Order IDs are generated by `generateId('ORD_')`, not UUIDs — validating them
 * as UUIDs would reject every real order at the router boundary.
 */
export const OrderIdParamsSchema = z.object({
  id: z.string().min(1).openapi({ example: 'ORD_a1b2c3d4e5f6' }),
});

/**
 * GET /api/orders/:id returns one of two shapes depending on the caller's
 * scope: staff get the full row, guests get the projection. Both are documented
 * here so the contract reflects what the handler can actually emit.
 */
export const OrderOrCustomerProjectionSchema = z.union([
  OrderResponseSchema,
  CustomerOrderResponseSchema,
]).openapi('OrderOrCustomerProjection');

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderResponseSchema),
  meta: PaginationMetaSchema,
}).openapi('OrderListResponse');

export const OrderSummarySchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  totalRevenue: MoneySchema,
  averageOrderValue: MoneySchema,
  ordersByStatus: z.record(OrderStatusEnum, z.number().int().nonnegative()),
  ordersByPaymentMethod: z.record(PaymentMethodEnum, z.number().int().nonnegative()),
}).openapi('OrderSummary');

// Export types
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;
export type OrderPayment = z.infer<typeof OrderPaymentSchema>;
export type OrderCustomer = z.infer<typeof OrderCustomerSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;
export type OrderChannel = z.infer<typeof OrderChannelEnum>;
export type OrderResponse = z.infer<typeof OrderResponseSchema>;
export type CustomerOrderItem = z.infer<typeof CustomerOrderItemSchema>;
export type CustomerOrderResponse = z.infer<typeof CustomerOrderResponseSchema>;
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

// OpenAPI route definitions
export const OrderRoutes = {
  list: createRoute({
    method: 'get',
    path: '/api/orders',
    summary: 'List orders with pagination and filtering',
    tags: ['Orders'],
    request: {
      query: PaginationQuerySchema.extend({
        tableId: z.string().uuid().optional(),
        locationId: z.string().uuid().optional(),
        status: OrderStatusEnum.optional(),
        paymentStatus: PaymentStatusEnum.optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
        customerId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: { description: 'Order list', content: { 'application/json': { schema: SuccessResponseSchema(OrderListResponseSchema) } } },
      400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  }),
  get: createRoute({
    method: 'get',
    path: '/api/orders/{id}',
    summary: 'Get order by ID',
    description: 'Returns the full row for staff roles and the customer-safe projection for guests. Guest and unauthenticated callers whose token does not own the row receive 404 — the existence of a foreign order is never disclosed.',
    tags: ['Orders'],
    request: { params: OrderIdParamsSchema },
    responses: {
      200: {
        description: 'Order details (server-scoped: staff = full row, guest = customer projection)',
        content: {
          'application/json': {
            schema: SuccessResponseSchema(OrderOrCustomerProjectionSchema),
          },
        },
      },
      404: { description: 'Not found, or not owned by the calling customer', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  }),
  create: createRoute({
    method: 'post',
    path: '/api/orders',
    summary: 'Create new order',
    tags: ['Orders'],
    request: { body: { content: { 'application/json': { schema: OrderCreateSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(OrderResponseSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  }),
  update: createRoute({
    method: 'patch',
    path: '/api/orders/{id}',
    summary: 'Update order (status, notes, customer)',
    description: 'Applies updates to an existing order. Status transitions are dual-gated: checked first against the lifecycle state machine (400 if illegal), then against the calling actor role (403 if unauthorized).',
    tags: ['Orders'],
    request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: OrderUpdateSchema } } } },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(OrderResponseSchema) } } },
      400: { description: 'Validation error or invalid status transition', content: { 'application/json': { schema: ErrorResponseSchema } } },
      403: { description: 'Role unauthorized for this transition', content: { 'application/json': { schema: ErrorResponseSchema } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  }),
  cancel: createRoute({
    method: 'post',
    path: '/api/orders/{id}/cancel',
    summary: 'Cancel order',
    tags: ['Orders'],
    request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: z.object({ reason: z.string().max(500).optional() }) } } } },
    responses: {
      200: { description: 'Cancelled', content: { 'application/json': { schema: SuccessResponseSchema(OrderResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      409: { description: 'Cannot cancel (already served/completed)', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  }),
  summary: createRoute({
    method: 'get',
    path: '/api/orders/summary',
    summary: 'Get order summary statistics',
    tags: ['Orders'],
    request: {
      query: z.object({
        locationId: z.string().uuid().optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
      }),
    },
    responses: {
      200: { description: 'Order summary', content: { 'application/json': { schema: SuccessResponseSchema(OrderSummarySchema) } } },
    },
  }),
};
