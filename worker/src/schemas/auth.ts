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
  StaffRoleEnum,
  LoyaltyTierEnum,
  ReferenceSchema,
  DeviceFingerprintSchema,
  IdempotencyKeySchema,
} from "./common";

/**
 * Authentication schemas
 */

export const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(128),
  locale: LocaleEnum.default("vi"),
  deviceFingerprint: DeviceFingerprintSchema.optional(),
  idempotencyKey: IdempotencyKeySchema.optional(),
}).openapi("Register");

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
  deviceFingerprint: DeviceFingerprintSchema.optional(),
}).openapi("Login");

export const VerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  idempotencyKey: IdempotencyKeySchema.optional(),
}).openapi("VerifyEmail");

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
  idempotencyKey: IdempotencyKeySchema.optional(),
}).openapi("ResetPassword");

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  idempotencyKey: IdempotencyKeySchema.optional(),
}).openapi("ChangePassword");

export const RegisterStaffSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(128),
  role: StaffRoleEnum.default("waiter"),
  locale: LocaleEnum.default("vi"),
}).openapi("RegisterStaff");

export const BootstrapOwnerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(128),
  locale: LocaleEnum.default("vi"),
}).openapi("BootstrapOwner");

export const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
    role: StaffRoleEnum,
    locale: LocaleEnum,
    loyaltyTier: LoyaltyTierEnum,
    loyaltyPoints: z.number().int().nonnegative(),
    emailVerified: z.boolean(),
    avatarUrl: z.string().url().nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  }),
  session: z.object({
    id: z.string().uuid(),
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: DateTimeSchema,
    isTrustedDevice: z.boolean().default(false),
  }),
}).openapi("AuthResponse");

export const SessionResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
    role: StaffRoleEnum,
    locale: LocaleEnum,
    loyaltyTier: LoyaltyTierEnum,
    loyaltyPoints: z.number().int().nonnegative(),
    emailVerified: z.boolean(),
    avatarUrl: z.string().url().nullable(),
  }),
  session: z.object({
    id: z.string().uuid(),
    expiresAt: DateTimeSchema,
    isTrustedDevice: z.boolean(),
    deviceName: z.string().nullable(),
    lastUsedAt: DateTimeSchema.nullable(),
  }),
}).openapi("SessionResponse");

export const TrustedDeviceSchema = z.object({
  id: z.string().uuid(),
  fingerprint: z.string(),
  name: z.string(),
  platform: z.string().nullable(),
  browser: z.string().nullable(),
  ip: z.string().ipv4().nullable(),
  isTrusted: z.boolean(),
  lastUsedAt: DateTimeSchema,
  createdAt: DateTimeSchema,
  expiresAt: DateTimeSchema,
}).openapi("TrustedDevice");

export const StaffResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: StaffRoleEnum,
  locale: LocaleEnum,
  isActive: z.boolean(),
  avatarUrl: z.string().url().nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("StaffResponse");

export const StaffListResponseSchema = z.object({
  staff: z.array(StaffResponseSchema),
  meta: PaginationMetaSchema,
}).openapi("StaffListResponse");

// Export types
export type Register = z.infer<typeof RegisterSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type VerifyEmail = z.infer<typeof VerifyEmailSchema>;
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
export type RegisterStaff = z.infer<typeof RegisterStaffSchema>;
export type BootstrapOwner = z.infer<typeof BootstrapOwnerSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type TrustedDevice = z.infer<typeof TrustedDeviceSchema>;
export type StaffResponse = z.infer<typeof StaffResponseSchema>;
export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;

// OpenAPI route definitions
export const AuthRoutes = {
  register: {
    method: "post",
    path: "/api/auth/register",
    summary: "Register new customer account",
    tags: ["Auth"],
    request: { body: { content: { "application/json": { schema: RegisterSchema } } } },
    responses: {
      201: { description: "Registered", content: { "application/json": { schema: SuccessResponseSchema(AuthResponseSchema) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Email already exists", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  login: {
    method: "post",
    path: "/api/auth/login",
    summary: "Login with email and password",
    tags: ["Auth"],
    request: { body: { content: { "application/json": { schema: LoginSchema } } } },
    responses: {
      200: { description: "Logged in", content: { "application/json": { schema: SuccessResponseSchema(AuthResponseSchema) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Invalid credentials", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  logout: {
    method: "post",
    path: "/api/auth/logout",
    summary: "Logout (revoke session)",
    tags: ["Auth"],
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Logged out", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  me: {
    method: "get",
    path: "/api/auth/me",
    summary: "Get current user profile",
    tags: ["Auth"],
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "User profile", content: { "application/json": { schema: SuccessResponseSchema(z.object({ user: AuthResponseSchema.shape.user })) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  session: {
    method: "get",
    path: "/api/auth/session",
    summary: "Get current session details",
    tags: ["Auth"],
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Session details", content: { "application/json": { schema: SuccessResponseSchema(SessionResponseSchema) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  verifyEmail: {
    method: "post",
    path: "/api/auth/verify-email",
    summary: "Verify email with code",
    tags: ["Auth"],
    request: { body: { content: { "application/json": { schema: VerifyEmailSchema } } } },
    responses: {
      200: { description: "Verified", content: { "application/json": { schema: SuccessResponseSchema(AuthResponseSchema) } } },
      400: { description: "Invalid code", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  registerStaff: {
    method: "post",
    path: "/api/auth/register-staff",
    summary: "Register new staff member (owner only)",
    tags: ["Auth"],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: RegisterStaffSchema } } } },
    responses: {
      201: { description: "Created", content: { "application/json": { schema: SuccessResponseSchema(StaffResponseSchema) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  listStaff: {
    method: "get",
    path: "/api/auth/staff",
    summary: "List all staff members (owner only)",
    tags: ["Auth"],
    security: [{ BearerAuth: [] }],
    request: { query: PaginationQuerySchema.extend({ role: StaffRoleEnum.optional(), isActive: z.coerce.boolean().optional() }) },
    responses: {
      200: { description: "Staff list", content: { "application/json": { schema: SuccessResponseSchema(StaffListResponseSchema) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  bootstrapOwner: {
    method: "post",
    path: "/api/auth/bootstrap-owner",
    summary: "Bootstrap first owner account",
    tags: ["Auth"],
    request: { body: { content: { "application/json": { schema: BootstrapOwnerSchema } } } },
    responses: {
      201: { description: "Owner created", content: { "application/json": { schema: SuccessResponseSchema(AuthResponseSchema) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Owner already exists", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  resetPassword: {
    method: "post",
    path: "/api/auth/reset-password",
    summary: "Request password reset",
    tags: ["Auth"],
    request: { body: { content: { "application/json": { schema: ResetPasswordSchema } } } },
    responses: {
      200: { description: "Reset email sent", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  changePassword: {
    method: "post",
    path: "/api/auth/change-password",
    summary: "Change password",
    tags: ["Auth"],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: ChangePasswordSchema } } } },
    responses: {
      200: { description: "Password changed", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Invalid current password", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  },
  trustedDevices: {
    list: {
      method: "get",
      path: "/api/auth/devices",
      summary: "List trusted devices",
      tags: ["Auth"],
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: "Device list", content: { "application/json": { schema: SuccessResponseSchema(z.array(TrustedDeviceSchema)) } } },
      },
    },
    revoke: {
      method: "delete",
      path: "/api/auth/devices/{id}",
      summary: "Revoke trusted device",
      tags: ["Auth"],
      security: [{ BearerAuth: [] }],
      request: { params: IdParamsSchema },
      responses: {
        200: { description: "Revoked", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
        404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
      },
    },
    revokeAll: {
      method: "delete",
      path: "/api/auth/devices",
      summary: "Revoke all trusted devices",
      tags: ["Auth"],
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: "All revoked", content: { "application/json": { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      },
    },
  },
};