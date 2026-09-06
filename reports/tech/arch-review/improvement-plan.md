# Architecture Improvement Plan — AURA CAFE (FnB-Container-Caffe)

**Pipeline:** `tech:architecture-review` · **Date:** 2026-08-25
**Inputs:** `architecture-audit.md` (FE 5/10 · BE 7/10) · `api-audit.md` (security 4/10) · `schema-review.md` (schema health 4/10)
**Owner focus:** kiến trúc FE còn nhiều lỗi → FE items are prioritized first within each phase.

---

## 1. Executive Synthesis

Ba audit hội tụ về cùng một bức tranh: **nền móng kỹ thuật tốt (strict TS, Hono middleware, SQL parameterized, observability 8/10) nhưng bị phá vỡ ở các điểm ghép nối (integration seams)**:

| Seam | Vấn đề cốt lõi | Nguồn |
|---|---|---|
| **Auth transport** | FE tin cookie httpOnly, BE chỉ đọc `Authorization: Bearer` ⇒ mọi call authenticated từ web đều không mang credential BE chấp nhận | ARCH-FE-01/02 + API F-03 |
| **RBAC hai đầu trống** | FE guard không check `role`; BE có ~41 endpoint public không nên public (billing, PII customers) | ARCH-FE-01 + API F-01/02/05/06 |
| **Contract drift** | ≥5 đường API FE gọi không tồn tại/khác tên; envelope 3 kiểu; DTO lặp (`MenuItem` ×12); 3 hardcoded origins | ARCH-FE-04/05/06 + API F-07–F-10/F-15 |
| **Dead weight** | Stitch legacy = **46% FE (567 files / 41K LOC)**, một phần load-bearing | ARCH-FE-03 |
| **Data model fiction** | 0× `tenant_id`; ~14 ghost tables; split-brain `erpnext_sync_log(s)`, `staff_shifts`, `reservations`; 4 luồng migration song song | SCHEMA F-01–F-07 |

**Nguyên nhân gốc chung:** frontend hoàn toàn không được lint (lint script chỉ target `worker/src`) + không có source-of-truth cho contract (không OpenAPI, không shared types, migration không có tooling) ⇒ drift tích lũy âm thầm.

---

## 2. Phased Roadmap

### 🔴 Phase 0 — "Cứu cháy" an toàn & đúng đắn (1–2 ngày, diff nhỏ)

> Mục tiêu: đóng mọi P0. Không refactor cấu trúc.

| # | Việc | Fix chính | Nguồn finding |
|---|---|---|---|
| 0.1 | Gate billing API | `subscriptions.ts` wrap `requireAuth(['owner'])`; tách GET plans public sang `/api/saas/pricing` | API F-01 |
| 0.2 | Gate CRM PII | `GET /api/customers` → `requireAuth(['owner','staff'])` | API F-02 |
| 0.3 | **Chốt auth transport** (quyết định kiến trúc lớn nhất): khuyến nghị **(b) Bearer in-memory** — ít rủi ro CSRF, sửa 1 chỗ `apiFetch()`; đồng bộ `getAuthToken()`, login/logout, mobile flow. Thêm E2E test: login → gọi route protected thành công | API F-03 + ARCH-FE-01 |
| 0.4 | Role-aware `ProtectedRoute`: `<ProtectedRoute roles={['staff','owner']}>` cho 28 admin routes + mobile shell; role lấy từ `/api/auth/me` | ARCH-FE-01 |
| 0.5 | Sửa session-refresh: `AuthProvider` luôn gọi `fetchMe()` on mount (bỏ gate `if (user)`); test regression reload-with-cookie | ARCH-FE-02 |
| 0.6 | Anti-spoof tenancy: `tenantMiddleware` resolve từ JWT, header chỉ dành cho platform-admin | API F-04 + SCHEMA F-01 |
| 0.7 | Xóa destructive block: `schema.sql:264-267` DROP loyalty_*; seed.sql bare DELETE → INSERT OR IGNORE + env-guard | SCHEMA F-06/F-16 |
| 0.8 | Dọn dẹp tức thời: `.bak` routes, `auth-verify-fixed.ts`, dead scripts root, gitignore `coverage/dist/__pycache__/*.log/*.bak` | ARCH-BE-01/HYG-01 |

### 🟠 Phase 1 — FE architecture hardening (tuần 1–2) ⭐ *trọng tâm owner*

| # | Việc | Chi tiết |
|---|---|---|
| 1.1 | **Bật ESLint toàn FE** — gốc rễ của mọi drift: flat config thêm `src/**/*.{ts,tsx}`; rules: `typescript-eslint`, `react-hooks`, `no-restricted-syntax` cấm raw `fetch` ngoài `lib/`, `import/no-restricted-paths` enforce layer, `max-lines ≤300`. Wire vào CI cạnh `tsc --noEmit` | ARCH-FE-07/04 |
| 1.2 | Migrate 22 file raw-fetch → `apiFetch` (ưu tiên `checkout.tsx:127` payment-request) | ARCH-FE-04 |
| 1.3 | Sửa contract breaks FE→BE: `/api/errors`→`/api/client-error`; `/api/dashboard/overview`→`/api/stats`; `/api/admin/checkins`; `/api/admin/erpnext-sync/*`→`/api/erpnext/sync/*`; map lỗi `body.error ?? body.detail ?? body.message` để UX hiển thị message tiếng Việt của BE | API F-07/08/09 |
| 1.4 | Thống nhất `VITE_API_BASE` bắt buộc (fail build nếu thiếu), xóa 3 hardcoded origins; smoke-test `/api/version` khớp GIT_COMMIT_SHA | API F-10 + ARCH-FE-11 |
| 1.5 | Endpoint registry: `src/lib/api/endpoints.ts` — typed path builders, migrate dần orders/menu/admin trước | ARCH-FE-05 |
| 1.6 | Guard các router BE còn hở: `menu-modifiers`, `kitchen-stations`, `/mobile/notifications/*` | API F-05/06/18 |
| 1.7 | Rate limit dài hạn: loyalty/promotions/customers/contact/mobile-login; xóa `rate-limit-login.ts` chết | API F-12 |

### 🟡 Phase 2 — Data & contract foundation (tuần 2–4)

| # | Việc | Chi tiết |
|---|---|---|
| 2.1 | **Consolidate migrations**: chọn `worker/migrations/` làm nguồn duy nhất, wire `wrangler d1 migrations apply`; squash baseline = export prod hiện tại (backup đã có trong `worker/backups/`); archive 3 dir kia | SCHEMA F-07/F-15 |
| 2.2 | Ghost entities: rà 14 bảng (§2.3 schema report) route-by-route — tạo DDL cho feature sống, xóa route chết | SCHEMA F-02 |
| 2.3 | Split-brain: `erpnext_sync_log(s)` giữ singular; `staff_shifts`, `reservations`, `notification_audit_log` reconcile theo prod shape | SCHEMA F-03/04/05 |
| 2.4 | Shared domain types: `src/types/domain.ts` mirror `worker/src/types/models.ts` (hoặc Zod-infer shared package); diệt `MenuItem` ×12, `Order` ×4 | ARCH-FE-06 |
| 2.5 | Index hot-path: `customers(phone)` (+UNIQUE), `orders(table_id)`, `cashback_transactions(wallet_id,order_id)`, `loyalty_point_logs(customer_id)`, `orders(status,created_at)`; UNIQUE `user_rewards(code)` | SCHEMA F-11/13 |
| 2.6 | Zod sprint: port 10 mutating endpoints traffic-cao nhất vào `lib/validators.ts`; chuẩn hóa envelope `ApiResponse<T>` (bắt đầu `dindin.ts`) | API F-11/F-15 |
| 2.7 | Money INTEGER: cast REAL→INTEGER các cột `_vnd` trong lần recreate kế tiếp | SCHEMA F-10 |

### 🟢 Phase 3 — Structural debt (quý, chạy song song feature work)

| # | Việc | Chi tiết |
|---|---|---|
| 3.1 | **Stitch triage program** (mục tiêu đo được: stitch ≤10% FE LOC): (a) delete unused variants, (b) promote keepers vào `pages/admin`+`pages/menu` stripping mock constants, (c) gate/remove 21 showcase routes khỏi bundle | ARCH-FE-03 |
| 3.2 | Nested layouts: `<Route element={<StitchShell/>}>` / `<AdminShell/>` prefix-match, xóa Set exact-pathname | ARCH-FE-10 |
| 3.3 | Mechanical moves: `stores/` top-level (60 consumer files), merge `payment(s)/`, extract `route-utils` dùng chung 4 route files | ARCH-FE-08/09/12 |
| 3.4 | Multi-tenancy thật: `tenant_id TEXT NOT NULL` + composite indexes trên mọi domain table, resolve server-side | SCHEMA F-01 |
| 3.5 | OpenAPI source of truth: `@hono/zod-openapi` generate spec; CI check FE fetch paths vs spec (tự động bắt loại F-07/F-08) | API F-14 |
| 3.6 | CI schema guardrail: build scratch D1 từ schema+migrations sorted → smoke queries → diff referenced-tables vs sqlite_master | SCHEMA F-02/F-08 |
| 3.7 | Token lifecycle: web JWT ≤1h + silent refresh; jti-based revocation | API F-20 |
| 3.8 | secureHeaders() global; xóa `CORS_ORIGIN="*"` var chết | API F-16 |
| 3.9 | Folder-per-page opportunistically khi chạm vào từng feature admin (140 files flat) | ARCH-FE-13 |

---

## 3. Dependency Graph

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3
   │            │            │
   │            └─ 1.1 ESLint phải đi TRƯỚC mọi refactor FE (chặn regression)
   │                         1.3 contract fix cần trước 2.4 shared types (định hình shape)
   └─ 0.3 auth transport là PREREQUISITE cho 0.4 RBAC và mọi test authenticated
2.1 migrations consolidate cần trước 2.3/2.4/3.4 (mọi DDL mới vào 1 luồng duy nhất)
```

## 4. Success Metrics

| Metric | Hiện tại | Mục tiêu |
|---|---|---|
| Public endpoints không nên public | ~41 (~14%) | 0 |
| FE lint coverage | 0% | 100% `src/` trong CI |
| Raw `fetch()` ngoài lib | 22+ files | 0 |
| Endpoint literals rải rác | 126 unique / 112 files | registry-only |
| Stitch % FE LOC | 46% | ≤10% |
| `MenuItem` definitions | ≥12 | 1 |
| Migration directories | 4 | 1 (wrangler-managed) |
| Ghost/split-brain tables | ~14 ghost + 6 conflicts | 0 |
| Tables có `tenant_id` | 0 | 100% domain tables |
| Session survives refresh | ❌ | ✅ (test tự động) |

## 5. Effort Estimates

| Phase | Effort | Rủi ro nếu trễ |
|---|---|---|
| Phase 0 | ~2 ngày | PII/billing lộ công khai; session auth vô dụng |
| Phase 1 | ~1.5 tuần | Drift tiếp tục tích lũy mỗi PR mới |
| Phase 2 | ~2–3 tuần | Fresh deploy fail (`no such table`), billing sai số REAL float |
| Phase 3 | ~1 quý (song song) | Codebase 88K LOC khó bảo trì, multi-tenant Phase-5 kẹt |

---
*Generated by `tech:architecture-review` pipeline · inputs: arch/api/schema audits dated 2026-08-25.*
