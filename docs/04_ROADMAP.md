---
date: 2025-06-19
version: 1.0
status: stable
---

# PROJECT ROADMAP — AURA CAFE CONTAINER

## Current State: Production v2.1.0 (Stable)

**Status:** Production running at `https://fnb-caffe-container.pages.dev`  
**Last major release:** March 31, 2026  
**Deployment platform:** Cloudflare Pages + Workers + D1  
**Monthly hosting cost:** ~700,000 VND (Free Tier + Paid plan mix)

---

## Historical Milestones

### v1.0.0 — Initial Launch (March 10, 2026)

- ✅ Complete F&B Container website build
- ✅ Basic order system (HTML + JavaScript)
- ✅ Initial admin panel

---

### v2.0.0 — Cloudflare Migration & Revenue Engine (March 17, 2026)

**Major Features:**
- ✅ Full migration to Cloudflare Workers + D1 + KV
- ✅ Multi-payment: COD, MoMo, VNPay, PayOS
- ✅ PayOS production webhook integration
- ✅ Optimized checkout flow with QR codes
- ✅ Automatic order processing pipeline
- ✅ Delivery fee calculation by ward distance
- ✅ Free delivery threshold (300K)

**Additional Features:**
- ✅ Happy Hour System (14:00-16:00, 20% off drinks)
- ✅ Loyalty & Referral Program
  - Multi-tier: Bronze/Silver/Gold/Platinum
  - Referral commissions (30%)
  - Birthday rewards
  - Check-in points
- ✅ Churn Prevention (30-day inactive detection, win-back campaigns)
- ✅ PWA: offline mode, home screen, push notifications
- ✅ SEO: meta tags, Open Graph, sitemap, structured data

**Design:**
- ✅ Material Design 3 implementation
- ✅ Dark mode support
- ✅ Responsive design (mobile-first)

---

### v5.0.0 — Loyalty Expansion (March 14, 2026)

- ✅ Loyalty rewards system refinement
- ✅ SEO enhancements
- ✅ Admin dashboard with analytics
- ✅ Performance optimizations

---

### v2.1.0 — Production Polish (March 31, 2026)

**Maintenance & Quality:**
- ✅ Removed all console.log from production (keep console.error only)
- ✅ Fixed remaining TODOs in checkout and config
- ✅ Updated README with Quick Start and API endpoints
- ✅ Cleaned up legacy Python files
- ✅ Fixed test environment configuration
- ✅ Removed minified assets from git tracking
- ✅ Version sync across package.json, README, CHANGELOG

**Infrastructure:**
- ✅ CI/CD pipeline stabilization
- ✅ 576 unit tests (14 test suites)
- ✅ Test coverage ≥ 80%

---

### v3.0.0 — React SPA Migration (June 2026)

- ✅ 19 static HTML pages → React + Vite + TypeScript SPA
- ✅ Component architecture: 20+ component dirs, 27 routes
- ✅ Zustand state management (use-cart-store pattern)
- ✅ TanStack Query for server state (pre-migration to Zustand stores)
- ✅ Cloudflare Pages deploy with SPA routing (_redirects)
- ✅ 268 unit tests, 0 TypeScript errors

---

### v3.1.0 — Full API Integration (July 1, 2026)

- ✅ **14 Zustand stores** wired to Hono Worker APIs (1592 lines)
- ✅ **JWT auth system**: login, register, logout, ProtectedRoute, AuthProvider
- ✅ **Revenue path**: Menu, Orders, Payments (PayOS + COD)
- ✅ **Loyalty program**: Tiers, points, cashback, referrals, phone-auth
- ✅ **Admin dashboard**: 5 admin stores, 9 pages wired (orders, customers, staff, reservations, POS)
- ✅ **Operations**: Reservations, Checkin, Contact, TrackOrder, KDS, TVMenu
- ✅ **410 tests** (56 test files), 0 TypeScript errors, build passes
- ✅ Deployed to Cloudflare Pages (fnb-caffe-container-biy.pages.dev)

---

## Current Capabilities (v3.1.0)

### Completed Systems

| System | Status | Notes |
|--------|--------|-------|
| **Order Management** | ✅ Production | POS, KDS, status workflow, admin order view |
| **Payment Processing** | ✅ Production | PayOS, COD, transaction tracking |
| **Loyalty Program** | ✅ Production | 4 tiers, points, cashback, referral, check-in |
| **Reservations** | ✅ Production | Table booking, capacity management |
| **Menu Management** | ✅ Production | Categories, products, pricing in VND |
| **Customer Management** | ✅ Production | Phone-based auth, profiles |
| **Admin Dashboard** | ✅ Production | Metrics, charts, top products |
| **KDS (Kitchen)** | ✅ Production | Real-time order display, status updates |
| **PWA** | ✅ Production | Offline mode, installable |
| **SEO** | ✅ Production | Meta tags, sitemap, structured data |

---

## Roadmap: Next Phases

### Phase 1: 12 Pillars Integration (Q3-Q4 2026)

**Goal:** Complete integration of all 12 open-source pillars to create a unified F&B ecosystem.

#### Pillar Integration Status

| Pillar | Current | Target | Effort | Owner |
|--------|---------|--------|--------|-------|
| **1. ERPNext POS/ERP/CRM** | 🟢 Complete (Adapter & E2E Verified) | ✅ Full | 45h (all done) | backend-dev |
| **2. Cal.com** | 🟢 Complete | ✅ Full | 20h (all done) | integration |
| **3. OpenWISP** | 🟢 Complete (Captive Portal & CRM Tagging) | ✅ Full | 30h (all done) | infra |
| **4. pretix** | 🟢 Complete | ✅ Full | 25h (all done) | integration |
| **5. TastyIgniter** | 🟢 Complete (Bridge & Inbound Webhooks) | ✅ Full | 35h (all done) | backend-dev |
| **6. Xibo/Anthias** | 🟢 Complete | ✅ Full | 20h (all done) | frontend |
| **7. Mautic** | 🟢 Complete | ✅ Full | 25h (all done) | marketing |
| **8. Home Assistant** | 🟢 Complete (Presence Triggers & Webhook) | ✅ Full | 15h (all done) | infra |
| **9. Frigate** | 🟢 Complete (CCTV AI & Occupancy Analytics) | ✅ Full | 20h (all done) | infra |
| **10. Payment Gateways** | 🟢 Complete (PayOS, SePay, Web Payments) | ✅ Done | - | - |
| **11. Mixpost** | 🟢 Complete | ✅ Full | 20h (all done) | marketing |
| **12. SMTP** | 🟢 Complete (Transactional Receipts) | ✅ Enhanced | 10h (all done) | ops |

**Phase 1 Status:** 🟢 COMPLETE (12/12 Pillars Integrated & Verified E2E, 3,579 Tests Passing, DDL Migration `20261003_01_pillar_tables.sql`)  
**Timeline:** Completed Q4 2026  
**Dependencies:** All pillar clients provide native fallback/mock modes for zero-credential testability; production endpoints configurable via Cloudflare secrets.

---

### Phase 2: Mobile App / PWA Enhancements & Offline Cart Sync (Q4 2026)

**Status:** 🟢 COMPLETE (PR #65)

**Deliverables:**
- ✅ Backend offline order sync endpoint `POST /api/orders/sync` in `worker/src/routes/orders-core.ts`
- ✅ Dual payload support (nested `{ localId, orderData }` and flat `{ localId, items }`)
- ✅ KV idempotency caching (`order:idempotency:offline:${localId}`) with 24h TTL
- ✅ Client `OfflineDB` (`src/lib/offline-db.ts`) with `localId` preservation and queue pruning
- ✅ Automatic store sync reconciliation in `useOfflineSync` and `useOrderStore` upon reconnection
- ✅ 100% test pass rate across `orders-sync.test.ts` and `use-offline-sync.test.ts`

---

### Phase 3: Multi-Tenant & Franchise Preparation (Q4 2026)

**Status:** 🟢 COMPLETE (PR #66)

**Deliverables:**
- ✅ DDL migration `20261004_01_multi_tenant_franchise.sql` applied to production D1 `AURA_DB` (72 tables total)
- ✅ Row-level tenant partitioning (`tenant_id TEXT NOT NULL DEFAULT 'default'`) across core domain tables (`orders`, `cafe_tables`, `inventory_items`, `reservations`)
- ✅ Franchise location registry (`franchise_locations`), settlement ledger (`royalty_settlements`), and analytics
- ✅ Composite performance indexes on `(tenant_id, created_at)`, `(tenant_id, status)`, `(tenant_id, table_number)`, `(tenant_id, sku)`, and `(tenant_id, date)`
- ✅ Multi-tenant franchise E2E test suite passing (`multi-tenant-franchise.test.ts` — 8/8 PASS)

---

### Phase 4: AI & Edge Automation (Q4 2026)

**Status:** 🟢 COMPLETE (PR #67)

**Deliverables:**
- ✅ DDL migration `20261004_02_ai_automation.sql` applied to production D1 `AURA_DB` (75 tables total)
- ✅ AI menu cross-sell recommendations engine (`/api/ai/recommendations`) with collaborative filtering and time-of-day affinity
- ✅ Edge AI stock run-rate forecasting and safety stock replenishment calculation (`/api/inventory/forecasting/run-rate`, `/safety-stock`)
- ✅ 7-day sales and demand forecasting endpoint (`/api/analytics/demand-forecast`)
- ✅ AI automation E2E test suite passing (`ai-automation.test.ts` — 14/14 PASS)

---

### Phase 5: Autonomous Edge Operations & Dynamic Pricing (Q4 2026)

**Status:** 🟢 COMPLETE (PR #68)

**Deliverables:**
- ✅ DDL migration `20261004_03_autonomous_edge_ops.sql` applied to production D1 `AURA_DB` (78 tables total)
- ✅ Real-time dynamic pricing engine (`/api/pricing/dynamic/calculate` & `/rules`) supporting Happy Hour, weather surcharges, and inventory-clearance discounts
- ✅ Edge telemetry watchdog (`/api/edge/telemetry/heartbeat`, `/anomalies`, `/metrics`) with error rate and p95 latency tracking
- ✅ Zalo OA webhook challenge verification and barista concierge assistant endpoint (`/api/chat/assistant`)
- ✅ Autonomous edge ops E2E test suite passing (`autonomous-edge-ops.test.ts` — 15/15 PASS)

---

### Phase 6: Zero-Defect Browser E2E Remediation (Q4 2026)

**Status:** 🟢 COMPLETE (PR #69)

**Deliverables:**
- ✅ Fixed uncached `getSnapshot` in `TableOrder-hooks.ts`, eliminating React 19 / Zustand v5 infinite render loop crashes
- ✅ Added Vite dev server mock handlers for `/api/vitals` and `/api/errors`, eliminating 404 beacon console errors
- ✅ Centralized canonical `API_BASE` resolution across client callers
- ✅ Added `silent` fetch option and `AbortError` filter in `src/lib/api-client.ts` to suppress expected cancellation logs
- ✅ 0 browser runtime errors, 0 infinite loops, 0 audit failures across Playwright E2E suites

---

### Phase 7: Fullstack Admin Operations — Revenue Analytics & Inventory Management (Q4 2026)

**Status:** 🟢 COMPLETE (PR #70)

**Deliverables:**
- ✅ Grouped sales analytics endpoints in `worker/src/routes/reports-handlers/grouped-sales-handlers.ts`:
  - `GET /api/dashboard/overview?from=...&to=...`: Time-window aggregation with previous-period comparison (% change, AOV, order totals)
  - `GET /api/reports/sales-by-hour`: Hourly revenue distribution with 24-slot zero-filling (`00:00` to `23:00`)
  - `GET /api/reports/sales-by-day`: Grouped daily sales
  - `GET /api/reports/sales-by-category`: Category breakdown
  - `GET /api/reports/sales-by-payment`: Payment method breakdown (`payos`, `cash`, `sepay`, `card`)
- ✅ Frontend Admin Inventory Subsystem (`/admin/inventory`) strictly `< 200 LOC` per file:
  - `inventory-types.ts`, `Inventory.tsx`, `Inventory-stats-cards.tsx`, `Inventory-ingredients-tab.tsx`, `Inventory-movement-modal.tsx`, `Inventory-movements-tab.tsx`, `Inventory-suppliers-tab.tsx`, `Inventory-forecast-tab.tsx`
- ✅ Mounted `/admin/inventory` in `src/routes/admin-routes.tsx` and navigation item in `StitchAdminTerminalNew-constants.ts`
- ✅ Dedicated integration test suite (`admin-reports-revenue.test.ts` & `Inventory.test.tsx` — 9/9 PASS; monorepo suite 3,640 PASS)

---

## Dependencies & Blockers

### External Dependencies

| Dependency | Impact | Timeline |
|------------|--------|----------|
| **E-invoicing compliance** | Mandatory for all Vietnamese businesses from June 2025 | Must integrate ERPNext Accounting or alternative by Q3 2026 |
| **Cloudflare pricing changes** | Could affect Free Tier viability | Monitor quarterly |
| **Payment gateway API changes** | PayOS/MoMo/SePay API version upgrades | Test before production push |

### Internal Dependencies

- **Backend team:** Must complete 12 pillars integration (180h effort remaining)
- **Infrastructure:** Raspberry Pi setup for Home Assistant/Frigate/Xibo
- **Legal:** E-invoicing compliance review (accounting firm)

---

## Success Metrics by Phase

### Phase 1 Completion Criteria

- ✅ All 12 pillars integrated and tested
- ✅ Documentation updated (ADR, architecture)
- ✅ Integration tests passing for each pillar
- ✅ Cost model still ≤ 1M VND/month
- ✅ No regression in existing features

---

## Timeline Summary

```
2026 Q2:  Production stabilization, monitoring, bug fixes
2026 Q3:  Begin 12 pillars integration (ERPNext, Cal.com, OpenWISP)
2026 Q4:  Complete 12 pillars integration (TastyIgniter, Xibo, Mautic)
2027 Q1:  Evaluate mobile app needs
2027 Q2:  Multi-tenant architecture design
2027 Q3:  AI/automation exploration
2027 Q4:  Review & planning for next year
```

---

## Risk Register Link

See `10_RISK_REGISTER.md` for detailed risk analysis including:
- Cloudflare Free Tier limits
- 12 pillars integration complexity
- E-invoicing compliance timeline
- Team capacity constraints

---

## Multi-Tenancy Deferral Note (2026-08)

Business-table tenancy (`tenant_id` on orders/products/...) is deferred until a second tenant onboards. Identity plumbing is already in place: `users.tenant_id` (D1) → login JWT claim → tenant middleware. When tenancy activates, row scoping MUST go through `worker/src/tree/orders/shared-listing.ts` — the single query-builder shared by `/api/admin/orders` and the KDS listing.

---

## Related Documents

- `01_GOAL.md` — Project objectives and success criteria
- `03_ARCHITECTURE.md` — System design and components
- `05_TASKS/` — Detailed task breakdowns by domain
- `06_ADR/` — Architecture decisions affecting roadmap
- `07_EVALUATION.md` — KPIs and monitoring
- `08_BUSINESS_MODEL.md` — Revenue and cost projections
- `09_BEHAVIOR_GRAPH.md` — User journey improvements
- `12_CHANGELOG.md` — Version history

---

*Last updated: 2026-08-25 — Production Readiness & Launch Control plan APPROVED (full 7 phases): Phase 1 baseline/SLOs completed → plans/260814-production-readiness-launch-control/. Data audit 2026-08-24 fixed checkins/users DDL drift (plans/reports/audit-260824-1235-*). Pillar status below unchanged since 2026-07-01.*

*Historical (2026-07-01): pretix complete (25 tests). Mixpost complete (33 tests). Xibo complete (30 tests). Mautic complete (73 tests). Cal.com complete (8 tests, webhook + embed). ERPNext Phase 08 blocked on credentials. Total: 7/12 pillars, 814 tests.*
