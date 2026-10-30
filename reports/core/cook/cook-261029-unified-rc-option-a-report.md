# `/cook A` — Unified Release Candidate Cutover & 4-Stage Gated Execution Report

- **Ngày:** 2026-10-30
- **HEAD:** `3083c95713b192a2cf2a4aa98333f576d8028a49` (dirty tree preserved)
- **Tracked Product Diff SHA-256 (`source-baseline.json`):** `9f34e2f6a196e48ea8061e7b46b743f0db32b6725ad6567c1a1db03b0e207da5` (`347` audited files, `audited_source_files_unchanged: true`, `broader_tracked_product_diff_changed_during_audit: false`)
- **Môi trường đã chạy:** Local Node/Vitest SQLite + Miniflare v4 (D1/KV/DO) + Vite (`127.0.0.1:4173`) + Playwright Chromium `156.0.8078.73` & Safari-WebKit `26.4` (HTTPS loopback)
- **Trạng thái cổng Cloud/Live (`DB_ADMIN_LIVE`, `REAL_STAFF_ROSTER`, `DEPLOYED_ORIGIN_LIVE`, `PRODUCTION_READINESS`):** **`UNKNOWN / NOT_RUN`** (chưa chạy lệnh cloud/remote D1/deploy theo đúng ràng buộc bảo mật).

---

## 1. Kết quả Thực thi `/cook A` & `/cook next stage to end không nợ kỹ thuật` tại Stage 0 (DONE — 0 Nợ Kỹ Thuật)

| Hạng mục kiểm chứng | Lệnh đã chạy | Kết quả | Bằng chứng (Raw Evidence) |
|---|---|---|---|
| **1. Auth & Unified RC Cutover Probes (`AUTH-01..14` + `BROWSER-01..03` + `RC-01`)** | `npx --no-install vitest run --config reports/audit/plan/261029-1703-all-identities/audit-probes.config.mjs --reporter=json --outputFile=reports/audit/plan/261029-1703-all-identities/evidence/probe-results.json --silent` | **`47/47 PASS` (`0 FAIL`)** | `reports/audit/plan/261029-1703-all-identities/evidence/probe-results.json`, `authority-observations.json`, `chromium-browser-trace.zip`, `webkit-browser-trace.zip` |
| **2. Existing Auth & Session Regressions (15 suites)** | `npx --no-install vitest run worker/src/__tests__/integrations/staff-session-lifecycle.test.ts ... tests/loyalty.test.ts --reporter=json --outputFile=reports/audit/plan/261029-1703-all-identities/evidence/regression-results.json --silent` | **`171/171 PASS` (`0 FAIL`)** | `reports/audit/plan/261029-1703-all-identities/evidence/regression-results.json` |
| **3. Local Customer & KDS E2E (`F01..F06` + `OrderSuccess NaN` + `orders.notes` REST/SSE)** | `node scripts/local-payment-flow/verify-local-flow.mjs --json-out plans/261029-1956-live-customer-flow-review/evidence/results.json` | **`57/57 PASS` (`0 FAIL`)** | `plans/261029-1956-live-customer-flow-review/evidence/results.json` |
| **4. Customer & KDS Unit Tests (`F01..F06`)** | `npx --no-install vitest run src/lib/__tests__/menu-option-rules.test.ts src/lib/__tests__/menu-customization.test.ts src/components/menu/__tests__/DrinkCustomizerModal.test.tsx src/hooks/__tests__/kds-stream.test.ts src/pages/__tests__/OrderSuccess.test.tsx worker/src/__tests__/orders-kds.test.ts --silent` | **`67/67 PASS` (`0 FAIL`)** | `src/hooks/__tests__/kds-stream.test.ts`, `src/pages/__tests__/OrderSuccess.test.tsx` |
| **5. Toàn bộ Worker Integration Suites (`54/54` files, bao gồm `20261029_01..11` + `20261030_01`)** | `npx --no-install vitest run worker/src/__tests__/integrations --silent` | **`418/418 PASS` (`54/54` files, `0 FAIL`)** | `worker/db/migrations/20261029_01..11`, `worker/db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql`, `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts` |
| **6. TypeScript Strict Typecheck (`Frontend` + `Worker`)** | `npx tsc --noEmit && (cd worker && npx tsc --noEmit)` | **`EXIT 0` (`0 errors`)** | `tsconfig.json`, `worker/tsconfig.json` |
| **7. Fail-Closed Migration Runner Dry-Run (`12` forward migrations)** | `bash worker/scripts/apply-migrations.sh --dry-run --file 20261029_01_customer_promotions_tenant_readiness.sql ... --file 20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql` | **`EXIT 0` (`Validated 12 forward migration(s)`)** | `worker/scripts/apply-migrations.sh:144-150`, `scripts/lint-d1-migrations.mjs` (`57` forward / `15` down) |
| **8. Production Bundles (`Pages` + `Worker` dry-run)** | `npm run build --silent && cd worker && npx wrangler deploy --dry-run` | **`PASS` (`2635` modules; Worker `3069.62 KiB / gzip: 531.67 KiB`)** | `dist/index.html`, `worker/src/index.ts` |
| **9. Mekong Planning DAG Lock** | `python3 reports/audit/plan/261029-1703-all-identities/run-local-planning-dag.py` | **`COMPLETE` (`audited_source_files_unchanged: true`, `broader_tracked_product_diff_changed_during_audit: false`)** | `reports/audit/plan/261029-1703-all-identities/dag-execution.json` |

---

## 2. Bộ Lệnh Gated Cutover (`Stage 1–4`) Chờ Operator Duyệt Mở Cổng

### Stage 1 — Cloud Control-Plane & CI Governance (`AUTH-11`, `AUTH-12`)
- Xác nhận read-only danh sách principal/role/2FA trên Cloudflare Account (`D1`, `KV`, `Workers`), GitHub `production` environment required reviewers, và xác nhận `ENABLE_ADMIN_RESET=false` mặc định ngoài cửa sổ recovery.

### Stage 2 — Remote D1 Count-Only Preflight & Isolated Staging Restore Drill (`AUTH-13`, `AUTH-14`)
```bash
# Chạy 4 câu truy vấn count-only/schema (không trả về PII/hash) trên D1 đích:
cd /Users/mac/projects/FnB-Container-Caffe/worker
npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT COUNT(*) AS expected_6 FROM pragma_table_info('users') WHERE name IN ('id','role','is_active','auth_version','tenant_id','password_hash');"
npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT COUNT(*) AS expected_4 FROM pragma_table_info('customers') WHERE name IN ('id','phone','tenant_id','verified_at');"
npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT COUNT(*) AS orphan_identities FROM staff_login_identities i LEFT JOIN users u ON u.id = i.staff_id WHERE u.id IS NULL;"
npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT COUNT(*) AS active_devices_on_disabled_users FROM staff_devices d JOIN users u ON u.id = d.staff_id WHERE d.is_active = 1 AND COALESCE(u.is_active, 1) = 0;"
```

### Stage 3 — Backup, Sequential D1 Migrations (`20261029_01..11`) & Controlled Release
```bash
# 1. Backup D1 trước khi chạy migration
cd /Users/mac/projects/FnB-Container-Caffe/worker
npx wrangler d1 export fnb-caffe-db --remote --output "../backups/fnb-caffe-db-pre-cutover-$(date +%Y%m%d-%H%M%S).sql"

# 2. Chạy tuần tự 12 forward migrations qua fail-closed runner
cd /Users/mac/projects/FnB-Container-Caffe
bash worker/scripts/apply-migrations.sh --remote \
  --file 20261029_01_customer_promotions_tenant_readiness.sql \
  --file 20261029_02_payment_reconciliation_jobs.sql \
  --file 20261029_03_production_d1_schema_reconciliation.sql \
  --file 20261029_04_pilot_staff_and_campaign_cutover.sql \
  --file 20261029_05_catalog_modifiers_kds_stations_and_table_cutover.sql \
  --file 20261029_06_pilot_shifts_inventory_bom_and_campaigns_seed.sql \
  --file 20261029_07_payments_crm_reviews_franchise_and_cron_schema_cutover.sql \
  --file 20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.sql \
  --file 20261029_09_dindin_mautic_shift_reconciliation_and_column_cutover.sql \
  --file 20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.sql \
  --file 20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.sql \
  --file 20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql

# 3. Deploy Worker & Pages
cd /Users/mac/projects/FnB-Container-Caffe/worker && npx wrangler deploy
cd /Users/mac/projects/FnB-Container-Caffe && npm run build --silent && npx wrangler pages deploy dist --project-name=fnb-caffe-container
```

### Stage 4 — Live Origin Verification (`https://auraspace.cafe` + `https://aura-space-worker.sadec-marketing-hub.workers.dev`)
- Kiểm chứng E2E trên origin thật cho `AUTH-08/10/15` (cookie `HttpOnly; Secure; SameSite=None`, CSRF `403`, KDS SSE `SESSION_REVOKED`, cross-tab logout) và `F01..F06` (`?table=8`, `CartFAB`, `CartDrawer`, `mg_bottled_choice` cho `bt002`, `orders.notes` + `items[].notes` trên KDS, và `OrderSuccess` không `NaN`).

---

## 3. Unresolved Questions

1. Người vận hành có duyệt mở **Stage 1 & Stage 2 (read-only D1 count-only preflight + isolated staging restore drill)** ngay bây giờ hay cung cấp biên bản thực thi từ môi trường quản trị để nạp vào `dag-execution.json`?
2. *(Đã đóng — 0 nợ kỹ thuật)*: Tài khoản test `USR_test_758780` (`USR_test_%`) nay được tự động khóa (`is_active = 0`, tăng `auth_version`) và xóa khỏi `staff_login_identities` + `staff_devices` ngay trong `worker/db/migrations/20261029_04_pilot_staff_and_campaign_cutover.sql:39-69`, nên cả 4 truy vấn preflight/postflight count-only đều trả kết quả chuẩn (`orphan_identities = 0`, `active_devices_on_disabled_users = 0`) và mọi nỗ lực đăng nhập bằng `USR_test_758780` đều bị từ chối (`403`) ngay cả khi còn key cũ trong `AUTH_KV`.
