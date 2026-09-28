/**
 * Common validators — shared primitives and utilities
 */

import { z } from 'zod';

// ── Payment methods: COD + PayOS only ──
export const paymentMethodSchema = z.enum(['cod', 'payos']);

// ── Password ──
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128, 'Mật khẩu không vượt quá 128 ký tự');

// ── Name ──
export const nameSchema = z
  .string()
  .min(1, 'Tên không được để trống')
  .max(100, 'Tên không vượt quá 100 ký tự');

// ── Order item ──
export const orderItemSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  name: z.string().min(1),
  qty: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional()
});

// ── Re-export phone/email primitives from their canonical modules ──
export { VN_PHONE_REGEX, phoneSchema } from './phone';
export { emailSchema } from './email';

// ── Shared Zod error response helpers ──────────────────────────────
export function zodErrorResponse(
  c: { json: (data: unknown, status?: any) => Response },
  error: z.ZodError
) {
  return c.json(
    { success: false, error: error.issues[0]?.message ?? 'Validation error' },
    400
  );
}

export function zodErrorResponseRaw(error: z.ZodError) {
  return new Response(
    JSON.stringify({ success: false, error: error.issues[0]?.message ?? 'Validation error' }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
