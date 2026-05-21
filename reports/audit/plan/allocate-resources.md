# ALLOCATE RESOURCES — Team Capacity Plan
## Context: 1 Senior Engineer, Sa Đéc timezone (UTC+7)

---

## Resource Allocation

| # | Task | Engineer | Est. Time | Depends On | Window |
|---|------|----------|-----------|------------|--------|
| A1 | D1 migrations | 1 | 2 min | — | **IMMEDIATE** |
| A2 | Rebuild + deploy | 1 | 5 min | A1 | After A1 ✅ |
| A3 | Test suite | 1 | 5 min | A2 | After A2 ✅ |
| A4 | Smoke test | 1 | 5 min | A2 | After A2 ✅ |
| A5 | Cashback backfill | 1 | 15 min | A1 | Deferred |

```
Timeline:
  min 0-2:   ██ A1 (migrations)
  min 2-7:   █████ A2 (build+deploy)
  min 7-12:  █████ A3 (tests)  ║ █████ A4 (smoke)  ← parallel
  min 12:    ✅ COMPLETE
```

## Capacity Check

| Metric | Value |
|--------|-------|
| Available | 1 engineer |
| Total effort | 17 min (sequential dependency chain) |
| Utilization | 100% |
| Buffer | 10 min for retries/errors |
| **Total session** | **~30 min** |

## Notes

- A3 and A4 can run in parallel (2 terminal tabs)
- A2 deploy uses Cloudflare Pages build → ~3 min deploy time
- A5 cashback backfill deferred — manual per-customer if complaints arise
- All 2026-05-07 changes in current branch ready to ship

---

## Risk Register Update

Previous: 12 findings → After audit execution → Target: 0 open items (R1+R7 resolved)
- R1 migrations: → CLOSED via A1
- R7 stale deploy: → CLOSED via A2  
- R8 tests: → VERIFIED via A3
- R2-R6: → Already fixed in code, verified via A4
- R9-R10: → Accepted risk, no action
