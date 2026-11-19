# AURA SaaS Commercial Edition v3 — Go-Live & Operations Checklist

Runbook triển khai thực tế để đưa **AURA SaaS Commercial Edition v3** lên Cloudflare Workers + D1 + Pages (Staging → Production) mà **không ảnh hưởng đến quán flagship `default` (AURA SPACE Sa Đéc)**.

---

## 1. Biến môi trường & Secrets bắt buộc (Cloudflare Worker)

Thiết lập bằng `wrangler secret put <NAME>` (tách biệt Staging và Production). **Tuyệt đối không dùng chung tài khoản PayOS của quán flagship (`PAYOS_*`) với tài khoản thu phí nền tảng SaaS (`SAAS_PAYOS_*`).**

| Biến / Secret | Loại | Mô tả | Khi thiếu sẽ xảy ra gì? |
|---|---|---|---|
| `TENANT_SECRETS_KEY` | Secret (64-hex / 32-byte key) | Khóa AES-256-GCM mã hóa PayOS credentials từng quán trong `tenant_payment_configs` | Chủ quán không thể lưu PayOS riêng (HTTP 500 rõ ràng, không lưu plaintext) |
| `SAAS_PAYOS_CLIENT_ID` | Secret | Client ID của tài khoản PayOS thu phí gói SaaS (Starter/Pro/Chain) | `POST /api/saas/billing/checkout` fail-fast **HTTP 503** `saas_billing_not_configured` |
| `SAAS_PAYOS_API_KEY` | Secret | API Key của tài khoản PayOS thu phí gói SaaS | Như trên — **không bao giờ fallback sang `PAYOS_API_KEY` của flagship** |
| `SAAS_PAYOS_CHECKSUM_KEY` | Secret | Checksum Key xác thực HMAC-SHA256 webhook gia hạn gói SaaS | `POST /api/saas/billing/webhook/payos` fail-fast **HTTP 503** |
| `SAAS_PLATFORM_DOMAIN` | Var (`wrangler.toml`) | Domain gốc nền tảng SaaS, ví dụ `auraspace.cafe` | Tự fallback về `auraspace.cafe` khi resolve subdomain `{slug}.auraspace.cafe` |
| `FE_BASE_URL` | Var (`wrangler.toml`) | URL frontend chính (ví dụ `https://auraspace.cafe`) để build `returnUrl` / `cancelUrl` | Dùng origin của request nếu không đặt |

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
npx wrangler d1 export aura-space-db --remote --output=../backups/d1-pre-saas-v3-$(date +%Y%m%d-%H%M%S).sql
```

### Bước 2.2 — Apply Migration (Staging trước, Production sau)
```bash
# Staging
npx wrangler d1 execute aura-space-db-staging --remote --file=db/migrations/20261119_02_saas_commercial_v3.sql

# Production (chỉ chạy sau khi pass Smoke Test mục 5 trên Staging)
npx wrangler d1 execute aura-space-db --remote --file=db/migrations/20261119_02_saas_commercial_v3.sql
```

### Bước 2.3 — Xác minh bảng mới
```bash
npx wrangler d1 execute aura-space-db --remote --command="
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
npx wrangler d1 execute aura-space-db --remote --file=db/migrations/20261119_02_saas_commercial_v3.down.sql
```

---

## 3. Cấu hình DNS Wildcard & Custom Domains (Cloudflare)

1. **Wildcard Subdomain (`*.auraspace.cafe`):**
   - Trong Cloudflare DNS của zone `auraspace.cafe`, thêm bản ghi proxied (`Proxied = ON`):
     - `CNAME` `*` → `auraspace.cafe` (hoặc Worker Route `*.auraspace.cafe/*`).
   - Kiểm tra Cloudflare Pages / Worker Custom Domains đã bind cả `auraspace.cafe` và `*.auraspace.cafe`.
2. **Custom Domain của từng quán (gói Pro / Chain):**
   - Bật **Cloudflare for SaaS (Custom Hostnames)** với Fallback Origin trỏ về Worker/Pages của `auraspace.cafe`.
   - Khi chủ quán thêm tên miền trong `/admin/saas` (tab Tên miền), hệ thống cấp bản ghi `TXT _aura-verify.<domain>` và `CNAME <domain> -> cname.auraspace.cafe`.
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

---

## 5. Smoke Test Go-Live (2 quán thật + Flagship)

Thực hiện lần lượt trên Staging rồi Production:

1. **Flagship `default` không bị ảnh hưởng:**
   - Mở `https://auraspace.cafe/` → đặt thử 1 đơn takeaway + kiểm tra `/admin` + `/kds`.
2. **Đăng ký tự phục vụ 2 quán mới (`/saas/signup`):**
   - Tạo `quan-pilot-a` (mẫu Quán Cà Phê Truyền Thống) và `quan-pilot-b` (mẫu Quán Trà Sữa).
   - Kiểm tra cả 2 quán tự động có sẵn danh mục, món, bàn, ca làm việc, hạn dùng thử 14 ngày.
3. **Cách ly dữ liệu chéo & định tuyến tên miền:**
   - Mở `https://quan-pilot-a.auraspace.cafe` và `https://auraspace.cafe/s/quan-pilot-a`, tạo đơn cho Quán A.
   - Đăng nhập Chủ Quán B → xác nhận đơn của Quán A **không xuất hiện** trong `/admin`, `/kds`, `/api/saas/export`.
4. **Kiểm tra khóa chỉ-đọc HTTP 402 khi hết hạn:**
   - Từ HQ Dashboard (`/hq/saas`), tạm ngưng hoặc đặt quá hạn trial+grace cho `quan-pilot-b`.
   - Thử tạo đơn khách hàng hoặc sửa menu của `quan-pilot-b` → nhận đúng **HTTP 402** (`subscription_expired_readonly`), giao diện hiển thị `SaasReadOnlyBanner` có nút **Gia hạn ngay**.
   - Xác nhận chủ quán B vẫn xem được đơn cũ, xuất JSON (`GET /api/saas/export`), và tạo link thanh toán gia hạn (`POST /api/saas/billing/checkout`).
5. **Kiểm tra gia hạn PayOS tự động mở khóa:**
   - Thanh toán 1 hóa đơn thật (hoặc test trên PayOS Sandbox) cho `quan-pilot-b` → webhook trả `200`, gói tự động chuyển `active`, và thao tác tạo đơn mở khóa lại ngay lập tức.

---

## 6. Kiểm định tự động trước mỗi lần Release

```bash
# Worker: typecheck + unit & integration tests (chạy trên schema + migration thật)
cd worker
npx tsc --noEmit
../node_modules/.bin/vitest run src/__tests__/saas-commercial-v3.test.ts src/__tests__/saas-commercial-hardening.integration.test.ts

# Frontend: typecheck + production build
cd ../frontend
npx tsc --noEmit
npm run build
```
