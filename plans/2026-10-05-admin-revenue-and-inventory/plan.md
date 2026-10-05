# Plan: Fullstack Admin Operations — Revenue Analytics & Inventory Management

## Overview
Connect frontend admin portal with Cloudflare D1 database and Edge AI by implementing missing revenue analytics endpoints (`/api/dashboard/overview`, `/api/reports/sales-by-*`) and constructing a comprehensive Admin Inventory Management subsystem (`/admin/inventory`) with stock levels, movement audits, supplier orders, and AI run-rate forecasting.

## Phases
- [x] **Phase 1: Backend Revenue & Overview Analytics Endpoints**: Implement `/api/dashboard/overview`, `/api/reports/sales-by-hour`, `/api/reports/sales-by-day`, `/api/reports/sales-by-category`, and `/api/reports/sales-by-payment` in `worker/src/routes/reports-handlers/grouped-sales-handlers.ts` and mount in `worker/src/routes/features-router.ts`.
- [x] **Phase 2: Frontend Admin Inventory Subsystem (< 200 LOC per file)**: Create modular inventory management page in `src/pages/admin/` with KPI cards, ingredients catalog, stock movement modal, movement history audit log, suppliers & purchase orders, and AI depletion forecasting.
- [x] **Phase 3: Route Mounting & Navigation Integration**: Mount `/admin/inventory` in `src/routes/admin-routes.tsx`, add menu entry in `src/components/stitch/StitchAdminTerminalNew-constants.ts`, and update bilingual dictionary in `src/locales/vi.json` & `en.json`.
- [x] **Phase 4: Automated Testing & Verification**: Write integration tests in `worker/src/__tests__/integrations/admin-reports-revenue.test.ts` (5/5 PASS) and component tests in `src/pages/admin/__tests__/Inventory.test.tsx` (4/4 PASS). Verify entire suite (3,640 tests PASS), 0 lint errors, 0 typecheck errors, and successful production build.
- [ ] **Phase 5: Branching, Commit, PR & Merge**: Create feature branch `feat/admin-revenue-inventory`, commit with conventional commit format, push, create PR #70, squash-merge into `main`, and document cook summary.
