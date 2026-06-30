# Code Review — SMTP Email Giao Dịch
**Ngày:** 2026-06-30 | **Severity tổng:** CAO (3 HIGH, không CRITICAL)
**Test:** 877 passed (845 cũ + 14 mới + 18 skipped) — KHÔNG regression

## Acceptance Criteria — VERDICT

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| AC1 | Email xác nhận sau POST /api/orders (non-blocking) | PASS |
| AC2 | Email receipt sau PayOS webhook completed (non-blocking) | PASS |
| AC3 | Templates: tiếng Việt, AURA CAFE branding | PASS |
| AC4 | Email failure KHÔNG block order flow | PASS |
| AC5 | Toàn bộ 845+ tests vẫn pass | PASS (877 total) |
| AC6 | 14 tests mới: parse, render, error handling | PASS |

## Business Logic — KHÔNG Regression

- `orders.js`: notifyTelegram KHÔNG đổi, email thêm sau order creation ✓
- `webhooks.js`: PayOS handler logic KHÔNG đổi, email thêm sau payment confirm ✓
- `odoo-invoices.js`: sendInvoiceEmail stub → SendGrid thật ✓
- API schemas, DB schemas KHÔNG thay đổi ✓
- Public contracts giữ nguyên ✓

## Findings

### HIGH
1. **`odoo-invoices.js:185` — `env.EXECUTION_CTX?.waitOnly` double-bug**
   - `waitOnly` là typo, phải là `waitUntil`
   - `EXECUTION_CTX` không tồn tại trên `env` (là `c.executionCtx` bên Hono)
   - `waitUntil` không bao giờ được gọi → email invoice có thể bị CF Workers terminate sớm
   - Fix: truyền `ctx` hoặc `c.executionCtx` vào `sendInvoiceEmail`, dùng `ctx.waitUntil()`

2. **`sendInvoiceEmail` gọi 4 args nhưng nhận 2 param `(env, order)`**
   - `result` (PDF URL, invoice number) và `pdfResult` bị bỏ qua
   - Template email cứng HTML, KHÔNG có link PDF thực → tích hợp chưa hoàn chỉnh
   - Fix: cập nhật signature thành `(env, order, result, pdfResult)`, chèn link PDF

3. **`renderWelcome` XSS — `customer.name` không escape**
   - `welcome.js:27`: nội suy trực tiếp `${customer.name}` vào HTML
   - Tên khách chứa `<script>alert(1)</script>` → thực thi trong email client
   - Fix: dùng hàm escape HTML hoặc `textContent` tương đương

### MEDIUM
4. **`welcome.js` — dead code, 0 call sites**
   - `renderWelcome` không được import ở bất kỳ route nào → template vô dụng
   - Nên thêm vào flow đăng ký hoặc xóa file nếu chưa dùng

5. **`email.js` không có request timeout**
   - `notifyTelegram` dùng `AbortSignal.timeout(5000)` nhưng `sendEmail` không
   - Nếu SendGrid API treo → fetch block vô hạn
   - Fix: thêm `signal: AbortSignal.timeout(10000)` vào fetch options

6. **`orders.js:1` — `/* eslint-disable no-console */` dư thừa**
   - File đã migrate sang logger, không còn `console.*` → directive stale
   - Fix: xóa dòng 1

### LOW
7. `odoo-invoices.js:373` — `catch (_)` warning unused param → dùng `catch {}`
8. Template `order-confirm.js` không escape `i.name` — rủi ro thấp (từ DB menu)
9. Không validate format `customer_email` trước khi gửi SendGrid

## Pattern Compliance

- Logger pattern (`createLogger`) ✓
- Non-blocking: `ctx.waitUntil()` / async IIFE ✓
- Error handling: log.error, never throw ✓
- Single quotes, ES modules ✓
- `.env.example` đã thêm `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` ✓

## Metrics

- ESLint: 0 errors, 2 warnings (low)
- Tests: 877 passed / 877 total
- New coverage: `sendEmail` 7 tests + templates 7 tests = 14 tests
