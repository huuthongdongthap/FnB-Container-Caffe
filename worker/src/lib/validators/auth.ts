/**
 * Authentication and authorization validators
 */

import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  VN_PHONE_REGEX
} from './common';

// ── Register ──
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional(),
  phone: phoneSchema.optional()
});

// ── Login ──
export const loginSchema = z.object({
  email: z.string().min(1, 'Email là bắt buộc'),
  password: z.string().min(1, 'Mật khẩu là bắt buộc')
});

// ── Verify email ──
export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: z.string().length(6, 'Mã xác thực phải có 6 chữ số')
});

// ── Register staff ──
export const registerStaffSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional(),
  phone: phoneSchema.optional(),
  // Durable tenant binding — set once at provisioning by an owner-authed caller,
  // never accepted from request-time headers.
  tenant_id: z.string().max(64).optional()
});

// ── Bootstrap owner ──
export const bootstrapOwnerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional()
});

// ── Reset password ──
export const resetPasswordSchema = z.object({
  email: z.string().min(1, 'Email là bắt buộc'),
  newPassword: passwordSchema
});

// ── Change password ──
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema
});

// ══════════════════════════════════════════════
// STAFF MOBILE AUTH
// ══════════════════════════════════════════════

export const staffRoleSchema = z.enum(['owner', 'manager', 'staff', 'waiter']);

export const pinSchema = z
  .string()
  .length(4, 'PIN phải có 4 chữ số')
  .regex(/^\d{4}$/, 'PIN phải là 4 chữ số');

export const registerDeviceSchema = z.object({
  device_token: z.string().min(8, 'device_token quá ngắn'),
  device_name: z.string().max(100).optional(),
  staff_id: z.string().min(1, 'staff_id là bắt buộc'),
  role: staffRoleSchema.optional().default('staff'),
  pin: pinSchema
});

export const staffLoginSchema = z.object({
  device_token: z.string().min(8, 'device_token quá ngắn'),
  pin: pinSchema
});

// ── Phone auth ──
export const phoneAuthSchema = z.object({
  phone: z.string().regex(VN_PHONE_REGEX, 'Số điện thoại không hợp lệ'),
  name: z.string().max(100).optional(),
  dob: z.string().optional(),
  zalo: z.string().optional(),
  source: z.string().optional(),
  referral_code: z.string().optional()
});
