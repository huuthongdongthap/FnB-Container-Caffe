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
  PaymentStatusEnum,
  PaymentMethodEnum,
  SupportedPaymentMethodEnum,
  ReferenceSchema,
  IdempotencyKeySchema,
} from './common';

/**
 * Payment schemas
 */

export const PaymentIntentSchema = z.object({
  orderId: z.string().min(1),
  amount: MoneySchema,
  method: SupportedPaymentMethodEnum,
  idempotencyKey: IdempotencyKeySchema,
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  locale: LocaleEnum.default('vi'),
}).openapi('PaymentIntent');

export const PaymentIntentResponseSchema = z.object({
  paymentId: z.string().min(1),
  paymentUrl: z.string().url().nullable(),
  qrCodeUrl: z.string().url().nullable(),
  deeplink: z.string().nullable(),
  expiresAt: DateTimeSchema,
  status: PaymentStatusEnum,
}).openapi('PaymentIntentResponse');

export const PayOSWebhookSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number().int().nonnegative(),
    description: z.string(),
  }).passthrough(),
  signature: z.string(),
}).openapi('PayOSWebhook');

export const PaymentResponseSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  order: ReferenceSchema.nullable().optional(),
  amount: MoneySchema,
  method: PaymentMethodEnum,
  status: PaymentStatusEnum,
  transactionId: z.string().nullable(),
  payosOrderCode: z.number().nullable(),
  payosPaymentLinkId: z.string().nullable(),
  qrCodeUrl: z.string().url().nullable(),
  deeplink: z.string().nullable(),
  paidAt: DateTimeSchema.nullable(),
  failedAt: DateTimeSchema.nullable(),
  failureReason: z.string().nullable(),
  refundedAmount: MoneySchema.default(0),
  refundedAt: DateTimeSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Payment');

export const PaymentListResponseSchema = z.object({
  payments: z.array(PaymentResponseSchema),
  meta: PaginationMetaSchema,
}).openapi('PaymentListResponse');

export const RefundRequestSchema = z.object({
  paymentId: z.string().min(1),
  amount: MoneySchema.optional(),
  reason: z.string().max(500).optional(),
  idempotencyKey: IdempotencyKeySchema,
}).openapi('RefundRequest');

export const RefundResponseSchema = z.object({
  id: z.string().min(1),
  paymentId: z.string().min(1),
  amount: MoneySchema,
  reason: z.string().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  processedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
}).openapi('Refund');

export const PaymentSummarySchema = z.object({
  totalPayments: z.number().int().nonnegative(),
  totalAmount: MoneySchema,
  successfulAmount: MoneySchema,
  failedAmount: MoneySchema,
  refundedAmount: MoneySchema,
  byMethod: z.record(PaymentMethodEnum, z.object({
    count: z.number().int().nonnegative(),
    amount: MoneySchema,
  })),
  byStatus: z.record(PaymentStatusEnum, z.number().int().nonnegative()),
}).openapi('PaymentSummary');

// Export types
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;
export type PaymentIntentResponse = z.infer<typeof PaymentIntentResponseSchema>;
export type PayOSWebhook = z.infer<typeof PayOSWebhookSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>;
export type RefundRequest = z.infer<typeof RefundRequestSchema>;
export type RefundResponse = z.infer<typeof RefundResponseSchema>;
export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

// OpenAPI route definitions
export const PaymentRoutes = {
  create: {
    method: 'post',
    path: '/api/payments',
    summary: 'Create payment',
    tags: ['Payments'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: PaymentIntentSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(PaymentIntentResponseSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      404: { description: 'Order not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  createIntent: {
    method: 'post',
    path: '/api/payments/intent',
    summary: 'Create payment intent',
    tags: ['Payments'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: PaymentIntentSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(PaymentIntentResponseSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      404: { description: 'Order not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  get: {
    method: 'get',
    path: '/api/payments/{id}',
    summary: 'Get payment by ID',
    tags: ['Payments'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Payment details', content: { 'application/json': { schema: SuccessResponseSchema(PaymentResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  list: {
    method: 'get',
    path: '/api/payments',
    summary: 'List payments with pagination and filtering',
    tags: ['Payments'],
    security: [{ BearerAuth: [] }],
    request: {
      query: PaginationQuerySchema.extend({
        orderId: z.string().min(1).optional(),
        method: PaymentMethodEnum.optional(),
        status: PaymentStatusEnum.optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
      }),
    },
    responses: {
      200: { description: 'Payment list', content: { 'application/json': { schema: SuccessResponseSchema(PaymentListResponseSchema) } } },
      400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  refund: {
    method: 'post',
    path: '/api/payments/refund',
    summary: 'Request refund',
    tags: ['Payments'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: RefundRequestSchema } } } },
    responses: {
      201: { description: 'Refund initiated', content: { 'application/json': { schema: SuccessResponseSchema(RefundResponseSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      404: { description: 'Payment not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      409: { description: 'Cannot refund (already refunded/failed)', content: { 'application/json': { schema: ErrorResponseSchema } } },
      422: { description: 'Automatic PayOS refund unavailable; verified provider capability required', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  summary: {
    method: 'get',
    path: '/api/payments/summary',
    summary: 'Get payment summary statistics',
    tags: ['Payments'],
    security: [{ BearerAuth: [] }],
    request: {
      query: z.object({
        locationId: z.string().min(1).optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
      }),
    },
    responses: {
      200: { description: 'Payment summary', content: { 'application/json': { schema: SuccessResponseSchema(PaymentSummarySchema) } } },
    },
  },
  webhook: {
    payos: {
      method: 'post',
      path: '/api/payments/webhook/payos',
      summary: 'PayOS webhook handler',
      tags: ['Payments'],
      request: { body: { content: { 'application/json': { schema: PayOSWebhookSchema } } } },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
        400: { description: 'Invalid signature', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
};
