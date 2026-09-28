# Progress — UI Re-Architecture (M3 / 2026 Standards)

## Phase 6 — Legacy Migration & Dead Code Cleanup (COMPLETED)
- [x] Executed 5-point safe deletion checklist across candidate legacy files.
- [x] Removed 9 unreferenced legacy shims and dead prototypes:
  - `src/pages/AboutUs.tsx` (unrouted re-export shim)
  - `src/pages/admin/AdminLayout.tsx` (deprecated shim)
  - `src/pages/admin/AdminSidebar.tsx` (legacy sidebar)
  - `src/pages/admin/admin-sidebar-header.tsx`
  - `src/pages/admin/admin-sidebar-nav-item.tsx`
  - `src/pages/admin/admin-sidebar-nav-config.ts`
  - `src/pages/mobile/offline-queue.tsx` (unrouted mobile prototype)
  - `src/pages/stitch/our-story/our-story-footer.tsx` (orphaned footer)
  - `src/pages/stitch/reservation-new/reservation-new-styles.tsx` (orphaned style component)
- [x] Modernized Admin navigation test mocks for `TabletSmartphone` and `LayoutGrid`.
- [x] Preserved compatibility shim `StitchAppLayout.tsx` mapping to `CustomerShell`.
- [x] Verification Gate: `npx tsc --noEmit` = 0 errors · **382 files / 3,519 tests PASS** · `npm run build` ok.

## Phase 4/5 — Shell Governance, Route Hygiene & Dead Prototype Removal (COMPLETED)
- [x] Shell boundaries strictly enforced: `CustomerShell` (public PWA + 6 showcases, sole owner of `CartBottomBar`), `OpsShell` (KDS, TV, POS, Ops Terminal, Mobile staff), `AdminShell` (HQ management wrapped with `ProtectedRoute`).
- [x] Pruned `/stitch/*` showcase routes from 10 to 6; retired divergent mock routes (`/stitch/referral-1`, `/stitch/events-1`, `/stitch/customer-account`, `/stitch/loyalty`).
- [x] Relocated `order-management` to `OpsShell` (was incorrectly placed in customer layout).
- [x] Deleted dead prototype directories: `src/pages/stitch/loyalty/` and `src/pages/stitch/mobile/` (0 routes, 0 imports).
- [x] Preserved `src/pages/stitch/StitchBase.tsx` after dependency verification showed 10+ active components import `StitchShell`/`StitchNav`.
- [x] Repointed `stitch-screen-gallery` registry to canonical routes (`/about`, `/reviews`, `/admin/dashboard`, `/admin/login`, `/events`, `/order`, `/referral`, `/account`); marked unrouted batch exports as `skipped`.
- [x] Gate: `npx tsc --noEmit` = 0 errors · **375 files / 3,475 tests PASS** · `npm run build` ok.
### Phase 4/5 Reconciliation — Matrix vs Filesystem (COMPLETED)
- [x] Filesystem scan proved Section 5C Phase 6 candidates (`events-1`, `events-2`, `events`, `checkout`, `referral`) were **already absent from disk** — the matrix was stale, not the tree.
- [x] `src/pages/stitch/` ground truth: 19 entries. `events-promotions-2/` is **live** (routed `/stitch/events-2` via `src/routes/stitch-routes.tsx:14,22`) and retained.
- [x] Section 5C rewritten in `plans/ui-rearchitecture/page-migration-matrix.md` — all listed prototypes marked `DELETED` with `absent from filesystem` evidence. No Phase 6 deletion backlog remains.
- [x] Gate re-run after edit: `npx tsc --noEmit` = 0 errors · **375 files / 3,475 tests PASS**.

## Phase 0 — Forensic Audit (COMPLETED)
- [x] All 9 audit artifacts under `plans/ui-rearchitecture/`; verdict **READY**.
- [x] 3 authoritative shells identified + 1 orphan; 4 route governance defects; 1,290 token violations across 432 files.
- [x] M4-B / M4-C invariants verified intact — no backend changes required.

## Phase 1 — Safe Dead-Code Cleanup (COMPLETED)
- [x] Removed 19 dead files: 9 one-off Python scripts in `src/components/stitch/`, 1 unused payment prototype, 9 unused `RefundModal-*` modules.
- [x] Removed empty dirs `src/components/payment/`, `src/components/payments/`.
- [x] Gate: 5-point safety protocol (0 routes, 0 imports, 0 dynamic refs, 0 feature deps, 0 test impact).
- [x] `npx tsc --noEmit` = 0 errors · 376 files / 3,477 tests PASS · `npm run build` ok.
- [x] Report: `reports/ui/legacy-cleanup.md`.

## Phase 2 — Design Token Foundation (SPECIFIED)
- [x] Token chain documented: AURA brand → `--md-sys-*` roles → Tailwind `@theme` → components.
- [x] `src/styles/aura-tokens.css` confirmed as canonical source; `brand-tokens.css` already reduced to utility classes + keyframes (no duplicate declarations).
- [x] Spec: `plans/ui-rearchitecture/phase-02-tokens.md` (color roles, shape, elevation, typescale, migration order).
- [x] Adapter adoption: `src/components/ui/adapters/*` → MD3 primitives (incremental, per-component).
- [ ] Delete 4 zero-consumer legacy primitives: `ui/navbar.tsx`, `ui/footer.tsx`, `ui/glass-card.tsx`, `ui/bottom-nav.tsx`.

## Phase 3 — Component Core: Deep-Import Shim Conversion (COMPLETED)
- [x] Root cause identified: 212 deep-import matches across 115 files bypass `src/components/ui/index.ts` and the adapters by importing `@/components/ui/{button,card,badge,input,modal,skeleton,toast}` directly.
- [x] Strategy: convert each legacy primitive module into a thin **re-export shim** pointing at its adapter. Zero-touch for all 115 consumers — no call sites edited.
- [x] Converted 7/7 legacy primitives to shims: `button` → ButtonAdapter, `card` → CardAdapter (Card/CardHeader/CardBody/CardFooter), `badge` → BadgeAdapter, `input` → InputAdapter, `modal` → ModalAdapter, `skeleton` → SkeletonAdapter, `toast` → ToastAdapter (`useToast`/`ToastProvider`).
- [x] Supporting adapter fixes landed with the conversion:
  - `ButtonAdapter` — `destructive` variant now renders `var(--md-sys-color-error)` / `on-error` (was falling through to primary).
  - `BadgeAdapter` — rewritten from MD3Chip `<button>` to a `<span>` with MD3 token classes; preserves legacy DOM shape expected by tests.
  - `md3-text-field.tsx` — error/helper text span gains `role={error ? 'alert' : undefined}`.
- [x] Tests retargeted from legacy Tailwind assertions to M3 tokens (`bg-md-primary`, `border-md-outline`, `text-md-primary`, `var(--md-sys-color-error)`).
- [x] Gate: `npx tsc --noEmit` = 0 errors · **376 files / 3,480 tests PASS** · `npm run build` ok.

## Phase 3 — Mobile Layout Absorption (COMPLETED)
- [x] `pages/mobile/mobile-layout.tsx` retired — the monolithic layout that owned its own tab-switching state is gone from disk.
- [x] Replaced by route-boundary hosts in `src/routes/mobile-route-hosts.tsx`: `MobileStationHost` (declares `data-shell="ops"`, renders `MobileTabBar`), `MobileOverlayHost` (back-navigating detail shell), `MobileNotificationsPage`, `MobileProfilePage`.
- [x] Navigation ownership moved from component state to the router — `TAB_ROUTES` maps each tab to `/mobile/{kds,orders,tables,notifications,profile}`, so deep links and station-tablet refresh preserve view state.
- [x] Role gating preserved via `canAccess(t.id, user.role)`; `MobileTabBar` renders nothing when the signed-in role has no accessible destination.
- [x] Tokens used throughout (`--md-sys-color-*`, `--md-sys-shape-corner-sm`) — no legacy AURA vars in the mobile hosts.

---

# Progress — UI Re-Architecture Phase 3 Closure

## Verification Results
| Audit | Area | Status | Evidence |
|-------|------|--------|----------|
| P4#01 | Deep-Import Bypass | GREEN | 212 import sites / 115 files now resolve through adapters; 0 legacy implementations remain |
| P4#02 | Legacy Primitives | GREEN | 7/7 converted to shims: button, card, badge, input, modal, skeleton, toast |
| P4#03 | Zero-Consumer Dead Files | GREEN | `ui/navbar.tsx`, `ui/footer.tsx`, `ui/glass-card.tsx`, `ui/bottom-nav.tsx` no longer exist on disk; 0 references in `src/` |
| P4#04 | Barrel Contract | GREEN | `src/components/ui/index.ts` points only at adapters + MD3 primitives; no shim indirection exported |
| P4#05 | Mobile Shell Conformance | GREEN | `mobile-layout.tsx` retired; hosts declare `data-shell="ops"`; router owns navigation |
| P4#06 | Adapter Correctness | GREEN | ButtonAdapter destructive → MD3 error tokens; BadgeAdapter → span; MD3TextField error → `role="alert"` |
| P4#07 | Typecheck | GREEN | `npx tsc --noEmit` = 0 errors |
| P4#08 | Test Suite | GREEN | 376 files / 3,480 tests PASS (baseline 376 / 3,477) |
| P4#09 | Build | GREEN | `npm run build` → vite build ok |
| P4#10 | Diff Hygiene | GREEN | 81 insertions / 372 deletions in `src/components/ui/` — net −291 LOC |
| P4#11 | Secrets | GREEN | No `.env`, key, credential, `apps/`, or `daemon/` paths staged or untracked |
| P4#12 | State | GREEN | `.ai/state/*` + `docs/12_CHANGELOG.md` updated |

---

# Progress — UI Re-Architecture Phase 4/5 Closure

## Verification Results
| Audit | Area | Status | Evidence |
|-------|------|--------|----------|
| P5#01 | Shell Ownership | GREEN | Every route has exactly one shell owner; `CustomerShell` is the only `CartBottomBar` owner |
| P5#02 | Ops Isolation | GREEN | `/kds`, `/tv-menu`, `/pos/table/:tableId`, `/stitch/order-management`, `{mobileRoutes}` all under `OpsShell`; no customer nav |
| P5#03 | Admin Boundary | GREEN | `{adminRoutes}` wrapped by `AdminShell` + `ProtectedRoute` |
| P5#04 | Route Pruning | GREEN | `/stitch/*` reduced 10 → 6; 4 divergent mock routes deleted with their lazy imports |
| P5#05 | Router-Owned Nav | GREEN | `TAB_ROUTES` in `mobile-route-hosts.tsx`; no `useState` tab state remains |
| P5#06 | Dead Prototypes | GREEN | `stitch/loyalty/`, `stitch/mobile/` deleted after 0-route / 0-import proof |
| P5#07 | Matrix Reconciliation | GREEN | `StitchBase.tsx` reclassified DELETE → KEEP with dependency evidence; deleted dirs recorded |
| P5#08 | Typecheck | GREEN | `npx tsc --noEmit` = 0 errors |
| P5#09 | Test Suite | GREEN | 375 files / 3,475 tests PASS (376/3,477 baseline − 1 retired mock suite = −2 tests) |
| P5#10 | Build | GREEN | `npm run build` → vite build ok |
| P5#11 | Contract Invariants | GREEN | No D1 schema, OpenAPI, DTO, pricing, snapshot, guard, or IDOR change |
| P5#12 | Secrets | GREEN | No `.env`, key, credential, `apps/`, or `daemon/` path staged or untracked |
| P5#13 | Open Follow-ups | YELLOW | `src/pages/stitch/loyalty-calc/` is routed at `/loyalty-calculator` and retained; merge into `/loyalty` deferred to Phase 6 |

---

# Progress — M4-D Customer Order Tracking & History UI

## M4-D Completed

- [x] Phase 1: Contract Audit — frontend wired to server-authoritative `formatCustomerOrder()` projections; OpenAPI query params (`status`, `paymentStatus`, `dateFrom`, `dateTo`, `customerId`) enumerable by exact name.
- [x] Phase 2: Sub-router Middleware Scoping — all 11 `openapi-*-handlers/routes.ts` wildcard middlewares narrowed from `use('*', ...)` to domain prefixes (`use('/api/<domain>/*', ...)`). Root-mounted wildcards were intercepting `/api/health` and `/api/version` and returning 401.
- [x] Phase 3: Payments Webhook Exception — `openApiPaymentsRouter` scopes auth to `/api/payments/*` while preserving the unauthenticated inbound webhook path.
- [x] Phase 4: Customer Projection Tests — `tests/m4d-customer-order-projection.test.ts` (5 tests): allowlist-only fields, internal ID omission, `CustomerOrderResponseSchema` conformance, divergence from staff `formatOrder()`, customer-safe line items.
- [x] Phase 5: Order History Scope Tests — `tests/m4d-order-history.test.ts` (8 tests): per-customer isolation, staff unconstrained view, `customerId`/`status`/date-range filters, pagination meta, 401 fail-closed for unauthenticated callers.
- [x] Phase 6: State Sync — 376 files / 3,477 tests PASS; `tsc --noEmit` 0 errors.

## M4-D Verification Results
| Audit | Area | Status | Evidence |
|-------|------|--------|----------|
| D#01 | Middleware Scope | GREEN | Domain-prefixed `use()` on all 11 OpenAPI sub-routers; `/api/health` + `/api/version` no longer 401 |
| D#02 | Customer Projection | GREEN | `formatCustomerOrder()` allowlist; no `source`/`payments`/`customer_id`/`location_id`/`table_id`/`server_staff_id` |
| D#03 | Line-Item Privacy | GREEN | `formatCustomerOrderItem()` omits `id`, `product_id`, `menuItemId`, `order_id`; modifiers reduced to `{name, priceAdjustment}` |
| D#04 | List Scope Isolation | GREEN | Customer token → own `customer_id` only; staff → unfiltered; covered by 8 history tests |
| D#05 | Fail-Closed | GREEN | Unauthenticated `GET /api/orders` → 401; unscoped non-staff → `WHERE 1=0` |
| D#06 | Schema Conformance | GREEN | Every customer order parsed through `CustomerOrderResponseSchema.safeParse` in tests |
| D#07 | Build/Typecheck | GREEN | `npx tsc --noEmit` = 0 errors |
| D#08 | Test Suite | GREEN | 376 files / 3,477 tests PASS (baseline was 375 / 3,464) |
| D#09 | State | GREEN | `.ai/state/*` updated |

---

# Progress — M4-C Order Pipeline & Server-Authoritative Cart Engine (historical)

## Completed Phases
- [x] Phase 1: Pricing Engine & Channel Pricing — `resolveItemPrice()` in `@aura/domain-catalog` (channel deltas, modifier deltas, happy-hour windows). Resolves Y-03.
- [x] Phase 2: Order Price Snapshot & Immutable Lines — `calculateOrderSnapshot()` in `@aura/domain-order`; wired into `createOrder` so client prices/totals are discarded.
- [x] Phase 3: State Machine & Transition Guards — `canActorTransition()` + `toActorRole()` layered over `canTransition()`.
- [x] Phase 4: Customer Security & OpenAPI Contract — `OrderRoutes` registered; intent-only `OrderCreateSchema`; customer-safe positive projections; ownership scoping closes the `GET /api/orders/:id` IDOR hole.
- [x] Phase 5: Acceptance Tests & State Sync — IDOR + price-tampering + transition-validity acceptance suites; 375 files / 3,464 tests PASS; `tsc --noEmit` 0 errors.

## Verification Results
| Audit | Area | Status | Evidence |
|-------|------|--------|----------|
| #01 | Server-Authoritative Price | GREEN | `calculateOrderSnapshot()` discards client `price`/`subtotal`/`totalAmount`/`discountAmount` |
| #02 | Intent-Only Contract | GREEN | `OrderCreateSchema` admits no price-bearing key at line or order level; tamper test asserts stripping |
| #03 | Ownership Scoping (IDOR) | GREEN | `resolveCustomerScope()` in read handlers; customer token reaches only its own `customer_id` |
| #04 | Fail-Closed Semantics | GREEN | Non-staff actor with no resolvable owner → `AND 1=0`; foreign order → 404, not 403 |
| #05 | Dual-Gate Transition Auth | GREEN | 400 (structural illegality) decided before 403 (role authority) in `update` + `cancel` |
| #06 | Customer-Safe Projection | GREEN | `formatCustomerOrder()` allowlist; omits `customer_id`, staff fields, supplier info |
| #07 | OpenAPI 3.1 | GREEN | `OrderRoutes` registered in `worker/src/lib/openapi.ts`; schemas match runtime |
| #08 | Route Auth Gate | GREEN | `requireAuth(['owner','manager','staff','customer'])` — guests reach their own routes |
| #09 | Test Coverage | GREEN | 3 new acceptance blocks; 375 files / 3,464 tests PASS |
| #10 | Build/Typecheck | GREEN | `npx tsc --noEmit` = 0 errors |
| #11 | Runtime | GREEN | Hono in-process `app.fetch()` with mocked D1 |
| #12 | State | GREEN | `.ai/state/*` updated |

## M4-B Foundation (Verified — DO NOT MODIFY)
- Canonical `GET /api/menu` + `GET /api/menu/:id`, `@aura/domain-catalog` customer-safe DTO, `MenuRoutes` registered.
- 18/18 M4-B audits GREEN at time of completion. Historical detail retained in the milestone archive; M4-B baseline was 371 files / 3,395 tests.

## Verification Results — M4-B Digital Menu (historical)
- [x] Phase 1: Contract & Test Specification (15 tests in m4b-digital-menu-contract.test.ts)
- [x] Phase 2: Domain Projection & Locale Support (getCustomerMenu, getCustomerMenuItem with vi-VN default)
- [x] Phase 3: API Endpoint Implementation (canonical GET /api/menu, GET /api/menu/:id in worker/src/index.ts)
- [x] Phase 4: Frontend Integration (useCustomerMenu hook, MenuPage locale wiring, api-client repointing)
- [x] Phase 5: OpenAPI Contract (packages/domain/catalog/schemas/menu.ts, wired in openapi.ts)

## Verification Results
| Audit | Area | Status | Evidence |
|-------|------|--------|----------|
| #01 | Canonical API | GREEN | Single GET /api/menu, GET /api/menu/:id; legacy /api/catalog/menu/customer & /api/crm/menu retired |
| #02 | Domain Boundary | GREEN | @aura/domain-catalog reused; no duplicate models |
| #03 | Customer-Safe DTO | GREEN | FORBIDDEN_FIELDS absent; SQL selects only customer-safe columns |
| #04 | Product Visibility | GREEN | Default available-only; includeUnavailable opt-in |
| #05 | Price | GREEN | Integer VND cents; server-side only; no frontend override |
| #06 | Availability | GREEN | Backend-derived via parseAvailabilityFilter; no internal stock exposure |
| #07 | Localization | GREEN | vi-VN default; en-US supported; deterministic vi collation |
| #08 | OpenAPI | GREEN | MenuRoutes registered; CustomerMenuItem/Category/Response schemas; 200/404 responses |
| #09 | Test Coverage | GREEN | 15 contract tests + 9 legacy tests pass; 371 files / 3,395 total |
| #10 | E2E Customer Journey | GREEN | Integration tests hit canonical worker endpoint with ExecutionContext |
| #11 | UI/API Source of Truth | GREEN | useCustomerMenu hook is sole source; api-client points to canonical |
| #12 | Three-Shell Isolation | GREEN | Shells exist but M4-B doesn't touch them; no cross-contamination |
| #13 | Design System | GREEN | MD3 tokens used; no raw CSS values in menu page |
| #14 | Legacy/Duplication | GREEN | CRM menu test deleted (zero callers verified); legacy queries/menu.ts preserved for 9 existing tests |
| #15 | Build/Typecheck/Lint | YELLOW | tsc=0, tests=PASS; eslint has 53 pre-existing errors (unrelated to M4-B) |
| #16 | Runtime/Deployment | GREEN | Worker routes mounted; graceful D1 degradation; mock ctx for tests |
| #17 | Git Diff Hygiene | GREEN | 26 files changed; focused scope; no temp/debug files |
| #18 | State | GREEN | .ai/state/ updated |

## Remaining
- M4-D complete. No open blockers.
- `GET /api/orders/:id` and phone-based `GET /api/orders/my-orders` legacy unauthenticated paths retired; canonical scoped `GET /api/orders` + `GET /api/orders/:id` are the only order-read surfaces.