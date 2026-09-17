# Changelog

Tất cả các thay đổi đáng kể của dự án F&B Caffe Container được ghi lại tại đây.

## [Unreleased]

### 🔧 M5 CRM / Growth — Campaign Engine (Phase 05)

- **feat(domain/crm)** — Added 4 new command files in `packages/domain/crm/commands/campaign/`:
  - `types.ts` — shared `CampaignTrigger`, `CampaignChannel`, `CampaignCustomer`, `CampaignMessage`, `CampaignResult`, `CampaignLogRow`, `CampaignConfig`.
  - `templates.ts` — pure `renderTemplate(trigger, params?)` → `{ subject, sms, html }`. Bilingual (VN + EN) for all 5 triggers. Exhaustive switch throws on unknown trigger. `safeName` defaults to `'bạn'`, `formatCurrency` uses vi-VN locale.
  - `dedup.ts` — `deduplicate(db, customerId, trigger, sinceDays)` → boolean (true = skip send). `logSend(db, result)` — INSERT into `campaign_logs` with generated ID.
  - `detect.ts` — 5 trigger detectors: `detectWelcomeCandidates` (24h new), `detectBirthdayCandidates` (month match, once/year), `detectWinbackCandidates` (30d inactive), `detectPostVisitCandidates` (24-48h after completed order), `detectCashbackExpiry` (7 days before expires). Plus `markExpiryNotified(db, ids[])` batch UPDATE.
- **refactor(tree/campaigns)** — `cron-handler.ts` migrated from local `./campaign-engine`, `./templates`, `./triggers/*` to `@aura/domain-crm` barrel exports. Channel senders (sms/email/zalo) remain in `worker/src/tree/campaigns/channels/` (integration layer).
- **refactor(routes)** — `routes/campaigns.ts` now imports `CampaignTrigger`, `CampaignChannel`, `CampaignConfig` types from `@aura/domain-crm` instead of local re-declaration.
- **feat(schema)** — Added `campaign_configs` + `campaign_logs` tables to `worker/schema.sql` with indexes on `(customer_id, trigger)` and `sent_at`.
- **test** — `tests/crm-campaign.test.ts` (17 tests: template rendering × 5, dedup × 3, logSend × 2, detectors × 7). Full suite green: 369 files / 3374 tests.

### 🔧 M5 CRM / Growth — Referral (Phase 04)

- **feat(domain/crm)** — Added `referral-policy.ts` + `referral.ts` in `packages/domain/crm/commands/`:
  - `referral-policy.ts` — pure `resolveReferralPolicy(kv?)` → `ReferralPolicy`. Defaults: `{ bonusType: 'cashback', pointsReferrer: 100, pointsReferee: 50, cashbackReferrerVnd: 10000, cashbackRefereeVnd: 5000, minOrderVnd: 20000 }`. KV overlay (`referral:policy`) merges partial over defaults. Invalid JSON → fallback to defaults.
  - `referral.ts` — `getOrCreateReferralCode(db, customerId)` (6-char uppercase, unique), `getReferralCode(db, customerId)`, `redeemReferral(db, code, refereeId)` (validates code + self-referral + duplicate pending → creates pending `ReferralRow`), `rewardReferralOnFirstOrder(db, refereeId, orderId, amount, policy?)` (points mode: customers + loyalty_point_logs; cashback mode: batch cashback_wallets + cashback_transactions + loyalty_audit_log), `reverseReferralCashback(db, referralId)` (batch debit wallet + reversal audit), `getReferralStatus(db, customerId)` (code + counts + cashback earned). Idempotent: one reward per (referrer, referee) via `referral.status` check.
- **feat(routes)** — Added 2 endpoints on `crmRouter` in `worker/src/routes/crm.ts`:
  - `GET /api/crm/customers/:id/referral` — get/create referral code + status. Auth: owner, staff, or self.
  - `POST /api/crm/customers/:id/referral/redeem` — body `{ code }`. Auth: self only. Returns `{ success, data: ReferralResult }` or 400 with `reason`.
- **refactor(domain/crm)** — `place-order.ts` now triggers `rewardReferralOnFirstOrder` after loyalty accrual (non-blocking). Uses KV-tunable policy.
- **refactor(tree/loyalty)** — `phone-auth-handler.ts` migrated from legacy `routes/referrals.applyReferralForNewCustomer` to `redeemReferral` from `@aura/domain-crm`.
- **test** — `tests/crm-referral.test.ts` (18 tests: resolveReferralPolicy × 4, redeemReferral × 4, rewardReferralOnFirstOrder × 4, reverseReferralCashback × 2, getReferralStatus × 2, getOrCreateReferralCode × 2). Full suite green: 368 files / 3357 tests.

### 🔧 M5 CRM / Growth — Segments (Phase 03)

- **feat(domain/crm)** — Added `segments.ts` in `packages/domain/crm/commands/`:
  - `DEFAULT_SEGMENTS` — 5 declarative definitions: `new_first_week`, `regular`, `regular_high_value`, `lapsing_30d`, `dormant_60d`. Each has `key`, `labelVi`, `labelEn`, `description`, optional `highValueThresholdVnd`.
  - `loadSegmentDefinitions(kv?)` — KV override (`crm:segments`) replaces defaults entirely (no merge). Shape guard validates entries; bad JSON/missing key → defaults.
  - `scanCustomers(db)` — LEFT JOIN orders + GROUP BY customer → `{ id, name, phone, tier, lifetime_points, last_order_at }`.
  - `buildSegment(db, key, kv?, opts?, now?)` — evaluates predicate per customer, returns `{ key, labelVi, labelEn, description, count, customers[] }`. `limit=0` returns all matches.
  - `listSegments(db, kv?, now?)` — all definitions with counts (no member list).
  - `classify(row, policy, now)` — wraps `computeFrequencyBand` with dormant fallback for null `last_order_at`.
- **feat(routes)** — Added 2 endpoints on `crmRouter` in `worker/src/routes/crm.ts`:
  - `GET /segments` — list all segment definitions with counts. Auth: `requireAuth(['owner', 'staff'])`.
  - `GET /segments/:key/customers?limit&offset` — paginated member list. Auth: same. `limit=0` returns all.
- **test** — `tests/crm-segments.test.ts` (19 tests: classification × 8, pagination × 4, KV override × 5, listSegments × 2). Full suite green: 367 files / 3339 tests.

### 🔧 M5 CRM / Growth — Customer Intelligence (Phase 02)

- **feat(domain/crm)** — Added 3 new commands in `packages/domain/crm/commands/`:
  - `frequency-band.ts` — pure `computeFrequencyBand(summary, policy, now?)` → `'new' | 'regular' | 'lapsing' | 'dormant' | 'resurrected'`. KV-tunable via `crm:band_policy` (defaults: new 30d, regular 60d, dormant 120d, resurrect window 30d). `resolveBandPolicy(kv)` merges override over defaults.
  - `preferences.ts` — pure `extractPreferences(orders[])` → `{ favouriteCategories, favouriteItems, avgOrderCents, preferredChannel, orderCount, totalSpentCents }`. Defensive `parseOrderItems` skips malformed JSON. Categories + items capped at top 5 by frequency.
  - `customer-360.ts` — `getCustomer360(db, customerId, kv?, opts?)` composes account + tier + band + preferences + recent events (default 5) into unified owner/staff read model. Partial-but-typed fallbacks: read failure in any lens returns empty data, not an exception. Parallel D1 reads. Tier display normalizes legacy `'member'` → `'bronze'`.
- **feat(routes)** — Added `GET /api/crm/customers/:id/360` on `crmRouter`. Auth: `requireAuth(['owner', 'staff'])`. Query: `?eventLimit=`. Returns `{ success, data: Customer360 }`.
- **test** — `tests/crm-intelligence.test.ts` (14 tests: banding boundaries × 6, preference parsing × 5, 360 composition × 3). Full suite green: 366 files / 3320 tests.

### 🔧 M5 CRM / Growth — Loyalty Domain (Phase 01)

- **feat(domain/crm)** — Added 4 pure, Hono-free commands in `packages/domain/crm/commands/`:
  - `loyalty-policy.ts` — `loadPolicy(db, kv?)` reads `loyalty_tiers` + active `bonus_campaigns` + KV overrides. Returns `{ tiers, defaultRate, campaignMultiplier }`.
  - `compute-tier.ts` — pure `computeTier(lifetimePoints, currentTierName, policy)` → `{ tierName, lifetimePoints, nextTier, pointsToNext }`. Uses `loyalty_tiers.min_points` thresholds (Bronze 0 / Silver 50 / Gold 200 / Platinum 500). No D1 dependency.
  - `accrual.ts` — `applyAccrual(db, policy, { customerId, orderId, orderTotalVnd })` writes `loyalty_point_logs`, updates `customers.loyalty_points` + `lifetime_points`, recalculates tier, emits tier_upgrade/downgrade to `loyalty_audit_log`. Idempotent: skips when `loyalty_point_logs` already has `reason='order'` for the order.
  - `refund-reversal.ts` — `reverseAccrual(db, policy, { customerId, orderId, refundAmountVnd })` writes negative `points_change`, decrements both points columns, recalculates tier if dropped below threshold.
- **refactor(domain/crm)** — `get-customer-account.ts` now uses `computeTier` instead of inline nextTier query. Behavior byte-identical.
- **refactor(domain/order)** — `loyalty-trigger.ts` delegates to `applyAccrual` directly. Idempotency guard on `cashback_transactions WHERE order_id AND type='earn'`. Min order threshold 20,000 VND.
- **refactor(routes)** — `worker/src/routes/refunds.ts` migrated to `loadPolicy` + `reverseAccrual`. `worker/src/routes/loyalty.ts` re-exports the 3 domain commands.
- **cleanup** — Deleted legacy `worker/src/tree/loyalty/process-order.ts` (278 lines) and 3 obsolete test files that referenced it.
- **Invariants preserved**: tier thresholds 0/50/200/500 `min_points` (NOT `min_spent_vnd`), 1pt/10k VND × tier multiplier, cashback rates 3/5/7/10%, multipliers 1.0/1.1/1.3/1.5, earn cap 50k/tx, wallet cap 50% of bill, proportional refund reversal.
- **test** — Full suite green: 365 files / 3306 tests. Legacy `process-order.ts` zero imports remain.

### 🔧 M4 AURA Online — Pickup / Delivery Fulfillment (Option D)

- **feat(domain/crm)** — Added `getFulfillment(db, orderId, viewerCustomerId?, kv?)` and `listPickupPoints(kv?)` in `packages/domain/crm/commands/get-fulfillment.ts`. Pure function, Hono-free. Computes ETA from prep baseline (8 min) + 3 min per pending order ahead in queue. Terminal states (`served`, `picked_up`, `cancelled`, `rejected`) return `etaAt: null`, `etaMinutes: 0`, no pickup point. Customer-scoped: a customer may only read their own fulfillment; staff/owner see any. Pickup point resolved from `fulfillment:pickup_point` KV config with static `DEFAULT_PICKUP_POINT` fallback (malformed JSON also falls back). Exported via barrel.
- **feat(routes)** — Added two endpoints on `crmRouter` in `worker/src/routes/crm.ts`:
  - `GET /fulfillment/locations` — public pickup-point list (no auth; customer needs location before ordering).
  - `GET /orders/:id/fulfillment` — auth: `requireAuth(['customer', 'staff', 'owner'])`. Returns `{ orderId, status, channel, etaAt, etaMinutes, pickupPoint, queueDepth }`. 404 for unknown order, 403 for customer reading another's order, 500 for D1 failure.
- **test** — `tests/crm-fulfillment.test.ts` (11 tests: default pickup point, KV-configured pickup point, public access, pending pickup with ETA + queue depth + pickup point, terminal order null ETA + no pickup point, unknown order 404, customer cross-read 403, staff override, delivery channel no pickup point, 401 no auth, malformed JSON fallback). Full suite green: 367 files / 3345 tests.

### 🔧 M4 AURA Online — Online Order (Option C)

- **feat(domain/crm)** — Added `placeOrder(db, input)` in `packages/domain/crm/commands/place-order.ts`. Pure function, Hono-free. Reads each item's price from `menu_items` server-side (customer cannot inject price). Validates channel (`pickup`|`delivery`), item existence, availability, quantity. Inserts into `orders` with `status: 'pending'`. Exported via barrel alongside `VALID_CHANNELS`.
- **feat(routes)** — Added `POST /orders` on `crmRouter` in `worker/src/routes/crm.ts`. Auth: `requireAuth(['customer', 'staff', 'owner'])`. Customer role uses own `id`; staff/owner must pass `customerId` + `customerPhone`. Validates body (channel, items, customerPhone). Returns 201 with `{ orderId, status, channel, totalCents, items }`; 400 for invalid input; 401/403 for auth.
- **test** — `tests/crm-online-order.test.ts` (11 tests: customer pickup order, staff on-behalf delivery, unavailable item rejection, unknown item rejection, empty items, invalid channel, missing customerPhone, invalid quantity, 401 no auth, 403 disallowed role, per-item note preservation). Full CRM/M4 suite green: 37 tests.

### 🔧 M4 AURA Online — Public Digital Menu (Option B)

- **feat(domain/catalog)** — Added `getCustomerMenu(db, opts)` in `packages/domain/catalog/commands/get-customer-menu.ts`. Queries `menu_items`, groups by `category`, strips internal fields (`cost`, `sku`, `supplier`), exposes `priceCents`, `imageUrl`, `tags`, `available`. Honors availability policy via `toAvailabilityFilter`. Non-blocking — returns empty categories on failure.
- **feat(routes)** — Added `GET /menu` on `crmRouter` (public, no auth). Query params: `?category=&include_unavailable=true`. Customer-facing menu for online ordering surface.
- **test** — `tests/crm-customer-menu.test.ts` (7 tests: category aggregation, default availability filter, include_unavailable, category query, field stripping, D1 failure fallback, public access). Full CRM suite green: 26 tests.

### 🔧 M4 AURA Online — Customer Self-Service Account (Option A)

- **feat(domain/crm)** — Added `getCustomerAccount(db, customerId, opts)` in `packages/domain/crm/commands/get-customer-account.ts`. Parallel D1 reads across `customers`, `orders`, `consents`, `loyalty_tiers`. Returns `{ customerId, name, phone, email, tier, points, lifetimePoints, nextTier, recentOrders, consents }`. Partial-but-typed fallbacks so read failures never break the customer journey. Exported via barrel.
- **feat(domain/crm)** — Added `updateConsent(db, update)` in `packages/domain/crm/commands/update-consent.ts`. Append-only INSERT (never UPDATE) — each change writes a new row to `consents`, latest row per `(customer_id, purpose)` is current state. Validates purpose against `['marketing','order','analytics','referral','loyalty']`, returns `{ ok: true, consent } | { ok: false, error, code }`. Tracks `actorId`, `actorRole`, `source`, `policyVersion`.
- **feat(routes)** — Added M4 endpoints in `worker/src/routes/crm.ts`:
  - `GET /account/me` — returns authenticated customer's account view (role: customer | staff | owner).
  - `PATCH /account/consent` — body `{ purpose, granted, policyVersion?, customerId? }`. Customer can only update own; staff/owner can update any (pass `customerId`). Returns 400 for invalid purpose / missing fields, 401 without auth.
  - `GET /consent-purposes` — public list of valid purposes for UI dropdowns.
- **test** — `tests/crm-account.test.ts` (10 tests: account aggregation with tier calc, empty account for unknown customer, 401 without auth, 403 disallowed role, consent grant, consent revoke (staff-on-customer), 400 invalid purpose, 400 missing fields, 401 no auth on PATCH, public consent-purposes list).
- **docs** — Updated `.ai/specs/phase-map.md` (M4 IN PROGRESS — Option A Customer Account).

### 🔧 M1 Customer Events Read-Model (Option A) — CRM Timeline API

- **feat(domain/crm)** — Added pure `aggregateEvents(db, customerId, options)` in `packages/domain/crm/commands/aggregate-events.ts`. Parallel D1 reads across `customer_identities`, `consents`, `visits`, `orders`, `loyalty_point_logs`. Returns `{ customerId, events, total }` sorted descending by timestamp. Failures swallowed (non-blocking — read failure never breaks staff/owner surface). Exported via barrel.
- **feat(routes)** — Added `worker/src/routes/crm.ts` with Hono router: `GET /customers/:id/events` (timeline feed, `?limit` query) and `GET /customers/:id/profile` (recent activity summary). Both protected by `requireAuth(['owner', 'staff'])`. Mounted at `/api/crm` in `worker/src/index.ts`.
- **test** — `tests/crm-events.test.ts` (9 tests: empty state, identity aggregation, descending sort, limit trim, payload JSON parse, consent revoke type, mixed-source aggregation, 401 without auth, 401 invalid token). Full suite green: 363 files / 3306 tests passing.
- **docs** — Updated `.ai/specs/phase-map.md` (M1 IN PROGRESS, CRM lookup step marked done).

### 🔧 M3 Phase 05 — Canonical KDS Consolidation & Owner Dashboard v1

- **feat(domain/kitchen)** — Added pure `station-policy.ts` (`buildCategoryStationIndex`, `buildIndexFromDbRows`, `parseOrderItems`, `routeItemToStation`, `groupItemsByStation`, `filterItemsForStation`) with zero Hono/worker imports for direct vitest unit testing. Barrel-exported from `packages/domain/kitchen/index.ts`.
- **feat(kitchen-stations)** — Replaced the `GET /:id/tickets` KDS subquery (which could surface an order across multiple station views) with a policy-driven loop: fetch all active orders once, then `filterItemsForStation` keeps only the items matching the requested station. Each item now appears in exactly one station view.
- **feat(reports)** — Added `GET /api/reconciliation` daily reconciliation endpoint that LEFT JOINs `shifts` with `shift_reconciliations`, sums cash payments from `orders`, cash payouts from `expenses`, and aggregates per payment method. Returns per-shift rows (`opening_float`, `cash_payments`, `cash_payouts`, `expected_cash`, `actual_cash`, `variance`, `status`, `denominated`) plus `payment_methods`, `category_breakdown`, and totals (`revenue`, `cash_expected`, `cash_actual`, `cash_variance`, `digital_payments`, `order_count`).
- **test** — `station-policy.test.ts` (14 tests: parse/index/route/group/filter), `reconciliation.test.ts` (4 tests: 200 shape, digital payments, shift fields, totals). Full suite green: 362 files / 3297 tests passing. tsc delta +16 (1317→1333), all within legacy TS2307/TS2339/TS2345 band, 0 new error classes.
- **docs** — Updated `docs/12_CHANGELOG.md`, `.ai/specs/phase-map.md`, and `plans/2026-09-14-m3-cafe-independent-operation/journal.md`. **M3 milestone complete.**

### 🔧 M2 Staff & Shift Exemplar (D10) — Extract + Migrate + Delete

- **feat(domain/staff)** — Extracted staff domain into `packages/domain/staff/` (auth/crypto, auth/pin, model/staff-types, policies/roles, routes/staff-auth, routes/staff-tips, barrel index). Implemented edge Web Crypto PBKDF2 PIN authentication (`crypto.subtle`, 100,000 iterations, 8-byte salt, zero Node.js `crypto` dependencies). Extracted bilingual RBAC policy engine (`STAFF_ROLES`, `ROLE_LABELS` in `vi`/`en`, `ROLE_PERMISSIONS`, `hasPermission`, `visibleRolesFor`). Extracted staff tips attribution reporting (`/report`, `/summary`, `/orders`) and device management.
- **feat(domain/shift)** — Extracted shift domain into `packages/domain/shift/` (model/shift-types, routes/shifts, barrel index). Extracted attendance tracking endpoints (`POST /clock-in`, `POST /clock-out`, `GET /`) enforcing single active shift per staff member per calendar day and worked hours computation.
- **refactor(M2)** — Migrated all callers directly to `@aura/domain-staff` and `@aura/domain-shift`: `worker/src/index.ts`, `worker/src/middleware/staff-auth.ts`, `worker/src/__tests__/lib/staff-roles.test.ts`, `worker/src/__tests__/routes/staff-auth-mobile.test.ts`, `tests/shifts.test.ts`.
- **refactor(M2)** — Deleted legacy worker files without temporary shims: `worker/src/routes/staff-auth.ts`, `worker/src/routes/staff-tips.ts`, `worker/src/routes/shifts.ts`, `worker/src/lib/staff-roles.ts`.
- **build** — Wired `@aura/domain-staff` + `@aura/domain-shift` paths in `worker/tsconfig.json`, root `tsconfig.json`, and `vitest.config.ts`.
- **test** — Full suite green: 358 test files / 3270 tests passing. tsc delta within established M1/M2 band (1317 errors, all TS2307/TS6059/TS2305/TS2554, 0 new error classes).
- See: `plans/2026-09-14-m2-staff-shift-exemplar/`. M2 Milestone complete.

### 🔧 M2 Tables Exemplar (D10) — Extract + Migrate + Delete

- **feat(domain/table)** — Extracted `tablesRouter` (GET list + by-id, PATCH occupy/release/status) and `qrRouter` (GET /:slug → PNG, signature-gated) into `packages/domain/table/` (commands/ + policies/ + barrel). Status policy extracted as `policies/status.ts` with `TABLE_STATUS_TRANSITIONS` + `canTransitionTo` (v1 permissive — all 4 statuses legal targets).
- **refactor(M2)** — Migrated every caller off `worker/src/routes/tables.ts` onto direct `@aura/domain-table` imports: `worker/src/index.ts`, `worker/src/routes/admin-qr.ts`, `worker/src/tree/qr/generator.ts`, `worker/src/__tests__/routes/{tables,debug-wrong-sig,debug-patch}.test.ts`, `tests/tables.test.ts` (6 files).
- **refactor(M2)** — Deleted `worker/src/routes/tables.ts` shim and its `.bak` artifact. Canonical copies live in `packages/domain/table/`.
- **build** — Wired `@aura/domain-table` + `@aura/domain-table/*` aliases in `worker/tsconfig.json`, root `tsconfig.json`, `vitest.config.ts`.
- **test** — Full suite green: 360 files / 3274 tests. tsc delta all new errors match the established M1/M2 band (TS2307 + TS6059 + relocated TS2305/TS2554 `openapi`/`2-3 args`) — identical to what catalog/order/payment/kitchen already ship with. 0 new error classes introduced.
- Scope: `worker/src/routes/tables.ts` only. Status-enum conflict avoided (out-of-scope: `schemas/tables.ts`, `openapi-tables.ts`, `tables-mobile.ts`, `table-sessions.ts`, `tree/qr/generator.ts`, `tree/qr/signer.ts`). Money-table safety: zero DDL, SQL strings byte-identical, HTTP shape unchanged.
- See: `plans/2026-09-14-m2-tables-exemplar/`.

### 🔧 M2 Catalog Domain Exemplar (D10) — Extract + Migrate + Delete

- **feat(domain/catalog)** — Extracted products / menu / categories / menu-modifiers routes + schemas into `packages/domain/catalog/` (commands/ queries/ model/ schemas/ barrel). Pricing + availability policies split into `policies/pricing.ts` + `policies/availability.ts` per D10 spec. Old route files become re-export shims (kept live during migration window).
- **refactor(M2)** — Migrated every caller off shim paths onto direct `@aura/domain-catalog` imports: `worker/src/index.ts`, `worker/src/lib/openapi.ts`, `openapi-categories.ts`, `openapi-products.ts`, `worker/src/__tests__/tree/menu-modifiers/`, `worker/src/__tests__/routes/{categories,menu}.test.ts`, `tests/{products,menu,categories}.test.ts` (9 files total). 3 call sites were dynamic imports repointed to the barrel.
- **refactor(M2)** — Deleted all shims: 4 route shims (`products.ts`, `categories.ts`, `menu.ts`, `menu-modifiers.ts`) + 2 schema shims (`schemas/products.ts`, `schemas/categories.ts`). Canonical copies live in `packages/domain/catalog/`.
- **build** — Wired `@aura/domain-catalog` + `@aura/domain-catalog/*` aliases in `worker/tsconfig.json`, root `tsconfig.json`, `vitest.config.ts`.
- **fix(test)** — Added `import '@hono/zod-openapi'` preload to `src/test-setup.ts` so the root zod instance gets patched before test-schema modules load. Without this, dual-zod (root `node_modules/zod` vs `worker/node_modules/zod`, two separate module instances) causes `z.coerce.number().openapi is not a function` across 42 catalog tests — the patch side-effect from `@hono/zod-openapi` was mutating only the worker copy.
- **test** — Full suite green: 360 files / 3274 tests. tsc delta +24 (552→576), all new errors match the established M1 band (TS2307 `worker/src/...` unresolvable from package, TS6059 `not under rootDir`, relocated TS2305/TS2554 `openapi`/`2-3 args`) — identical error classes already present for `packages/domain/{order,payment,kitchen}` in baseline.
- See: `plans/2026-09-14-m2-catalog-exemplar/`. Money-table safety: zero DDL, no contract change, menu payload shape identical.

### 🔧 M2 Shim Caller Migration — Order / Payment / Kitchen

- **refactor(M2)** — Migrated every caller off shim route paths onto direct `@aura/domain-order` / `@aura/domain-payment` / `@aura/domain-kitchen` imports: `index.ts`, `orders-hono.ts`, `cron-admin.ts`, `webhooks.ts`, `tests/*`, `worker/src/__tests__/*` (17 test files).
- **refactor(M2)** — Deleted all shims: 6 route shims (`payments.ts`, `payments/momo-create.ts`, `payments-nowpayments.ts`, `kds-mobile.ts`, `kds-stream.ts`, `kitchen-stations.ts`), `routes/orders.ts` domain shim, and the entire `worker/src/tree/orders/` directory (14 files). Canonical copies live in `packages/domain/*` (drift-verified zero before deletion).
- **fix(domain/order)** — 12 broken dynamic imports in `create-order.ts` / `update-order.ts` / `loyalty-trigger.ts` had tree-relative `await import()` paths that never resolved from the domain location — repointed to `worker/src/...` alias paths.
- **test** — Repointed dead `vi.mock` paths (telegram ×2, loyalty-trigger ×1) to domain package locations so mocks keep firing after tree deletion.
- **test** — Full suite green: 360 files / 3274 tests. tsc delta −1 vs baseline (1240→1239), all within known legacy TS2307/TS6059 band.
- Commit: `fcce027`. Money-table safety: zero DDL, no contract change.

### 🔧 M1 Monorepo Domain Extraction — Payment + Kitchen (Batch 6)

- **feat(domain/payment)** — Extracted PayOS create-link, MoMo create, NowPayments IPN to `packages/domain/payment/` (commands/ + barrel). Old routes (`worker/src/routes/payments.ts`, `payments/momo-create.ts`, `payments-nowpayments.ts`) become re-export shims — old paths stay live until M2 migrates callers.
- **feat(domain/kitchen)** — Extracted KDS mobile handlers, KDS SSE stream, kitchen-stations router to `packages/domain/kitchen/`. Old routes (`kds-mobile.ts`, `kds-stream.ts`, `kitchen-stations.ts`) become re-export shims.
- **build** — Wired `@aura/domain-payment` + `@aura/domain-kitchen` aliases across root tsconfig, worker tsconfig, vite, vitest. Added `worker/src` alias to vite/vitest (needed when shims are runtime-consumed by `worker/src/index.ts`, unlike test-only order shim).
- **test** — Full suite green: 360 files / 3274 tests (payment 16, kitchen 14 included).
- Commits: `c1db222` (order), `9027d21` (payment + kitchen).
- Money-table safety: zero DDL, pure code-move — `payments`/`subscription_invoices` schemas untouched.

### 🔧 M1 D1 Hygiene — Orphan-Table Retirement + D7 Spec Reconciliation

- **feat(db)** — Migration `20260913_02_retire_orphan_tables` (+down): dropped 9 verified-empty orphan tables from prod D1 — `users_legacy`, `checkin_log`, `odoo_*` (6 tables), `erpnext_invoices`. 0 data rows, zero code consumers (verified via live sqlite_master + row counts + repo-wide grep pre-drop). DDL preserved verbatim in down-migration; live data untouched (orders 89, payments 14, users 6, customers 20).
- **fix(db)** — Rewrote `20260824_04_users_recreate`: `ALTER TABLE users RENAME TO users_legacy` → `DROP TABLE IF EXISTS users_legacy`. The old rename resurrected `users_legacy` on fresh bootstraps by renaming the canonical `users` table away (review finding H1).
- **docs(specs)** — D7 closed as RESOLVED-NOT-NEEDED: migrations 006/013 were recreate+rename (no `_new` duplicates ever existed in prod); subscription family never provisioned. Corrected: migration-matrix (MERGE rows closed), phase-map M1 items 2/4/5 marked done/closed, DOMAIN_MAP §1/§5, CURRENT_STATE P4, migrations README remote-only list + retired section.

### 🔧 M1 Customer Domain — Identity, Consent, Visits, Order-Link Capture

- **feat(domain/customer)** — Added `worker/src/tree/customer/`: identify-customer, record-consent, record-visit, link-order + helpers. Zero-based customer DB per v4 §6 — AURA earns customer relationships transaction-by-transaction; no Viva Star migration.
- **feat(domain)** — D1 migration `0005_customer_identity_consent_events_visits` (+down): customers identity/consent columns, customer_events, customer_visits tables.
- **feat(orders)** — create-order/update-order capture customer identity events on golden-loop spine (CustomerCreated / CustomerIdentified / ConsentGiven).
- **test** — 299-line customer-domain suite (worker).
- See: `plans/2026-09-13-m1-customer-domain/`

### 🔧 M1 i18n Glossary Consolidation (D9)

- **fix(i18n)** — vi `nav.referral` + `footer.referral`: "Giới thiệu bạn" → "Giới thiệu bạn bè" (converged with `loyalty.referEarn`, glossary G10 ratified).
- **fix(i18n)** — Added vi `stitch.accountDashboard.errorDescription` — Account Dashboard error state now renders translated copy instead of en fallback.
- **docs** — `.ai/context/glossary.vi-en.yaml` ratified (referral convergence note).
- **test** — `src/__tests__/locales-glossary.test.ts` regression guard: referral labels + errorDescription key + JSON validity — locale drift now fails CI.
- **fix(worker)** — `phone-auth-handler.ts` safeWaitUntil: Hono executionCtx getter throws under `router.request()` in tests → background call sites wrapped, prod behavior unchanged.
- **fix(test)** — promotion-card usage-count assertion exact-matched `/^10\/100 luot dung$/` (was colliding with "Con 110 ngay" expiry label under /10/ regex).
- 359 files / 3269 tests green; tsc exit 0; review PASS.

### 🔧 UX Token Migration — Font Stacks → Aura Tokens (Stitch Scope)

- **refactor(stitch)** — Migrated 23 stitch/theme files + 5 pages from literal font stacks (`'Space Grotesk'`, `'Libre Caslon Text'`, `'Cormorant Garamond'`) to aura design tokens (`--aura-font-body`, `--aura-font-display`, `--aura-font-display-serif`, `--aura-font-mono`). Legacy fonts were never webfont-loaded (index.html only loads Quicksand + Be Vietnam Pro), so literals were broken fallbacks to generic system fonts — this is a rendering fix.
- **refactor(theme)** — `src/theme/aura-tokens.ts` fontFamily now references CSS vars instead of literals.
- **fix(stitch)** — Removed dead `@import` Google Fonts URL from `StitchAdminLoginNew-styles.ts` (Cormorant Garamond + Space Grotesk no longer referenced by any rule).
- **fix(styles)** — Corrected stale font comment in `src/styles/global.css` (was "EB Garamond + Space Grotesk"; actual stack is Quicksand + Be Vietnam Pro).
- **fix(stitch)** — Collapsed redundant `var(--aura-font-display-serif, var(--aura-font-display))` fallbacks to bare `var(--aura-font-display-serif)` in about-page CTA/hero sections for pattern consistency.
- **docs** — Updated `docs/01_GOAL.md`, `docs/03_ARCHITECTURE.md` typography sections to reflect actual token stack (Quicksand display / Be Vietnam Pro body / `--aura-font-mono`).

### 🔧 pretix Event Ticketing Bridge (Pillar 07 Complete)

- **feat(pretix)** — Added `worker/src/lib/pretix-client.js`: pretix REST API HTTP client with Token auth. Supports listEvents, getEvent, listItems, listOrders, getOrder, redeemCheckin, listWebhooks, createWebhook. Retry on 5xx (1 attempt), structured error handling with PretixApiError class. Graceful skip when PRETIX_API_URL unset.
- **feat(pretix)** — Added `worker/src/routes/pretix.js`: Hono router with 6 API endpoints.
  - `GET /api/pretix/events` — List events + ticket types from pretix.
  - `GET /api/pretix/events/:slug` — Get single event with items.
  - `GET /api/pretix/orders` — List recent orders (admin).
  - `POST /api/pretix/webhook` — Receive pretix webhook events (order.placed, order.paid, order.canceled, order.refund.done). HMAC-SHA256 signature validation.
  - `POST /api/pretix/checkin` — Proxy check-in scan (QR secret to pretix redeem API). Returns green/yellow/red status.
  - `POST /api/pretix/generate` — Generate branded social post content from event data (for Mixpost cross-posting).
- **feat(pretix)** — Registered `pretixRouter` at `app.route('/api/pretix', pretixRouter)` in `worker/src/index.js` (27 route modules total).
- **feat(pretix)** — Webhook handler: HMAC-SHA256 signature validation, D1 sync via `ticket_orders` table, status lifecycle management (placed/paid/canceled/refunded), webhook auto-registration on startup.
- **feat(pretix)** — Docker Compose (`docs/docker-compose.pretix.yml`): PostgreSQL 15 + Redis 7 + pretix/standalone:stable on port 9001, pretix cron container.
- **test(pretix)** — 25 TDD tests in `tests/pretix-bridge.test.js`. Coverage: PretixClient auth/retry/errors, Hono route validation (events list, event detail, orders list, webhook HMAC + 5 actions, check-in 3 statuses + missing secret, generate post content). All pass.
- **docs** — Added `docs/pretix-setup-guide.md`: bilingual (Vietnamese + English) setup guide covering Docker deployment, organizer/event setup, API token generation, Worker env vars, widget embed, check-in scanner, troubleshooting.
- **docs** — Added `docs/docker-compose.pretix.yml`, `docs/pretix.cfg`.
- **docs** — Updated 03_ARCHITECTURE.md, 04_ROADMAP.md, 12_CHANGELOG.md for pretix pillar.
- **Total:** 25 new tests, 814/814 total pass (29 suites, 0 build errors).
- **Architecture:** CF Worker Bridge → pretix Docker (VPS, port 9001) → PostgreSQL + Redis. HMAC-SHA256 webhooks. QR-based check-in proxy. JS widget embed for ticket sales.
- **Env vars required:** `PRETIX_API_URL`, `PRETIX_API_TOKEN`, `PRETIX_ORGANIZER`, `PRETIX_WEBHOOK_SECRET`.
- See: `plans/260701-0120-pretix-event-ticketing/`

### 🔧 Mixpost Social Media Bridge (Phase 04 Complete)

- **feat(mixpost)** — Added `worker/src/lib/mixpost-client.js`: Mixpost REST API HTTP client with Sanctum Bearer token auth. Supports createPost, listAccounts, listPosts, uploadMedia. Retry on 5xx (2 attempts), structured error handling with MixpostApiError class. Graceful skip when MIXPOST_API_URL unset.
- **feat(mixpost)** — Added `worker/src/routes/mixpost.js`: Hono router with 4 API endpoints + 3 cron function exports.
  - `POST /api/mixpost/posts` — Create scheduled social post with media uploads. Zod validation.
  - `POST /api/mixpost/generate` — Auto-generate post content from D1 data (promotions, menu specials). Returns draft for review.
  - `GET /api/mixpost/accounts` — List connected social accounts (Facebook, Instagram, TikTok).
  - `GET /api/mixpost/posts` — List recent Mixpost posts with status.
- **feat(mixpost)** — 3 cron jobs for automatic social posting:
  - `autoPostDailySpecials` — Daily at 07:00, picks top 3-5 available products.
  - `autoPostNewPromotions` — Daily at 08:00, posts promotions activated in last 24h.
  - `autoPostWeeklyHighlights` — Monday at 09:00, aggregates last 7 days best sellers.
- **feat(mixpost)** — Registered `mixpostRouter` at `app.route('/api/mixpost', mixpostRouter)` in `worker/src/index.js` (26 route modules total).
- **test(mixpost)** — 33 TDD tests in `tests/mixpost-bridge.test.js`. Coverage: API client auth/retry/errors, Hono route validation, content generation templates (promo, daily specials, weekly highlights), cron function logic (empty data, error handling, idempotency). All pass.
- **docs** — Added `docs/mixpost-setup-guide.md`: 290-line bilingual (Vietnamese + English) setup guide covering Docker deployment, API token generation, social account connection, Worker configuration, auto-scheduling, and troubleshooting.
- **docs** — Updated 03_ARCHITECTURE.md, 04_ROADMAP.md, 12_CHANGELOG.md for Mixpost pillar.
- **Total:** 33 new tests, 789/789 total pass (28 suites, 0 build errors).
- **Architecture:** CF Worker Bridge → Mixpost Docker (VPS, port 9000) → Facebook/Instagram. All reads from existing D1 tables (products, promotions, categories). No new DB tables required. Bilingual setup guide with copy-paste commands.
- **Env vars required:** `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`.
- See: `plans/260701-0040-mixpost-social-media-bridge/`

### 🔧 Xibo Digital Signage Pillar (Phase 03 Complete)

- **feat(signage)** — Added `worker/src/routes/signage.js`: Two public read-only API endpoints for Xibo digital signage players.
  - `GET /api/signage/menu` — Categories with available products, grouped by category, sorted by `sort_order`. Joins `products` and `categories` tables. No auth required.
  - `GET /api/signage/promos` — Active promotions from `promotions` table (`is_active = 1`). Returns code, percent, max_discount, min_order, expires_at.
  - Both endpoints set `Cache-Control: public, max-age=300` (5-minute cache). JSON error responses with structured logging.
- **feat(signage)** — Created 3 self-contained HTML widgets in `signage-widgets/`:
  - `menu-board.html` — Category-grouped menu display with product images, prices, and descriptions. Vietnamese/English bilingual rendering. Auto-fetches from `/api/signage/menu`.
  - `promo-screen.html` — Promotional carousel with card layout, discount percentage badges, expiry dates, and carousel indicators. Auto-fetches from `/api/signage/promos`.
  - `welcome-screen.html` — Multi-section welcome screen with welcome greeting, Wi-Fi info, loyalty highlights, and today's specials. Section rotation with indicators. Aura branding.
  - All widgets: zero CDN dependencies, offline-capable (fully self-contained HTML+CSS+JS), inline font fallbacks.
- **feat(signage)** — Registered `signageRouter` at `app.route('/api/signage', signageRouter)` in `worker/src/index.js` (25 route modules total).
- **test(signage)** — Added 30 TDD tests:
  - `tests/signage-api.test.js` (12 tests) — Coverage: menu returns categories with products, menu filters unavailable products, promos returns active promotions, promos returns empty array when none active, Cache-Control header, error handling on DB failure.
  - `tests/signage-widgets.test.js` (18 tests) — Menu Board: category headings, product items with name/price/image, error overlay, fetch endpoint verification. Promo Screen: promo card rendering, expiry dates, carousel indicators, empty state fallback, error overlay. Welcome Screen: welcome section, wifi section, loyalty highlights, today's specials, section rotation indicators, Aura branding. Widget file structure: all 3 widgets exist and contain valid HTML + API_BASE constant.
- **docs** — Added `docs/xibo-setup-guide.md`: 300-line bilingual (Vietnamese + English) setup guide covering Docker deployment on Cloud VPS (2GB RAM), Raspberry Pi 5 player setup, widget configuration, and troubleshooting.
- **docs** — Updated 03_ARCHITECTURE.md, 04_ROADMAP.md, 12_CHANGELOG.md for Xibo pillar.
- **Total:** 30 new tests, 756/756 total pass (27 suites, 0 build errors).
- **Architecture:** CF Worker API → Xibo CMS v4.4.3 (Docker) → Xibo Player (RPi 5) → HDMI → TV. All reads from existing D1 tables (menu, categories, promotions). No new DB tables required.
- See: `docs/xibo-setup-guide.md`

### 🔧 Mautic Marketing Automation Bridge (Phase 04 Complete)

- **feat(mautic)** — Added `worker/src/lib/mautic-client.js`: OAuth2 client credentials auth for Mautic REST API. Supports contact upsert by email, batch upsert (up to 50), segment enrollment, campaign enrollment. Retry with exponential backoff (3 attempts). FastCGI body-token fallback for Mautic instances behind Nginx.
- **feat(mautic)** — Added `worker/src/lib/resend-client.js`: Resend.com email API wrapper. Free tier: 3,000 emails/month, 100/day. Fire-and-forget pattern with 10s timeout. Falls back gracefully when `RESEND_API_KEY` is unset.
- **feat(mautic)** — Added `worker/src/lib/speedsms-client.js`: SpeedSMS.vn API wrapper for Vietnamese SMS. Cost: 490 VND/SMS flat rate (~$6/mo for 300). Brandname sender type (type=2). Phone number normalization to 84xxxxxxxxx format.
- **feat(mautic)** — Added `worker/src/lib/campaign-templates.js`: Vietnamese message templates (winback, birthday, promo). Each returns multi-channel payload `{ subject, html, sms }` for coordinated email + SMS campaigns.
- **feat(mautic)** — Added `worker/src/routes/mautic-bridge.js`: One-way D1-to-Mautic contact sync bridge. Incremental sync via KV cursor (`mautic_last_sync_ts`). Batch upsert in groups of 50. Automatic segment assignment by loyalty tier (BASIC/SILVER/GOLD/PLATINUM), order recency (active/at-risk/inactive), and birthday month.
- **feat(mautic)** — Three campaign enrollment triggers: `detectWinbackCandidates` (30d inactive customers), `detectBirthdayCandidates` (birthday month, dedup against already-redeemed `birthday_discount_used`), `triggerPromoCampaign` (manual with segment filter).
- **feat(mautic)** — Registered Mautic cron tasks in `worker/src/index.js` `scheduled.fetch()`: `syncMauticContacts`, `detectWinbackCandidates`, `detectBirthdayCandidates`.
- **feat(mautic)** — Added `campaign_enrollments` table to `worker/schema.sql` with customer dedup window (30d rolling), campaign type indexing, and Mautic contact ID mapping.
- **test(mautic)** — Added 73 TDD tests across 5 files: `mautic-client.test.js` (27), `mautic-bridge.test.js` (13), `resend-client.test.js` (9), `speedsms-client.test.js` (12), `campaign-triggers.test.js` (12). All pass (726/726 total).
- **docs** — Updated 03_ARCHITECTURE.md, 04_ROADMAP.md, 12_CHANGELOG.md for Mautic pillar.
- **Env vars required:** `MAUTIC_BASE_URL`, `MAUTIC_CLIENT_ID`, `MAUTIC_CLIENT_SECRET`, `RESEND_API_KEY`, `SPEEDSMS_API_KEY`, `SPEEDSMS_API_SECRET`, `MAUTIC_CAMPAIGN_WINBACK`, `MAUTIC_CAMPAIGN_BIRTHDAY`, `MAUTIC_CAMPAIGN_PROMO`, `MAUTIC_SEGMENT_LOYALTY_BRONZE/LOYALTY_SILVER/LOYALTY_GOLD/LOYALTY_PLATINUM`, `MAUTIC_SEGMENT_ACTIVE/AT_RISK/INACTIVE`, `MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH`.
- See: `plans/260630-2230-mautic-marketing-automation/`

### 🔧 Cal.com Booking Webhook Integration (Phase 01-02 Complete, Phase 03 Finalizing)

- **feat(cal)** — Added `worker/src/routes/cal-booking-webhook.js`: Cal.com webhook receiver handling BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED. Validates `x-cal-webhook-secret` header. Table allocator queries `cafe_tables WHERE capacity >= guest_count`, prefers zone match. Idempotency via `cal_booking_uid`. Vietnamese error messages for customer-facing responses.
- **feat(cal)** — Registered route `POST /api/webhooks/cal-booking` in `worker/src/index.js` (24 route modules total).
- **feat(cal)** — Added `cal_booking_uid TEXT` column to `reservations` table + `idx_reservations_cal_uid` index in `worker/schema.sql`.
- **feat(cal)** — Added Cal.com embed widget to `table-reservation.html` with "Dat Ban Nhanh" quick-book section, gold-themed button, dark theme popup, month view.
- **feat(cal)** — Added Cal.com quick-book styling in `table-reservation.css` using Bazi v5.1 tokens.
- **fix(cal)** — Changed `t.seats` → `t.capacity` in `worker/src/routes/reservations.js` to match actual schema column name.
- **test(cal)** — Added `tests/cal-booking-webhook.test.js` with 8 TDD tests covering: valid booking creation, missing/wrong secret (401), invalid payload (400), no tables available (409), idempotent duplicate (200), cancellation flow, zone preference allocation. All pass.
- **docs** — Updated 03_ARCHITECTURE.md, 04_ROADMAP.md, 12_CHANGELOG.md for Cal.com pillar.
- See: `plans/260630-2147-cal-com-reservations/`

### 🔧 ERPNext Migration (Phase 01-06)

- **ERPNext Migration (Phase 01-06):** Replaced Odoo JSON-RPC with ERPNext REST API. New files: erpnext-client.js, erpnext-crm/product/accounting clients, 3 route handlers, 3 lib mappers, admin ERPNext sync page, DB migration SQL, 3 ADRs. Code review complete (9 issues fixed). 904 tests pass (0 fail, 18 skipped).

### 🔧 ERPNext Migration (Phase 07: Odoo Cleanup)

- **Phase 07 (Odoo Cleanup):** Deleted 22 Odoo files (routes, clients, lib, admin pages, tests). Removed Odoo imports/routes from index.js, cron.js, loyalty.js, orders.js. Added ERPNext stub functions (`processErpnextRetryQueue`, `processErpnextProductSync`) in cron.js. Fixed `orderId` scope bug in erpnext-invoices.js. Updated integration test to use ERPNext naming. Added `erpnext_mappings` and `erpnext_sync_logs` tables to schema.sql (existing `odoo_*` tables preserved for data retention). Updated customers.js to JOIN `erpnext_mappings` instead of `odoo_mappings`. Build: 0 errors, Tests: 645 pass, 0 fail.

### 🔧 Superseded — Odoo Integration (Pillar Complete, Replaced by ERPNext)

- **status** — All 3 phases coded (~90%), pending real Odoo credentials + VAT API for production
- **Phase 1:** Accounting — invoices, retry queue, PDF placeholder
- **Phase 2:** POS/Products — checkout availability check, delta sync cron + webhook, sales order creation
- **Phase 3:** CRM — lead creation, loyalty tier → tag trigger, admin customer notes/tags page
- **docs** — ADR 0013 (Accounting), 0014 (POS Sync), 0015 (CRM Sync) in `docs/06_ADR/`
- **tests** — 859 tests passing, lint clean, 5 new D1 migrations (odoo_mappings, odoo_invoices, odoo_sync_logs, odoo_product_sync, odoo_customer_consent)

### 🔧 Superseded — Odoo Phase 1: E-Invoicing

- **feat** - OdooClient base class: JSON-RPC 2.0, auth caching, retry with exponential backoff
- **feat** - OdooAccountingClient: order → invoice processing, PDF generation placeholder
- **feat** - Routes: `POST/GET /api/odoo/invoices`, `POST /api/odoo/invoices/:orderId/retry`
- **feat** - Admin routes for Odoo sync failure management
- **feat** - Fire-and-forget Odoo trigger on order completion
- **feat** - Enhanced cron retry queue with Odoo sync logging
- **feat** - Database tables: `odoo_mappings`, `odoo_invoices`, `odoo_sync_logs`
- **feat** - 144 unit tests passing (29 skipped for Phase 2/3)
- **feat** - Lint clean, all migrations applied to D1

### 🔧 Superseded — Odoo Phase 2: POS (Sales Orders + Product Sync)

- **feat** - OdooProductClient: availability lookup with KV caching (30s TTL)
- **feat** - searchChangedProducts() for delta sync from Odoo
- **feat** - syncProductsToLocal() batch upsert to odoo_product_sync
- **feat** - updateOdooProduct() with field whitelist + cache invalidation
- **feat** - odoo-sales-mapper: mapOrderToSaleOrder, mapOrderItemToSaleOrderLine, mapCustomerToOdooPartner
- **feat** - POST /api/odoo/sales-orders — create SO from local order (idempotent)
- **feat** - GET /api/odoo/products/:productId/availability — KV-cached stock check
- **feat** - POST /api/odoo/products/sync — delta sync from Odoo to local DB
- **feat** - Migration 002: odoo_product_sync + odoo_sync_failures tables

### 🔧 Superseded — Odoo Phase 3: CRM Sync

- **feat** - OdooCrmClient: createLead, updatePartner, addTag, removeTag, getPartnerInfo
- **feat** - mapLoyaltyTier: bronze→Bronze Member, silver→Silver, gold→Gold, platinum→VIP
- **feat** - POST /api/odoo/leads — create lead from customer signup (consent-aware)
- **feat** - GET /api/odoo/customers/:customerId/notes — pull Odoo partner info
- **feat** - POST /api/odoo/customers/:customerId/tags — add loyalty tier tag
- **feat** - Migration 003: odoo_customer_consent table for GDPR compliance

### 🔧 SMTP Transactional Email (SendGrid)

- **feat** - SendGrid HTTP API wrapper (`worker/src/lib/email.js`) with 10s timeout, fire-and-forget pattern, ctx.waitUntil() support
- **feat** - Order confirmation template (`worker/src/templates/order-confirm.js`) -- Vietnamese layout, itemized table, Aura Cafe branding (#0A1A2E Navy, #C9D6DF Chrome)
- **feat** - Payment receipt template (`worker/src/templates/receipt.js`) -- Vietnamese layout, green success header, payment details
- **feat** - Welcome email template (`worker/src/templates/welcome.js`) -- HTML escaping for XSS prevention, loyalty tier display
- **feat** - Fire-and-forget email triggers in order creation (orders.js), payment webhook (webhooks.js), registration (auth.js), and e-invoice with PDF URL (erpnext-invoices.js)
- **feat** - 14 unit tests (`tests/email.test.js`) covering utility validation, template rendering, edge cases
- **chore** - Updated `.env.example` with SENDGRID_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME

### 🎯 Features

- **feat(kds)** - Realtime order tracking integration using HTTP polling:
  - KDS: 3-second polling with `KdsPollClient`, auto-refresh on status changes
  - Track Order page: 5-second polling with animated timeline updates
  - Success page: Real-time progress bar with toast notifications
  - KDS stats: Now fetch real counts from API instead of hardcoded
  - Sound notifications: Web Audio API beeps for new orders (800Hz) and ready status (1200Hz)
  - All WebSocket dead code removed
  - 556 tests passing, lint clean, production ready
  - See: `plans/260626-1412-realtime-order-tracking-integration/`

### 📚 Documentation

- **docs** - Complete documentation overhaul with standardized 12-docs structure:
  - `00_FOUNDER_MANIFESTO.md` — Vision, mission, values, Bazi principles
  - `01_GOAL.md` — Project objectives, success metrics, scope
  - `02_AGENTS.md` — Agent catalog and usage guide
  - `03_ARCHITECTURE.md` — System architecture, components, data flows
  - `04_ROADMAP.md` — Timeline, milestones, phase planning
  - `05_TASKS/` — Task breakdowns by domain (orders, loyalty, menu, reservations, payments, admin, integration, infrastructure)
  - `06_ADR/` — 12 Architecture Decision Records
  - `07_EVALUATION.md` — KPIs, evaluation framework, monitoring
  - `08_BUSINESS_MODEL.md` — Revenue streams, cost structure, unit economics
  - `09_BEHAVIOR_GRAPH.md` — User journey maps, touchpoints
  - `10_RISK_REGISTER.md` — Risk inventory with mitigation plans
  - `11_GLOSSARY.md` — Terms, acronyms, concepts
  - `12_CHANGELOG.md` — This file, updated
- **docs** - Created `docs/README.md` navigation hub for documentation
- **prompts** - Added `prompts/` directory with 5 prompt files (goal, architect, reviewer, security, business)
- **github** - Added `.github/pull_request_template.md`

### 🏗️ Architecture

- **ADR** - Added 12 Architecture Decision Records covering:
  - Cloudflare Workers platform choice
  - D1 SQLite vs PostgreSQL
  - Static HTML vs SPA frameworks
  - Hono framework adoption
  - JWT authentication
  - Bazi v5.1 design system
  - Rate limiting at Worker layer
  - Audit logging to git-tracked files
  - Payment webhook vs polling
  - KDS polling vs WebSocket
  - PayOS as primary gateway
  - Multi-tier loyalty structure
  - **0013** — Odoo Accounting: JSON-RPC 2.0, retry queue, PDF placeholder
  - **0014** — Odoo POS Sync: KV-cached availability, delta sync, field whitelist
  - **0015** — Odoo CRM Sync: bidirectional customer D1↔Odoo, consent table, tag/loyalty mapping

## [v2.1.0] - 2026-03-31

### 🔧 Maintenance & Cleanup

#### Production Code Quality
- **cleanup** - Xóa 4 console.log còn lại trong js/ (chỉ giữ console.error)
- **fix** - Resolve 2 TODO comments trong checkout.js và config.js về PayOS configuration
- **docs** - Cập nhật README.md với Quick Start section và 11 API endpoints

#### Infrastructure Cleanup
- **cleanup(python)** - Xóa legacy Python files không sử dụng
- **cleanup(test)** - Fix test environment configuration
- **cleanup(root)** - Dọn dẹp files ở root directory
- **git** - Removed .min files khỏi git tracking (CSS/JS minified assets)

#### Version Sync
- **version** - Sync version across package.json, README, CHANGELOG

---

## [v2.0.0] - 2026-03-17

### 🎉 Major Features

#### Cloudflare Migration
- Di chuyển toàn bộ infrastructure sang Cloudflare Pages
- Tích hợp Cloudflare Workers cho edge computing
- Cloudflare D1 database cho lưu trữ dữ liệu
- Cloudflare KV cho auth session storage
- Tối ưu performance với CDN toàn cầu

#### Revenue Engine
- Hệ thống thanh toán đa dạng: COD, MoMo, VNPay, PayOS
- Integration với PayOS production gateway
- Checkout flow tối ưu với QR code payment
- Tự động hóa quy trình xử lý đơn hàng
- Delivery fee calculation theo ward distance
- Free delivery threshold từ 500K → 300K

#### Happy Hour System
- Automatic happy hour detection (2:00 PM - 4:00 PM)
- 20% discount cho tất cả đồ uống
- Visual indicators trong menu
- Auto-apply discount khi checkout

#### Loyalty & Referral Program
- Referral code system cho khách hàng
- 30% commission cho referrer
- 15% discount cho người được giới thiệu
- Commission tracking dashboard
- Withdrawal request system
- Multi-tier loyalty program (Bronze, Silver, Gold, Platinum)

#### Churn Prevention
- 30-day inactive customer detection
- Targeted promo campaigns
- Win-back discount codes
- Customer engagement analytics

#### PWA Features
- Offline mode với service worker
- Add to home screen support
- Push notifications
- App-like experience trên mobile
- Manifest.json với icons

#### SEO Optimization
- Meta tags optimization
- Open Graph tags
- Twitter Card tags
- Structured data (JSON-LD)
- Sitemap generation
- Robots.txt configuration

### 🎨 Design System

#### Material Design 3
- Fully implemented M3 design tokens
- Color system với primary, secondary, tertiary palettes
- Typography scale chuẩn M3
- Component library đồng bộ
- Dark mode support
- Responsive design với breakpoints

### 🛠️ Technical Improvements

#### Testing
- 576 unit tests với Jest
- 14 test suites covering all major features
- Test coverage cho checkout, loyalty, menu, i18n
- Automated testing trong CI/CD

#### Performance
- CSS minification với clean-css
- JavaScript minification với terser
- Image optimization với WebP
- Lazy loading cho images
- Critical CSS inlining
- Code splitting

### 🔧 Fixed Issues

- PayOS clientId hardcoded → environment variable
- Delivery fee threshold từ 500K → 300K
- Font families cập nhật sang Space Grotesk/Inter
- Test failures do class name mismatches
- Mock fetch issues trong tests
- i18n translation keys

---

## [v5.0.0] - 2026-03-14

### 🎉 Features (Tính năng mới)
- **feat(loyalty)** - Thêm chương trình Loyalty Rewards cho khách hàng thân thiết (#2a9de0e69)
- **feat(seo)** - Thêm SEO metadata, PWA service worker support (#66b92ae0b)
- **feat(menu)** - Menu page với filtering, gallery lightbox và JSON data (#37aaf15a6)
- **feat(dashboard)** - Admin dashboard với Order Management, Analytics integration (#9b6dfbf07, #a2fe589c4)
- **feat(fnB-caffe-container)** - Order System, Dark Mode, Responsive và SEO/PWA (#204ea0a76)
- **feat(theme)** - Cập nhật F&B color palette với warm coffee tones + ☕ favicon (#9f277a627)

### 🐛 Bug Fixes
- **fix(responsive)** - Thêm breakpoint styles cho 375px trên menu, dashboard, KDS (#9556d5886)
- **fix(tests)** - Điều chỉnh console.log threshold cho dashboard API logging (#630a8ad24)

### 📦 Performance & Cleanup
- **chore(perf)** - Minify CSS/JS assets và clean console.log production code (#e83b56abf)
- **refactor** - Remove console.log statements từ dashboard.js (#3a733acf7)

### 📚 Documentation
- Admin dashboard verification report (#4d433b7c1)
- Project complete report (#79a8dc39e)
- Responsive fix report với breakpoint audit (#32834b668)
- Frontend UI build report cho admin dashboard (#99c9414f7)
- Release notes v4.42.0 (#88c713d5a)

---

## [v4.42.0] - 2026-03-13

### Features
- Release notes v4.42.0 và fix tests (#88c713d5a)

---

## [v1.0.0] - 2026-03-10

### 🚀 Initial Release
- F&B Caffe Container Initial Launch (#0df1b0c0f)
- Complete F&B Container website build (#e98a4fae7)

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v2.1.0 | 2026-03-31 | Production cleanup: console.log removal, TODO resolution, Python legacy cleanup, test environment fixes, .min files removed from git |
| v2.0.0 | 2026-03-17 | Cloudflare migration, Revenue Engine, Happy Hour, Loyalty Referral, Churn Prevention, PWA, SEO |
| v5.0.0 | 2026-03-14 | Loyalty program, PWA, SEO, Admin dashboard |
| v4.42.0 | 2026-03-13 | Cleanup và performance improvements |
| v1.0.0 | 2026-03-10 | Initial launch |

---

## Semantic Versioning

Dự án tuân theo [Semantic Versioning](https://semver.org/):
- **MAJOR** - Thay đổi không tương thích ngược
- **MINOR** - Tính năng mới, tương thích ngược
- **PATCH** - Bug fixes, tương thích ngược
