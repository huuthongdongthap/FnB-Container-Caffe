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
  price: z.number().nonnegative().optional()
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
  table_id: z.string().optional()
});

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
  phone: phoneSchema.optional()
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

// ── PayOS create link ──
export const payOSCreateLinkSchema = z.object({
  order_id: z.string().min(1),
  description: z.string().max(25).optional(),
  customer_name: z.string().max(100).optional()
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

// ── Menu query ──
export const menuQuerySchema = z.object({
  category: z.string().optional(),
  available: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional()
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

// ══════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════

export const createProductSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được để trống'),
  price: z.number().positive('Giá phải lớn hơn 0'),
  slug: z.string().optional(),
  description: z.string().optional(),
  compare_at_price: z.number().optional(),
  category_id: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  is_available: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

export const updateProductSchema = createProductSchema.partial();

// ══════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được để trống'),
  slug: z.string().optional(),
  sort_order: z.number().int().optional(),
  image_url: z.string().url().optional().or(z.literal(''))
});

export const updateCategorySchema = createCategorySchema.partial();

// ══════════════════════════════════════════════
// SUBSCRIPTIONS — plans
// ══════════════════════════════════════════════

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Tên gói không được để trống'),
  price: z.number().nonnegative(),
  billing_cycle: z.string().optional(),
  features: z.string().optional(),
  description: z.string().optional()
});

export const updatePlanSchema = createPlanSchema.partial();

// ══════════════════════════════════════════════
// SUBSCRIPTIONS — lifecycle
// ══════════════════════════════════════════════

export const createSubscriptionSchema = z.object({
  plan_id: z.string().min(1, 'plan_id là bắt buộc'),
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional()
});

export const upgradeSubscriptionSchema = z.object({
  new_plan_id: z.string().min(1, 'new_plan_id là bắt buộc')
});

export const downgradeSubscriptionSchema = z.object({
  new_plan_id: z.string().min(1, 'new_plan_id là bắt buộc')
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().optional()
});

export const pauseSubscriptionSchema = z.object({
  until_date: z.string().optional()
});

export const resumeSubscriptionSchema = z.object({});

export const updateSubscriptionSchema = z.object({
  customer_name: z.string().max(100).optional(),
  customer_phone: z.string().max(20).optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  container_number: z.string().optional(),
  zone: z.string().optional(),
  deposit_vnd: z.number().nonnegative().optional(),
  deposit_paid: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional()
});

export const payInvoiceSchema = z.object({
  payment_method: z.string().max(50).optional(),
  payment_ref: z.string().max(200).optional()
});

// ══════════════════════════════════════════════
// SHIFTS
// ══════════════════════════════════════════════

export const clockInSchema = z.object({
  staff_id: z.string().min(1, 'staff_id là bắt buộc'),
  staff_name: z.string().optional(),
  notes: z.string().optional()
});

export const clockOutSchema = z.object({
  staff_id: z.string().min(1, 'staff_id là bắt buộc')
});

// ══════════════════════════════════════════════
// CHECKIN
// ══════════════════════════════════════════════

export const checkinSchema = z.object({
  customer_id: z.string().min(1, 'customer_id là bắt buộc'),
  customer_name: z.string().optional()
});

// ══════════════════════════════════════════════
// ORDERS-HONO
// ══════════════════════════════════════════════

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served', 'cancelled'])
});

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
// PROMOTIONS
// ══════════════════════════════════════════════

export const validatePromotionSchema = z.object({
  code: z.string().min(1, 'code là bắt buộc'),
  order_total: z.number().optional()
});

export const redeemPromotionSchema = z.object({
  code: z.string().min(1, 'code là bắt buộc'),
  order_id: z.string().min(1, 'order_id là bắt buộc'),
  order_total: z.number()
});

// ══════════════════════════════════════════════
// PRETIX
// ══════════════════════════════════════════════

export const pretixWebhookBodySchema = z.object({
  notification_id: z.number().optional(),
  organizer: z.string().min(1),
  event: z.string().min(1),
  code: z.string().min(1),
  action: z.string().min(1)
});

export const pretixCheckinSchema = z.object({
  secret: z.string().min(1, 'secret là bắt buộc'),
  event: z.string().optional(),
  listId: z.number().optional()
});

export const pretixGenerateSchema = z.object({
  source: z.literal('event'),
  slug: z.string().min(1, 'slug là bắt buộc')
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

// ── Guest QR check-in (no auth) ────────────────────────────────────
export const guestCheckinSchema = z.object({
  customer_name: z.string().min(1, 'Tên là bắt buộc').max(100),
  customer_phone: z.string().min(1, 'SĐT là bắt buộc').max(20),
  table_id: z.string().min(1, 'Bàn là bắt buộc')
});

// ══════════════════════════════════════════════
// TABLES
// ══════════════════════════════════════════════

export const updateTableStatusSchema = z.object({
  status: z.enum(['Available', 'Occupied', 'Reserved', 'Overdue'])
});

// ══════════════════════════════════════════════
// BIRTHDAY
// ══════════════════════════════════════════════

export const redeemBirthdaySchema = z.object({
  customer_id: z.string().min(1, 'customer_id là bắt buộc'),
  order_id: z.string().optional()
});

// ══════════════════════════════════════════════
// MIXPOST
// ══════════════════════════════════════════════

export const mixpostCreatePostSchema = z.object({
  content: z.string().min(1, 'content là bắt buộc'),
  accounts: z.array(z.number()).min(1, 'accounts là bắt buộc'),
  media_urls: z.array(z.string().url()).optional(),
  scheduled_at: z.string().optional()
});

export const mixpostGenerateSchema = z.object({
  source: z.enum(['promotion', 'menu']),
  id: z.string().optional(),
  category: z.number().optional()
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

// ══════════════════════════════════════════════
// WEBHOOKS — PayOS
// ══════════════════════════════════════════════

export const payosWebhookSchema = z.object({
  success: z.boolean(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string()
  }).passthrough()
});

// ══════════════════════════════════════════════
// ERPNEXT
// ══════════════════════════════════════════════

export const erpnextLeadSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  phone_number: z.string().optional(),
  consent_marketing: z.boolean().optional(),
  consent_erpnext_sync: z.boolean().optional()
});

export const erpnextTagSchema = z.object({
  tag: z.string().min(1, 'tag là bắt buộc')
});

export const updateCustomerProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional()
});

export const erpnextProductSyncSchema = z.object({
  product_ids: z.array(z.string()).optional()
});

// ══════════════════════════════════════════════
// DINDIN (AURA CAFE MENU ORDERING)
// ══════════════════════════════════════════════

export const dindinCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'sessionId là bắt buộc'),
  payment_method: z.enum(['cod', 'payos'])
});

// ══════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ══════════════════════════════════════════════

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url('endpoint không hợp lệ'),
  auth_key: z.string().min(1, 'auth_key là bắt buộc'),
  p256dh_key: z.string().min(1, 'p256dh_key là bắt buộc'),
  customer_id: z.string().optional(),
  user_agent: z.string().optional(),
  role: z.string().optional()
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().min(1, 'endpoint là bắt buộc')
});

export const pushSendStaffSchema = z.object({
  title: z.string().min(1, 'title là bắt buộc'),
  body: z.string().min(1, 'body là bắt buộc'),
  role: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(z.object({ action: z.string(), title: z.string() })).optional()
});

// ══════════════════════════════════════════════
// ZALO ZNS
// ══════════════════════════════════════════════

export const zaloSendSchema = z.object({
  phone: z.string().optional(),
  customer_id: z.string().optional(),
  template_key: z.string().min(1, 'template_key là bắt buộc'),
  data: z.record(z.string(), z.unknown())
});

// ══════════════════════════════════════════════
// ERPNEXT POS
// ══════════════════════════════════════════════

export const erpnextSalesOrderSchema = z.object({
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  items: z.array(
    z.object({
      item_code: z.string().min(1),
      item_name: z.string().optional(),
      qty: z.number().positive(),
      rate: z.number().positive(),
      amount: z.number().optional()
    })
  ).min(1, 'Phải có ít nhất 1 sản phẩm'),
  table_id: z.string().optional(),
  notes: z.string().optional()
});

export const erpnextPosWebhookSchema = z.object({
  doctype: z.string().optional(),
  docname: z.string().optional(),
  action: z.string().optional()
}).passthrough();

// ══════════════════════════════════════════════
// BROADCAST
// ══════════════════════════════════════════════

export const broadcastSendSchema = z.object({
  segment: z
    .enum(['all', 'loyalty_bronze', 'loyalty_silver', 'loyalty_gold', 'loyalty_platinum', 'active_30d', 'inactive_90d', 'birthday_this_month'])
    .optional()
    .default('all'),
  channel: z.enum(['zns', 'sms', 'email', 'all']),
  title: z.string().max(200).optional(),
  message: z.string().min(1, 'message là bắt buộc').max(5000)
});

// ══════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════

export const campaignConfigSchema = z.object({
  is_active: z.coerce.number().int().min(0).max(1).optional(),
  channels: z.union([z.string(), z.array(z.string())]).optional(),
  timing: z.string().max(200).optional().or(z.literal(''))
});

// ══════════════════════════════════════════════
// ERPNext configure
// ══════════════════════════════════════════════

export const erpnextConfigureSchema = z.object({
  url: z.string().url('URL không hợp lệ'),
  api_key: z.string().min(1, 'api_key là bắt buộc'),
  api_secret: z.string().min(1, 'api_secret là bắt buộc')
});

// ══════════════════════════════════════════════
// ERPNext VAT invoice update
// ══════════════════════════════════════════════

export const erpnextVatUpdateSchema = z.object({
  success: z.boolean(),
  invoice_number: z.string().optional()
});

// Shared body types for routes file
export type CampaignConfigBody = z.infer<typeof campaignConfigSchema>;
export type BroadcastSendBody = z.infer<typeof broadcastSendSchema>;
export type ErpnextConfigureBody = z.infer<typeof erpnextConfigureSchema>;
export type ErpnextVatUpdateBody = z.infer<typeof erpnextVatUpdateSchema>;

export const customerUpdateSchema = z.object({
  customer_name: z.string().max(100).optional(),
  customer_email: emailSchema.optional().or(z.literal('')),
  customer_phone: z.string().min(8).max(15).optional(),
  customer_address: z.string().max(500).optional(),
});

// ── Shared Zod error response helpers ──────────────────────────────
export function zodErrorResponse(c: import('hono').Context, error: z.ZodError) {
  return c.json({ success: false, error: error.issues[0].message }, 400);
}

export function zodErrorResponseRaw(error: z.ZodError) {
  return new Response(JSON.stringify({ success: false, error: error.issues[0].message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
