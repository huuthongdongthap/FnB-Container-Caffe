# M1 Batch 1 — Customer + Data Foundation (v4 pivot)

Owner "go" 2026-09-12 authorized M1. This batch builds the customer
domain on the existing zero-based `customers` table + `customer_phone`
order key — additive only, live checkout never breaks.

## Scope (this batch)

1. **D1 migration** `20260913_01` (DONE): customer_identities, consents,
   customer_events, visits + down-migration. CREATE TABLE IF NOT EXISTS
   (re-run safe). Applied to remote D1 2026-09-13 — all 4 tables verified.
2. **Domain modules** `worker/src/tree/customer/`
   - helpers.ts — genId, phone normalization, nowIso
   - identify-customer.ts — capture identifier (phone/email/zalo),
     mark primary, emit CustomerIdentified
   - record-consent.ts — granular consent write, emit ConsentGiven
   - record-visit.ts — one visit row, emit VisitRecorded
   - link-order.ts — OrderLinked event on order completion
3. **Flow wiring** (all non-blocking try/catch, log-only on failure)
   - create-order.ts customer-upsert block → identifyCustomer +
     OrderLinked
   - phone-auth-handler.ts new signup → identifyCustomer (phone) +
     ConsentGiven when marketing opt-in
   - update-order.ts (served/completed) → recordVisit + linkOrder
4. **Tests** — manual-D1-mock pattern (phone-auth-handler.test.ts),
   cover: new identity, existing-identity no-dup, consent write, visit
   write, link event, idempotency.
5. **Migration README** — document 20260913_01 canonical tables.

## Laws binding this batch

- Zero-based (v4 §6/§13): no historical migration; only AURA-verified
  writes
- Consent gate before any CRM write (v4, domain-contracts §11)
- NEVER DELETE→REWRITE→HOPE: old bundle stays live; failures in new
  writes never block checkout
- No Viva Star concepts in domain code
- Domain owns rules; handlers thin

## Phases

| # | Phase | File |
|---|---|---|
| 1 | Customer domain modules | phase-01-domain-modules.md |
| 2 | Flow wiring (checkout/auth/visit) | phase-02-flow-wiring.md |
| 3 | Tests + verify | phase-03-tests-verify.md |

## Acceptance

- New tables written on real checkout/signup/order-complete paths
- 4800+ existing tests stay green (no regression) — **DONE 2026-09-13: 152 files / 1567 tests green, +16 new customer-domain tests**
- Old bundle deployable at every step
- Each command unit-tested (new, existing, idempotent cases) — **DONE 2026-09-13**
