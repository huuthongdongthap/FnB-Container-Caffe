# Phase 2: Validators Refactoring Report

## Status: COMPLETE & VERIFIED

### 1. Overview
Modularized monolithic `worker/src/lib/validators.ts` (664 LOC) into 18 domain-scoped modules under `worker/src/lib/validators/` with zero business logic drift and zero broken imports. Retained `worker/src/lib/validators.ts` as a thin compatibility barrel (8 LOC).

### 2. Module Breakdown & LOC Before/After

| File | LOC | Description / Exports |
|------|-----|------------------------|
| **Original** `worker/src/lib/validators.ts` | **664** | Monolith before split |
| `worker/src/lib/validators.ts` (barrel) | 8 | Backward-compatibility re-export barrel |
| `validators/phone.ts` | 10 | `VN_PHONE_REGEX`, `phoneSchema` |
| `validators/email.ts` | 6 | `emailSchema` |
| `validators/common.ts` | 54 | `paymentMethodSchema`, `passwordSchema`, `nameSchema`, `orderItemSchema`, `zodErrorResponse`, `zodErrorResponseRaw` |
| `validators/auth.ts` | 94 | `registerSchema`, `loginSchema`, `verifyEmailSchema`, `registerStaffSchema`, `bootstrapOwnerSchema`, `resetPasswordSchema`, `changePasswordSchema`, `staffRoleSchema`, `pinSchema`, `registerDeviceSchema`, `staffLoginSchema`, `phoneAuthSchema` |
| `validators/order.ts` | 109 | `createOrderSchema` (with superRefine), `adminOrdersQuerySchema`, `payOSCreateLinkSchema`, `updateOrderStatusSchema`, `createOrderInputSchema`, `guestOrderSchema` |
| `validators/customer.ts` | 93 | `contactSchema`, `reservationSchema`, `referralApplySchema`, `spendCashbackSchema`, `redeemRewardSchema`, `checkinSchema`, `guestCheckinSchema`, `redeemBirthdaySchema`, `createReviewSchema`, `updateCustomerProfileSchema`, `customerUpdateSchema` |
| `validators/products.ts` | 44 | `menuQuerySchema`, `createProductSchema`, `updateProductSchema`, `createCategorySchema`, `updateCategorySchema` |
| `validators/subscription.ts` | 64 | `createPlanSchema`, `updatePlanSchema`, `createSubscriptionSchema`, `upgradeSubscriptionSchema`, `downgradeSubscriptionSchema`, `cancelSubscriptionSchema`, `pauseSubscriptionSchema`, `resumeSubscriptionSchema`, `updateSubscriptionSchema`, `payInvoiceSchema` |
| `validators/shift.ts` | 14 | `clockInSchema`, `clockOutSchema` |
| `validators/promotion.ts` | 15 | `validatePromotionSchema`, `redeemPromotionSchema` |
| `validators/pretix.ts` | 23 | `pretixWebhookBodySchema`, `pretixCheckinSchema`, `pretixGenerateSchema` |
| `validators/mixpost.ts` | 17 | `mixpostCreatePostSchema`, `mixpostGenerateSchema` |
| `validators/tables.ts` | 8 | `updateTableStatusSchema` |
| `validators/push.ts` | 25 | `pushSubscribeSchema`, `pushUnsubscribeSchema`, `pushSendStaffSchema` |
| `validators/marketing.ts` | 42 | `zaloSendSchema`, `broadcastSendSchema`, `campaignConfigSchema`, types |
| `validators/erpnext.ts` | 73 | `erpnextLeadSchema`, `erpnextTagSchema`, `erpnextProductSyncSchema`, `erpnextSalesOrderSchema`, `erpnextPosWebhookSchema`, `erpnextConfigureSchema`, `erpnextUpdateCustomerSchema`, `erpnextVatUpdateSchema`, types |
| `validators/payos.ts` | 13 | `payosWebhookSchema` |
| `validators/dindin.ts` | 10 | `dindinCheckoutSchema` |
| `validators/index.ts` | 22 | Central barrel re-exporting all submodules |
| **Total Modularized** | **744** | All files < 110 LOC (Max: `order.ts` at 109 LOC) |

### 3. Verification Gates
- `npx tsc --noEmit` (worker/src): **0 errors**
- `npx vitest run`: **152 test files / 1,539 tests PASS** (100% green)
- Drift Guard: All 82 original symbols verified with exact schema structures & validation regexes.

### 4. Remaining Risks
- None. 36 consumer import sites resolve through `worker/src/lib/validators.ts` barrel without changes.
