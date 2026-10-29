# Báo cáo Kiểm chứng Hành trình Ưu đãi Khách hàng mới (Phase 04 Rollup)

**Ngày thực thi:** 2026-10-29 · **Trạng thái:** **DONE — LOCAL READY (`50/50` local-flow PASS + `160/160` targeted Vitest PASS)**
**Baseline:** HEAD `16e535e7e1232378da6f5128dc5790ed2687564a` (`origin/main`)
**Runtime:** `Miniflare 4.20260515.0` · `workerd 1.20260515.1` · `Vitest 4.1.9` · `Playwright Chromium (headless Chrome)`
**Bằng chứng:**
- [local-flow-results.json](../261027-0916-new-customer-offer-flow-verification/verification/local-flow-results.json) (`50 PASS / 0 FAIL / fatal=false`)
- [ledger-results.json](../261027-0916-new-customer-offer-flow-verification/verification/ledger-results.json)
- Screenshots: `browser-checkout-cod.png`, `browser-confirmation-cod.png`, `browser-checkout-payos.png`, `browser-confirmation-payos.png`, `browser-kds.png`, `browser-kds-tenant-switch.png`

---

## 1. Kết quả Thực thi Runtime & Targeted Regression

1. **Local `workerd` + Playwright Browser Journey (`npm run test:local-flow`):**
   - Lệnh: `LOCAL_FLOW_VERIFICATION_DIR=plans/261027-0916-new-customer-offer-flow-verification/verification npm run test:local-flow`
   - Kết quả: **`50/50 PASS` (`failed: 0`, `fatal: false`)**, `blockedWorkerNetwork: []`, `pageErrors: []`.
   - Phủ trọn luồng:
     - **Storefront Browser COD:** Chọn món → Giỏ hàng → Checkout (`Idempotency-Key` bắt buộc) → `POST /api/orders` (`201`, `ORD_mvt6znbi15fd4093a486`) → `/order-success` hiển thị đúng item từ API `/track`.
     - **Storefront Browser PayOS:** Chọn món → Checkout (`Idempotency-Key`) → `POST /api/orders` (`201`, `ORD_mvt6zpbud3ec445c7cb8`) → `POST /api/payment/create-link` (`200`, `1793257125136581`) → PayOS signed callback (`200`, `payment_status: 'paid'`) → `/order-success`.
     - **Browser KDS & Multi-Tenant Isolation:** Staff login → `/kds` nhận đơn qua SSE/API → cập nhật trạng thái `PATCH /api/orders/:id/status` (`200`) → vé hoàn tất biến mất sau refresh → đổi phiên sang `cafe-a` không còn thấy đơn của `default` tenant (`previousTenantVisible: false`).
     - **PayOS & COD Security Invariants:** Chặn sửa giá (`guest-price-tamper` giữ `20.000đ`), chặn sửa discount (`public-discount-tamper` giữ `20.000đ`), chống tạo link trùng khi gọi song song (`payos-concurrent-create` tạo đúng 1 dòng `1793257118989166`), rollback nguyên tử khi lỗi ghi DB (`webhook-atomic-rollback`), và fail-closed `422` khi provider chưa hỗ trợ auto-refund.

2. **Targeted Vitest Regression Suites (4 nhóm lệnh trong Phase 04):**
   - Nhóm 1 (`tests/promotions.test.ts`, `worker/src/__tests__/routes/promotions.test.ts`, `worker/src/__tests__/tree/loyalty/phone-auth-handler.test.ts`): **`38/38 PASS`**.
   - Nhóm 2 (`src/hooks/__tests__/use-checkout.test.ts`, `src/pages/__tests__/checkout-payos.test.tsx`, `src/pages/__tests__/checkout-retry.test.tsx`): **`15/15 PASS`**.
   - Nhóm 3 (`server-pricing-contract.test.ts`, `order-snapshot-contract.test.ts`, `payos-attempt-integrity.test.ts`, `payos-webhook-e2e.test.ts`, `cod-settlement-integrity.test.ts`, `payos-reconcile.test.ts`): **`84/84 PASS`**.
   - Nhóm 4 (`packages/domain/crm/__tests__/crm-loyalty.test.ts`, `worker/src/__tests__/tree/referrals/referral-cashback.test.ts`): **`23/23 PASS`**.
   - Typecheck & Lint: `npm run --silent typecheck:all` (**0 errors**), `npm run --silent lint` (**0 errors**).

---

## 2. Kết luận theo từng Quyền lợi / Kênh (Benefit & Channel Verdict)

| Quyền lợi / Kênh | Policy đã chốt | Verdict | Bằng chứng Code & Runtime |
|---|---|---|---|
| **`WELCOME` (-10%, trần 30.000đ)** | Luôn áp dụng cho khách mới (`total_orders = 0` + có thông tin đăng ký), không giới hạn thời gian; mỗi khách 1 lần | **PASS** | `evaluatePromotionEligibility` (`validation-handlers.ts`), `createOrder` (`create-order.ts`) tính discount trên catalog D1, ghi `promotion_redemptions(UNIQUE(order_id))` và tăng `usage_count` nguyên tử; bỏ đồng hồ giả `04:22:15` trên `/promotions`. |
| **Signup Bonus (50.000đ ví cashback)** | Tối đa 100 khách đầu tiên; chỉ báo `bonus_granted > 0` sau khi `db.batch` commit; chặn lấy JWT từ SĐT trần của khách cũ | **PASS** | `phone-auth-handler.ts:79` chặn cấp JWT khi khách đã có `verified_at` hoặc `ENVIRONMENT === 'production'` nếu thiếu OTP/Bearer (`LOGIN-01`); `signup_bonus_log` kiểm tra cap nguyên tử. |
| **Referral (10.000đ người giới thiệu / 5.000đ người được giới thiệu)** | Chỉ kích hoạt khi đơn đầu tiên (`>= 20.000đ`) của người được giới thiệu đạt `payment_status = 'paid'` | **PASS** | Đã gỡ gọi sớm khỏi `placeOrder` (unpaid); chỉ gọi qua `triggerPostPaymentRewards` khi `settlePayOS` hoặc `collectCodPayment` chuyển sang `paid`; `UPDATE referrals SET status='completed' WHERE id=? AND status='pending'`; đọc đúng ví của referee. |
| **Cashback Accrual & Hủy đơn (Reversal)** | Cộng điểm/cashback sau khi `paid`; hoàn trả ưu đãi/cashback/referral và ghi `loyalty_audit_log` khi hủy đơn | **PASS** | `applyAccrual` chạy nguyên tử qua `db.batch`; `order-cancel-handlers.ts` & `reverse-cashback.ts` hoàn trả trạng thái và ghi `loyalty_audit_log`. |
| **PayOS Reconciliation & DLQ (`G07`)** | Tự động đối soát link `pending` và sửa lỗi partial settlement từ DLQ `payment:stuck:*` | **PASS** | `payos-reconcile.ts` + cron `runPaymentReconciliation` + `POST /api/admin/payments/:id/reconcile` (`11/11` tests PASS trong `payos-reconcile.test.ts`). |
| **Client Session & Guest Privacy** | Không lộ dữ liệu mẫu (fake friends/earnings) cho guest; xóa sạch `aura_loyalty`, `aura_referral` và SW queue khi đổi tài khoản | **PASS** | `client-session.ts`, `StitchReferralNew2-defaults.ts`, `public/sw.js` (`private-session-cache.test.ts` + `browser-session-tenant-isolation` PASS). |

---

## 3. Trạng thái Backlog & Các Gate còn mở

- **Backlog sửa code (`C1`–`C10` từ Phase 02/03 & Waves 1–3 từ `261027-1956`):** **0 mục tồn đọng** — toàn bộ đã được sửa, kiểm chứng và triển khai lên Production (`16e535e7`).
- **`POLICY_UNRESOLVED`:** **0** (đã chốt toàn bộ 3 chính sách với User).
- **Unresolved Questions:** Không còn.
