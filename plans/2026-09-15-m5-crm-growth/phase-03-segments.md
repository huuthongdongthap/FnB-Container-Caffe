# Phase 03 — Segments

**Priority:** HIGH — powers retention, campaigns, win-back.
**Status:** ⏳ PLANNED

## Overview
Declarative customer segments computed from frequency band + order value. Segments are read-only views over the customer table — no extra write model.

## Key Insights

- Segment = predicate over customer 360 fields (band, lifetimePoints, lastOrderAt).
- KV holds segment definitions; code defaults for the 5 core segments.
- Counts are computed on read (D1 query with WHERE clause derived from segment).

## Requirements

- `getSegmentDefinitions(kv?)` → list of { key, labelVi, labelEn, description, predicate }.
- `buildSegment(db, key, kv?)` → { key, count, customers[] }.
- 5 default segments: `new_first_week`, `regular`, `regular_high_value`, `lapsing_30d`, `dormant_60d`.

## Architecture

```
packages/domain/crm/commands/
├── segments.ts           # getSegmentDefinitions, buildSegment
```

## Related Code Files

### Create
- `packages/domain/crm/commands/segments.ts`
- `tests/crm-segments.test.ts`

### Modify
- `packages/domain/crm/index.ts` — barrel exports
- `worker/src/routes/crm.ts` — add routes

## Implementation Steps

1. Create `segments.ts` with DEFAULT_SEGMENTS + `loadSegmentDefinitions(kv?)`.
2. Implement `buildSegment` — translate predicate to D1 WHERE (band computed via subquery or post-filter).
3. Add routes: `GET /segments`, `GET /segments/:key/customers?limit&offset`.
4. Write tests: segment count accuracy, pagination, KV override.
5. Run full suite.

## Todo

- [ ] `segments.ts`
- [ ] Barrel exports
- [ ] Routes
- [ ] Tests
- [ ] Run full suite

## Success Criteria

- 5 default segments return correct counts against seeded data.
- Pagination works.
- KV override replaces defaults.
- tsc clean.

## Security

- Owner/staff only.
