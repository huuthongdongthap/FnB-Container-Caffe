import { z } from "zod";
import { openapi } from "@hono/zod-openapi";

/**
 * Common OpenAPI schemas for all routes
 */

// Pagination
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).openapi({
    example: 1,
    description: "Page number (1-indexed)",
  }),
  limit: z.coerce.number().int().positive().max(100).default(20).openapi({
    example: 20,
    description: "Items per page (max 100)",
  }),
  sort: z.string().optional().openapi({
    example: "created_at:desc",
    description: "Sort field and direction (field:asc|desc)",
  }),
  search: z.string().optional().openapi({
    example: "ca phe",
    description: "Search query",
  }),
});

export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

// Standard response wrappers
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: PaginationMetaSchema.optional(),
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().openapi({ example: "VALIDATION_ERROR" }),
    message: z.string().openapi({ example: "Invalid input data" }),
    details: z.record(z.unknown()).optional(),
  }),
  meta: z.object({
    timestamp: z.string().datetime().openapi({ example: "2026-08-26T10:00:00Z" }),
    requestId: z.string().uuid().optional(),
  }).optional(),
});

export const IdParamsSchema = z.object({
  id: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
});

export const TableIdParamsSchema = z.object({
  tableId: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
});

export const LocationIdParamsSchema = z.object({
  locationId: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
});

// Locale enum for bilingual content
export const LocaleEnum = z.enum(["vi", "en"]).openapi({
  example: "vi",
  description: "Locale code (Vietnamese or English)",
});

// Timezone for Sa Đéc
export const TimezoneSchema = z.literal("Asia/Ho_Chi_Minh").openapi({
  example: "Asia/Ho_Chi_Minh",
  description: "Sa Đéc timezone",
});

// Money schema (stored as integer cents/VND)
export const MoneySchema = z.number().int().nonnegative().openapi({
  example: 45000,
  description: "Amount in VND (integer, no decimals)",
});

// Timestamp schemas
export const DateTimeSchema = z.string().datetime().openapi({
  example: "2026-08-26T10:30:00+07:00",
  description: "ISO 8601 datetime with timezone",
});

export const DateSchema = z.string().date().openapi({
  example: "2026-08-26",
  description: "ISO 8601 date",
});

// Slug schema (diacritic-safe for Vietnamese)
export const SlugSchema = z.string().regex(/^[a-z0-9-]+$/).openapi({
  example: "ca-phe-ban-dia",
  description: "URL-safe slug (lowercase, alphanumeric, hyphens only)",
});

// Common ID reference
export const ReferenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: SlugSchema.optional(),
});

// Device fingerprint
export const DeviceFingerprintSchema = z.object({
  fingerprint: z.string().min(32).max(128).openapi({
    example: "a1b2c3d4e5f6...",
    description: "Client device fingerprint hash",
  }),
  userAgent: z.string().optional(),
  ip: z.string().ipv4().optional(),
});

// Webhook idempotency
export const IdempotencyKeySchema = z.string().uuid().openapi({
  example: "550e8400-e29b-41d4-a716-446655440000",
  description: "Unique key for idempotent operations",
});

// Order status enum
export const OrderStatusEnum = z.enum([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
  "refunded",
]).openapi({
  example: "confirmed",
  description: "Order lifecycle status",
});

// Payment status enum
export const PaymentStatusEnum = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
]).openapi({
  example: "completed",
  description: "Payment status",
});

// Payment method enum
export const PaymentMethodEnum = z.enum([
  "cash",
  "card",
  "payos",
  "momo",
  "zalopay",
  "bank_transfer",
]).openapi({
  example: "payos",
  description: "Payment method",
});

// Table status enum
export const TableStatusEnum = z.enum([
  "available",
  "occupied",
  "reserved",
  "maintenance",
  "cleaning",
]).openapi({
  example: "available",
  description: "Table availability status",
});

// Category type enum
export const CategoryTypeEnum = z.enum(["food", "drink", "combo", "promo"]).openapi({
  example: "drink",
  description: "Menu category type",
});

// Product status enum
export const ProductStatusEnum = z.enum(["active", "inactive", "archived", "out_of_stock"]).openapi({
  example: "active",
  description: "Product availability status",
});

// Staff role enum
export const StaffRoleEnum = z.enum([
  "owner",
  "manager",
  "barista",
  "cashier",
  "waiter",
  "kitchen",
  "admin",
]).openapi({
  example: "barista",
  description: "Staff role",
});

// Loyalty tier enum
export const LoyaltyTierEnum = z.enum(["bronze", "silver", "gold", "platinum"]).openapi({
  example: "silver",
  description: "Customer loyalty tier",
});

// Shift status enum
export const ShiftStatusEnum = z.enum(["scheduled", "active", "completed", "cancelled"]).openapi({
  example: "active",
  description: "Shift status",
});

// Inventory movement type
export const InventoryMovementTypeEnum = z.enum([
  "purchase",
  "sale",
  "waste",
  "adjustment",
  "transfer",
  "return",
]).openapi({
  example: "sale",
  description: "Inventory movement type",
});

// Audit action enum
export const AuditActionEnum = z.enum([
  "create",
  "read",
  "update",
  "delete",
  "login",
  "logout",
  "payment",
  "export",
  "import",
]).openapi({
  example: "update",
  description: "Audit log action",
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type IdParams = z.infer<typeof IdParamsSchema>;
export type Locale = z.infer<typeof LocaleEnum>;
export type OrderStatus = z.infer<typeof OrderStatusEnum>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type TableStatus = z.infer<typeof TableStatusEnum>;
export type CategoryType = z.infer<typeof CategoryTypeEnum>;
export type ProductStatus = z.infer<typeof ProductStatusEnum>;
export type StaffRole = z.infer<typeof StaffRoleEnum>;
export type LoyaltyTier = z.infer<typeof LoyaltyTierEnum>;
export type ShiftStatus = z.infer<typeof ShiftStatusEnum>;
export type InventoryMovementType = z.infer<typeof InventoryMovementTypeEnum>;
export type AuditAction = z.infer<typeof AuditActionEnum>;