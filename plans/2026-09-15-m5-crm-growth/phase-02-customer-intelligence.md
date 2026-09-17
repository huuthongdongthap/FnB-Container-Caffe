# Phase 02 — Customer Intelligence (RFM-lite + Preferences + 360-view)

**Priority:** HIGH — feeds segments, retention, dashboard.
**Status:** ✅ COMPLETE (2026-09-15)

## Overview
Read-only analytics commands over the shared order + customer tables. No writes. Produces the unified **CRM 360 view** for owner/staff dashboard.

## Key Insights

- Pure functions where possible (banding, preferences) → easy unit testing.
- 360-view composes account + tier + band + preferences + recent events.
- Tunable windows via KV: `crm:band_policy` JSON { regularMaxDays, lapsingMinDays, dormantMinDays }.

## Requirements

### Functional
- `computeFrequencyBand({ firstOrderAt, lastOrderAt, orderCount, now }, policy)` → 'new' | 'regular' | 'lapsing' | 'dormant' | 'resurrected'.
- `extractPreferences(orders[])` → { favouriteCategories, favouriteItems, avgOrderCents, preferredChannel, orderCount }.
- `getCustomer360(db, customerId, kv?)` → composes account + tier + band + preferences + recent events.

### Non-Functional
- Pure functions band + preferences (no D1).
- 360-view handles partial failures (non-blocking — read failure never breaks staff surface).
- KV-tunable band windows with code defaults.

## Architecture

```
packages/domain/crm/commands/
├── frequency-band.ts     # pure computeFrequencyBand(ordersSummary, policy)
├── preferences.ts        # pure extractPreferences(orders[])
├── customer-360.ts       # getCustomer360(db, customerId, kv?)
```

## Related Code Files

### Modify
- `packages/domain/crm/commands/get-customer-account.ts` — may be superseded or composed into 360.

### Create
- `packages/domain/crm/commands/frequency-band.ts`
- `packages/domain/crm/commands/preferences.ts`
- `packages/domain/crm/commands/customer-360.ts`
- `packages/domain/crm/index.ts` — barrel exports
- `tests/crm-intelligence.test.ts` — unit + integration tests

## Implementation Steps

1. Create `frequency-band.ts` — pure computeFrequencyBand + DEFAULT_BAND_POLICY.
2. Create `preferences.ts` — pure extractPreferences (parses orders.items JSON).
3. Create `customer-360.ts` — composes getCustomerAccount + computeTier + computeFrequencyBand + extractPreferences + aggregateEvents (limit 5).
4. Add barrel exports.
5. Add route `GET /customers/:id/360` (owner/staff) in `crm.ts`.
6. Write tests: banding boundaries (unit), preference parsing (unit), 360 composition (integration).
7. Run full suite.

## Todo

- [ ] `frequency-band.ts` (pure)
- [ ] `preferences.ts` (pure)
- [ ] `customer-360.ts` (D1 composition)
- [ ] Barrel exports
- [ ] Route `GET /customers/:id/360`
- [ ] Tests
- [ ] Run full suite

## Success Criteria

- `computeFrequencyBand` covered by ≥ 4 unit tests.
- `extractPreferences` correctly aggregates from realistic order JSON.
- 360 route returns unified payload; 401/403 enforced.
- tsc clean.

## Risks

- Order items JSON schema variance (v1 schema vs legacy). Mitigation: defensive parsing, skip malformed items.
- 360-view read latency (5+ D1 queries). Mitigation: Promise.all parallelism; partial fallbacks.

## Security

- 360-view owner/staff only (contains tier, points, band — sensitive).
- No cost/sku/supplier echoed back in preferences (internal-only).
