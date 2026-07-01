import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════
   AURA CAFE · Zod Validators (v4)
   Checkout form validation matching backend API contract.
   ═══════════════════════════════════════════════════════════════════ */

export const PAYMENT_METHODS = ['cod', 'payos'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const VN_PHONE_REGEX = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;

export const checkoutFormSchema = z.object({
  fullName: z
    .string({ message: 'Vui lòng nhập họ và tên' })
    .min(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
    .max(100, { message: 'Họ tên không quá 100 ký tự' }),
  email: z
    .string()
    .email({ message: 'Email không hợp lệ' })
    .optional()
    .or(z.literal('')),
  phone: z
    .string({ message: 'Vui lòng nhập số điện thoại' })
    .regex(VN_PHONE_REGEX, { message: 'Số điện thoại không hợp lệ (VD: 0912345678)' }),
  address: z
    .string({ message: 'Vui lòng nhập địa chỉ giao hàng' })
    .min(5, { message: 'Địa chỉ phải có ít nhất 5 ký tự' }),
  ward: z.string().optional(),
  notes: z.string().max(500, { message: 'Ghi chú không quá 500 ký tự' }).optional(),
  deliveryTime: z.enum(['now', 'scheduled']).default('now'),
  scheduledTime: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  discountCode: z.string().optional(),
  tip: z.number().min(0, { message: 'Tip không được âm' }).max(1_000_000, { message: 'Tip tối đa 1.000.000đ' }).optional().default(0),
});

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

export const cartItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().min(1).max(99),
  image: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
  notes: z.string().max(200).optional(),
});

export const orderApiPayloadSchema = z.object({
  items: z.array(cartItemSchema).min(1, { message: 'Giỏ hàng trống' }),
  total: z.number().min(0),
  customer_name: z.string().min(2),
  customer_phone: z.string().regex(VN_PHONE_REGEX),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_address: z.string().min(5),
  payment_method: z.enum(PAYMENT_METHODS),
  notes: z.string().max(500).optional(),
  delivery_time: z.enum(['now', 'scheduled']).optional(),
  shipping_fee: z.number().min(0).optional().default(0),
  discount: z.number().min(0).optional().default(0),
  tip: z.number().min(0).optional().default(0),
});

export type OrderApiPayload = z.infer<typeof orderApiPayloadSchema>;
