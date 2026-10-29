# `/cook A` — Unified Release Candidate Cutover & 4-Stage Gated Execution Report

- **Ngày:** 2026-10-30
- **HEAD:** `b553209bd07a3437c622e3e324ee4e0b17c12f91` (dirty tree preserved)
- **Tracked Product Diff SHA-256 (`source-baseline.json`):** `7c25cd6ac40a644ecae71b78b838584d92218d0d468ac67a0f37d1c955f30bce` (`347` audited files, `audited_source_files_unchanged: true`, `broader_tracked_product_diff_changed_during_audit: false`)
- **Môi trường đã chạy:** Local Node/Vitest SQLite + Miniflare v4 (D1/KV/DO) + Vite (`127.0.0.1:4173`) + Playwright Chromium `156.0.8078.73` & Safari-WebKit `26.4` (HTTPS loopback)
- **Trạng thái cổng Cloud/Live (`DB_ADMIN_LIVE`, `REAL_STAFF_ROSTER`, `DEPLOYED_ORIGIN_LIVE`, `PRODUCTION_READINESS`):** **`UNKNOWN / NOT_RUN`** (chưa chạy lệnh cloud/remote D1/deploy theo đúng ràng buộc bảo mật).

---

## 1. Kết quả Thực thi `/cook A` tại Stage 0 (Unified Local & Dual-Browser RC Gate — DONE)

| Hạng mục kiểm chứng | Lệnh đã chạy | Kết quả | Bằng chứng (Raw Evidence) |
|---|---|---|---|
| **1. Auth & Unified RC Cutover Probes (`AUTH-01..14` + `BROWSER-01..03` + `RC-01`)** | `npx --no-install vitest run --config reports/audit/plan/261029-1703-all-identities/audit-probes.config.mjs --reporter=json --outputFile=reports/audit/plan/261029-1703-all-identities/evidence/probe-results.json --silent` | **`47/47 PASS` (`0 FAIL`)** | `reports/audit/plan/261029-1703-all-identities/evidence/probe-results.json`, `authority-observations.json`, `chromium-browser-trace.zip`, `webkit-browser-trace.zip` |
| **2. Existing Auth & Session Regressions (15 suites)** | `npx --no-install vitest run worker/src/__tests__/integrations/staff-session-lifecycle.test.ts ... tests/loyalty.test.ts --reporter=json --outputFile=reports/audit/plan/261029-1703-all-identities/evidence/regression-results.json --silent` | **`171/171 PASS` (`0 FAIL`)** | `reports/audit/plan/261029-1703-all-identities/evidence/regression-results.json` |
| **3. Local Customer & KDS E2E (`F01..F06` + `OrderSuccess NaN` + `orders.notes` REST/SSE)** | `node scripts/local-payment-flow/verify-local-flow.mjs --json-out plans/261029-1956-live-customer-flow-review/evidence/results.json` | **`57/57 PASS` (`0 FAIL`)** | `plans/261029-1956-live-customer-flow-review/evidence/results.json` |
| **4. Customer & KDS Unit Tests (`F01..F06`)** | `npx --no-install vitest run src/lib/__tests__/menu-option-rules.test.ts src/lib/__tests__/menu-customization.test.ts src/components/menu/__tests__/DrinkCustomizerModal.test.tsx src/hooks/__tests__/kds-stream.test.ts src/pages/__tests__/OrderSuccess.test.tsx worker/src/__tests__/orders-kds.test.ts --silent` | **`67/67 PASS` (`0 FAIL`)** | `src/hooks/__tests__/kds-stream.test.ts`, `src/pages/__tests__/OrderSuccess.test.tsx` |
| **5. D1 Cutover & Schema Reconciliation Suites (`20261029_01..11`)** | `npx --no-install vitest run worker/src/__tests__/integrations/production-d1-schema-reconciliation.test.ts ... worker/src/__tests__/integrations/loyalty-referrals-inventory-po-customer-events-and-audit-cutover.test.ts --silent` | **`21/21 PASS` (`10/10` files)** | `worker/db/migrations/20261029_01..11` |
| **6. Fail-Closed Migration Runner Dry-Run (`11` forward migrations)** | `bash worker/scripts/apply-migrations.sh --dry-run --file 20261029_01_customer_promotions_tenant_readiness.sql ... --file 20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.sql` | **`EXIT 0` (`Validated 11 forward migration(s)`)** | `worker/scripts/apply-migrations.sh:144-150` |
| **7. Production Bundles (`Pages` + `Worker` dry-run)** | `npm run build --silent && cd worker && npx wrangler deploy --dry-run` | **`PASS` (`2635` modules; Worker `3069.62 KiB / gzip: 531.67 KiB`)** | `dist/index.html`, `worker/src/index.ts` |
| **8. Mekong Planning DAG Lock** | `python3 reports/audit/plan/261029-1703-all-identities/run-local-planning-dag.py` | **`COMPLETE` (`audited_source_files_unchanged: true`, `broader_tracked_product_diff_changed_during_audit: false`)** | `reports/audit/plan/261029-1703-all-identities/dag-execution.json` |

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

# 2. Chạy tuần tự 11 forward migrations qua fail-closed runner
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
  --file 20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.sql

# 3. Deploy Worker & Pages
cd /Users/mac/projects/FnB-Container-Caffe/worker && npx wrangler deploy
cd /Users/mac/projects/FnB-Container-Caffe && npm run build --silent && npx wrangler pages deploy dist --project-name=fnb-caffe-container
```

### Stage 4 — Live Origin Verification (`https://auraspace.cafe` + `https://aura-space-worker.sadec-marketing-hub.workers.dev`)
- Kiểm chứng E2E trên origin thật cho `AUTH-08/10/15` (cookie `HttpOnly; Secure; SameSite=None`, CSRF `403`, KDS SSE `SESSION_REVOKED`, cross-tab logout) và `F01..F06` (`?table=8`, `CartFAB`, `CartDrawer`, `mg_bottled_choice` cho `bt002`, `orders.notes` + `items[].notes` trên KDS, và `OrderSuccess` không `NaN`).

---

## 3. Unresolved Questions

1. Người vận hành có duyệt mở **Stage 1 & Stage 2 (read-only D1 count-only preflight + isolated staging restore drill)** ngay bây giờ hay cung cấp biên bản thực thi từ môi trường quản trị để nạp vào `dag-execution.json`?
2. Tài khoản `USR_test_758780` trên D1 remote sẽ được khóa (`status = 'disabled', is_active = 0`) hay xóa khỏi `AUTH_KV` trước khi chạy migration `20261029_04`?
