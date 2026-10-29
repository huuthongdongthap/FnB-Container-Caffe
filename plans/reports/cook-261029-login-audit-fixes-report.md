# /cook + /fix — Báo cáo Khắc phục Kiểm toán Đăng nhập (`AUTH-01` → `AUTH-05`)

- **Ngày thực hiện:** 2026-10-29
- **Báo cáo chi tiết:** `reports/core/cook/cook-261029-login-audit-fixes-report.md`
- **Trạng thái:** **5/5 Findings Fixed & Verified (`186/186` tests PASS, `typecheck:all` PASS)**

## Tóm tắt Khắc phục
1. **`AUTH-01` (P0 — Fixed):** `worker/src/tree/loyalty/phone-auth-handler.ts:71-122` xác minh thực sự Bearer JWT (`verifyJWT` + check `revoked:`) hoặc one-time OTP trong `AUTH_KV` (`phone_otp:${phone}`) bằng `timingSafeEqualString`; chặn hoàn toàn `otp_verified: true`, `otp` giả, và `Bearer` giả (`403 PHONE_VERIFICATION_REQUIRED`).
2. **`AUTH-02` (P1 — Fixed):** `worker/src/lib/jwt.ts:226-237`, `worker/src/tree/auth/reset-password.ts:24-28`, `worker/src/routes/auth-verify.ts:37` chuyển sang dùng `timingSafeEqualString` constant-time.
3. **`AUTH-03` (P2 — Fixed):** `worker/src/tree/auth/login.ts:26-59` bổ sung khóa rate-limit theo email (`rl:login:email:${email}`, tối đa 10 lần sai / 300s) và chuẩn hóa `x-forwarded-for` trong `worker/src/routes/auth-endpoints.ts:24-25`.
4. **`AUTH-04` (P2 — Fixed):** `src/pages/mobile/mobile-login.tsx:205-208` bỏ ghi lặp 5 key `localStorage`, ủy quyền cho `await login(data.token, staffProfile)`.
5. **`AUTH-05` (P3 — Fixed):** `worker/src/tree/auth/helpers.ts:15-59` giới hạn fallback `AUTH_KV` ở 1 trang (`limit: 100`) khi D1 `users` đã phản hồi thành công.

## Unresolved Questions
- None.
