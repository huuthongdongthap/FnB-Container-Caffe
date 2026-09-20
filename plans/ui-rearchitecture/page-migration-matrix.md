# AURA OS — Page Migration Matrix (Classification of 302 Pages)

This matrix classifies all 302 `.tsx` page files across `src/pages/` according to the rule:
`KEEP | MIGRATE | MERGE | REPLACE | DELETE | UNKNOWN`.

**Rule:** "Never delete based only on age, folder name, LOC, or appearance." Every deletion requires:
`no active route + no imports + no feature dependency + replacement exists + tests pass`.

---

## 1. Summary of Page Classifications

| Classification | Count | Definition |
|---|---|---|
| **KEEP** | ~110 | Canonical production pages wired to active routes, compliant or near-compliant |
| **MIGRATE** | ~65 | Wired to active routes but need shell re-assignment, token fixes, or adapter use |
| **MERGE** | ~40 | Duplicate/variant pages that should combine into one canonical implementation |
| **REPLACE** | ~25 | Prototype/stitch generations replaced by production M3 components |
| **DELETE** | ~50 | Zero route, zero import consumers, dead prototypes (safe candidates) |
| **UNKNOWN** | ~12 | Need manual runtime verification before decision |
| **TOTAL** | **302** | |

---

## 2. Directory Breakdown & Page Groups

```
src/pages/
├── admin/                  (108 files) ── HQ / Management portal
├── stitch/                 (122 files) ── Prototypes, showcases, and current production flows
├── (root)                  (31 files)  ── Canonical public / customer pages
├── mobile/                 (10 files)  ── Staff mobile routes (orphaned shell)
├── saas/                   (8 files)   ── Multi-tenant / SaaS onboarding
├── account/                (5 files)   ── Customer account sub-components
├── stitch-screen-gallery/  (5 files)   ── Dev screen gallery
├── __tests__/              (4 files)   ── Page tests (NOT production code)
├── subscriptions/          (3 files)   ── Subscription customer views
├── [locale]/               (2 files)   ── Locale-scoped pricing
├── container/              (1 file)    ── Container concept page
├── order/                  (1 file)    ── Table order flow
└── register/               (1 file)    ── Registration
```

---

## 3. Canonical Root Pages (`src/pages/*.tsx` — 31 Files)

| File | Active Route | Current Shell | Classification | Action / Target Shell |
|---|---|---|---|---|
| `home.tsx` | `/` | CustomerShell | **KEEP** | Canonical Home (CustomerShell) |
| `menu.tsx` | `/menu`, `/menu/:id` | CustomerShell | **KEEP** | Canonical Menu (M4-B Customer DTO) |
| `checkout.tsx` | `/checkout` | CustomerShell | **KEEP** | Canonical Checkout Flow |
| `TableOrder.tsx` | `/order`, `/pos/table/:id` | Customer/Ops | **MIGRATE** | Split into Customer Order vs Ops TableOrder |
| `TableCheckin.tsx` | `/table-checkin` | CustomerShell | **MERGE** | Merge into `/checkin` (`stitch/checkin-new`) |
| `account.tsx` | `/account` | CustomerShell | **KEEP** | Canonical Account |
| `loyalty.tsx` | `/loyalty` | CustomerShell | **KEEP** | Canonical Loyalty |
| `referral.tsx` | `/referral` | CustomerShell | **KEEP** | Canonical Referral |
| `events.tsx` | `/events` | CustomerShell | **KEEP** | Canonical Events |
| `container.tsx` | `/container` | CustomerShell | **KEEP** | Concept Landing |
| `order-success.tsx` | `/order-success` | CustomerShell | **KEEP** | Canonical Success Page |
| `KDS.tsx` | `/kds` | OpsShell | **MIGRATE** | Canonical KDS — standardize under OpsShell |
| `TVMenu.tsx` | `/tv-menu` | OpsShell | **MIGRATE** | Canonical TV Menu — standardize under OpsShell |
| `BrandGuideline.tsx` | `/brand` | CustomerShell | **KEEP** | Internal Dev / Reference |
| `Contact.tsx` | (re-export) | CustomerShell | **MERGE** | Merged into `stitch/contact-new` |
| `TableReservation.tsx` | (re-export) | CustomerShell | **MERGE** | Merged into `stitch/reservation-new` |
| `promotions.tsx` | (re-export) | CustomerShell | **MERGE** | Merged into `stitch/promotions-new` |
| `Reviews.tsx` | (re-export) | CustomerShell | **MERGE** | Merged into `stitch/customer-reviews` |
| *20+ sub-component files* | — | — | **KEEP** | Used by the above pages |

---

## 4. Admin Portal (`src/pages/admin/` — 108 Files)

### 4A. Canonical Admin Views (28 Routes → KEEP/MIGRATE to AdminShell)

| View File | Route | Classification | Notes |
|---|---|---|---|
| `Login.tsx` | `/admin/login` | **MIGRATE** | Move under AdminShell (auth state) |
| `Dashboard.tsx` | `/admin`, `/admin/dashboard` | **KEEP** | Core HQ metrics & recent orders |
| `AuditLogViewer.tsx` | `/admin/audit-logs` | **KEEP** | Security & audit log explorer |
| `BirthdayConfig.tsx` | `/admin/birthday-config` | **KEEP** | CRM Birthday auto-rewards |
| `BroadcastPage.tsx` | `/admin/broadcasts` | **KEEP** | Mass marketing messages |
| `CampaignsManager.tsx` | `/admin/campaigns` | **KEEP** | Promo campaigns |
| `ChatInbox.tsx` | `/admin/chat` | **KEEP** | Live customer support |
| `CheckinApprove.tsx` | `/admin/checkin-approve` | **KEEP** | Staff review of table checkins |
| `Customers.tsx` | `/admin/customers` | **KEEP** | CRM Customer directory |
| `ERPNExtSync.tsx` | `/admin/erpnext-sync` | **KEEP** | ERP data synchronization |
| `TableManagement.tsx` | `/admin/table-management` | **KEEP** | Floor & table layout manager |
| `GenerateQR.tsx` | `/admin/generate-qr` | **KEEP** | QR code generator |
| `InvoiceHistory.tsx` | `/admin/invoice-history` | **KEEP** | Billing & invoice ledger |
| `ManageMenu.tsx` | `/admin/manage-menu` | **KEEP** | Full catalog manager (admin-authoritative) |
| `NotificationSettings.tsx` | `/admin/notification-settings` | **KEEP** | Push / email notification config |
| `Metrics.tsx` | `/admin/metrics` | **KEEP** | Performance & system metrics |
| `Orders.tsx` | `/admin/orders` | **KEEP** | Order lifecycle management |
| `POS.tsx` | `/admin/pos` | **MIGRATE** | Cashier POS — evaluate moving to OpsShell |
| `PromotionsManager.tsx` | `/admin/promotions` | **KEEP** | Discount codes & vouchers |
| `Reservations.tsx` | `/admin/reservations` | **KEEP** | Booking management |
| `SalesReports.tsx` | `/admin/sales-reports` | **KEEP** | Revenue & financial reports |
| `Staff.tsx` | `/admin/staff` | **KEEP** | Staff accounts & permissions |
| `SubscriptionsManager.tsx` | `/admin/subscriptions` | **KEEP** | Subscription plans |
| `DinDinMenu.tsx` | `/admin/dindin/menu` | **KEEP** | DinDin integration |
| `DinDinCart.tsx` | `/admin/dindin/cart` | **KEEP** | DinDin integration |
| `DinDinCheckout.tsx` | `/admin/dindin/checkout` | **KEEP** | DinDin integration |
| `DinDinOrderSuccess.tsx` | `/admin/dindin/success` | **KEEP** | DinDin integration |
| `Devices.tsx` | `/admin/devices` | **KEEP** | Hardware & terminal registry |

### 4B. Admin Layout & Shared Modules

| File | Classification | Rationale |
|---|---|---|
| `AdminLayout.tsx` | **REPLACE** | 11 lines delegating to Stitch; replace with canonical `AdminShell` |
| `AdminSidebar.tsx` | **REPLACE** | Replace with `MD3NavigationDrawer` |
| `admin-sidebar-header.tsx`, `admin-sidebar-nav-item.tsx` | **REPLACE** | Part of legacy sidebar |
| ~75 modular sub-components (`*-form.tsx`, `*-table.tsx`, `*-modal.tsx`) | **KEEP** | Directly owned by the 28 views above |

---

## 5. Stitch Directory (`src/pages/stitch/` — 122 Files)

The largest and most heterogeneous directory. Represents 3 distinct generations:

### 5A. Stitch Pages in Active Production Use (Canonical Implementations)

| File | Active Route | Classification | Target Shell |
|---|---|---|---|
| `reservation-new/index.tsx` | `/table-reservation` | **KEEP** | CustomerShell |
| `promotions-new/index.tsx` | `/promotions` | **KEEP** | CustomerShell |
| `checkin-new/index.tsx` | `/checkin` | **KEEP** | CustomerShell |
| `our-story/index.tsx` | `/about` | **KEEP** | CustomerShell |
| `customer-reviews/index.tsx` | `/reviews` | **KEEP** | CustomerShell |
| `contact-new/index.tsx` | `/contact` | **KEEP** | CustomerShell |
| `gallery-new/index.tsx` | `/gallery` | **KEEP** | CustomerShell |
| `loyalty-calc/index.tsx` | `/loyalty-calculator` | **MERGE** | CustomerShell (merge into `/loyalty`) |
| `subscriptions-new/index.tsx` | `/subscriptions` | **KEEP** | CustomerShell |
| `track-order/index.tsx` | `/track-order` | **KEEP** | CustomerShell |
| `order-failure/index.tsx` | `/order-failure` | **KEEP** | CustomerShell |
| `kitchen-display/index.tsx` | `/stitch/kds` | **MIGRATE** | **OpsShell** (was in CustomerShell!) |
| `order-management/index.tsx` | `/stitch/order-management` | **MIGRATE** | **OpsShell** (was in CustomerShell!) |
| `admin-terminal/index.tsx` | `/stitch/admin-terminal` | **MIGRATE** | **AdminShell** (was in CustomerShell!) |
| `admin-orders/index.tsx` | `/stitch/admin-orders` | **MIGRATE** | **AdminShell** (was in CustomerShell!) |
| `admin-pos/index.tsx` | `/stitch/admin-pos` | **MIGRATE** | **AdminShell** (was in CustomerShell!) |
| `admin-v2/index.tsx` | `/stitch/admin-v2` | **MIGRATE** | **AdminShell** (was in CustomerShell!) |

### 5B. Stitch Showcase & A/B Variants (In `stitchRoutes`)

| File | Route | Classification | Recommendation |
|---|---|---|---|
| `luxury-landing-hero/index.tsx` | `/stitch/landing` | **KEEP** | Showcase / A-B test candidate |
| `luxury-landing/index.tsx` | `/stitch/container-landing` | **KEEP** | Showcase / A-B test candidate |
| `luxury-cafe-1/index.tsx` | `/stitch/container-cafe-1` | **KEEP** | Concept showcase |
| `luxury-cafe-2/index.tsx` | `/stitch/container-cafe-2` | **KEEP** | Concept showcase |
| `customer-account/index.tsx` | `/stitch/customer-account` | **MERGE** | Merge with `src/pages/account.tsx` |
| `loyalty-rewards/index.tsx` | `/stitch/loyalty` | **MERGE** | Merge with `src/pages/loyalty.tsx` |
| `referral-rewards-1/index.tsx` | `/stitch/referral-1` | **MERGE** | Combine with referral-2 → `src/pages/referral.tsx` |
| `referral-rewards-2/index.tsx` | `/stitch/referral-2` | **MERGE** | Combine with referral-1 → `src/pages/referral.tsx` |
| `digital-menu/index.tsx` | `/stitch/menu` | **REPLACE** | Superseded by canonical M4-B `src/pages/menu.tsx` |
| `digital-menu-2/index.tsx` | `/stitch/menu-2` | **REPLACE** | Superseded by canonical M4-B `src/pages/menu.tsx` |
| `mobile-ordering/index.tsx` | `/stitch/mobile-ordering` | **MERGE** | Merge into `/order` |
| `events-promotions-1/index.tsx` | `/stitch/events-1` | **MERGE** | Merge into `src/pages/events.tsx` |
| `events-promotions-2/index.tsx` | `/stitch/events-2` | **MERGE** | Merge into `src/pages/events.tsx` |
| `order-success/index.tsx` | `/stitch/order-success` | **MERGE** | Merge into `src/pages/order-success.tsx` |
| `premium-checkout/index.tsx` | `/stitch/premium-checkout` | **MERGE** | Merge into `src/pages/checkout.tsx` |

### 5C. Dead Stitch Prototypes (Zero Route Consumers — Safe Deletion Candidates)

| Directory / Files | Classification | Evidence | Safe to Delete? |
|---|---|---|---|
| `src/pages/stitch/events-1/` | **DELETE** | Route uses `events-promotions-1`; this folder is unrouted | Phase 6 |
| `src/pages/stitch/events-2/` | **DELETE** | Route uses `events-promotions-2`; this folder is unrouted | Phase 6 |
| `src/pages/stitch/events/` (6 sub-files) | **DELETE** | Superseded by `events-promotions-1/2` and root `events.tsx` | Phase 6 |
| `src/pages/stitch/checkout/` (standalone) | **DELETE** | Route uses `premium-checkout` or root `checkout.tsx` | Phase 6 |
| `src/pages/stitch/referral/` (standalone) | **DELETE** | Route uses `referral-rewards-1/2` | Phase 6 |
| `src/pages/stitch/StitchBase.tsx` | **DELETE** | Unused base component | Phase 6 |
| ~30 orphaned sub-component files in dead folders | **DELETE** | Only imported within their own unrouted folders | Phase 6 |

---

## 6. Staff Mobile Directory (`src/pages/mobile/` — 10 Files)

| File | Route | Classification | Action |
|---|---|---|---|
| `mobile-login.tsx` | `/mobile/login` | **MIGRATE** | Staff PIN login → OpsShell |
| `mobile-layout.tsx` | `/mobile` (layout) | **REPLACE** | Inline-styled shell; absorb into OpsShell |
| `kitchen-display.tsx` | `/mobile/kds`, `/mobile` | **MERGE** | Merge with `src/pages/KDS.tsx` under OpsShell |
| `waiter-orders.tsx` | `/mobile/orders` | **MIGRATE** | Waiter tablet view → OpsShell |
| `table-manager.tsx` | `/mobile/tables` | **MIGRATE** | Floor staff view → OpsShell |
| `kds-card.tsx`, `kds-filter-tabs.tsx`, etc. (5 files) | — | **MIGRATE** | Component parts of KDS; retain during merge |

---

## 7. SaaS & Other Directories (23 Files)

| Directory | Files | Route | Classification | Notes |
|---|---|---|---|---|
| `src/pages/saas/` | 8 | `/saas/*` | **KEEP** | Multi-tenant onboarding wizard |
| `src/pages/account/` | 5 | `/account` sub | **KEEP** | Sub-components of canonical account |
| `src/pages/stitch-screen-gallery/` | 5 | `/stitch-gallery-screen-showcase` | **KEEP** | Internal dev tool; keep behind dev flag |
| `src/pages/subscriptions/` | 3 | `/subscriptions` sub | **KEEP** | Sub-components of subscriptions |
| `src/pages/[locale]/` | 2 | `/pricing`, `/:locale/pricing` | **KEEP** | Public marketing pricing |
| `src/pages/container/` | 1 | `/container` sub | **KEEP** | Container concept sub-view |
| `src/pages/order/` | 1 | `/order` sub | **KEEP** | Customer order sub-view |
| `src/pages/register/` | 1 | `/register` | **KEEP** | Registration |
| `src/pages/__tests__/` | 4 | (tests) | **KEEP** | Vitest test files |

---

## 8. Safe Deletion Protocol (Phase 6 Gated Checklist)

A file may **ONLY** be deleted in Phase 6 if **ALL 5 conditions** are satisfied:

```
[ ] 1. ZERO active routes reference this file (verified in route-matrix.md)
[ ] 2. ZERO import consumers across the entire codebase (verified via grep)
[ ] 3. ZERO feature or data dependency (not referenced by stores, hooks, or styles)
[ ] 4. A verified replacement exists in the canonical architecture
[ ] 5. Full test suite passes: npx vitest run (3,464+ tests green) + npx tsc --noEmit (0 errors)
```

**Estimated Deletion Candidates for Phase 6:** ~45–50 dead prototype files, recovering ~12,000 LOC of unmaintainable prototype code.