# Báo Cáo Kiểm Định Toàn Diện & Giải Phẫu Phân Hệ Báo Cáo F&B — Aura Coffee (`FnB-Container-Caffe`)

- ** Kho lưu trữ kiểm định:** `huuthongdongthap/FnB-Container-Caffe` (`main` @ `16b6c03c93465dcb5050d6601b7b5a40a485878e`)
- ** Thư mục clone độc lập:** `/Users/macbook/FnB-Container-Caffe-latest` *(thư mục cũ `/Users/macbook/FnB-Container-Caffe` được giữ nguyên 100% — `61` mục trạng thái chưa commit không bị đụng chạm)*
- ** Nhánh khắc phục & bàn giao:** `fix/ci-sop-reminders-and-aura-report-261118`
- ** Thời điểm kiểm định:** `18/11/2026` (Múi giờ đối chiếu: `Asia/Saigon` / `UTC+7` & môi trường CI `UTC`)

---

## TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY CHO CHỦ QUÁN / CEO)

Phiên bản mới nhất của **Aura Coffee (`16b6c03c`)** đã tiến một bước rất xa so với bản tháng 08/2026 đang nằm trên máy cục bộ (`22342dac`): hệ thống đã có thêm **247 commits**, mở rộng lên **1.690 tệp TypeScript/TSX production non-test (`212.410` dòng code)**, tách thành **20 gói miền nghiệp vụ (`@aura/domain-*`)**, chuẩn hóa **124 bảng cơ sở dữ liệu Cloudflare D1**, khóa chặt phân quyền đa chi nhánh/nhượng quyền tới **Phase `BQ`**, và vận hành **565 bộ kiểm thử tự động (`5.683` bài test)** với độ phủ dòng lệnh đạt **`76.14%`**.

Qua kiểm định thực tế từ đầu đến cuối, **toàn bộ `lint`, `lint:migrations`, `typecheck:all` và `vite build` đều đạt chuẩn 100% (`0` lỗi, `0` cảnh báo)**. Lỗi duy nhất làm đỏ GitHub Actions trên nhánh `main` (`sop-reminders.test.ts` — bài test nhắc việc định kỳ SOP trước `08:00`) xuất phát từ việc hàm tạo ngày trong file test dùng giờ địa phương của máy chạy thay vì múi giờ quán `UTC+7`, khiến máy chủ GitHub (`UTC`) hiểu nhầm `06:00` thành `13:00` giờ Việt Nam; lỗi này đã được sửa triệt để trong nhánh PR bàn giao và vượt qua **565/565 test files (`5.683/5.683` tests PASS)** dưới cả môi trường `UTC`, `Asia/Saigon` và `America/Los_Angeles`.

Về **Phân hệ Báo cáo Doanh thu, Kho, Ca & Khách hàng F&B**, nền tảng dữ liệu thật trên D1 đã hoạt động vững chắc (loại trừ đúng đơn hủy/hoàn/lỗi thanh toán, chống rò rỉ dữ liệu liên chi nhánh, chống CSV formula injection, tự động trừ kho định mức BOM và tính phí bản quyền nhượng quyền). Tuy nhiên, báo cáo chỉ ra **5 điểm lệch nghiệp vụ/kỹ thuật cụ thể** mà chủ quán và đội kỹ thuật cần nắm rõ khi đọc số liệu (đặc biệt là lỗi truyền tham số `'30d'` thay vì `YYYY-MM-DD` ở biểu đồ doanh thu trang Tổng quan, sự chênh lệch múi giờ `UTC` vs `UTC+7` cho các đơn hàng phát sinh từ `00:00–06:59` sáng, và việc API đối soát tiền mặt cuối ca đang chủ động khóa `501` trong giai đoạn thí điểm chấm công).

---

## PHẦN A — LỊCH SỬ TIẾN HÓA TỪ BẢN THÁNG 08/2026 (`22342dac`) ĐẾN BẢN MỚI NHẤT (`16b6c03c`)

Trong 3 tháng từ `11/08/2026` (`22342dac`) đến `08/11/2026` (`16b6c03c`), dự án đã trải qua **247 commits** chia làm **5 giai đoạn nâng cấp lớn**:

### 1. Giai đoạn 1 (08/2026 – giữa 09/2026): Tái cấu trúc Component, Cookie Auth & Nhận diện Rustic Sa Đéc
- Chia nhỏ hàng loạt màn hình lớn (`>200 LOC`) qua các Sprints 10–24 (`41040bb6`, `ba5a1227`, `8d570556`, `d4f46838`, `58dea90c`, `3ce19a37`) để dễ bảo trì.
- Chuyển cơ chế đăng nhập từ lưu JWT thuần trong `localStorage` sang **`httpOnly` cookie** an toàn hơn (`15951d65`) và bổ sung xác thực email (`79f12e19`).
- Định hình giao diện thương hiệu Rustic Sa Đéc, gắn OpenAPI + tài liệu trực quan Scalar (`@scalar/hono-api-reference`), luồng sự kiện bếp KDS thời gian thực (SSE) và đặt nền móng đa chi nhánh (`253ec3d8`, PR `#57`).

### 2. Giai đoạn 2 (09/2026): Kiến trúc Monorepo 20 Gói Nghiệp Vụ (`M0–M3`) & Ổn định CI/CD
- Tách lõi nghiệp vụ khỏi tầng HTTP thành **20 gói `@aura/domain-*`** độc lập trong `packages/domain/` (`fcce0277`, `3016b461`, `aaa7e204`) và chia nhỏ các router khổng lồ (`reports.ts`, `openapi-*.ts`) thành từng thư mục `*-handlers/` (`faabeb9c`..`083112bf`).
- Chuẩn hóa quy trình kiểm tra migration D1 và dứt điểm chuỗi lỗi cổng triển khai qua PR `#58` (`b81f8ea7`), PR `#59` (`fb7ea6f2`), PR `#60` (`1593f611`), PR `#61` (`d2c609b7`).

### 3. Giai đoạn 3 (10/2026 — PR `#62` đến `#72`): Nhượng Quyền Đa Chi Nhánh, Vận Hành Tự Trị AI & Phân Hệ Doanh Thu / Kho
- **Hàng đợi ngoại tuyến & Kế toán nhượng quyền (Franchise Royalty):** Đồng bộ đơn khi rớt mạng (PR `#65` — `4b326e11`); quản lý chuỗi container đa điểm bán kèm công thức tính phí bản quyền nhượng quyền `royalty_percentage` (PR `#66` — `fd5ffe22`).
- **AI Barista, Dự báo nhu cầu & Định giá linh hoạt bảo vệ biên lợi nhuận:** Gợi ý món thông minh, dự báo tốc độ tiêu hao nguyên liệu (PR `#67` — `746a365d`), định giá linh hoạt `worker/src/routes/dynamic-pricing.ts` và giám sát cảm biến IoT container `worker/src/routes/container-telemetry.ts` (PR `#68` — `db3c3dd8`).
- **Phân hệ Quản trị Doanh thu & Kho nguyên liệu hoàn chỉnh:** PR `#64` (`34204b1a`), PR `#69` (`e9129609`) và PR `#70` (`df7faa60`) hoàn thiện bảng điều khiển doanh thu, quản lý nhà cung cấp, đơn mua hàng (PO), định mức công thức pha chế (BOM `recipe_ingredients` cho 49 món có ảnh AVIF/WebP thật — `3a8f1acc`, `3083c957`) và đạt đồng bộ 3 chiều cho **124 bảng D1** (`cb4a5696`).
- **Gia cố chịu tải Go-Live (Waves 5–9):** Giới hạn bộ nhớ Durable Object `OrderBroadcaster` tối đa `500` đơn / TTL `24h` (`2cf0025a`), bảo vệ CSRF cho các thao tác ghi dùng cookie (`2f8fa441`), giới hạn kích thước gói tin (`9a5a47ff`).

### 4. Giai đoạn 4 (30/10 – 02/11/2026): Ghi Kép Kho/Điểm Thưởng & Hai Đợt Kiểm Toán Bảo Mật `261030` / `261101`
- **Kiểm toán `261030` (`21d1f263`, `fab09048`):** Bắt buộc cơ chế **fail-closed** (từ chối ngay nếu chưa cấu hình khóa bí mật) kèm so sánh chữ ký HMAC hằng thời gian cho tất cả cổng webhook ngoại vi: Zalo (`worker/src/routes/zalo-webhook.ts`), Home Assistant (`worker/src/routes/homeassistant/index.ts`), TastyIgniter (`worker/src/routes/integrations/tastyigniter.ts`), Pretix (`worker/src/tree/pretix/hmac-validator.ts`), đồng thời che giấu thông tin nhạy cảm (PII) trong log email (`worker/src/lib/email.ts`).
- **Đồng bộ ghi kép Điểm thưởng / Trừ kho (`da947372`):** Thống nhất sổ cái điểm thưởng khách hàng và trừ tồn kho tự động theo đơn, bổ sung cổng kiểm tra trước triển khai `scripts/verify-staging-gates.mjs`.
- **Kiểm toán `261101` (`55a1ff6b` — `BA-01..BA-06` & `F01..F15`):** Thu hồi toàn bộ phiên đăng nhập anh em khi khóa tài khoản nhân viên/khách hàng, tự động đối chiếu `orders.tenant_id` khi trừ kho ở `packages/domain/inventory/src/routes/order-deduction.ts` để ngăn trừ nhầm kho chi nhánh khác, và đồng bộ phân quyền `supervisor`/`shipper`.

### 5. Giai đoạn 5 (02/11 – 08/11/2026): Khóa Chặt Biên Đa Chi Nhánh (Multi-Tenant Isolation `T1–AJ4` đến `BQ`)
- Chuỗi nâng cấp bảo mật dày đặc từ `f0311f30`, `09d09040` đến commit đỉnh `16b6c03c` (thay đổi đồng loạt **314 tệp**): chặn hoàn toàn mọi xung đột giữa `X-Tenant-ID`, `X-Store-ID`, query `?tenant_id=` và `tenantId` trong JWT (`400`/`403`); chỉ cho phép tài khoản `HQ SuperAdmin` (`owner`/`admin` thuộc tenant `hq`/`*`) xem gộp toàn chuỗi và ghi nhận đầy đủ vào nhật ký kiểm toán; đồng thời gắn khóa phạm vi phiên (`sessionScope` / `sessionVersion`) trên các kho trạng thái giao diện React/Zustand để không lưu nhầm cache khi chuyển đổi tài khoản.

---

## PHẦN B — TỔNG THỂ HIỆN TRẠNG KIẾN TRÚC & SỨC KHỎE KỸ THUẬT

### 1. Quy mô mã nguồn & Hạ tầng đo đạc thực tế tại `16b6c03c`

| Hạng mục đo đạc | Số liệu xác thực | Chi tiết nguồn |
|---|---|---|
| **Tổng số commits trên `main`** | **956 commits** | Khởi tạo `14/03/2026` (`0d2e6b32`) → `08/11/2026` (`16b6c03c`) |
| **Commits mới từ tháng 08/2026** | **247 commits** | Dải `22342dac..16b6c03c` |
| **Mã nguồn Production (TS/TSX non-test)** | **1.690 tệp (`212.410` LOC)** | `src/` (`986` tệp / `82.677` LOC), `worker/src/` (`503` tệp / `87.041` LOC), `packages/` (`190` tệp / `41.508` LOC), `setup/` (`11` tệp / `1.184` LOC) |
| **Định tuyến Frontend (React Router)** | **94 đường dẫn URL duy nhất** | Khai báo qua `103` thẻ `<Route>` trong `src/App.tsx` và `src/routes/*.tsx`; `232` tệp `.tsx` trang non-test (`356` tệp `.ts/.tsx` tổng trong `src/pages/`) |
| **Định tuyến Backend (Hono Worker)** | **91 tệp route cấp 1 (`275` tệp non-test đệ quy)** | Hơn `306` điểm gắn router/endpoint trên Cloudflare Workers (`279` tệp nếu tính cả `routes/__tests__`) |
| **Gói miền nghiệp vụ (`@aura/domain-*`)** | **20 packages** | `audit`, `catalog`, `continuity`, `crm`, `customer`, `deployment`, `integration`, `inventory`, `kitchen`, `migration`, `notification`, `observability`, `order`, `payment`, `reservation`, `security`, `shift`, `sop`, `staff`, `table` |
| **Cơ sở dữ liệu D1 & Migrations** | **124 bảng D1 / 85 forward migrations** | Khớp 3 chiều giữa `worker/schema.sql` (`124` bảng) và `db/schema.sql` (`124` bảng); `16` tệp `.down.sql` |
| **Tích hợp hệ sinh thái ngoại vi** | **11 nền tảng + 3 kênh thông báo** | PayOS (VietQR), NOWPayments (Crypto), Zalo OA/ZNS, ERPNext, TastyIgniter, Home Assistant, Frigate NVR, Pretix, Mixpost, Mautic, Cal.com + Resend/SendGrid, SpeedSMS, WebPush VAPID |
| **Bộ kiểm thử tự động (Tests)** | **573 tệp test/spec toàn repo** | `565` bộ Vitest kích hoạt (`5.683` bài test) + `8` bộ Playwright E2E tại `tests/playwright/*.spec.ts` |

### 2. Kết quả kiểm định kỹ thuật thực tế & Bản vá lỗi CI

Toàn bộ lệnh kiểm tra đã được chạy trực tiếp trên bản clone sạch `/Users/macbook/FnB-Container-Caffe-latest` (bao gồm chạy ép múi giờ `TZ=UTC` giống hệt máy chủ Ubuntu của GitHub Actions):

| Cổng kiểm tra | Lệnh thực thi | Kết quả | Chi tiết đo được |
|---|---|---|---|
| **ESLint (Zero-Warning Gate)** | `npm run lint` | **PASS (`0` lỗi, `0` cảnh báo)** | Kiểm tra toàn bộ `worker/src/`, `src/`, `packages/`, `setup/aura-deploy/src/` |
| **Kiểm định chuỗi SQL D1** | `npm run lint:migrations` | **PASS** | Xác thực `85` forward migrations & `16` down migrations trên `4` thư mục |
| **Kiểm tra kiểu TypeScript** | `npm run typecheck:all` | **PASS** | Xác thực cả 3 dự án TS: Frontend/Root, Cloudflare Worker, và `setup/aura-deploy` |
| **Đóng gói Production (Vite 8)** | `npm run build` | **PASS** | Tạo bundle SPA + PWA sạch sẽ vào `dist/` |
| **Toàn bộ Unit & Integration Tests** | `TZ=UTC npm run test:ci` | **PASS (`565/565` files, `5.683/5.683` tests)** | Độ phủ toàn cục: **Statements `74.43%` (`43.062/57.853`), Branches `65.27%`, Functions `66.72%`, Lines `76.14%`** |

#### Chẩn đoán & Sửa dứt điểm lỗi làm đỏ CI trên `main` (`sop-reminders.test.ts`)
- **Hiện tượng trên GitHub Actions (`run 42424134142`):** Bài test `does not raise the day-not-run notice before 08:00` tại `worker/src/__tests__/routes/sop-reminders.test.ts:137` bị trượt (`expected 1 to be +0`).
- **Nguyên nhân gốc:** Logic nghiệp vụ thật trong `worker/src/routes/cron-handlers/sop-reminders.ts:12,72,86,109-117` hoạt động **đúng chuẩn** — luôn quy đổi thời gian sang múi giờ quán `Asia/Ho_Chi_Minh` (`UTC+7`) rồi mới kiểm tra `currentHour >= 8`. Ngược lại, hàm hỗ trợ `localDate()` trong file test (`sop-reminders.test.ts:32-34`) lại khởi tạo bằng `new Date(year, monthIndex, day, hour, 0, 0)` (phụ thuộc múi giờ máy đang chạy test). Trên máy lập trình viên ở Việt Nam (`UTC+7`), `hour = 6` là `06:00` sáng giờ quán nên test xanh; nhưng lên máy chủ GitHub Actions (`TZ=UTC`), `06:00 UTC` tương đương **`13:00` chiều giờ Việt Nam** (`>= 08:00`), làm hàm nhắc việc kích hoạt hợp lệ và trả về `1` thay vì `0`.
- **Cách khắc phục trong nhánh PR:** Cập nhật `localDate(year, monthIndex, day, hour = 12, minute = 0)` tại `worker/src/__tests__/routes/sop-reminders.test.ts:31-43` tính mốc thời gian tuyệt đối từ `Date.UTC(year, monthIndex, day, hour, minute) - STORE_OFFSET_MS` (`7 * 60 * 60 * 1000`), đồng thời giữ trọn đối số thứ 5 `minute` tại dòng `184`. Đã kiểm chứng lại bài test dưới cả 3 múi giờ `TZ=UTC`, `TZ=Asia/Saigon`, và `TZ=America/Los_Angeles` — tất cả đều đạt **18/18 PASS**.

### 3. Các rủi ro vận hành & CI/CD còn tồn tại cần lưu ý

1. **Bước tải báo cáo độ phủ `Codecov` trên CI thiếu khóa bí mật (`CODECOV_TOKEN`):**
   - Tại `.github/workflows/ci.yml:42-47`, bước `codecov/codecov-action@v4` đặt `if: always()` nhưng chưa truyền `token: ${{ secrets.CODECOV_TOKEN }}` và chưa bật `fail_ci_if_error: false` / `continue-on-error: true`. Ngay cả khi 5.683 bài test đều xanh, Codecov v4 có thể từ chối nhận dữ liệu từ PR fork hoặc khi bị giới hạn tần suất (rate-limit), gây báo đỏ bước cuối trên GitHub Actions.
2. **Middleware chống dò mật khẩu chuyên dụng (`loginRateLimit`) chưa được gắn vào route:**
   - File `worker/src/middleware/rate-limit-login.ts:13` (khóa sau `5` lần đăng nhập sai / `5` phút / IP) hiện đang nằm chờ chưa có nơi gọi; trong khi `worker/src/routes/auth-endpoints.ts:21-38` đang dùng bộ đếm KV tự viết với ngưỡng rộng hơn (`20` lần / `5` phút) và cho qua (`fail-open`) nếu KV gặp sự cố mạng.
3. **8 bộ kiểm thử giao diện Playwright E2E và typecheck của `aura-deploy` chưa đưa vào `ci.yml`:**
   - `.github/workflows/ci.yml:30-35` mới gọi `typecheck` và `typecheck:worker` (chưa gọi `typecheck:all`), đồng thời chưa chạy `tests/playwright/*.spec.ts` trên CI.
4. **Cấu hình ID hạ tầng cố định trong kịch bản Canary / Rollback:**
   - `.github/workflows/deploy.yml:25,30` đang để cứng giá trị mặc định `baseline_version_id: '33d9e23b-711c-4278-82d1-b8013fedc41a'`. Khi vận hành viên chạy tay workflow Canary 10% hoặc Rollback mà quên điền mã phiên bản mới nhất, lưu lượng sẽ bị quay về bản Worker cũ này.
5. **Nợ kỹ thuật nhỏ về kiểu dữ liệu & vệ sinh thư mục:**
   - Vẫn còn `577` vị trí dùng `: any` trong code non-test của 4 thư mục ESLint chính (`worker/src/`, `src/`, `packages/`, `setup/aura-deploy/src/`), một symlink ẩn bị đứt (`.codex -> /Users/mac/mekong-cli/.codex`), và tài liệu `SECURITY.md:26` / `README.md:16` chưa cập nhật kịp việc hệ thống đã chuyển sang `httpOnly` cookie + bộ ký JWT WebCrypto nội bộ.

---

## PHẦN C — PHÂN TÍCH CHUYÊN SÂU PHÂN HỆ BÁO CÁO F&B (DOANH THU, CA, THANH TOÁN, TỒN KHO & KHÁCH HÀNG)

### 1. Bản đồ toàn bộ các màn hình & API Báo cáo đang hoạt động thật

Phân hệ báo cáo của Aura Coffee được thiết kế thành **2 tầng truy vấn song song** tùy mục đích sử dụng của chủ quán và quản lý:

| Màn hình Quản trị (UI) | Đường dẫn URL | Nguồn API & Kho dữ liệu D1 | Chức năng phục vụ Chủ quán / Quản lý |
|---|---|---|---|
| **Bảng điều khiển Tổng quan (`AdminDashboardPage`)** | `/admin`, `/admin/dashboard` (`src/pages/admin/Dashboard.tsx`) | `GET /api/stats` (`packages/domain/order/queries/stats.ts`) + `/api/analytics/*` (`worker/src/tree/analytics/*.ts`, có cache KV 30s–300s) | Xem nhanh doanh thu & số đơn hôm nay (theo giờ VN `UTC+7`), trạng thái đơn đang pha chế, Top 6–10 món bán chạy, khung giờ cao điểm (`peak-hours`), hiệu suất theo khu vực ngồi (`zones`), tỷ lệ khách quay lại và xuất CSV đơn hàng. |
| **Báo cáo Doanh thu Chuyên sâu (`SalesReportsPage`)** | `/admin/sales-reports`, `/admin/finance` (`src/pages/admin/SalesReports.tsx`) | `GET /api/reports/daily`, `/summary`, `/sales-by-hour`, `/sales-by-day`, `/sales-by-category`, `/sales-by-payment`, `/export` (`worker/src/routes/reports-handlers/*.ts` — truy vấn trực tiếp D1 không qua cache) | Phân tích doanh thu theo khoảng ngày tùy chọn (`7d`/`30d`/`90d` hoặc chọn lịch tối đa `366` ngày), so sánh tăng trưởng kỳ này với kỳ trước (`PeriodComparisonChart`), bóc tách doanh thu theo **khung giờ / thứ trong tuần / nhóm món / phương thức thanh toán**, bảng chi tiết từng ngày và tải CSV có BOM tiếng Việt chuẩn Excel. |
| **Giám sát Vận hành & Dự báo Nhu cầu (`AdminMetricsPage`)** | `/admin/metrics`, `/admin/analytics` (`src/pages/admin/Metrics.tsx`) | `GET /api/admin/metrics?range=24h\|7d\|30d`, `/api/admin/metrics/forecast`, `/seasonality`, `/api/vitals/summary` (`worker/src/routes/demand-forecast.ts`) | Theo dõi lưu lượng truy cập, độ trễ API, tỷ lệ lỗi hệ thống, điểm mượt giao diện (Web Vitals) và dự báo nhu cầu đặt món theo mùa vụ. |
| **Quản trị Tồn kho, Định mức & Dự báo AI (`InventoryPage`)** | `/admin/inventory` (`src/pages/admin/Inventory.tsx`) | `/api/inventory/*` (`packages/domain/inventory/src/routes/*.ts`) + `/api/inventory/forecast` (`worker/src/routes/inventory-forecasting.ts`) | Theo dõi tồn kho nguyên liệu thực tế, lịch sử xuất-nhập-hủy (`stock_movements`), quản lý nhà cung cấp & đơn nhập hàng (PO), và **Dự báo tiêu hao AI** tính tốc độ dùng trung bình/ngày (`v_run`) + Số ngày còn đủ bán (`Days-of-Supply`). |
| **Kế toán Chuỗi Nhượng quyền (`Franchise Router`)** | API `GET /api/franchise/locations/:id/metrics` (`worker/src/routes/franchise-locations.ts:210-319`, gắn tại `/api/franchise` ở `features-router.ts:229`) | Bảng `franchise_locations` kết hợp `orders` theo `tenant_id` từng điểm bán | Tự động tổng hợp tổng doanh thu hợp lệ (`gross_sales`), nhân tỷ lệ phí bản quyền (`royalty_percentage`, mặc định `5%`) để tính `royalty_amount` nộp về HQ và phần thực nhận của điểm nhượng quyền (`net_franchisee_payout`). |
| **Đối soát Thanh toán & Xuất Kế toán ERPNext** | `/admin/erpnext-sync` (`src/pages/admin/ERPNExtSync.tsx`) + `/api/analytics/payout` + Cron `*/5 * * * *` | `worker/src/routes/analytics-handlers/metrics-handlers.ts`, `payment-reconcile.ts`, `erpnext-invoices.ts`, `erpnext-pos.ts` | Tách bạch tiền thực thu qua cổng **PayOS (VietQR)**, **NOWPayments** và **Tiền mặt/COD**, khấu trừ tổng tiền đã hoàn (`refunded`), tự động chạy đối soát các giao dịch treo mỗi 5 phút và đồng bộ hóa đơn POS/chi phí sang ERPNext. |
| **Báo cáo Khách hàng thân thiết & CRM (`AdminLoyalty`)** | `/admin/customers` (`src/routes/admin-routes.tsx`) + Backend API `/api/admin/loyalty/*` & `/api/admin-loyalty/*` (`worker/src/routes/admin-loyalty.ts`, gắn ở `features-router.ts:180-181`) | Bảng `customers`, `loyalty_transactions`, `orders` | Thống kê tổng tệp khách, khách mới 30 ngày, tỷ lệ mua lặp lại (`repeat_rate` tính theo SĐT đặt từ 2 đơn hợp lệ trở lên), giá trị đơn trung bình (`AOV`), phân bổ hạng thẻ (Tier) và xuất danh sách khách VIP ra CSV *(lưu ý: các API `/api/admin-loyalty/*` đã hoàn thiện ở backend nhưng hiện chưa được nối vào một trang UI quản trị riêng trên `src/`)*. |

### 2. Kiểm chứng độ chính xác của Công thức Doanh thu, Giá vốn & Bảo mật dữ liệu

1. **Cách lọc đơn hàng hợp lệ khi cộng Doanh thu (Đã chuẩn xác):**
   - Toàn bộ truy vấn doanh thu cốt lõi (`VALID_REVENUE_ORDER_SQL` tại `worker/src/routes/reports-handlers/analytics-handlers.ts`, `worker/src/tree/analytics/summary.ts` và `franchise-locations.ts:270-271`) đều **loại trừ chặt chẽ** các đơn có `status IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')` **và** loại trừ các giao dịch có `payment_status IN ('refunded', 'failed')`. Nhờ vậy, đơn khách đặt nhầm rồi hủy hoặc đơn hoàn tiền không bị cộng ảo vào doanh thu của quán.
2. **Cách bóc tách Doanh thu theo Món & Danh mục:**
   - Hệ thống ưu tiên kết nối bảng quan hệ chuẩn `order_items` → `products` → `categories` (`grouped-sales-handlers.ts`); nếu gặp các đơn lịch sử thời kỳ đầu chưa tách dòng `order_items`, truy vấn tự động chuyển sang đọc mảng JSON `orders.items` để không bỏ sót doanh thu món cũ.
3. **Cách trừ kho tự động & Dự báo hết hàng:**
   - Khi đơn hàng hoàn tất, `deductInventoryForOrder` (`packages/domain/inventory/src/routes/order-deduction.ts`) tra cứu bảng công thức `recipe_ingredients` (BOM) đúng theo `tenant_id` của đơn hàng đó để ghi bút toán xuất kho vào `stock_movements`. Bộ dự báo `worker/src/routes/inventory-forecasting.ts:89-95` gom toàn bộ biến động âm (`out`, `consumption`, `sale`, `waste`, `order_deduction`, điều chỉnh giảm) để tính số ngày chạm đáy tồn kho an toàn.
4. **An toàn xuất file Excel/CSV & Cô lập chi nhánh:**
   - Cả 4 cổng xuất CSV (`/api/reports/export`, `/api/analytics/export`, `/api/admin/sales/csv`, `/api/admin-loyalty/export`) đều giới hạn chỉ cho phép `owner`, `manager`, `admin` tải về (nhân viên thu ngân/phục vụ/giám sát ca không tải trộm được tệp dữ liệu doanh thu/khách hàng) và đều bọc bộ lọc chống mã độc công thức bảng tính (`=`, `+`, `-`, `@`, `|`).

### 3. Năm (05) Điểm Lệch & Khoảng Trống Nghiệp Vụ Trong Phân Hệ Báo Cáo Cần Xử Lý Sớm

Đây là những phát hiện thực tế quan trọng nhất rút ra từ mã nguồn để anh không bị bất ngờ khi vận hành quán:

1. **[Lỗi Gọi Hàm UI — Mức độ Cao] Biểu đồ doanh thu trên trang Tổng quan (`/admin`) gửi sai định dạng ngày lên API:**
   - **Vị trí lỗi:** Tại `src/pages/admin/Dashboard-hooks.ts:40,45`, biến `revenueRange` nhận chuỗi `'7d' | '30d' | '90d'` nhưng lại được truyền thẳng vào tham số thứ nhất `from` của `useDailyRevenue(from?: string, to?: string)` (`src/hooks/use-analytics-data.ts:131-141`).
   - **Hệ quả:** Trình duyệt gửi request `GET /api/reports/daily?from=30d&to=2026-11-18`, và backend tại `worker/src/routes/reports-handlers/analytics-handlers.ts:160` lập tức trả lỗi **`400 Invalid date format (YYYY-MM-DD required)`** làm khu vực biểu đồ doanh thu ngày ở trang `/admin` báo lỗi/trống dữ liệu (trong khi trang chuyên sâu `/admin/sales-reports` truyền đúng `YYYY-MM-DD` nên vẫn chạy bình thường).
2. **[Lệch Múi Giờ Ngày Kinh Doanh — Mức độ Cao] Chưa đồng nhất giữa `UTC` và `UTC+7` ở một số bảng báo cáo ngày:**
   - **Vị trí lệch:** Các API mới như `GET /api/stats` (`packages/domain/order/queries/stats.ts`), `handleOverview`, `/sales-by-hour`, `/sales-by-day` (`worker/src/routes/reports-handlers/grouped-sales-handlers.ts`) và `peak-hours.ts` đã cộng `datetime(created_at, '+7 hours')` chuẩn giờ Việt Nam. Tuy nhiên, nhóm API `/api/reports/daily`, `/api/reports/summary`, `/api/reports/top-products` (`worker/src/routes/reports-handlers/analytics-handlers.ts`) và `/api/reports/export` (`worker/src/routes/reports-handlers/export-handlers.ts`) vẫn đang nhóm theo `DATE(created_at)` gốc (`UTC`).
   - **Hệ quả cho quán:** Các đơn bán sớm từ **`00:00` đến `06:59` sáng giờ Việt Nam** (ví dụ ca mở cửa 06:15 sáng ngày 18/11) có `created_at` theo UTC là 23:15 ngày 17/11 — dẫn đến bảng `SalesReportDailyTable` ghi nhận đơn đó vào ngày hôm trước, lệch nhẹ vài ly cà phê sáng khi đối chiếu giữa 2 biểu đồ trên cùng màn hình `/admin/sales-reports`.
3. **[Đang Tắt Chủ Động — Mức độ Trung bình] Chốt két tiền mặt cuối ca (`Cash Reconciliation`) đang khóa `501`:**
   - **Thực tế trong code:** Thuật toán đối soát tiền mặt cuối ca (`reconcileShiftCash`) đã được viết sẵn tại `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`, nhưng cả hai cổng HTTP `GET /api/reports/reconciliation` (`worker/src/routes/reports-handlers/reconciliation-handlers.ts:6-9`) và `/api/shifts/:id/reconciliation` (`packages/domain/shift/src/routes/reconciliation.ts`) đang chủ động trả mã **`501 PILOT_CASH_RECONCILIATION_DISABLED`** (*"Cash reconciliation is unavailable for the attendance pilot"*). Nếu quán cần bàn giao tiền mặt đầu ca – cuối ca ngay trên phần mềm thay vì kiểm đếm sổ tay, cần mở khóa (wire) lại policy này vào route.
4. **[Lệch Tham Số Xuất CSV — Mức độ Thấp] Nút xuất CSV trên trang Tổng quan luôn tải danh sách đơn thô thay vì tổng hợp ngày:**
   - `downloadAnalyticsCsv` tại `src/hooks/use-analytics-data.ts:155` truyền `?type=revenue&start=...&end=...`, nhưng `worker/src/routes/analytics-handlers/export-handlers.ts` bỏ qua tham số `type` và luôn trả về danh sách từng đơn hàng lẻ (`orders-export-*.csv`). Muốn lấy bảng tổng hợp doanh thu theo ngày chuẩn kế toán, chủ quán cần bấm nút Xuất CSV bên trang **Báo cáo (`/admin/sales-reports`)** gọi vào `/api/reports/export?type=revenue`.
5. **[Trải Nghiệm Phân Quyền Giao Diện — Mức độ Thấp] Hiển thị mục menu Báo cáo cho cả vai trò nhân viên phục vụ/thu ngân:**
   - Khung `AdminShell` (`src/routes/admin-routes.tsx` + `StitchAdminTerminalNew-constants.ts`) cho phép `staff`, `waiter`, `cashier`, `shipper` nhìn thấy menu `/admin/sales-reports` và `/admin/metrics` ở thanh bên trái, nhưng khi bấm vào thì API backend chặn quyền đúng luật (`403 Forbidden`, vì chỉ mở cho `owner`, `manager`, `supervisor`, `admin`). Nên ẩn luôn các mục menu này ở tầng giao diện theo đúng `user.role` để nhân viên đỡ bấm nhầm vào màn hình báo lỗi `403`.

---

## PHẦN D — KHUYẾN NGHỊ LỘ TRÌNH HÀNH ĐỘNG TIẾP THEO (ƯU TIÊN THEO GIÁ TRỊ KINH DOANH)

1. **Làm ngay (01 giờ công — Đóng gói ngay sau khi Merge PR này):**
   - Duyệt & bấm **Merge** Pull Request sửa lỗi `sop-reminders.test.ts` để nhánh `main` trên GitHub xanh trở lại 100%.
   - Thêm biến `CODECOV_TOKEN` vào GitHub Actions Secrets (hoặc đặt `fail_ci_if_error: false` tại `.github/workflows/ci.yml:45`) để bước tải coverage không làm gián đoạn pipeline.
2. **Tuần này (Trước khi đối soát sổ sách tháng với kế toán quán):**
   - Sửa lời gọi `useDailyRevenue` trong `src/pages/admin/Dashboard-hooks.ts:40-45` đổi từ `'7d'|'30d'|'90d'` sang ngày `YYYY-MM-DD` thực tế để biểu đồ doanh thu ở `/admin` hiển thị lại ngay.
   - Đồng bộ `DATE(datetime(created_at, '+7 hours'))` cho `/api/reports/daily`, `/summary`, `/top-products` và `/export` để ca sáng trước `07:00` luôn rơi đúng vào ngày bán hàng tại Việt Nam.
3. **Giai đoạn mở rộng vận hành tại quầy:**
   - Kích hoạt chính thức API đối soát két tiền mặt cuối ca (`/api/shifts/:id/reconciliation` & `/api/reports/reconciliation`) dựa trên `cash-reconciliation-policy.ts` đã viết sẵn.
   - Nối middleware `loginRateLimit` (`worker/src/middleware/rate-limit-login.ts`) vào đường dẫn đăng nhập và ẩn các tab báo cáo doanh thu khỏi thanh menu của vai trò `waiter`/`cashier`/`shipper`.

---

## CÂU HỎI CHƯA GIẢI QUYẾT / CẦN CHỦ QUÁN QUYẾT ĐỊNH CHÍNH SÁCH (UNRESOLVED QUESTIONS)

1. **Chính sách mở lại Đối soát tiền mặt cuối ca (`PILOT_CASH_RECONCILIATION_DISABLED`):** Quán hiện muốn tiếp tục giữ chế độ chỉ chấm công ca làm việc (tắt đối soát tiền mặt trên app) hay muốn mở luôn tính năng nhập tiền đầu ca / kiểm đếm tiền mặt cuối ca cho thu ngân ở đợt cập nhật kế tiếp?
2. **Giờ chốt sổ ngày kinh doanh (Cut-off Hour):** Quán đóng cửa hoàn toàn trước `24:00` đêm (chốt ngày lúc `00:00` giờ Việt Nam `UTC+7`) hay có bán xuyên đêm cần chốt ngày kinh doanh lúc `04:00` sáng hôm sau?
3. **Định hướng 3 gói khung `apps/hq`, `apps/ops`, `apps/space` (`version: 0.0.0`):** Đội kỹ thuật dự kiến tách thành 3 ứng dụng Cloudflare Pages độc lập trong tương lai hay giữ nguyên mô hình một SPA thống nhất tại `src/` như hiện tại để gắn tag phát hành mới (`v2.3.0`)?
