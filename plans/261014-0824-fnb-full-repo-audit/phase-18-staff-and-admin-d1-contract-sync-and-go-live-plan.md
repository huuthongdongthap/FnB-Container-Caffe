# Phase 18: Staff & Admin D1 Runtime Contract Synchronization & Go-Live Execution Plan

**Context Links:**
- [Overview Plan](plan.md)
- [Phase 04: Staging Smoke Verification & Go-Live Gates](phase-04-staging-smoke-verification-and-go-live-gates.md)
- [Phase 16: Web Payment Fail-Closed, Staging Gates & Fail-Closed D1 Migration Runners](phase-16-web-payment-staging-gates-and-fail-closed-migrations.md)
- [Phase 17: Live D1 Schema Verification, Migration Ledger Baseline & 3-Tier Rollback Orchestration](phase-17-live-d1-ledger-baseline-and-rollback-orchestration.md)
- [Operational Readiness Report](../reports/audit-261014-repo-operational-readiness-verification.md)

## Overview
- **Priority:** P0 (Go-Live Critical Path — Staff & Admin Operations + D1 Contract Alignment)
- **Current Status:** Complete (Code & Offline Verification Complete; Ready for Live D1 Read-Only Baseline & Staging Smoke)
- **Description:** Consolidates the selected `/brainstorm --deep` architecture (`Option A1` `schema_migrations` baseline ledger + `Option B1` 3-tier PITR rollback policy without destructive `.down.sql` generation), documents the full audit and remediation of all 15 Staff & Admin ↔ D1 runtime contract mismatches, and defines the exact step-by-step Go-Live execution sequence.

---

## 1. Selected Architecture (`/brainstorm --deep` Optimal Go-Live Path)

1. **D1 Migration Execution & Ledger (`Option A1`):**
   - Normal deployments (`deploy-cloudflare.sh`, `scripts/deploy-branded.sh`, `worker/scripts/deploy.sh`, `.github/workflows/deploy.yml`) execute **0 automatic D1 migrations**.
   - Forward migrations require explicit `--file <filename.sql>` matching `^[0-9]{8}_[0-9]{2}_[a-z0-9_]+\.sql$` in `worker/db/migrations/`.
   - After read-only live D1 inspection (`sqlite_master` + `PRAGMA table_info`), initialize `schema_migrations(filename PRIMARY KEY, checksum_sha256, applied_at, applied_by, execution_mode)` and record existing live migrations as `'baseline_verified'` without replaying historical table-rebuild SQL (`20260710_02_notifications_fixed.sql`, `20261003_02_admin_metrics_and_inventory.sql`).
2. **Production Rollback Policy (`Option B1`):**
   - **Tier 1 (Cloudflare Pages `fnb-caffe-container`):** Rollback via Cloudflare Pages Rollback REST API (`POST /client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/fnb-caffe-container/deployments/${DEPLOYMENT_ID}/rollback`).
   - **Tier 2 (Cloudflare Worker `aura-space-worker`):** Rollback via `npx wrangler rollback <VERSION_ID> --config worker/wrangler.toml`.
   - **Tier 3 (Cloudflare D1 `fnb-caffe-db`):** Point-in-time recovery via `npx wrangler d1 time-travel restore fnb-caffe-db --bookmark="<BOOKMARK_ID>"` or Forward-Fix SQL (no fabrication of destructive `DROP TABLE` `.down.sql` files).

---

## 2. Staff & Admin Pages + D1 Runtime Contract Matrix

### 2.1 Subsystems Verified Working Prior to Remediation
- **Staff Shifts (`/admin/staff` → `ShiftsTab.tsx`):** Connected to `/api/shifts/today`, `/api/shifts`, `/api/shifts/clock-in`, `/api/shifts/clock-out` (`packages/domain/shift/commands/shifts.ts` on D1 `shifts`).
- **Staff Recruitment (`/admin/staff` → `RecruitmentTab.tsx`):** Connected to `/api/recruitment/applications` (`worker/src/routes/recruitment-handlers.ts` on D1 `recruitment_applications`).
- **Staff Mobile PWA (`/mobile/login`, `/mobile/kds/orders`, `/mobile/tables`, `/mobile/orders`):** Connected to `/api/staff/auth`, `/api/kds/*`, `/api/tables/*` on D1 `staff_devices`, `orders`, `tables` + `AUTH_KV`.
- **Admin Inventory (`/admin/inventory`):** Connected to `/api/inventory/ingredients`, `/api/inventory/movements`, `/api/inventory/suppliers`, `/api/inventory/purchase-orders`, `/api/inventory/forecasting/run-rate`.
- **Admin Metrics & Loyalty (`/admin/metrics`, `/admin/loyalty`):** Connected to `/api/analytics/*` and `/api/loyalty/*`.

### 2.2 Remediated Staff & Admin ↔ D1 Contract Bugs (15/15 Fixed & Verified)
| Subsystem | Root Cause (`Source Fact`) | Remediation (`file:line`) | Status |
|:---|:---|:---|:---:|
| **1. Staff Directory & Creation (`/admin/staff`)** | `registerStaff` only mirrored to D1 `users` when `tenant_id` was provided (omitted by `StaffCreateModal.tsx`) and ignored `role`; `listStaff` only read `AUTH_KV` and returned `{ users }`, while `useAdminStaffStore` read `data.staff`. | `worker/src/lib/validators/auth.ts:52`, `worker/src/tree/auth/register-staff.ts:44-89`, `worker/src/tree/auth/list-staff.ts:28-115`, `src/hooks/stores/admin/use-admin-staff-store.ts:20-58` | **Complete** |
| **2. Admin Audit Logs (`/admin/audit-logs`)** | D1 `audit_logs` returned `actor_id`, `actor_name`, `resource_type`, `resource_id`, `ip_address`, `created_at` (or OpenAPI `user_id`, `entity_type`, `entity_id`, `metadata`), while UI expected camelCase `AuditEntry`. | `src/hooks/stores/admin/use-audit-store.ts:15-52` | **Complete** |
| **3. Admin Customers (`/admin/customers`)** | `/api/admin/customers` returned `{ data, pagination: { total } }` with D1 `visit_count`, `total_spent`, `created_at`, causing `CustomerTable.tsx:86` (`c.totalSpent.toLocaleString()`) to throw `TypeError`. | `worker/src/routes/admin-handlers.ts:224-246`, `src/hooks/stores/admin/use-admin-customers-store.ts:14-63`, `src/hooks/use-admin.ts:103-138` | **Complete** |
| **4. Admin Orders (`/admin/orders`)** | `/api/admin/orders` returned D1 `customer_name`, array/JSON `items`, `payment_method`, `created_at`, and `pagination.total`, while store read `customer`, numeric `items`, `payment`, `createdAt`, `totalCount`. | `src/hooks/stores/admin/use-admin-orders-store.ts:21-81` | **Complete** |
| **5. Admin Dashboard (`/admin/dashboard`)** | `Dashboard.tsx` lacked mount `useEffect` to invoke `fetchDashboard()` / `fetchOrders()`; `/api/stats` returned `{ stats: { orders_today, revenue_today } }` instead of `DashboardStats`. | `src/pages/admin/Dashboard.tsx:1,49-53`, `src/hooks/stores/admin/use-admin-dashboard-store.ts:14-48` | **Complete** |
| **6. Admin Reservations (`/admin/reservations`)** | `/api/reservations` returned `{ success: true, data: [...] }` with D1 `customer_name`, `customer_phone`, `table_number`, `table_zone`, `guest_count`, `created_at`. | `src/hooks/stores/admin/use-admin-reservations-store.ts:14-56` | **Complete** |
| **7. Admin Staff Devices (`/admin/devices`)** | `listStaffDevices` (`GET /mobile/devices`) queried `staff_id` from D1 `staff_devices` but omitted `staff_id` in mapped JSON, crashing `Devices-table.tsx:59` (`fmtDeviceId(d.staff_id)`); `registerStaffDevice` lacked D1 `users` lookup fallback and rejected `'kitchen'` UI role (`Devices-register-modal.tsx:96`). | `packages/domain/staff/commands/staff-auth.ts:188-240,304-314`, `src/pages/admin/Devices-utils.ts:9-13`, `src/pages/admin/Devices-hooks.ts:36-41,67-82` | **Complete** |
| **8. Admin Menu & Promotions (`/admin/menu`, `/admin/promotions`)** | `src/pages/admin/menu-api.ts:10-21` called `fetch(path)` without `${API_BASE}`, without `credentials: 'include'`, and ignored Worker `data.error`, breaking Menu & Promotions CRUD on Cloudflare Pages (`auraspace.cafe`). | `src/pages/admin/menu-api.ts:1-25` | **Complete** |
| **9. Admin Subscriptions (`/admin/subscriptions`)** | `src/pages/admin/subscription-api.ts:3-14` omitted `credentials: 'include'`. | `src/pages/admin/subscription-api.ts:3-15` | **Complete** |
| **10. Admin Sales CSV Export & QR Download (`/admin/reports`, `/admin/qr`)** | `use-sales-report-data.ts:67` and `GenerateQR-utils.ts:2` called `fetch('/api/...')` without `${API_BASE}` and without `credentials: 'include'`. | `src/pages/admin/use-sales-report-data.ts:3,67-69`, `src/pages/admin/GenerateQR-utils.ts:1-6` | **Complete** |
| **11. Admin Check-in Approval (`/admin/checkin-approve`)** | `CheckinApprove-hooks.ts:17,33,48` called `/api/admin/checkins`, which was unmounted in `features-router.ts:147`, and D1 `checkins` rows (`customer_id`, `customer_name`, `checkin_time`) were not mapped to `PendingCheckin`. | `worker/src/routes/features-router.ts:147-149`, `worker/src/routes/checkin.ts:88,115,152-161`, `src/pages/admin/CheckinApprove-hooks.ts:6-55` | **Complete** |
| **12. Admin Push Notification Settings (`/admin/notifications`)** | `GET /api/push/list-subscriptions`, `DELETE /api/push/subscribe`, and `GET/PATCH /api/admin/notification-settings` were missing; manual staff subscribe `{ name, role }` and test push `{ targetRole, name }` failed Zod validation in `push.ts`. | `worker/src/routes/push.ts:9-138`, `worker/src/tree/push/notifier.ts:126-128`, `worker/src/routes/features-router.ts:153-171` | **Complete** |
| **13. Admin Loyalty (`/admin/loyalty`)** | `admin-loyalty.ts` omitted `/api/admin-loyalty` mount alias, excluded `'manager'` role in `requireAuth`, and queried `birthday` without `date_of_birth AS birthday` fallback in `/export`. | `worker/src/routes/features-router.ts:152`, `worker/src/routes/admin-loyalty.ts:35,120-135` | **Complete** |
| **14. Staff Notification Settings & SaaS Actions (`/mobile/*`, `/saas/dashboard`)** | `notification-settings.tsx:69` passed `credentials: 'omit'` to `/api/auth/me` and lacked `PATCH /api/staff/notification-settings` route; `receipt-download.tsx:11` and `cancel-dialog.tsx:20` omitted `${API_BASE}` and `credentials: 'include'`. | `src/components/staff/notification-settings.tsx:69,115-120`, `worker/src/routes/features-router.ts:172-184`, `src/pages/saas/dashboard/receipt-download.tsx:2,11-14`, `src/pages/saas/dashboard/cancel-dialog.tsx:6,20-24` | **Complete** |
| **15. Admin Metrics & Performance (`/admin/metrics`)** | `admin-metrics.ts:39-57` bound `${filter}%` into `LIKE ?` (turning `web_vital_*` into `web_vital_*%`, matching 0 rows in SQLite) and returned `{ metrics, total }` instead of `WebVitalsResponse` (`{ vitals, targets }`) or `APILatencyResponse` (`{ p50, p95, p99, requestCounts }`). | `worker/src/routes/admin-metrics.ts:38-129`, `src/hooks/stores/admin/use-performance-store.ts:53-112`, `tests/admin-metrics.test.ts:190-264` | **Complete** |

---

## 3. Go-Live Checklist & Execution Sequence

- [x] **Step 1 — Lock Fail-Closed Deploy & Migration Runners:** Verified `0` automatic D1 calls during normal deploys and strict `--file` validation across `deploy-cloudflare.sh`, `worker/scripts/apply-migrations.sh`, and `scripts/deploy-branded.sh` (`15/15` tests in `web-payment-and-staging-gates.test.ts`).
- [x] **Step 2 — Remediate Staff & Admin ↔ D1 Runtime Contracts:** Fixed all 15 contract mismatches and verified with `26/26` test files (`149/149` tests in Admin/Staff/Metrics/Deploy suite), `npx tsc --noEmit` (`0` errors), `npm run lint --silent` (`0` errors), `npm run lint:migrations` (`0` errors), and `npm run build --silent` (`exit 0`).
- [ ] **Step 3 — Read-Only Live D1 Audit & `schema_migrations` Baseline (`Phase 17`):** Upon owner authorization, run read-only `sqlite_master` + `push_subscriptions` + `audit_logs` checks on live `fnb-caffe-db` and seed `schema_migrations` with `execution_mode = 'baseline_verified'`.
- [ ] **Step 4 — Staging Gate & Live Smoke Verification (`Phase 04`):** Provision the 6 `*_STAGING` secrets and run the 4-stage staging smoke verification before production cutover.
