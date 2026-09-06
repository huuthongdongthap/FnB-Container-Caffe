import { z } from "zod";
import { openapi } from "@hono/zod-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  TableIdParamsSchema,
  LocaleEnum,
  DateTimeSchema,
  MoneySchema,
  OrderStatusEnum,
  PaymentStatusEnum,
  PaymentMethodEnum,
  ReferenceSchema,
} from "./common";

/**
 * Order schemas
 */

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  productSlug: z.string(),
  variantId: z.string().uuid().nullable(),
  variantName: z.string().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: MoneySchema,
  totalPrice: MoneySchema,
  modifiers: z.array(z.object({
    modifierId: z.string().uuid(),
    modifierName: z.string(),
    optionId: z.string().uuid(),
    optionName: z.string(),
    priceAdjustment: z.number().int(),
  })).optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(["pending", "preparing", "ready", "served", "cancelled"]).default("pending"),
}).openapi("OrderItem");

export const OrderPaymentSchema = z.object({
  id: z.string().uuid(),
  amount: MoneySchema,
  method: PaymentMethodEnum,
  status: PaymentStatusEnum,
  transactionId: z.string().optional(),
  payosOrderCode: z.number().optional(),
  paidAt: DateTimeSchema.nullable(),
  metadata: z.record(z.unknown()).optional(),
}).openapi("OrderPayment");

export const OrderCustomerSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  loyaltyTier: z.string().optional(),
  loyaltyPointsEarned: z.number().int().nonnegative().default(0),
  locale: LocaleEnum.default("vi"),
}).openapi("OrderCustomer");

export const OrderCreateSchema = z.object({
  tableId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  customer: OrderCustomerSchema.optional(),
  items: z.array(OrderItemSchema).min(1),
  notes: z.string().max(1000).optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  idempotencyKey: z.string().uuid().optional(),
  source: z.enum(["pos", "mobile", "kiosk", "admin", "api"]).default("pos"),
}).openapi("OrderCreate");

export const OrderUpdateSchema = z.object({
  status: OrderStatusEnum.optional(),
  notes: z.string().max(1000).optional(),
  customer: OrderCustomerSchema.partial().optional(),
}).openapi("OrderUpdate");

export const OrderResponseSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string().openapi({ example: "ORD-20260826-001" }),
  tableId: z.string().uuid().nullable(),
  table: ReferenceSchema.nullable().optional(),
  locationId: z.string().uuid(),
  customer: OrderCustomerSchema,
  items: z.array(OrderItemSchema),
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
}).openapi("Order");

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderResponseSchema),
  meta: PaginationMetaSchema,
}).openapi("OrderListResponse");

export const OrderSummarySchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  totalRevenue: MoneySchema,
  averageOrderValue: MoneySchema,
  ordersByStatus: z.record(OrderStatusEnum, z.number().int().nonnegative()),
  ordersByPaymentMethod: z.record(PaymentMethodEnum, z.number().int().nonnegative()),
}).openapi("OrderSummary");

// Export types
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderPayment = z.infer<typeof OrderPaymentSchema>;
export type OrderCustomer = z.infer<typeof OrderCustomerSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;
export type OrderResponse = z.infer<typeof OrderResponseSchema>;
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

// OpenAPI route definitions
export const OrderRoutes = {
  list: {
    method: "get",
    path: "/api/orders",
    summary: "List orders with pagination and filtering",
    tags: ["Orders"],
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
      200: { description: "Order list", content: { "application/json": { schema: SuccessResponseSchema(OrderListResponseSchema) } } },
      400: { description: "Invalid query", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  get: {
    method: "get",
    path: "/api/orders/{id}",
    summary: "Get order by ID",
    tags: ["Orders"],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: "Order details", content: { "application/json": { schema: SuccessResponseSchema(OrderResponseSchema) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: "post",
    path: "/api/orders",
    summary: "Create new order",
    tags: ["Orders"],
    request: { body: { content: { "application/json": { schema: OrderCreateSchema } } } },
    responses: {
      201: { description: "Created", content: { "application/json": { schema: SuccessResponseSchema(OrderResponseSchema) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: "patch",
    path: "/api/orders/{id}",
    summary: "Update order (status, notes, customer)",
    tags: ["Orders"],
    request: { params: IdParamsSchema, body: { content: { "application/json": { schema: OrderUpdateSchema } } } },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: SuccessResponseSchema(OrderResponseSchema) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  cancel: {
    method: "post",
    path: "/api/orders/{id}/cancel",
    summary: "Cancel order",
    tags: ["Orders"],
    request: { params: IdParamsSchema, body: { content: { "application/json": { schema: z.object({ reason: z.string().max(500).optional() }) } } } },
    responses: {
      200: { description: "Cancelled", content: { "application/json": { schema: SuccessResponseSchema(OrderResponseSchema) } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Cannot cancel (already served/completed)", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  summary: {
    method: "get",
    path: "/api/orders/summary",
    summary: "Get order summary statistics",
    tags: ["Orders"],
    request: {
      query: z.object({
        locationId: z.string().uuid().optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
      }),
    },
    responses: {
      200: { description: "Order summary", content: { "application/json": { schema: SuccessResponseSchema(OrderSummarySchema) } } },
    },
  },
};