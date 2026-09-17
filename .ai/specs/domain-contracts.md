---
date: 2026-09-12
version: 1.1
status: approved draft (binding for M1 implementation)
source: v2 §5/§6/§8/§9/§14/§16 + v4 §10/§15/§20/§22 + spec §6/§9/§10/§11 + DOMAIN_MAP.md
v4-reconciliation: plans/2026-09-12-aura-master-v4-reconciliation/plan.md (approved 2026-09-12)
---
# DOMAIN CONTRACTS — 15 AURA Mini-ERP contexts

## 0.1 v4 architecture law (added 2026-09-12)

- **No Viva Star-specific business concepts leak into `packages/domain/`**
  (v4 §20). Supplier facts live in Purchasing/Inventory contexts as
  data, never as domain concepts.
- **All channels (IN_STORE_POS / QR_TABLE / ONLINE_PICKUP /
  ONLINE_DELIVERY / CART / FUTURE_PARTNER) call the SAME Order domain
  commands** (v4 §15) — channel adapters sit outside every context.
- **Zero-based customer data** (v4 §6/§13): no historical migration; the
  customer DB is earned from Day 1 via real transactions. AURA records
  only what it can verify; never pretend complete historical sales data.
- Phase map resequenced per v4 §20: Customer+CRM context = M1;
  Catalog/Menu/Order/Payment/Kitchen/Table/Staff/Shift contracts = M2;
  Inventory/Purchasing/Supplier/Recipe/POS/Reporting = M3 independent
  operation; growth/CRM depth = M5.

## 0. Contract law (per spec §6, §10)

Each context owns its tables and rules; handlers are thin
(VALIDATE→AUTH→USE CASE→MAP); rules never live in React/hooks/routes;
integrations are adapters, never authorities (v2 §16). Offline note per
context follows v2 §14: distinguish LOCAL OPERATIONAL STATE vs REMOTE
SYNC; no "offline" promise without explicit conflict/recovery rules.

## 1. Catalog (M2 — exemplar, D10; moves from M1 per v4 M1 pivot)

- **Owns**: products+menu_items (merge target), categories
- **Commands**: createItem, updateItem, changePrice, setAvailability, mergeLegacyProduct
- **Queries**: getMenu (by channel), getItem, searchCatalog
- **Policies**: price computed server-side; availability enforced
  server-side; ONE product concept after consolidation; **origin/provenance
  decoupled from brand** — supplier lot, roast date, region are supply-
  chain fields (from Purchasing), the customer-facing brand is a
  presentation choice (AURA; Viva Star credit fades per LEGACY_MAP §6)
- **Events**: CatalogItemCreated/Updated, AvailabilityChanged, PriceChanged
- **Offline**: menu is cacheable read-only (PWA shell exists) — browse
  offline OK; writes require sync
- **Tables-from-CURRENT_STATE**: `products`, `menu_items`, `categories` (DOMAIN_MAP)

## 2. Menu (M2)

- **Owns**: menu presentation config per channel/surface (in-store POS, TV
  menu, online AURA SPACE future-M4)
- **Policies**: same catalog truth, per-channel presentation only — no
  channel-specific business logic (v2 §9 law)
- **Events**: MenuPublished
- **Tables**: menu_items view over Catalog; tv-menu config

## 3. Order (M2)

- **Owns**: orders, order_items, order timelines
- **Commands**: createOrder (dine-in/takeaway/delivery — per-type contract
  already doc'd, commit 1e86d65), confirmOrder, advanceStatus, cancelOrder
- **Queries**: getOrder, trackOrder (timeline via DO broadcast — shipped),
- **Policies**: order state machine; kitchen ticket creation on confirm;
  loyalty earn triggers on completion
- **Events**: OrderCreated, OrderConfirmed, OrderReady, OrderCompleted,
  OrderCancelled (OrderPreparing via KDS) — the golden-loop spine (v2 §8)
- **Offline**: current-order view survives disconnect (DO state); new
  orders need connectivity except queued writes via PWA offline-queue
- **Tables**: `orders`, `order_items`

## 4. Payment (M2)

- **Owns**: payments(+_new merge, D7), payment config
- **Commands**: initiatePayment, recordCash (COD), handleWebhook
- **Policies**: webhook-idempotency (ADR-0009); payment state is the ONLY
  authority for "paid" (v2 §16); Stripe/NOWPayments/SePay are adapters
- **Events**: PaymentSucceeded, PaymentFailed, PaymentRefunded
- **Offline**: cash OK offline (record locally, sync); card/crypto
  require connectivity (v2 §14: external authorization)
- **Tables**: `payments`, `payments_new` (merge), subscription payment
  tables stay with Subscription feature

## 5. Table (M2 scope / M3 polish)

- **Owns**: cafe_tables, floor plan, QR bindings
- **Commands**: checkInTable (QR — live), releaseTable, seatParty
- **Policies**: table state machine; QR order binding to active session
- **Events**: TableCheckedIn, TableReleased
- **Offline**: table state cached locally; conflict rule = last-write +
  manual override list (explicit, per v2 §14 "do not promise offline")
- **Tables**: `cafe_tables`, floor-plan config

## 6. Kitchen (M2 contract / M3 dedupe)

- **Owns**: kitchen tickets, queue
- **Commands**: claimTicket, advanceTicket (preparing→ready→served)
- **Policies**: queue order fairness; ticket created from confirmed
  order; DO broadcast pushes updates (ADR-0010)
- **Events**: KitchenTicketCreated, OrderPreparing, OrderReady, OrderServed
- **Offline**: kitchen queue must survive reload — DO is the durable
  state; reconnect resyncs
- **Tables**: order timeline rows; canonical surface /kds (D8: retire 2
  duplicate KDS surfaces in M2)

## 7. Inventory (M3 — biggest gap, Cluster A)

- **Owns**: ingredients, stock levels, counts
- **Commands**: receiveStock, recordWaste, adjustCount, lowStockAlert
- **Queries**: getStock (the /admin/inventory view SOP 01 uses), lowStock
- **Policies**: FIFO; top-10 morning check formalized as count event;
  recipe auto-deduct on OrderCompleted (Task 16 spec — verify against
  real usage before MIRROR→SWITCH)
- **Events**: StockReceived, WasteRecorded, StockLow, RecipeDeducted
- **Offline**: morning count works offline (local form → sync)
- **Tables**: Task-14 schema (41-ingredient seed) + existing inventory
  routes/schemas

## 8. Purchasing (M3 — ❌ today)

- **Owns**: suppliers, purchase orders, receiving
- **Commands**: createPO (auto-suggest from low stock — replaces
  "Cường buys direct"), receivePO, priceUpdate
- **Policies**: PO approval trail; supplier price history (multi-supplier
  per Task 14); **supplier diversification**: coffee category must not
  single-source from Viva Star during/after AURA brand transition (risk
  R18) — target 2–3 active suppliers + direct trade lots
- **Events**: POCreated, POReceived
- **Offline**: create PO offline, sync later
- **Tables**: Task-14/15 schema (multi-supplier; Viva Star = first
  supplier entity, not a special case)

## 9. Staff (M2)

- **Owns**: staff, roles (5-role RBAC live), HR profile
- **Commands**: hireStaff, assignRole, reviewPerformance (Task 22 spec)
- **Policies**: role permissions (staff-roles.ts); SOP adherence is
  training data not enforcement (Kit concern)
- **Events**: StaffHired, RoleChanged
- **Tables**: `users`, `staff`, `staff_shifts`, HR specs 19–23 deferred
  fields

## 10. Shift (M2 core / M3 cash recon)

- **Owns**: shifts, per-shift cash reconciliation (**missing** — Cluster B)
- **Commands**: openShift, closeShift, reconcileCash (count vs system
  totals per shift — makes SOP 02's cash count a system record)
- **Policies**: open/closed shift gates order capture per station; float
  + variance thresholds
- **Events**: ShiftOpened, ShiftClosed, CashReconciled (variance flagged)
- **Tables**: `staff_shifts` + new reconciliation rows

## 11. Customer (M1 — v4 pivot: customer/data foundation is first)

- **Owns**: customers, identity, consent, customer events, visits
- **Commands**: identifyCustomer (phone/digital identifier — v4 §7
  capture ladder: anonymous → identifier → profile → member →
  behavioral CRM), recordConsent, recordVisit, linkOrder
- **Policies**: zero-based DB (v4 §6/§13) — no historical migration,
  no Viva Star API dependency; never require registration before
  ordering (v2 §6 law); consent gate before any CRM write; AURA
  records only what it can verify
- **Events**: CustomerIdentified, ConsentGiven, VisitRecorded,
  CustomerUpgraded
- **Offline**: customer lookup cached; new identity capture queued
  via PWA offline-queue, synced on reconnect
- **Tables**: `customers` (existing — email/phone/loyalty/zalo/source),
  `users` (customer role), orders.`customer_phone` (existing zero-based
  key — verified in worker/schema.sql:114), new: customer_identities,
  consents, customer_events, visits

## 12. CRM (M1 foundation / M5 depth — Cluster D)

- **Owns**: CRM profiles, preferences, frequency, value, segments,
  communication permission
- **Commands**: buildProfile (from verified events only), applySegment
- **Queries**: the 6 questions (v2 §13): who are customers / who
  visited / what bought / how often / what prefer / who to invite back
- **Policies**: profiles built ONLY from AURA-verified transactions
  (v4 §22 — never pretend historical completeness); comms permission
  before outreach (v2 §6); feedback loop from reviews
- **Events**: CustomerVisitRecorded (golden-loop step 9 — missing today),
  SegmentChanged
- **Tables**: derived from orders/checkins/reviews/loyalty + new
  customer_events/visit materialization (M1 schema)

## 13. Promotion (M5 tie-in)

- **Owns**: promotions, vouchers, referral, check-in campaigns
- **Policies**: redemption rules server-side; referral = "Giới thiệu bạn
  bè" wording (D9)
- **Tables**: `promotions`, `vouchers`, `referrals`, `checkins` (live)

## 14. Reservation (M3 policy move)

- **Owns**: reservations
- **Policies**: conflict policy moves from route to domain (gap noted in
  FEATURE_MATRIX)
- **Tables**: `reservations` (live)

## 15. Reporting / HQ (M3 dashboard, M5 full)

- **Owns**: analytics, sales reports, owner dashboard (v2 §15)
- **Queries**: TODAY panel (revenue, orders, AOV, open orders, delayed
  tickets, top products, low stock, cash recon, reservations, new vs
  returning, CRM alerts) + WHY drill + ACTION items
- **Policies**: reports read golden-loop events — never recomputed from
  Excel; revenue truth = D1 payments/orders (retire Excel — L1 mirror path)
- **Tables**: analytics/_metrics trees → consolidated reporting package

## Cross-context laws

1. Golden-loop events (v2 §8 = v4 §11) are the shared event spine; each
   context emits/subscribes per spec §11 — no context reads another's
   tables directly (queries via events or owned projections)
2. Channel adapters (IN_STORE_POS / QR_TABLE / ONLINE_PICKUP /
   ONLINE_DELIVERY / CART / FUTURE_PARTNER) sit OUTSIDE all contexts —
   they call the same Order commands; no channel owns business logic
   (v2 §9, v4 §15) — never build separate apps for online/cart (v4 §24)
3. Authority table v2 §16 is law: catalog→product/price, menu→
   availability, order→order state, payment→paid, kitchen→kitchen
   state, CRM→customer, inventory→stock, ops→staff/shift, HQ→reporting
4. Sa Đéc one-location assumption holds until M6 cart / M8 multi-site —
   no premature location tables (D4)
5. Data ownership (v4 §22): AURA OWNS Customer, CRM, Customer Events,
   Product Master, Recipe, Inventory model, Order model, Operational
   state, Analytics model from Day 1. Viva Star may retain legacy sales
   transaction records during transition only.
6. No Viva Star-specific business concepts in `packages/domain/` (v4 §20)
