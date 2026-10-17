# AURA OS Full Repository Audit & Operational Remediation Plan

**Plan Identifier:** `plans/261014-0824-fnb-full-repo-audit`  
**Target:** `/Users/mac/mekong-cli/FnB-Container-Caffe`  
**Git Baseline:** `HEAD` (`a8190d5`), `origin/main` (`16b9173`)  
**Status:** In Progress (Audit Complete, Remediation Planned)  

---

## Executive Overview
This plan establishes the operational remediation strategy resulting from the comprehensive repository audit across Security, Performance, Compliance, and Architecture. It establishes concrete gates for moving from verified local test contracts to verified staging readiness.

---

## Phases & Execution Roadmap

| Phase | Title | Scope & Objectives | Status |
|:---|:---|:---|:---:|
| **[Phase 01](phase-01-audit-findings-and-severity-matrix.md)** | **Audit Findings & Severity Matrix** | Categorize all repo issues across Security, Performance, Compliance & Architecture | Complete |
| **[Phase 02](phase-02-high-risk-hardening-and-redaction.md)** | **High-Risk Hardening & Redaction** | Lock exact pricing ID, 503 readiness, health sanitization & logger redaction | Complete |
| **[Phase 03](phase-03-ci-pipeline-and-migration-linter.md)** | **CI Pipeline & Migration Linter** | Add `npm run build` and automated SQL migration linting to GitHub Actions | Complete |
| **[Phase 04](phase-04-staging-smoke-verification-and-go-live-gates.md)** | **Staging Smoke & Go-Live Gates** | 4-stage sandbox smoke test, credential acquisition & final release gates | Blocked (`GATE_3` static Pages-only rollback + `7/36` `.down.sql` files / `0/36` safely reversible on primary target, `GATE_4` Staging Creds) |
| **[Phase 05](phase-05-recruitment-rbac-and-migration-sync.md)** | **Recruitment RBAC & Migration Sync** | Enforce `owner`/`manager` RBAC on `DELETE`, scrub SQL errors & sync canonical migration | Complete |
| **[Phase 06](phase-06-rate-limit-production-bypass-hardening.md)** | **Rate Limit Production Bypass Hardening** | Gate localhost/loopback rate-limit bypass on `!isProd` & throttle public recruitment endpoint | Complete |
| **[Phase 07](phase-07-client-error-telemetry-hardening.md)** | **Client Error Telemetry Hardening** | Align `ErrorBoundary`/`api-client` schema, scrub URL secrets, throttle & isolate D1 errors | Complete |
| **[Phase 08](phase-08-inventory-rbac-and-erpnext-auth-hardening.md)** | **Inventory RBAC & ERPNext Auth Hardening** | Block `customer` role on `/api/inventory/items`, guard ERPNext POS/Invoices & scrub contact 500s | Complete |
| **[Phase 09](phase-09-webhook-simulation-and-customer-pii-hardening.md)** | **Webhook, Simulation & Customer PII Hardening** | Fix Cal.com webhook mount, guard `/bookings`, production-gate Zalo `/simulate` & customer PII | Complete |
| **[Phase 10](phase-10-multi-tenant-idor-and-edge-telemetry-hardening.md)** | **Multi-Tenant IDOR & Edge Telemetry Hardening** | Enforce JWT tenant confinement in `getTenantId`, guard IoT heartbeat in prod & harden order rate limit | Complete |
| **[Phase 11](phase-11-homeassistant-mobile-pretix-and-integration-hardening.md)** | **Home Assistant, Mobile & Pretix Hardening** | Fix HA no-op auth & webhook token bypass, wire mobile router `requireStaff`, guard Pretix & scrub 500s | Complete |
| **[Phase 12](phase-12-auth-otp-pin-shift-reconciliation-and-chat-hardening.md)** | **Auth OTP/PIN, Shift & Chat Hardening** | Enforce OTP/PIN brute-force lockouts, escape email HTML, guard shift reconciliation & scrub 500s | Complete |
| **[Phase 13](phase-13-openapi-auth-password-tree-auth-and-domain-error-hardening.md)** | **OpenAPI Auth, Auth Tree & Order/Catalog Hardening** | Fix OpenAPI password verify & OTP log leak, remove owner PII leak, block revoked JWT & scrub 500s | Complete |
| **[Phase 14](phase-14-rbac-manager-coverage-payment-idor-and-momo-webhook-hardening.md)** | **Manager RBAC, Payment IDOR & MoMo Webhook Hardening** | Add manager role to KDS/POS/tables/reports, guard payment IDOR, CSPRNG IDs & fail-closed MoMo key | Complete |
| **[Phase 15](phase-15-openapi-table-zones-auth-order-by-sqli-and-staff-security-hardening.md)** | **OpenAPI Table Zones Auth, ORDER BY SQLi & Staff/Loyalty Hardening** | Guard `/api/table-zones`, allowlist `ORDER BY` in 6 handlers, PBKDF2 staff hash & MoMo/Loyalty fixes | Complete |
| **[Phase 16](phase-16-web-payment-staging-gates-and-fail-closed-migrations.md)** | **Web Payment Fail-Closed, Staging Gates & Fail-Closed D1 Migration Runners** | Fail-closed Apple/Google Pay (`401`/`403`/`422`), `public/`+config build freshness & 4-target rollback gate checks, fail-closed D1 migration runners (`deploy-cloudflare.sh`, `apply-migrations.sh`, `deploy-branded.sh`), and verified Cloudflare rollback/Time Travel docs | Complete |
| **[Phase 17](phase-17-live-d1-ledger-baseline-and-rollback-orchestration.md)** | **Live D1 Schema Verification, Migration Ledger Baseline & 3-Tier Rollback Orchestration** | Read-only live D1 schema/data inspection (`push_subscriptions`, `audit_logs`, 9 remote-only tables), checksum-verified `schema_migrations` ledger baseline, 3-tier `deploy-rollback.sh` (Pages + Worker + D1 Time Travel PITR), and legacy migration directory consolidation | Complete (Static 3-Tier Rollback Implemented & Verified; Live D1 Ledger Baseline Ready for Pre-Release Run) |
| **[Phase 18](phase-18-staff-and-admin-d1-contract-sync-and-go-live-plan.md)** | **Staff & Admin D1 Runtime Contract Sync & Go-Live Execution Plan** | Align all 15 Staff & Admin ↔ Worker/D1 contracts (`AUTH_KV` + D1 `users`, `staff_devices`, `audit_logs`, `customers`, `orders`, `stats`, `reservations`, `checkins`, `push_subscriptions`, `_metrics`, `API_BASE` + cookies); lock A1+B1 Go-Live plan | Complete |
| **[Phase 19](phase-19-mobile-staff-kds-and-admin-integrations-sync.md)** | **Mobile Staff, KDS Lifecycle & Admin Integrations D1 Contract Sync** | Remediate 6 Wave 2 Staff Mobile (`/mobile/tables` ↔ `cafe_tables`, `/mobile/orders` `NOT NULL` columns), KDS (`pending→preparing` + `/api/admin/orders/:id/*`), and Admin Integrations (`/api/admin/birthday/config`, `/api/admin/erpnext-sync/*`, `useAdmin`) contracts | Complete |
| **[Phase 20](phase-20-admin-loyalty-broadcast-checkin-subscriptions-sync.md)** | **Admin Loyalty, Broadcast, Checkin & Subscriptions D1 Contract Sync** | Align Admin Broadcast (`loyalty_tier`, `date_of_birth`), Customer Segments (`date_of_birth`), Loyalty Dashboard (`cashback_wallets`, `orders`), Checkin Approvals (`cashback_wallets` balance/spent), and Subscriptions resilience | Complete |

---

## Dependencies & Blockers
- **Local Verification:** Typecheck (`npm run typecheck:all`), ESLint (`npm run lint` -> `eslint worker/src/ --ext .ts`), 4-directory migration lint (`npm run lint:migrations`: 63 forward, 7 down), targeted Vitest (`web-payment-and-staging-gates.test.ts` `15/15` passed; Staff/Admin/Metrics/Deploy suite `149/149` passed across `26` files + `77/77` across `13` route/store/page files), and Vite build (`npm run build`) pass.
- **Release Gate Blockers (`npm run verify:gates`):**
  1. `GATE_3_ROLLBACK_READINESS`: `FAIL` (static script inspection of `scripts/deploy-rollback.sh` is `pages=static_command_detected, worker=unreferenced, d1=unreferenced` with `evidence=static_script_inspection, runtimeVerified=false`; migration rollback readiness on selected primary target `worker/db/migrations` is `7/36` `.down.sql` files present [`29` missing] and `0/36` safely reversible without data-loss/schema-drift hazards [`7` existing `.down.sql` flagged]; non-blocking inventory: `scripts/migrations` `0/7`, `db/migrations` `0/9` [Unknown], `worker/migrations` `0/11` [Unknown]).
  2. `GATE_4_STAGING_CREDENTIALS`: `PENDING` (`6/6` staging credentials missing in local environment).
- **Production Guardrail:** No production deploy or migration execution until `GATE_3` and `GATE_4` pass.
