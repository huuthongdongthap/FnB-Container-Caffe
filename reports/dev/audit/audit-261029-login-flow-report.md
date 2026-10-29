# /audit — Báo cáo Kiểm toán Toàn diện Luồng Đăng nhập (`đăng nhập`)

- **Ngày thực hiện:** 2026-10-29
- **Baseline:** `HEAD 226a9b5` (`origin/main`)
- **Phạm vi:**
  - **Backend Auth & Session:** `worker/src/routes/auth-endpoints.ts`, `worker/src/tree/auth/*`, `worker/src/routes/auth-session.ts`, `worker/src/routes/auth-register.ts`, `worker/src/routes/auth-verify.ts`, `worker/src/lib/staff-session.ts`, `worker/src/lib/staff-session-auth.ts`, `worker/src/lib/staff-login-identity.ts`, `worker/src/lib/staff-password.ts`, `worker/src/lib/jwt.ts`, `worker/src/middleware/auth.ts`, `worker/src/routes/openapi-auth-handlers/*`
  - **Mobile Staff PIN & Device Binding:** `worker/src/routes/staff-mobile.ts`, `packages/domain/staff/commands/staff-auth.ts`
  - **Customer Phone Auth & Loyalty Middleware:** `worker/src/tree/loyalty/phone-auth-handler.ts`, `worker/src/tree/loyalty/auth-middleware.ts`, `worker/src/tree/loyalty/lookup-handler.ts`
  - **Frontend Session & Login Surfaces:** `src/lib/client-session.ts`, `src/hooks/stores/use-auth-store.ts`, `src/hooks/use-mobile-auth.tsx`, `src/hooks/stores/use-loyalty-store.ts`, `src/pages/admin/Login.tsx`, `src/pages/mobile/mobile-login.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/components/auth/AuthProvider.tsx`

---

## 1. Kiểm chứng Thực nghiệm & Các Chốt Bảo mật Đã Khóa (Sticky Verified Controls)

Theo quy tắc `review-audit-self-decision.md`, các chốt đã được chứng minh bằng test thực nghiệm trên SQLite/app router thật được khóa trạng thái **PASS**:

- **Probe Acceptance Suite (`reports/audit/plan/261028-1829-login-flow/audit-probes.config.mjs`):** **3/3 PASS** (`LOGIN-01`, `LOGIN-02`, `LOGIN-03`).
- **Auth & Session Regression Suite (10 files):** **93/93 PASS** (`staff-session-lifecycle.test.ts`, `staff-session-revocation.test.ts`, `customer-auth-promotions-waves.test.ts`, `use-mobile-auth.test.tsx`, `kds-stream.test.ts`, `private-session-cache.test.ts`, `use-auth-store.test.ts`, `ProtectedRoute.test.tsx`, `AuthProvider.test.tsx`, `api-client-auth.test.ts`, `mobile-service-worker-auth.test.ts`).
- **D1 Authority & 8h Staff Session (`worker/src/lib/staff-session.ts:6-121`):** Mọi phiên `staff-web` và `staff-mobile` đều đối chiếu trực tiếp bảng `users` (`is_active = 1`, `role`, `tenant_id`, `auth_version`) và `staff_devices` (cho mobile), giữ cứng trần `STAFF_SESSION_MAX_AGE_SECONDS = 28800` (8h) qua mọi lần `/mobile/refresh`, và fail-closed `503 AUTH_STATE_UNAVAILABLE` khi D1 hoặc `AUTH_KV` lỗi.
- **Chống CSRF trên Cookie-Only Write (`worker/src/lib/jwt.ts:210-216`, `worker/src/tree/auth/logout.ts:12-15`):** Mọi request thay đổi trạng thái (`POST`/`PUT`/`PATCH`/`DELETE`) chỉ mang cookie `access_token` mà không có `Authorization: Bearer` đều bị chặn `403`.
- **Cô lập Phiên Client & Xóa Cache khi Logout/Đổi Tài khoản (`src/lib/client-session.ts:44-71`):** Tăng `revision` chống race-condition, xóa toàn bộ `accountScopedKeys` (`aura_loyalty`, `aura_referral`, `aura_customer_profile`, ...) và gửi `CLEAR_AUTH_CACHE` tới Service Worker.

---

## 2. Phát hiện Mới Theo Mức Độ Nghiêm Trọng (Severity-Ranked Findings)

| ID | Mức độ | Phân loại | Vị trí (`file:line`) | Mô tả Lỗ hổng / Vấn đề Thực tế |
|---|---|---|---|---|
| **AUTH-01** | **CRITICAL (P0)** | Security (Authentication Bypass / OWASP A07) | `worker/src/tree/loyalty/phone-auth-handler.ts:79-86` | **Bypass xác thực chủ sở hữu SĐT trên `POST /api/loyalty/phone-auth`:** Handler kiểm tra `if ((meta?.verified_at \|\| c.env.ENVIRONMENT === 'production') && !body.otp_verified && !body.otp && !hasAuthHeader)`. Dù chặn được request chỉ gửi `{ phone }` (`LOGIN-01`), kẻ tấn công không cần đăng nhập chỉ cần truyền thêm `"otp_verified": true`, `"otp": "any"`, hoặc header giả `Authorization: Bearer x` là vượt qua nhánh chặn, nhận ngay JWT `customer` 7 ngày + cookie `access_token` của khách hàng đã tồn tại mà không hề đối chiếu OTP trong `AUTH_KV`/D1 hay verify JWT. |
| **AUTH-02** | **HIGH (P1)** | Security (Cryptographic Timing & Route Contract / OWASP A02, A07) | `worker/src/tree/auth/reset-password.ts:24-26`<br>`worker/src/routes/auth-endpoints.ts:47-48` | **So sánh `RESET_KEY` không constant-time & nhập nhằng `/api/auth/forgot-password`:**<br>1. `providedKey !== env.RESET_KEY` dùng phép so sánh chuỗi thường, có rủi ro rò rỉ timing.<br>2. `/api/auth/forgot-password` trỏ thẳng vào `resetPassword` (yêu cầu `X-Reset-Key` của operator và đổi thẳng mật khẩu + trả JWT mới), không có rate-limit theo email mục tiêu. |
| **AUTH-03** | **MEDIUM (P2)** | Performance & Security (Rate Limiting & KV Latency) | `worker/src/routes/auth-endpoints.ts:21-36`<br>`worker/src/tree/auth/login.ts:27-44` | **Gấp đôi lượt đọc/ghi KV Rate-Limit trên `/api/auth/login` và thiếu khóa theo Email:**<br>1. Mỗi request `POST /api/auth/login` chạy qua `authRateLimit` (`rate:auth:${ip}`, 20 req/300s) **và** `checkLoginRateLimit` (`rl:login:${ip}`, 10 req/60s) → tốn 2 `KV.get` + 2 `KV.put` tuần tự trước khi kiểm tra mật khẩu.<br>2. Chỉ khóa theo IP (hoặc `'unknown'` khi thiếu header), cho phép brute-force 1 tài khoản bằng xoay IP hoặc làm nghẽn toàn bộ người dùng chung NAT/proxy. |
| **AUTH-04** | **MEDIUM (P2)** | Architecture & Compliance (Dead Shadow Code & Duplicate Client Login) | `worker/src/index.ts:125,137`<br>`worker/src/routes/openapi-auth-handlers/auth-handlers.ts:31-341`<br>`src/pages/mobile/mobile-login.tsx:187-214` | **Code bóng (Shadowed Handlers) trên `openApiAuthRouter` & trùng lặp logic login Mobile:**<br>1. `authEndpointsRouter` (`/api/auth`) che khuất toàn bộ 12 route trùng tên trong `openApiAuthRouter`, nhưng `openApiAuthRouter` vẫn được bundle và dùng schema `sessions`/`trusted_devices` (opaque token) trái ngược với chuẩn JWT + `staff_devices`.<br>2. `mobile-login.tsx:187-214` tự gọi `fetch('/mobile/login')` và ghi tay 6 key `localStorage` trước khi gọi `useMobileAuth().login(token, profile)`, thay vì ủy quyền thẳng cho `useMobileAuth().login(deviceToken, fullPin)`. |
| **AUTH-05** | **LOW (P3)** | Performance (KV Subrequest Amplification) | `worker/src/tree/auth/helpers.ts:31-55` | **Quét tuần tự `AUTH_KV.list` + N×`AUTH_KV.get` trong `findExistingOwner`:** Khi bảng `users` chưa có `owner` active, hàm duyệt tối đa 20 trang × 1.000 key `user:*` và gọi `await env.AUTH_KV.get(key.name)` tuần tự, có nguy cơ chạm trần 1.000 subrequests của Cloudflare Worker nếu `AUTH_KV` có nhiều khách hàng. |

---

## 3. Khuyến nghị Khắc phục (Recommended Fixes)

- **Fix `AUTH-01` (`worker/src/tree/loyalty/phone-auth-handler.ts:78-86`):**
  - Xóa bỏ việc tin tưởng `body.otp_verified`, `body.otp` chưa kiểm chứng và `hasAuthHeader` trần.
  - Chỉ cho phép cấp token cho khách hàng đã tồn tại khi:
    1. Request đi kèm Bearer/Cookie session hợp lệ đã qua `authenticateRequest(c.req.raw, c.env)` và thuộc chính `customer.id` đó (hoặc Staff POS được phép thao tác nhưng **không** trả customer session cookie cho Staff), **hoặc**
    2. Xác minh mã OTP thực sự lưu trong `AUTH_KV` (`phone_otp:${phone}`) với giới hạn số lần thử.
- **Fix `AUTH-02` (`worker/src/tree/auth/reset-password.ts:24-26`):**
  - So sánh `X-Reset-Key` và `env.RESET_KEY` bằng hàm constant-time (`crypto.subtle.timingSafeEqual` hoặc HMAC digest comparison).
  - Tách biệt rõ `/api/auth/reset-password` (operator-only với `X-Reset-Key`) và `/api/auth/forgot-password`.
- **Fix `AUTH-03` (`worker/src/routes/auth-endpoints.ts:21-36`, `worker/src/tree/auth/login.ts:27-44`):**
  - Hợp nhất rate-limit đăng nhập về 1 lớp duy nhất, kết hợp khóa theo cả IP (`cf-connecting-ip`) và `email` đã chuẩn hóa (`rl:login:email:${email}`), giảm 50% độ trễ KV trên mỗi lượt login.
- **Fix `AUTH-04` (`worker/src/routes/openapi-auth-handlers/*`, `src/pages/mobile/mobile-login.tsx`):**
  - Gỡ bỏ các handler bị shadow trong `openApiAuthRouter` (chỉ giữ OpenAPI spec hoặc chuyển sang gọi chung handler thật trong `tree/auth/*`).
  - Trong `src/pages/mobile/mobile-login.tsx`, gọi trực tiếp `await login(deviceToken.trim(), fullPin)` từ `useMobileAuth()` để dùng chung `saveClientSession` và cơ chế chống race-condition `beginClientLogin()`.
- **Fix `AUTH-05` (`worker/src/tree/auth/helpers.ts:19-30`):**
  - Bảng `users` trong D1 đã là nguồn chân lý (authority) cho `owner`; khi `env.AURA_DB` có sẵn và truy vấn thành công (không ném lỗi), trả thẳng kết quả từ D1 mà không quét toàn bộ `AUTH_KV`.

## Unresolved Questions
- None.
