/**
 * Zod validators shared between routes.
 * Matches frontend validators in src/lib/validators.ts.
 * All payment_method values limited to cod|payos only.
 */

import { z } from 'zod';

// ── Vietnamese phone regex (matching frontend) ──
const VN_PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;

// ── Payment methods: COD + PayOS only ──
export const paymentMethodSchema = z.enum(['cod', 'payos']);

// ── Email ──
export const emailSchema = z.string().email('Email không hợp lệ');

// ── Password ──
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128, 'Mật khẩu không vượt quá 128 ký tự');

// ── Phone ──
export const phoneSchema = z
  .string()
  .regex(VN_PHONE_REGEX, 'Số điện thoại không hợp lệ');

// ── Name ──
export const nameSchema = z
  .string()
  .min(1, 'Tên không được để trống')
  .max(100, 'Tên không vượt quá 100 ký tự');

// ── Order item ──
export const orderItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
});

// ── Order create ──
export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm'),
  total: z.number().or(z.string()).refine(
    (val) => Number(val) >= 1000,
    'Tổng tiền tối thiểu 1,000đ'
  ),
  customer_name: nameSchema,
  customer_phone: z.string().min(8, 'Số điện thoại không hợp lệ').max(15),
  customer_email: emailSchema.optional().or(z.literal('')),
  customer_address: z.string().max(500).optional(),
  payment_method: paymentMethodSchema,
  shipping_fee: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  delivery_time: z.string().optional(),
});

// ── Register ──
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional(),
  phone: phoneSchema.optional(),
});

// ── Login ──
export const loginSchema = z.object({
  email: z.string().min(1, 'Email là bắt buộc'),
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

// ── Register staff ──
export const registerStaffSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional(),
  phone: phoneSchema.optional(),
});

// ── Bootstrap owner ──
export const bootstrapOwnerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional(),
});

// ── Reset password ──
export const resetPasswordSchema = z.object({
  email: z.string().min(1, 'Email là bắt buộc'),
  newPassword: passwordSchema,
});

// ── Change password ──
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// ── Contact form ──
export const contactSchema = z.object({
  name: nameSchema,
  phone: z.string().min(8).max(15),
  email: emailSchema.optional().or(z.literal('')),
  category: z.enum(['service', 'food', 'space', 'booking', 'complaint', 'other']).optional(),
  content: z.string().min(1, 'Nội dung không được để trống').max(2000, 'Nội dung tối đa 2000 ký tự'),
});

// ── Reservation ──
export const reservationSchema = z.object({
  table_id: z.string().min(1),
  customer_name: nameSchema,
  customer_phone: z.string().min(8).max(15),
  guest_count: z.number().int().min(1).max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (YYYY-MM-DD)'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ không hợp lệ (HH:MM)'),
  notes: z.string().max(500).optional(),
});

// ── PayOS create link ──
export const payOSCreateLinkSchema = z.object({
  order_id: z.string().min(1),
  description: z.string().max(25).optional(),
  customer_name: z.string().max(100).optional(),
});

// ── Referral apply ──
export const referralApplySchema = z.object({
  code: z.string().min(1, 'Thiếu mã giới thiệu'),
});

// ── Spend cashback ──
export const spendCashbackSchema = z.object({
  order_id: z.string().min(1),
  amount: z.number().int().positive('Số tiền phải lớn hơn 0'),
});

// ── Redeem reward ──
export const redeemRewardSchema = z.object({
  reward_id: z.string().min(1),
});

// ── Phone auth ──
export const phoneAuthSchema = z.object({
  phone: z.string().regex(VN_PHONE_REGEX, 'Số điện thoại không hợp lệ'),
  name: z.string().max(100).optional(),
  dob: z.string().optional(),
  zalo: z.string().optional(),
  source: z.string().optional(),
  referral_code: z.string().optional(),
});

// ── Menu query ──
export const menuQuerySchema = z.object({
  category: z.string().optional(),
  available: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// ── Admin orders query ──
export const adminOrdersQuerySchema = z.object({
  status: z.string().optional(),
  payment_status: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});
