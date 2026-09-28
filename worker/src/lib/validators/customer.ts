/**
 * Customer, loyalty, and CRM validators
 */

import { z } from 'zod';
import {
  emailSchema,
  nameSchema,
  phoneSchema
} from './common';

// ── Contact form ──
export const contactSchema = z.object({
  name: nameSchema,
  phone: z.string().min(8).max(15),
  email: emailSchema.optional().or(z.literal('')),
  category: z.enum(['service', 'food', 'space', 'booking', 'complaint', 'other']).optional(),
  content: z.string().min(1, 'Nội dung không được để trống').max(2000, 'Nội dung tối đa 2000 ký tự')
});

// ── Reservation ──
export const reservationSchema = z.object({
  table_id: z.string().min(1),
  customer_name: nameSchema,
  customer_phone: z.string().min(8).max(15),
  guest_count: z.number().int().min(1).max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (YYYY-MM-DD)'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ không hợp lệ (HH:MM)'),
  notes: z.string().max(500).optional()
});

// ── Referral apply ──
export const referralApplySchema = z.object({
  code: z.string().min(1, 'Thiếu mã giới thiệu')
});

// ── Spend cashback ──
export const spendCashbackSchema = z.object({
  order_id: z.string().min(1),
  amount: z.number().int().positive('Số tiền phải lớn hơn 0')
});

// ── Redeem reward ──
export const redeemRewardSchema = z.object({
  reward_id: z.string().min(1)
});

// ══════════════════════════════════════════════
// CHECKIN
// ══════════════════════════════════════════════

export const checkinSchema = z.object({
  customer_id: z.string().min(1, 'customer_id là bắt buộc'),
  customer_name: z.string().optional()
});

// ── Guest QR check-in (no auth) ────────────────────────────────────
export const guestCheckinSchema = z.object({
  customer_name: z.string().min(1, 'Tên là bắt buộc').max(100),
  customer_phone: z.string().min(1, 'SĐT là bắt buộc').max(20),
  table_id: z.string().min(1, 'Bàn là bắt buộc')
});

// ══════════════════════════════════════════════
// BIRTHDAY
// ══════════════════════════════════════════════

export const redeemBirthdaySchema = z.object({
  customer_id: z.string().min(1, 'customer_id là bắt buộc'),
  order_id: z.string().optional()
});

// ══════════════════════════════════════════════
// REVIEWS
// ══════════════════════════════════════════════

export const createReviewSchema = z.object({
  order_id: z.string().min(1, 'order_id là bắt buộc'),
  rating: z.number().int().min(1, 'Đánh giá tối thiểu 1').max(5, 'Đánh giá tối đa 5'),
  comment: z.string().optional(),
  customer_name: z.string().optional()
});

export const updateCustomerProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional()
});

export const customerUpdateSchema = z.object({
  customer_name: z.string().max(100).optional(),
  customer_email: emailSchema.optional().or(z.literal('')),
  customer_phone: z.string().min(8).max(15).optional(),
  customer_address: z.string().max(500).optional(),
});
