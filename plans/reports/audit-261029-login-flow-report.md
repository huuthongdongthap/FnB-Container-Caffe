# /audit — Báo cáo Kiểm toán Toàn diện Luồng Đăng nhập (`đăng nhập`)

- **Ngày thực hiện:** 2026-10-29
- **Baseline:** `HEAD 226a9b5` (`origin/main`)
- **Báo cáo chi tiết:** Xem `reports/dev/audit/audit-261029-login-flow-report.md`

## Tóm tắt Kết quả
- **Chốt bảo mật đã khóa (Sticky Verified):** `3/3` probe bảo mật (`LOGIN-01`, `LOGIN-02`, `LOGIN-03`) PASS; `186/186` bài test hồi quy Auth/Loyalty/Session/Client (14 files) PASS.
- **Phát hiện mới & Trạng thái khắc phục (`5/5 FIXED` — xem `reports/core/cook/cook-261029-login-audit-fixes-report.md`):**
  1. **`AUTH-01` (CRITICAL / P0 — Security) [FIXED]:** `worker/src/tree/loyalty/phone-auth-handler.ts:71-122` đã xác thực cryptographic Bearer JWT (`verifyJWT` + check `revoked:`) hoặc one-time OTP trong `AUTH_KV` (`phone_otp:${phone}`) bằng `timingSafeEqualString`.
  2. **`AUTH-02` (HIGH / P1 — Security) [FIXED]:** `worker/src/tree/auth/reset-password.ts:24-28` và `worker/src/routes/auth-verify.ts:37` đã chuyển sang so sánh constant-time `timingSafeEqualString`.
  3. **`AUTH-03` (MEDIUM / P2 — Performance/Security) [FIXED]:** `worker/src/tree/auth/login.ts:26-59` đã bổ sung khóa rate-limit theo `email` (`rl:login:email:${email}`, 10 lần sai / 300s) và chuẩn hóa IP `x-forwarded-for` trong `auth-endpoints.ts:24-25`.
  4. **`AUTH-04` (MEDIUM / P2 — Architecture) [FIXED]:** `src/pages/mobile/mobile-login.tsx:205-208` đã bỏ ghi tay 5 key `localStorage` trùng lặp và ủy quyền qua `useMobileAuth().login`.
  5. **`AUTH-05` (LOW / P3 — Performance) [FIXED]:** `findExistingOwner` (`worker/src/tree/auth/helpers.ts:15-59`) đã giới hạn quét fallback `AUTH_KV` ở 1 trang (`limit: 100`) khi D1 `users` truy vấn thành công.

## Unresolved Questions
- None.
