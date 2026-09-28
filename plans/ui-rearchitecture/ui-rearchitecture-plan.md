# AURA OS — Master UI Re-Architecture Execution Plan

**Execution Phasing:** Phase 0 (Done) → Phase 1 (Shells) → Phase 2 (Components) → Phase 3 (Customer UI) → Phase 4 (Operations) → Phase 5 (Admin) → Phase 6 (Cleanup)

---

## 1. Executive Summary & Phased Roadmap

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Phase 0    │ ──▶ │   Phase 1    │ ──▶ │   Phase 2    │ ──▶ │   Phase 3    │
│ Forensic     │     │ Shell        │     │ M3 Component │     │ Customer UI  │
│ Audit        │     │ Authority    │     │ System       │     │ + M4-B Menu  │
│ (COMPLETED)  │     │ (Isolate)    │     │ (Adapters)   │     │ (Canonical)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│   Phase 6    │ ◀── │   Phase 5    │ ◀── │   Phase 4    │ ◀──────────┘
│ Legacy       │     │ Admin        │     │ Operations   │
│ Cleanup      │     │ Shell & IA   │     │ (KDS/TV/POS) │
│ (Gated)      │     │ (HQ Portal)  │     │ (OpsShell)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Phase 1 — Shell Authority & Boundary Enforcement

**Goal:** Establish unambiguous viewport ownership; eliminate CartBottomBar leakage; resolve AdminShell duplication; standardize OpsShell.

### Tasks:
1. **Move `CartBottomBar` inside `CustomerShell.tsx`**:
   - Remove `<CartBottomBar />` from `src/App.tsx:68`.
   - Mount `<CartBottomBar />` inside `CustomerShell.tsx` as a child above `MD3NavigationBar`.
   - Result: ZERO leak to OpsShell, AdminShell, or unrouted pages.
2. **Standardize `OpsShell.tsx`**:
   - Enforce permanent dark mode: `bg-[var(--aura-noir-void)] text-white dark`.
   - Add station connectivity indicator / header slot.
   - Wrap `/kds`, `/tv-menu`, `/pos/table/:tableId`, `/stitch/kds`, `/stitch/order-management`.
3. **Consolidate `AdminShell.tsx` & Deprecate `AdminLayout.tsx`**:
   - Move layout orchestration into `src/components/stitch/AdminShell.tsx` using `MD3NavigationDrawer`.
   - Update `src/routes/admin-routes.tsx` to wrap under `<AdminShell />` instead of `<AdminLayout />`.
   - Convert `AdminLayout.tsx` to a simple re-export shim.
4. **Relocate Misplaced Stitch Routes in `stitchRoutes`**:
   - Move `/stitch/kds` and `/stitch/order-management` → `OpsShell`.
   - Move `/stitch/admin-terminal`, `/stitch/admin-orders`, `/stitch/admin-pos`, `/stitch/admin-v2` → `AdminShell`.
5. **Absorb Orphaned `mobileRoutes`**:
   - Wrap `mobileRoutes` under `OpsShell`.
   - Deprecate `src/pages/mobile/mobile-layout.tsx`.
6. **Validation Gate**:
   - `npx tsc --noEmit` = 0 errors
   - `npx vitest run` = 3,464+ tests pass
   - Verify CartBottomBar does NOT render on `/kds` or `/admin`.

---

## 3. Phase 2 — M3 Component System & Public Boundary

**Goal:** Consolidate legacy `ui/` and `md3/` behind a stable public contract; bridge 120 legacy consumers to MD3 primitives; eliminate dead primitives.

### Tasks:
1. **Token Consolidation**:
   - Merge `brand-tokens.css` into `aura-tokens.css` to establish a single source of truth.
   - Remove duplicate imports in `global.css`.
2. **Adapter Layer (`src/components/ui/adapters/`)**:
   - Create `ButtonAdapter` (maps legacy `Button` props → `MD3Button`).
   - Create `CardAdapter` (maps legacy `Card` props → `MD3Card`).
   - Create `BadgeAdapter` (maps legacy `Badge` props → `MD3Chip`).
   - Create `InputAdapter` (maps legacy `Input` props → `MD3TextField`).
   - Create `SkeletonAdapter` (maps legacy `Skeleton` props → `MD3ProgressIndicator`).
   - Create `ModalAdapter` (maps legacy `Modal` props → `MD3Dialog`).
   - Create `ToastAdapter` (maps legacy `Toast` props → `MD3Snackbar`).
3. **Update Barrel Contract (`src/components/ui/index.ts`)**:
   - Re-export adapters as `Button`, `Card`, `Badge`, `Input`, `Skeleton`, `Modal`, `Toast`.
   - Keep domain-specific keepers: `AuraImage`, `Switch`, `Drawer`.
   - Delete 4 zero-consumer modules: `navbar.tsx`, `footer.tsx`, `glass-card.tsx`, `bottom-nav.tsx`.
4. **Validation Gate**:
   - `npx tsc --noEmit` = 0 errors
   - Component test suites pass: `npx vitest run src/components/`

---

## 4. Phase 3 — Customer UI Re-Architecture & M4-B Integration

**Goal:** Canonical 5-tab Customer IA; strict M4-B customer-safe menu projection; verified M4-C cart/order flow.

### Tasks:
1. **Enforce 5-Tab Information Architecture**:
   - Tab 1: `/` (Home / Landing)
   - Tab 2: `/menu` (Canonical Menu — M4-B DTO)
   - Tab 3: `/table-reservation` (Table Booking)
   - Tab 4: `/promotions` (Offers & Vouchers)
   - Tab 5: `/account` (Customer Profile & Loyalty)
2. **Verify M4-B Customer Menu Boundary**:
   - Ensure `src/pages/menu.tsx` uses only `useCustomerMenu()` (positive allowlist).
   - Ensure sensitive backend fields are unreachable.
3. **Verify M4-C Server-Authoritative Checkout**:
   - Cart submits `{ items: [{ menuItemId, quantity, selectedVariantId, selectedModifierIds }] }`.
   - Server resolves all prices, discounts, and taxes.
4. **Tokenize Customer Pages**:
   - Replace raw classes in top customer pages with semantic AURA tokens.
5. **Validation Gate**:
   - `npx tsc --noEmit` = 0 errors
   - Customer flow tests pass.

---

## 5. Phase 4 — Operations Experience Re-Architecture

**Goal:** Rebuild KDS, TV Menu, and Table POS on permanent-dark `OpsShell`; eliminate mock data.

### Tasks:
1. **Consolidate Kitchen Display System (KDS)**:
   - Make `src/pages/KDS.tsx` the single canonical KDS implementation.
   - Wire to `use-kds.ts` query hook + SSE/audio notifications.
   - Deprecate mock array in `stitch/kds`.
2. **TV Menu Board**:
   - Modernize `src/pages/TVMenu.tsx` with high-contrast display layout.
   - Wire to `use-tv-menu.ts`.
3. **Table POS & Waiter View**:
   - Consolidate `src/pages/TableOrder.tsx` (staff mode) and `src/pages/mobile/waiter-orders.tsx`.
4. **Validation Gate**:
   - `npx tsc --noEmit` = 0 errors
   - Ops tests pass.

---

## 6. Phase 5 — Admin Experience Re-Architecture

**Goal:** Reconstruct HQ Admin Portal on `AdminShell` with `MD3NavigationDrawer` and high-density tokens.

### Tasks:
1. **Canonical Admin Navigation**:
   - Implement `MD3NavigationDrawer` in `AdminShell.tsx` for 28 admin routes.
   - Add search, store switcher, and breadcrumb bar.
2. **Tokenize High-Violation Admin Pages**:
   - Fix top violation files: `admin-orders`, `admin-pos`, `TableManagement`, `BroadcastPage`, `ChatInbox`.
3. **Consolidate Duplicate Admin Views**:
   - Consolidate `stitch/admin-*` prototype pages into canonical `src/pages/admin/*`.
4. **Validation Gate**:
   - `npx tsc --noEmit` = 0 errors
   - Admin test suite passes.

---

## 7. Phase 6 — Legacy Migration & Dead Code Cleanup (COMPLETED)

**Goal:** Safely remove unrouted prototype files using the 5-condition checklist.

### Completed Tasks:
1. **Executed Checklist across Candidate Files**:
   - Verified 5-point protocol: 0 routes, 0 imports, 0 dependencies, replacement exists, tests pass.
2. **Dead Legacy Shims & Unrouted Submodules Pruned**:
   - `src/pages/AboutUs.tsx` (unrouted re-export shim; `/about` maps directly to canonical `OurStory`)
   - `src/pages/admin/AdminLayout.tsx` (deprecated shim; `admin-routes.tsx` directly renders `AdminShell`)
   - `src/pages/admin/AdminSidebar.tsx` (legacy sidebar replaced by `AdminShell` / `StitchAdminTerminalNew`)
   - `src/pages/admin/admin-sidebar-header.tsx` (subcomponent of retired legacy admin sidebar)
   - `src/pages/admin/admin-sidebar-nav-item.tsx` (subcomponent of retired legacy admin sidebar)
   - `src/pages/admin/admin-sidebar-nav-config.ts` (subcomponent of retired legacy admin sidebar)
   - `src/pages/mobile/offline-queue.tsx` (orphaned prototype with 0 imports and 0 route declarations)
   - `src/pages/stitch/our-story/our-story-footer.tsx` (orphaned internal footer; page uses canonical `LandingFooter`)
   - `src/pages/stitch/reservation-new/reservation-new-styles.tsx` (orphaned style component with 0 imports)
3. **Compatibility Shim Verified**:
   - `src/components/stitch/StitchAppLayout.tsx` maintained as backwards-compatibility shim wrapping `CustomerShell`.
4. **Final Regression & Build Verification**:
   - `npm run build` → vite build ok
   - `npx tsc --noEmit` → 0 errors
   - `npx vitest run` → 382 test files / 3,519 tests PASS (100% green)

---

## 8. Rollback & Risk Mitigation Strategy

| Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| CartBar hidden on valid customer page | Low | High | Gated by `CustomerShell` mount rather than route regex |
| Legacy UI component visual regression | Medium | Medium | Adapter layer maintains identical DOM/CSS structure initially |
| Admin route broken after layout swap | Low | High | Keep `AdminLayout` as re-export shim during transition |
| Test suite failure after deletion | Low | Critical | Strict 5-point gate before any `git rm` |

---

## 9. Phase Execution Gates

| Phase | Entry Criteria | Exit Gate |
|---|---|---|
| **Phase 0** | Initiation | `PHASE-0-VERDICT.md = READY` |
| **Phase 1** | Phase 0 READY | 0 Cart leaks, 3 authoritative shells, tsc green, vitest green |
| **Phase 2** | Phase 1 done | Adapters active, dead UI primitives deleted, tsc green, vitest green |
| **Phase 3** | Phase 2 done | 5-tab IA active, M4-B/M4-C verified, tsc green, vitest green |
| **Phase 4** | Phase 3 done | Single canonical KDS on OpsShell, tsc green, vitest green |
| **Phase 5** | Phase 4 done | AdminDrawer active, admin tokens fixed, tsc green, vitest green |
| **Phase 6** | Phase 5 done | Dead code deleted, `npm run build` passes, full vitest suite green |