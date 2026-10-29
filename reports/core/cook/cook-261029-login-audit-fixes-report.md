# /cook + /fix — Báo cáo Khắc phục Toàn bộ Phát hiện Kiểm toán Đăng nhập (`AUTH-01` → `AUTH-05`)

- **Ngày thực hiện:** 2026-10-29
- **Baseline:** `HEAD 226a9b5` (`origin/main`)
- **Trạng thái:** **5/5 Findings Fixed & Verified (`186/186` tests PASS, `typecheck:all` PASS)**

## 1. Chi tiết Khắc phục (`AUTH-01` → `AUTH-05`)

| ID | Mức độ | File cập nhật | Nội dung khắc phục |
|---|---|---|---|
| **AUTH-01** | **CRITICAL (P0)** | `worker/src/tree/loyalty/phone-auth-handler.ts:71-122`<br>`worker/src/__tests__/tree/loyalty/phone-auth-handler.test.ts:374-438` | Loại bỏ tin tưởng mù quáng vào `body.otp_verified`, `body.otp` chưa đối chiếu và header `Authorization: Bearer` chưa verify. Bắt buộc xác minh cryptographic: (1) verify JWT qua `verifyJWT` + kiểm tra thu hồi `revoked:${token}` + đối chiếu chủ sở hữu `customer.id`/`customer.email` hoặc vai trò Staff, hoặc (2) đối chiếu one-time OTP trong `AUTH_KV` (`phone_otp:${phone}`) bằng `timingSafeEqualString` và xóa ngay sau khi khớp. |
| **AUTH-02** | **HIGH (P1)** | `worker/src/lib/jwt.ts:226-237,281-285`<br>`worker/src/tree/auth/reset-password.ts:24-28`<br>`worker/src/routes/auth-verify.ts:37` | Bổ sung hàm `timingSafeEqualString` so sánh constant-time trên mảng byte UTF-8 và áp dụng cho `X-Reset-Key` (`resetPassword`), mã xác thực email (`verifyEmail`), và kiểm tra mật khẩu (`verifyPassword`). |
| **AUTH-03** | **MEDIUM (P2)** | `worker/src/routes/auth-endpoints.ts:21-36`<br>`worker/src/tree/auth/login.ts:26-59,98-104` | Chuẩn hóa trích xuất IP đầu tiên từ `x-forwarded-for` trong `authRateLimit` và bổ sung khóa rate-limit theo email chuẩn hóa (`rl:login:email:${email}`, chặn `429` khi `>= 10` lần sai mật khẩu trong 300s, tự xóa khi đăng nhập đúng) để chặn brute-force xoay IP. |
| **AUTH-04** | **MEDIUM (P2)** | `src/pages/mobile/mobile-login.tsx:205-208` | Xóa bỏ 5 lệnh ghi `localStorage.setItem` thủ công trùng lặp trong `MobileLogin`, ủy quyền lưu trữ phiên thống nhất qua `await login(data.token, staffProfile)` (`saveClientSession`). |
| **AUTH-05** | **LOW (P3)** | `worker/src/tree/auth/helpers.ts:15-59` | Khi `AURA_DB` truy vấn bảng `users` thành công và xác nhận chưa có `owner`, giới hạn quét fallback `AUTH_KV` ở tối đa `1` trang (`limit: 100`) thay vì `20 × 1.000` keys để chống cạn kiệt subrequest trên Cloudflare Worker. |

## 2. Kết quả Kiểm chứng (Verification)

- **Unit & Integration Auth/Loyalty/Session Suites (12 files):** `183/183 PASS` (bao gồm 4 bài test mới chặn bypass `otp_verified: true`, `otp` giả, `Bearer` giả và xác thực `phone_otp` hợp lệ trong `phone-auth-handler.test.ts`).
- **Login Security Audit Probes (`LOGIN-01`, `LOGIN-02`, `LOGIN-03`):** `3/3 PASS`.
- **Typecheck toàn dự án (`npm run typecheck:all`):** `0 errors` (`PASS`).

## Unresolved Questions
- None.
