/**
 * Order and checkout validators
 */

import { z } from 'zod';
import {
  emailSchema,
  nameSchema,
  orderItemSchema,
  paymentMethodSchema
} from './common';

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
  table_id: z.string().optional(),
  /** Customer id (from POS lookup). Optional — guest orders leave it unset. */
  customer_id: z.string().optional(),
  /** No default: omitted order_type skips per-type validation (legacy QR flows);
   *  create-order falls back to 'dine_in' at insert time. */
  order_type: z.enum(['dine_in', 'takeaway', 'delivery']).optional(),
  tip_amount: z.number().nonnegative().optional().default(0),
  service_fee: z.number().nonnegative().optional().default(0),
}).superRefine((data, ctx) => {
  if (data.order_type === 'delivery' && !(data.customer_address ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customer_address'],
      message: 'Địa chỉ giao hàng là bắt buộc với đơn giao tận nơi',
    });
  }
  if (data.order_type === 'dine_in' && !(data.table_id ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['table_id'],
      message: 'Số bàn là bắt buộc với đơn tại quán',
    });
  }
});

// ── Admin orders query ──
export const adminOrdersQuerySchema = z.object({
  status: z.string().optional(),
  payment_status: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional()
});

// ── Order status update ──
export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served', 'cancelled'])
});

// ── Simple order create input ──
export const createOrderInputSchema = z.object({
  items: z.array(
    z.object({
      product_id: z.string().min(1),
      quantity: z.number().int().positive(),
      price: z.number().positive()
    })
  ).min(1, 'Phải có ít nhất 1 sản phẩm'),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_address: z.string().optional(),
  notes: z.string().optional(),
  payment_method: z.string().optional()
});

// ══════════════════════════════════════════════
// GUEST ORDER (QR Table Ordering — no phone required)
// ══════════════════════════════════════════════

export const guestOrderSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })).min(1, 'Phải có ít nhất 1 sản phẩm'),
  total: z.number().or(z.string()).refine(
    (val) => Number(val) >= 1000,
    'Tổng tiền tối thiểu 1,000đ'),
  customer_name: z.string().min(1, 'Tên là bắt buộc').max(100),
  payment_method: paymentMethodSchema,
  table_id: z.string().optional(),
  notes: z.string().max(1000).optional()
});
