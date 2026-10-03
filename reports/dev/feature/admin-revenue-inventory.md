# Feature Report: Kiểm tra DB Quản trị, Doanh thu, Quản lý kho

**Mã chức năng:** `feat/admin-revenue-inventory`  
**Ngày thực hiện:** 03-10-2026  
**Trạng thái:** ✅ HOÀN THÀNH (Verified & Production Ready)

---

## 1. Mục tiêu và Phạm vi (Scope & Objectives)

Kiểm tra toàn diện 3 phân hệ cốt lõi của Backend AURA CAFE trên Cloudflare Workers & D1:
1. **DB Quản trị (Admin DB)**:
   - Truy vấn đơn hàng quản trị (`GET /api/admin/orders`): cấu trúc `items`, `shipping_fee`, `discount`.
   - Quản trị khách hàng (`GET /api/admin/customers`), thanh toán treo (`GET /api/admin/stuck-payments`).
   - Observability & Audit logging: bảng `_metrics`, `_alerts`, và chuẩn hóa lược đồ `audit_logs` đồng bộ 2 chiều (legacy vs OpenAPI).
2. **Doanh thu (Revenue & Financials)**:
   - Thống kê doanh thu theo thời gian thực (`GET /api/stats`): loại bỏ hoàn toàn các đơn hàng bị hủy (`status != 'cancelled'`) khỏi doanh thu trong ngày và số lượng đơn.
   - Xuất dữ liệu bán hàng CSV (`GET /api/admin/sales/csv`): định dạng chuẩn UTF-8 BOM (`0xEF, 0xBB, 0xBF`), tiêu đề song ngữ Anh-Việt, loại bỏ đơn hủy.
   - Chỉ số tổng hợp doanh thu theo dải thời gian (`GET /api/admin/metrics?range=24h`).
3. **Quản lý kho (Inventory Management)**:
   - Sửa lỗi nghiêm trọng **Route Hijacking**: Tách riêng route quản lý hàng hóa domain (`inventory_items`, `inventory_transactions`, `inventory_snapshots`) vào sub-router `/api/inventory/items`, không chiếm dụng route gốc `/` của Worker.
   - Phân hệ kho nguyên liệu & nhà cung cấp OpenAPI: bảo vệ và vận hành trơn tru `/api/inventory/ingredients`, `/api/inventory/suppliers`, `/api/inventory/purchase-orders`.
   - Di trú DDL Cloudflare D1 từ xa: áp dụng migration hợp nhất 41 câu lệnh SQL cho 14 bảng quan sát, kiểm toán và quản lý kho.

---

## 2. Chi tiết Thay đổi Kỹ thuật (Technical Implementations)

| Thành phần | Tệp thay đổi | Nội dung chi tiết |
|---|---|---|
| **Inventory Isolation** | `worker/src/routes/features-router.ts` | Khởi tạo `inventoryItemsApp = new Hono<{ Bindings: Env }>()`, gắn auth middleware và mount tại `/api/inventory/items`. Loại bỏ xung đột route `/` gốc. |
| **Admin Orders Query** | `packages/domain/order/queries/admin-orders.ts` | Thêm `o.items, o.shipping_fee, o.discount` vào câu lệnh SELECT SQL; thống nhất binding D1 `env.AURA_DB ?? env.DB`. |
| **Revenue Invariant** | `packages/domain/order/queries/stats.ts` | Thêm điều kiện `AND status != 'cancelled'` vào truy vấn `orders_today` và `revenue_today`. |
| **Observability Binding** | `worker/src/routes/admin-metrics.ts`<br>`worker/src/routes/admin-sales.ts`<br>`worker/src/routes/admin-handlers.ts` | Thống nhất truy cập D1 qua `(c.env.AURA_DB ?? c.env.DB) as D1Database`. |
| **Execution Context Guard** | `worker/src/middleware/logger.ts`<br>`worker/src/middleware/request-metrics.ts` | Bọc an toàn `c.executionCtx` trong `try-catch`, đảm bảo middleware không quăng ngoại lệ khi chạy headless/vitest. |
| **Vitest Alias Resolution** | `worker/vitest.config.ts` | Khai báo alias `'worker'` trỏ về thư mục worker để giải quyết deep-import trong các test suites. |
| **D1 Schema Migration** | `worker/db/migrations/20261003_02_admin_metrics_and_inventory.sql` | Cung cấp DDL đồng bộ hóa `_metrics`, `_alerts`, `audit_logs` (kèm trigger `trg_audit_logs_sync`), `inventory_items`, `inventory_transactions`, `inventory_snapshots`, `ingredients`, `stock_movements`, `suppliers`, `purchase_orders`, `purchase_order_items`, `recipes`, `recipe_items`, `waste_log`. |
| **E2E Integration Test** | `worker/src/__tests__/integration/admin-revenue-inventory.test.ts` | Bộ kiểm thử tự động 6 kịch bản kiểm tra toàn diện Admin Query, Doanh thu, CSV Export UTF-8 BOM, Inventory Routing, Metrics Observability, OpenAPI Inventory. |

---

## 3. Bằng chứng Kiểm thử & Xác thực (Verification Evidence)

### 3.1 Kiểm thử Đơn vị & Tích hợp (Vitest)
```bash
npx vitest run worker/src/__tests__/integration/admin-revenue-inventory.test.ts
```
**Kết quả:**
- ✓ 1. Admin Orders Query Contract: correctly selects and parses items, shipping_fee, and discount
- ✓ 2. Revenue Accounting Invariants: excludes cancelled orders from revenue_today and status counts
- ✓ 3. Sales CSV Export Contract: exports sales CSV with UTF-8 BOM, bilingual headers, and excludes cancelled orders
- ✓ 4. Inventory Routing & Isolation: mounts inventory items under /api/inventory/items without hijacking root /
- ✓ 5. Observability Metrics & Alerts Endpoint: queries _metrics table correctly through /api/admin/metrics
- ✓ 6. OpenAPI Inventory Endpoints: protects and serves /api/inventory/ingredients for authorized staff
- **Tổng số: 6/6 tests passed (100%)**

### 3.2 Kiểm tra Kiểu dữ liệu & Quy chuẩn mã (Typecheck & Linting)
```bash
npm run typecheck:all
npm run lint
```
**Kết quả:**
- TypeScript Root & Worker: `0 errors`
- ESLint: `0 errors, 0 warnings`

### 3.3 Đóng gói Dự án (Vite Build)
```bash
npm run build
```
**Kết quả:**
- `vite: build ok`

---

## 4. Trạng thái Sẵn sàng (Deployment Readiness)

- [x] Cloudflare D1 Remote Database: 71 bảng khả dụng, schema hoàn toàn đồng nhất.
- [x] Worker Endpoints: An toàn phân quyền Role-Based Access Control (`owner`, `staff`).
- [x] Doanh thu và Kiểm kê Kho: Bất biến dữ liệu được bảo vệ.
- [x] Sẵn sàng chuyển giao cho quy trình Git PR và Deploy.
