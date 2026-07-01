---
plan_id: 260630-2045-hybrid-erpnext-tv-menu
status: in-progress
mode: tdd
effort: 18h
tests_target: 910+
depends_on: ERPNext instance (Phase 03 only)
---

# Hybrid Plan — ERPNext Unblock + TV Menu Display

**Summary:** Research ERPNext deployment + build TV menu display page + finish ERPNext migration when instance ready.

## Phases

| # | Phase | Effort | Status | TDD |
|---|-------|--------|--------|-----|
| 01 | ERPNext Deployment Research | 3h | pending | N/A (docs only) |
| 02 | TV Menu Display Page | 5h | pending | ✅ tests first |
| 03 | ERPNext Phase 07-08 Finish | 10h | in-progress | N/A (existing tests) |

## Dependencies

```
Phase 01 (3h) ──┐
                ├── Phase 03 (10h, when ERPNext instance ready)
Phase 02 (5h) ──┘
```

Phase 01 + 02 can run in parallel (independent). Phase 03a (Odoo cleanup) complete. Phase 03b (E2E) waits for ERPNext credentials.

## Key Decisions

- TV page: standalone HTML, NO backend changes — reads existing GET /api/menu
- Design: Bazi v5.1 (Navy #0f172a, Gold #c9a96e, font: Cormorant Garamond + Space Grotesk)
- ERPNext: Docker on 4GB VPS (~300K VND/mo) — guide for non-tech user
- TDD on Phase 02 only (HTML page with testable behavior)

## Success Criteria

- [ ] ERPNext deployment guide written, followable by non-tech user
- [ ] TV menu page renders correctly on 1920x1080
- [ ] TV page auto-refreshes every 60s
- [ ] TV page shows all menu categories + items + prices
- [ ] Build passes, 0 new errors
- [ ] Tests pass (910+)
- [ ] ERPNext Phase 07-08 complete (when instance ready)

## Related

- Brainstorm: `plans/reports/brainstorm-260630-2045-next-pillar-hybrid.md`
- ERPNext plan: `plans/260630-1948-erpnext-migration/plan.md`
