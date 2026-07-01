# Brainstorm Report — Next Steps After ERPNext Migration

**Date:** 2026-06-30
**Context:** ERPNext migration Phases 01-06 done, Phase 07-08 pending
**Decision:** Hybrid — ERPNext unblock + Digital Menu TV

---

## Problem

ERPNext migration blocked on credentials (1-2 weeks). Need productive work while waiting + quick customer-visible win.

## Scout Findings

- 12 pillars: 4 complete, 1 in-progress (ERPNext), 7 remaining
- Hardware available: TV/monitor, IP cameras, NO Raspberry Pi
- 904 tests, production stable, Cloudflare Workers + D1
- All priorities active: revenue, operations, CX, infrastructure

## Evaluated Approaches

| # | Approach | Effort | Pros | Cons |
|---|----------|--------|------|------|
| A | ERPNext finish only | 15h | Complete backbone pillar | No visible progress while waiting |
| B | Digital signage (Xibo) | 20h | Full CMS, reusable | Heavy for simple menu display, needs Xibo server |
| C | Hybrid: research + simple menu page | 8h + 10h after unblock | Progress now, ERPNext finishes after | Two workstreams, context switch |

**Selected: C (Hybrid)**

## Design

### Phase A: ERPNext Deployment Research (3h)
- Compare Docker vs Frappe Cloud vs manual install
- Write `docs/deployment/erpnext-setup-guide.md`
- Target: ~300K VND/month VPS (4GB RAM) or free tier if available
- Output: user can provision instance themselves

### Phase B: TV Menu Display (5h)
- New static page: `/tv-menu.html`
- Fetches from existing `/api/menu` — NO new backend code
- Bazi v5.1 design (Navy #0f172a, Gold #c9a96e, Chrome accents)
- Full-screen 1920x1080, auto-refresh every 60s
- Works on any browser device + HDMI to TV
- Sections: categories, products + prices, happy hour banner, QR to order

### Phase C: ERPNext Finish (10h, when instance ready)
- Phase 07: Delete 22 old Odoo files (2h)
- Phase 08: E2E test with real ERPNext (8h)
- Deploy + verify

## Implementation Order

```
A (3h) → B (5h) → [wait ERPNext instance] → C (10h)
```

## Touchpoints

- Phase A: docs/ only, no code
- Phase B: 1 new HTML file, reads from existing GET /api/menu
- Phase C: delete ~22 files, verify with real ERPNext

## Risk

- Menu TV page: low risk, standalone HTML, no backend changes
- ERPNext instance: depends on external VPS provisioning
- If ERPNext delayed beyond 2 weeks, can extend Phase B with more features (promo scheduler, multi-page slides)

## Validation

- Build passes (0 new errors)
- Tests pass (904+)
- TV page renders on 1920x1080, auto-refreshes
- ERPNext deployment guide is followable by non-tech user
