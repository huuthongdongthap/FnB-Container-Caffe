# Báo Cáo Hoàn Thiện Go-Live Vận Hành Thực Chiến Tại Quán (Store Operations Readiness)

- **Ngày thực hiện:** `2026-11-18` (`Asia/Saigon`, `+07:00`)
- **Nhánh làm việc:** `feat/fnb-reporting-remediation-and-ops-hardening-261118`
- **Trạng thái kiểm định:** `567/567` test suites (`5,688/5,688` tests) PASS dưới `TZ=UTC`; `lint:migrations`, `typecheck:all`, `eslint --max-warnings=0`, và `vite build` đạt 0 lỗi / 0 cảnh báo.

## Kết Quả Chính

Hệ thống **AURA SPACE — Container Caffe** đã hoàn tất rà soát và khóa chặt toàn bộ 5 mắt xích vận hành tiền mặt, điểm thưởng, kế toán lãi lỗ BOM, giao diện quản trị và hạ tầng CI/CD để sẵn sàng vận hành thực tế tại quán.

### 1. Sổ Cái Điểm Thưởng & Đổi Điểm Trực Tiếp Lúc Thanh Toán (Loyalty Checkout & Refund Loop)
- Cho phép khách hàng đổi điểm trực tiếp trong payload đặt món (`redeem_points` tại `worker/src/lib/validators/order.ts` và `packages/domain/order/commands/create-order.ts`), quy đổi `1 điểm = 100₫`, khóa trần tối đa `50%` tạm tính đơn hàng và trừ nguyên tử trong D1 (`WHERE loyalty_points >= ?`) để chống chi tiêu kép (double-spend).
- Ghi nhận bút toán âm vào `loyalty_transactions` (`type = 'redeem'`) ngay khi khóa đơn, hoàn trả điểm tự động nếu batch lưu đơn gặp sự cố.
- Hoàn trả đầy đủ điểm đã đổi (`refund_redeem`) và thu hồi điểm đã cộng (`reversal_earn`) một cách idempotent khi đơn hàng chuyển sang `cancelled` hoặc `refunded` trong `packages/domain/order/commands/update-order.ts`.

### 2. Chốt Ca & Đối Soát Két Tiền Mặt Bật Mặc Định (Shift Cash Reconciliation)
- Bật mặc định tính năng chốt két tiền mặt cuối ca (`ENABLE_SHIFT_CASH_RECONCILIATION = "true"` tại `worker/wrangler.toml`), đồng thời chuẩn hóa cờ đọc trong `packages/domain/shift/src/routes/reconciliation.ts` và `worker/src/routes/shift-reconciliation.ts` để chỉ tắt khi cấu hình tường minh `'false'` hoặc `'0'`.
- Hỗ trợ linh hoạt cả định dạng mảng mệnh giá trực tiếp lẫn object `{ denominations: [...] }` khi thu ngân gửi biên bản kiểm tiền cuối ca.

### 3. Báo Cáo Lãi Lỗ BOM (P&L) & Đồng Bộ Múi Giờ Việt Nam (`+07:00`)
- Bổ sung handler kế toán lãi lỗ `GET /api/reports/pnl` (`worker/src/routes/reports-handlers/pnl-handlers.ts`, đăng ký tại `worker/src/routes/reports-handlers/routes.ts`), bóc tách đầy đủ: `gross_sales`, `total_discounts`, `net_sales`, `estimated_cogs` (tính từ định mức nguyên liệu `recipe_ingredients × unit_cost`), `gross_profit`, `gross_margin_pct`, `shipping_collected`, và `tips_collected`.
- Đồng bộ toàn bộ truy vấn ngày của báo cáo chốt ca `GET /api/reports/reconciliation` (`worker/src/routes/reports-handlers/reconciliation-handlers.ts`) sang `DATE(created_at, '+7 hours')` và lọc nghiêm ngặt các đơn hủy/hoàn/lỗi thông qua `VALID_REVENUE_ORDER_SQL` để đơn ca tối sau `17:00 UTC` (`00:00+ ICT` hôm sau nếu lệch UTC, hoặc `22:30 ICT` tối hôm trước) luôn rơi đúng vào ngày bán hàng tại Việt Nam.
- Bổ sung bảo vệ chống CSV Formula Injection (`=`, `+`, `-`, `@`, tab, CR) tại cả `worker/src/tree/analytics/csv-export.ts` và `worker/src/routes/reports-handlers/export-handlers.ts`.

### 4. Hoàn Thiện Giao Diện Quản Trị Doanh Thu & Nhượng Quyền (Admin UI Wiring)
- Xây dựng mới hai trang quản trị `src/pages/admin/RevenueAccounting.tsx` (`/admin/revenue-accounting`) và `src/pages/admin/FranchiseReports.tsx` (`/admin/franchise`), kết nối trực tiếp tới `/api/reports/pnl`, `/api/reports/reconciliation`, `/api/franchise/overview` và `/api/franchise/royalties`.
- Gắn lazy routes trong `src/routes/admin-routes.tsx` và mở khóa mục điều hướng trên thanh bên `src/components/stitch/StitchAdminTerminalNew-constants.ts`.
- Sửa lỗi phân giải cấu trúc JSON `{ success: true, data: ... }` trong `src/hooks/use-analytics-data.ts` và `src/pages/admin/Dashboard-hooks.ts` để biểu đồ Admin hiển thị chính xác dữ liệu thật từ Worker.

### 5. Khóa Chặt Bảo Mật Đăng Nhập, Vệ Sinh Repo & Cổng CI/CD
- Nối middleware `loginRateLimit()` (`5` lần sai / `5` phút / IP, fail-closed `503` khi KV lỗi đọc trên môi trường production) vào `POST /api/auth/login`, đồng thời duy trì khả năng xoay vòng mật khẩu khẩn cấp trên `POST /api/auth/change-password` ngay cả khi KV hết hạn mức ghi (`worker/src/middleware/rate-limit-login.ts`, `worker/src/routes/auth-endpoints.ts`).
- Nâng cấp `.github/workflows/ci.yml` để chạy `npm run lint:migrations`, `npm run typecheck:all`, khóa múi giờ `TZ: UTC`, thêm `CODECOV_TOKEN` kèm `continue-on-error: true`, và bổ sung job Playwright E2E smoke.
- Loại bỏ UUID canary cứng nguy hiểm trong `.github/workflows/deploy.yml` (bắt buộc truyền `baseline_version_id` hợp lệ khi canary/rollback), thêm `.nvmrc` (`22`), và dọn sạch symlink đứt `.codex` cùng các script tạm ở thư mục gốc.

## Bằng Chứng Kiểm Định (Verification Gates)

| Cổng kiểm tra | Lệnh thực thi | Kết quả |
|---|---|---|
| D1 Migration Lint & 3-Way Schema Sync | `npm run lint:migrations` | PASS (`85` forward, `16` down migrations across 4 dirs) |
| TypeScript Strict Check (3 projects) | `npm run typecheck:all` | PASS (`0` errors trên `src`, `worker`, `setup/aura-deploy`) |
| ESLint Zero-Warning Gate | `npm run lint` | PASS (`0` errors, `0` warnings) |
| Production Bundle Build | `npm run build` | PASS (`2,670` modules bundled cleanly) |
| Go-Live Timezone Matrix | `TZ=UTC` & `TZ=Asia/Saigon` trên suite Go-Live | PASS (`28/28` tests dưới `UTC` & `ICT`) |
| Full Repository Regression Suite | `TZ=UTC npx vitest run` | PASS (`567/567` files, `5,688/5,688` tests) |

## Câu Hỏi Chưa Giải Quyết (Unresolved Questions)

- Tên miền API tùy chỉnh (ví dụ `api.auraspace.cafe`) đã sẵn sàng chứng chỉ trên Cloudflare Zone chưa để chuyển tiếp khỏi miền mặc định `aura-space-worker.sadec-marketing-hub.workers.dev` trong `_redirects` và `src/lib/api-client.ts`?
- Đội vận hành có muốn đóng tag phát hành mới (ví dụ `v2.3.0`) sau khi gộp nhánh này vào `main` để đồng bộ với cột mốc Go-Live tháng 11/2026 không?
