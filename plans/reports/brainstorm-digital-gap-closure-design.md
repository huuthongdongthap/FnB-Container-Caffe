---
phase: 2
title: Digital Gap Closure — Brainstorm Design Report
status: proposed
duration: 8-10 weeks
effort: ~76h implementation
depends_on: []
---

# Digital Gap Closure — Brainstorm Report

## Context

AURA CAFE digital platform is **LIVE** (auraspace.cafe). Phase 2 closes 7 identified digital gaps (G2-G9) while Physical Buildout (P1) and Regulatory (P3) run in parallel. This is the **only phase executable by the dev team** — P1/P3 are owner-action only.

---

## Scoping Decision

**Full execution of all 7 gaps** per user confirmation. Sprint grouping by effort + dependency:

- **Sprint 1** (Week 1-2, ~6h): Quick wins — G2 MoMo + G5 inventory prep
- **Sprint 2** (Week 3-4, ~22h): Token migration + first 10 G3 screens (critical path)
- **Sprint 3** (Week 5-6, ~32h): Remaining 18 G3 screens + G4 staff push + G9 PWA
- **Sprint 4** (Month 2-3, ~16h): G5 ERPNext sync + G6 wiring + integration testing

---

## Gap-by-Gap Analysis

### G2: MoMo Payment Integration (4h) — P1

**Problem:** PayOS is live but MoMo (Vietnam's #2 wallet, 30%+ market share) is configured in .env.example but NOT integrated. Losing ~30% of mobile wallet users.

**Approach:** Mirror PayOS pattern exactly.

```
Files:
  worker/src/routes/payments/momo-create.ts   (NEW)
  worker/src/routes/webhooks/momo.ts          (NEW)
  worker/src/routes/payments/index.ts         (MODIFY — add MoMo route)
  src/hooks/stores/use-payment-store.ts       (MODIFY — add MoMo method)
```

**Flow:** Create link → MoMo App/QR redirect → webhook IPN → update order status → Telegram + email notification (exact same async chain as PayOS).

**Risk:** MoMo sandbox endpoints change annually. Must note exact sandbox URL in code comments.

**Acceptance:** End-to-end sandbox payment creates order, webhook fires, status updates, receipt sent.

---

### G3: 28 Stitch Screens → React (70h) — P1

**Problem:** 28 screens from Stitch AI design need React conversion. 916 `--st-*` CSS tokens exist as legacy aliases alongside `--aura-*` tokens — chaos risk if not cleaned first.

**Token Migration Strategy (CRITICAL DECISION):**

- **Option A** Bulk sed replace + manual spot-check (5-10h, risk: miss edge cases)
- **Option B** Per-component manual migration (30-40h, quality: highest)
- **Option C** Bulk replace + automated regression (20h, balanced) ✅ RECOMMENDED

**Chosen: Option C**
1. Bulk replace `--st-` with `--aura-` in brand-tokens.css aliases (keep semantic mappings documented)
2. Run visual regression on top 10% highest-traffic screens (/, /menu, /checkout, /admin/dashboard)
3. Spot-check remaining 90% via component unit tests
4. Delete `stitch-tokens.css` entirely after migration verified

**Screen batches:**

| Batch | Screens | Timing |
|-------|---------|--------|
| Customer (5) | Home hero, Menu, Checkout, Order success, Loyalty | Sprint 2 Week 3 |
| Customer (5) | Referral, Reservations, Tracking, Account, Reviews | Sprint 2 Week 4 |
| Admin (5) | Dashboard, Orders, Menu manage, Customers, Promotions | Sprint 3 Week 5 |
| Admin (3) | Staff, Analytics, Settings | Sprint 3 Week 6 |

**Acceptance:** All 28 screens render correctly with `--aura-*` tokens, zero `--st-*` references remain in production code.

---

### G4: Staff Mobile Push Notifications (16h) — P1

**Problem:** Kitchen staff (KDS) and FOH staff need real-time order alerts on mobile devices. Current state: push subscription component exists, staff notification routes exist via Zalo/SMS.

**Approach:** Extend existing push infrastructure.

```
Files:
  src/components/push/              (EXTEND existing)
  src/components/staff/             (NEW directory)
  worker/src/routes/push/           (NEW)
  sw.js extensions                   (MODIFY)
```

**Notifications:**
- New order → KDS tablet (urgent, 1x repeat)
- Order status change (paid, preparing, ready) → customer + FOH staff
- Shift reminder → assigned staff (daily cron trigger)
- Low inventory alert → kitchen manager

**Acceptance:** Staff subscribes on mobile, receives push for new order, dismisses/acts on it.

---

### G5: Real-Time Inventory Management (12h) — P2

**Problem:** No inventory table exists. Kitchen runs on manual stock checks. ERPNext sync is a future goal but D1 storage layer must exist first.

**Approach:** Two-phase within this sprint.

**Phase A (Sprint 1 — Schema, 2h):**
```
New D1 table: inventory_items
  id, sku, name, category, unit, current_stock, min_stock, max_stock
  last_synced, last_ordered, supplier_id, cost_per_unit
  created_at, updated_at

New D1 table: inventory_transactions
  id, item_id, type (in/out/adjust/waste), quantity, reference_id
  reference_type (order/purchase/adjustment), notes, created_at
```

**Phase B (Sprint 4 — ERPNext Sync, 10h):**
- Weekly cron: `GET /api/inventory/sync` → push D1 → ERPNext (if credentials available)
- Fallback: if no ERPNext credentials, cron writes to `inventory_sync_log` table for later replay

**Acceptance:** Inventory CRUD API works, POS orders auto-decrement stock, weekly sync attempts ERPNext OR logs for replay.

---

### G6: ERPNext Full Wiring (16h) — P2

**Problem:** Stub routes exist (`erpnext.ts`, `erpnext-pos.ts`, `erpnext-invoices.ts`) but never wired to live API. 3 client mappers exist but never called.

**Hard Constraint:** BLOCKED until owner provides ERPNext API credentials (endpoint, API key, secret). Cannot proceed without these.

**Fallback Design (Sprint 4):**
1. Implement mock ERPNext client that logs request/response shapes to `erpnext_sync_log`
2. This allows G5 sync cron to be tested end-to-end without real ERPNext
3. When owner provides credentials → swap mock client for real HTTP client
4. Wire: invoice creation, POS sales orders, CRM leads, inventory item push

**Files:**
```
worker/src/lib/erpnext-client.ts         (NEW — real or mock)
worker/src/lib/erpnext-mapper.ts         (EXTEND existing)
worker/src/routes/erpnext.ts             (WIRE existing stubs)
worker/src/routes/erpnext-pos.ts         (WIRE existing stubs)
worker/src/routes/erpnext-invoices.ts    (WIRE existing stubs)
```

**Acceptance:** If credentials available: full ERPNext E2E. If not: mock client logs shape, real wiring path is 1 file swap away.

---

### G9: PWA Full Offline Mode (8h) — P2

**Problem:** `public/sw.js` exists but only caches static assets. No offline menu, no offline order queue. Customer on bad 3G/4G in rural Sa Đéc loses access.

**Approach:** Extend existing service worker.

```
Files:
  public/sw.js                           (EXTEND)
  src/hooks/use-offline-queue.ts         (NEW)
  src/components/pwa/offline-banner.tsx  (NEW)
```

**Features:**
- Offline menu: cache last 30 days of menu data in CacheStorage
- Offline order queue: store orders in IndexedDB, auto-submit when online
- Background sync: use Background Sync API where available
- Offline banner: show "You're offline — orders will sync when connected"
- Cache strategy: stale-while-revalidate for menu, network-first for orders

**Acceptance:** Turn off WiFi → menu loads from cache → place order → stored in IndexedDB → turn WiFi on → order auto-submits.

---

## Dependency Graph

```
G7 (✅ DONE)
  ├── G2 (MoMo payment) ───────────────────┐
  │     └── G3 (28 screens, checkout uses) ├──→ All screens functional
  ├── G5 (Inventory schema) ───────────────┤
  │     └── G5-sync (ERPNext) ─────────────┘
  └── G4 (Staff push) ←→ G9 (PWA offline)
        └── G6 (ERPNext wiring) — BLOCKED by credentials
```

**Critical path:** G2 → G3 screens (G3 is the longest pole at 70h)

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Token migration misses edge tokens | Medium | High (broken UI) | Option C: bulk + spot-check 10% top screens |
| MoMo sandbox config changes | Low | Medium | Document exact sandbox URLs, test before prod |
| G3 screens exceed 70h estimate | Medium | Low | Batch approach — can stop at any batch |
| ERPNext credentials never come | Medium | Low | Mock client fallback already designed |
| Offline IndexedDB quota exceeded | Low | Medium | Limit cached orders to 50, purge old |
| Staff push: VAPID key rotation | Low | Low | Store VAPID keys in KV, rotation script ready |

---

## Recommended Sprint Execution Order

| Sprint | Gaps | Owner | Pre-requisites |
|--------|------|-------|---------------|
| S1 (Week 1-2) | G2 MoMo + G5 schema | Dev team | None |
| S2 (Week 3-4) | G3 token migration + 10 screens | Dev team | S1 done |
| S3 (Week 5-6) | G3 remaining + G4 + G9 | Dev team | S2 done |
| S4 (Month 2-3) | G5 sync + G6 (fallback) + test | Dev team + Owner | Owner provides ERPNext creds |

---

## Acceptance Criteria (Phase 2 Complete)

1. ✅ MoMo payment working in production (sandbox tested, promo code "MOMOTEST")
2. ✅ All 28 Stitch screens rendered with `--aura-*` tokens, zero `--st-*` in production
3. ✅ Staff can subscribe to push, receives order alerts on mobile
4. ✅ Inventory has D1 table, orders auto-decrement stock
5. ✅ ERPNext wiring: live if creds available, mock client logging if not
6. ✅ Offline mode: menu loads without network, orders queue and auto-submit
7. ✅ All existing 1063 tests still pass
8. ✅ `npm run build` → 0 TypeScript errors
9. ✅ Zero new `:any` types in production code

---

## File Touchpoints (Complete)

| Gap | New Files | Modified Files |
|-----|-----------|---------------|
| G2 | `worker/src/routes/payments/momo-create.ts`, `worker/src/routes/webhooks/momo.ts` | `worker/src/routes/payments/index.ts`, `src/hooks/stores/use-payment-store.ts` |
| G3 | 28 new React components in `src/components/*/` | `src/styles/brand-tokens.css` (migrate), `src/styles/stitch-tokens.css` (delete) |
| G4 | `src/components/staff/`, `worker/src/routes/push/` | `public/sw.js`, `src/components/push/` |
| G5 | `db/migrations/*_inventory*.sql` | `worker/src/routes/inventory/` (new directory) |
| G6 | `worker/src/lib/erpnext-client.ts` | `worker/src/routes/erpnext*.ts`, `worker/src/lib/erpnext-mapper.ts` |
| G9 | `src/hooks/use-offline-queue.ts`, `src/components/pwa/offline-banner.tsx` | `public/sw.js` |

---

## Unresolved Questions (Blocking)

1. **Token migration: Option C approved?** — Blocks G3 Sprint 2 start
2. **ERPNext credentials:** Owner has not provided. Blocks G6 full wiring. Fallback mock client designed.
3. **MoMo sandbox URL:** Need to verify current MoMo sandbox endpoint (changes periodically)
4. **Which 28 Stitch screens exact list:** Need to enumerate from stitch-exports/ directory
5. **G5 inventory: unit type granularity** — By piece? By gram? By bottle? Need owner input for F&B context

---

## Notes

- This design follows YAGNI/KISS/DRY: reuse PayOS pattern for MoMo, reuse existing push infra for G4, reuse existing sw.js for G9
- No new libraries required — all dependencies already in package.json
- All changes are additive — no breaking changes to existing API contracts
- Bazi color lock honored: navy/chrome/jade only, fire/earth (gold/red/brown) BANNED
- i18n: all new customer-facing strings must have VN+EN locale entries
