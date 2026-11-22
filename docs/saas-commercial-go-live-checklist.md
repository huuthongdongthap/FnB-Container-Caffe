# AURA SaaS Commercial Edition v3 — Go-Live & Operations Checklist

Runbook triển khai thực tế để đưa **AURA SaaS Commercial Edition v3 / v3.1** lên Cloudflare Workers + D1 + Pages (Staging → Production) mà **không ảnh hưởng đến quán flagship `default` (AURA SPACE Sa Đéc)**.

> **Trạng thái hiện tại (2026-11-22):** Schema `20261119_02_saas_commercial_v3.sql` cùng bộ code `main` (`37e9b80b`, PR `#106`) đã được triển khai lên Production (`fnb-caffe-db`, Worker `44babe91`, Pages `32a30b2e`, issues `#79`/`#82` đã đóng) với chế độ cô lập hoàn toàn cho quán flagship `'default'`. **Không chạy lại `20261119_02_saas_commercial_v3.sql` trên Production D1.** Các bước kích hoạt SaaS thương mại còn lại (nạp secrets `TENANT_SECRETS_KEY` và `SAAS_PAYOS_*` tách biệt hoàn toàn với `PAYOS_*`, cấu hình DNS wildcard `*.auraspace.cafe`, onboard tenant pilot) hiện đang hoãn theo chủ trương ưu tiên vận hành quán Aura Café trước.

---

## 1. Biến môi trường & Secrets bắt buộc (Cloudflare Worker)

Thiết lập bằng `wrangler secret put <NAME>` (tách biệt Staging và Production). **Tuyệt đối không dùng chung tài khoản PayOS của quán flagship (`PAYOS_*`) với tài khoản thu phí nền tảng SaaS (`SAAS_PAYOS_*`).**

| Biến / Secret | Loại | Mô tả | Trạng thái / Khi thiếu sẽ xảy ra gì? |
|---|---|---|---|
| `TENANT_SECRETS_KEY` | Secret (64-hex / 32-byte key) | Khóa AES-256-GCM mã hóa PayOS credentials từng quán trong `tenant_payment_configs` | **Chưa nạp prod** — Chủ quán không thể lưu PayOS riêng (HTTP 500 rõ ràng, không lưu plaintext) |
| `SAAS_PAYOS_CLIENT_ID` | Secret | Client ID của tài khoản PayOS thu phí gói SaaS (Starter/Pro/Chain) | **Chưa nạp prod** — `POST /api/saas/billing/checkout` fail-fast **HTTP 503** `saas_billing_not_configured` |
| `SAAS_PAYOS_API_KEY` | Secret | API Key của tài khoản PayOS thu phí gói SaaS | **Chưa nạp prod** — Như trên, **không bao giờ fallback sang `PAYOS_API_KEY` của flagship** |
| `SAAS_PAYOS_CHECKSUM_KEY` | Secret | Checksum Key xác thực HMAC-SHA256 webhook gia hạn gói SaaS | **Chưa nạp prod** — `POST /api/saas/billing/webhook/payos` fail-fast **HTTP 503** |
| `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` | Secrets | Token & Chat ID cho cron vòng đời `runSaasLifecycleCron` (nudge 24h, Trial D-3/D-1, Grace D-1) | Nếu thiếu, cron bỏ qua dispatch và không chèn audit claim để có thể gửi bù khi đủ cấu hình |
| `SAAS_PLATFORM_DOMAIN` | Var (`worker/wrangler.toml`) | Domain gốc nền tảng SaaS (`"auraspace.cafe"`) | Đã khai báo trong `worker/wrangler.toml` `[vars]` |
| `FE_BASE_URL` | Var (`worker/wrangler.toml`) | URL frontend chính (`"https://auraspace.cafe"`) để build `returnUrl` / `cancelUrl` | Đã khai báo trong `worker/wrangler.toml` `[vars]` |

Tạo khóa mã hóa 32-byte an toàn:
```bash
openssl rand -hex 32 | npx wrangler secret put TENANT_SECRETS_KEY
```

---

## 2. Backup D1 & Chạy Migration `20261119_02_saas_commercial_v3.sql`

> **Quy tắc bắt buộc:** Luôn export bản sao lưu D1 trước khi apply migration lên Staging/Production.

### Bước 2.1 — Backup D1
```bash
cd worker
npx wrangler d1 export fnb-caffe-db --remote --output=../backups/d1-pre-saas-v3-$(date +%Y%m%d-%H%M%S).sql
```

### Bước 2.2 — Apply Migration (Fail-Closed Runner — Chưa chạy Production)

`worker/scripts/apply-migrations.sh` bắt buộc truyền `--file` tường minh (chặn glob, `--all`, `.down.sql`) và dừng ngay (`break` + exit non-zero) khi một file remote migration lỗi. `worker/wrangler.toml` bind D1 `fnb-caffe-db`, còn `.github/workflows/deploy.yml` (`action: apply-d1-migration`, `migration_file: 20261119_02_saas_commercial_v3.sql`) yêu cầu duyệt tay environment `production` sau khi export backup.

```bash
# Kiểm tra đường dẫn & tên file (không thực thi remote)
bash worker/scripts/apply-migrations.sh --dry-run --file 20261119_02_saas_commercial_v3.sql

# Production (chỉ chạy sau khi được xác nhận tường minh hoặc qua GitHub Actions deploy.yml)
bash worker/scripts/apply-migrations.sh --remote --file 20261119_02_saas_commercial_v3.sql
```

### Bước 2.3 — Xác minh bảng mới
```bash
npx wrangler d1 execute fnb-caffe-db --remote --command="
SELECT name FROM sqlite_master
WHERE type='table' AND name IN (
  'saas_tenants',
  'tenant_subscriptions',
  'tenant_branding',
  'tenant_domains',
  'tenant_payment_configs',
  'tenant_invoices',
  'saas_billing_transactions',
  'saas_audit_logs'
) ORDER BY name;"
```

### Rollback (nếu cần)
```bash
npx wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/20261119_02_saas_commercial_v3.down.sql
```

---

## 3. Cấu hình DNS Wildcard & Custom Domains (Cloudflare)

1. **Wildcard Subdomain (`*.auraspace.cafe`):**
   - Trong Cloudflare DNS của zone `auraspace.cafe`, thêm bản ghi proxied (`Proxied = ON`):
     - `CNAME` `*` → `auraspace.cafe` (hoặc Worker Route `*.auraspace.cafe/*`).
   - Kiểm tra Cloudflare Pages / Worker Custom Domains đã bind cả `auraspace.cafe` và `*.auraspace.cafe`.
2. **Custom Domain của từng quán (gói Pro / Chain):**
   - Bật **Cloudflare for SaaS (Custom Hostnames)** với Fallback Origin trỏ về Worker/Pages của `auraspace.cafe`.
   - Khi chủ quán thêm tên miền trong `/admin/saas-settings` (tab Tên miền), hệ thống cấp bản ghi `TXT _aura-verify.<domain>` và `CNAME <domain> -> cname.auraspace.cafe`.
   - Chỉ khi `tenant_domains.status = 'verified'` thì `resolveTenantFromHost` mới map domain đó vào `tenant_id` tương ứng.

---

## 4. Cấu hình PayOS Webhooks (Tách biệt 2 luồng tiền)

| Luồng tiền | PayOS Account | Webhook URL cấu hình trên PayOS |
|---|---|---|
| **Phí thuê bao SaaS** (Starter / Pro / Chain) | Tài khoản PayOS của nền tảng AURA | `https://api.auraspace.cafe/api/saas/billing/webhook/payos` |
| **Tiền đồ uống của flagship `default`** | Tài khoản PayOS của AURA Sa Đéc | `https://api.auraspace.cafe/api/webhook/payos` |
| **Tiền đồ uống của từng quán SaaS** | Tài khoản PayOS riêng của chủ quán | `https://api.auraspace.cafe/api/webhook/payos/{tenantSlug}` |

**Các bảo vệ đã kích hoạt tự động:**
- Webhook gia hạn SaaS yêu cầu khớp tuyệt đối `amountPaid === invoice.amount_vnd` (thiếu/thừa trả `409 amount_mismatch`).
- Gia hạn sớm cộng dồn từ `max(now, current_period_end)` (`+30d` tháng / `+365d` năm), không làm mất ngày còn dư.
- Conditional `UPDATE tenant_invoices ... WHERE status != 'paid'` đảm bảo retry/delivery song song là **idempotent tuyệt đối**.
- Quán con chưa cấu hình PayOS sẽ không bao giờ fallback sang khóa PayOS của flagship.
- Storefront `/s/:slug`: `GET /api/saas/storefront/:slug` chỉ trả về thông tin ngân hàng VietQR công khai (`bankBin`, `bankAccountNo`, `bankAccountName`, `bankName`) và cờ `hasPayos` (không lộ secret mã hóa); khách chọn `payos` gọi `POST /api/payment/create-link` kèm `X-Order-Token` và tự fallback sang thẻ VietQR nếu chưa tạo được link PayOS.

---

## 5. Smoke Test Go-Live (2 quán thật + Flagship — Chưa chạy Production)

Thực hiện sau khi được xác nhận rollout Production:

1. **Flagship `default` không bị ảnh hưởng:**
   - Mở `https://auraspace.cafe/` → đặt thử 1 đơn takeaway + kiểm tra `/admin` + `/kds`.
2. **Đăng ký tự phục vụ 2 quán mới (`/signup`):**
   - Tạo `quan-pilot-a` (mẫu Quán Cà Phê Truyền Thống) và `quan-pilot-b` (mẫu Quán Trà Sữa).
   - Kiểm tra cả 2 quán tự động có sẵn danh mục, món, bàn, ca làm việc, hạn dùng thử 14 ngày (và lưu `attribution` UTM vào `saas_tenants.config_json` nếu có query UTM).
3. **Cách ly dữ liệu chéo, định tuyến tên miền & thanh toán `/s/:slug`:**
   - Mở `https://quan-pilot-a.auraspace.cafe` và `https://auraspace.cafe/s/quan-pilot-a`, tạo đơn khách cho Quán A với `cod`, `vietqr`, và `payos` (qua `X-Order-Token`).
   - Đăng nhập Chủ Quán B → xác nhận đơn của Quán A **không xuất hiện** trong `/admin`, `/kds`, `/api/saas/export`.
4. **Kiểm tra khóa chỉ-đọc HTTP 402 & HQ SaaS Control (`/hq/saas`):**
   - Từ HQ Dashboard (`/hq/saas`), tạm ngưng (`rawStatus === 'suspended'`) và kiểm tra nút mở khóa hoạt động bình thường; xem phễu kích hoạt 7 ngày (`>=5` món đang bán & `>=3` đơn trong 7 ngày đầu), tab UTM, và tab Audit Logs (`GET /api/hq/saas/audit-logs`).
   - Thử tạo đơn khách hàng hoặc sửa menu khi bị khóa/hết hạn → nhận đúng **HTTP 402** (`subscription_expired_readonly`), giao diện hiển thị `SaasReadOnlyBanner` có nút **Gia hạn ngay**.
   - Xác nhận chủ quán B vẫn xem được đơn cũ, xuất JSON (`GET /api/saas/export`), và tạo link thanh toán gia hạn (`POST /api/saas/billing/checkout`).
5. **Kiểm tra gia hạn PayOS & Lifecycle Cron:**
   - Thanh toán 1 hóa đơn thật (hoặc PayOS Sandbox) cho `quan-pilot-b` → webhook trả `200`, gói tự động chuyển `active`, thao tác tạo đơn mở khóa lại ngay lập tức.
   - Kiểm tra cron 5 phút (`runSaasLifecycleCron` trong `worker/src/scheduled.ts`) tự động chuyển `expired` cho hóa đơn/giao dịch `pending` quá 24h và gửi thông báo Telegram (nudge 24h chưa kích hoạt, Trial D-3/D-1, Grace D-1) không trùng lặp nhờ `saas_audit_logs.id`.

---

## 6. Kiểm định tự động trước mỗi lần Release

> **Trạng thái kiểm định (2026-11-19):** Đã PASS đầy đủ trên nhánh `feat/saas-v3-1-activation-payment-telemetry` — `lint`, `lint:migrations`, `check:contrast` (11/11 WCAG AA), `typecheck:all`, `local-payment-flow --api-only` (59/59), `test:ci` (588 files / 5.826 tests; targeted SaaS v3.1 + VietQR: 19 tests), `npm run build`, và Worker `--dry-run`.

```bash
# 1. Lint, migration check & full typecheck (chạy ở thư mục gốc repo)
npm run lint
npm run lint:migrations
npm run typecheck:all

# 2. Frontend VietQR unit tests & Worker SaaS v3/v3.1 integration suites
./node_modules/.bin/vitest run \
  src/lib/__tests__/vietqr.test.ts \
  worker/src/__tests__/saas-commercial-v3.test.ts \
  worker/src/__tests__/saas-commercial-hardening.integration.test.ts \
  worker/src/__tests__/saas-schema-migration-parity.integration.test.ts \
  worker/src/__tests__/saas-v3-1-activation-payment-telemetry.integration.test.ts \
  worker/src/__tests__/saas-v3-1-export-audit.integration.test.ts \
  worker/src/__tests__/saas-v3-1-hq-guards-and-filters.integration.test.ts \
  worker/src/__tests__/saas-v3-1-hq-telemetry-activation.integration.test.ts \
  worker/src/__tests__/saas-v3-1-lifecycle-cron-boundaries.integration.test.ts \
  worker/src/__tests__/saas-v3-1-lifecycle-cron-expiry.integration.test.ts

# 3. Full CI test & production build
npm run test:ci
npm run build
```
