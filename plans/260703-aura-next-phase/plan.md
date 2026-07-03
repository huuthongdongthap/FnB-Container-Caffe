# AURA CAFE Next Phase Strategy — Tong Quan Chien Luoc

**Date:** 2026-07-03
**Status:** Planning Complete
**Branch:** `main`
**Production:** https://auraspace.cafe
**Current tests:** 1,184+ passing (116 suites), 0 TS errors
**Current deploy:** CF Workers + D1 + Pages, $5/mo

---

## 1. Current State Summary / Tinh Trang Hien Tai

### What We Built / Nhung Gi Da Xay Dung

AURA CAFE is a **production-validated** F&B management platform for an industrial-luxury container cafe in Sa Dec, Dong Thap. 30+ features, live ordering, real payments.

| Domain | Status | Highlights |
|--------|--------|------------|
| Customer Experience | **Live** | QR ordering, digital menu, PayOS/COD, order tracking, PWA, KDS |
| Admin Operations | **Live** | Dashboard, order mgmt, menu CRUD, staff mgmt, shifts, reservations |
| Marketing | **Live** | Campaign engine (birthday, winback, welcome), broadcast (ZNS/SMS/Email) |
| Loyalty | **Live** | 4 tiers, points, cashback, referral, check-in |
| Analytics | **Live** | Revenue chart, top products, peak hours, CSV export, real D1 data |
| Design | **5/10 Score** | Dark navy theme, glassmorphism, but fragmented fonts + colors |
| Payments | **Live** | PayOS main, COD backup, refund flow pending |
| Infrastructure | **Partial** | No metrics collection, no alerting, no audit log |
| Image Assets | **Optimized** | 47MB -> 10MB, WebP with lazy loading completed |

### Current Weaknesses / Diem Yeu Hien Tai

1. **Design fragmentation** — 3 font families fighting, light-mode tokens on dark-only site, 30+ emoji used as icons
2. **No observability** — Zero metrics, zero alerting, no way to know if payment webhooks are failing
3. **No audit trail** — Admin actions untracked, "who changed this?" cannot be answered
4. **No refund flow** — Paid transactions cannot be reversed through the system
5. **No performance monitoring** — Web Vitals untracked, degradation goes unnoticed
6. **Container padding inconsistency** — Pages use 16px instead of 24px matching DESIGN.md spec

---

## 2. Opportunity Ranking with GO/NO-GO Scores / Xep Hang Co Hoi

Each opportunity scored on: **Impact** (1-5) + **Effort** (hours) + **Risk** (1-5) + **Revenue Impact** (1-5)

| # | Opportunity | Impact | Effort | Risk | Revenue Impact | **Score** | Verdict |
|---|-------------|--------|--------|------|----------------|-----------|---------|
| A1 | Design Token Consolidation | 5 | 2h | 1 | 2 | **24/28** | **GO** |
| A2 | Component Dark Remedy | 5 | 1.5h | 1 | 2 | **24/28** | **GO** |
| A3 | Emoji to Lucide Migration | 4 | 3h | 2 | 1 | **20/28** | **GO** |
| A4 | Test Suite Stabilization | 5 | 6h | 1 | 1 | **23/28** | **GO** |
| A5 | A11y & UX Polish | 4 | 2h | 1 | 2 | **23/28** | **GO** |
| B1 | Observability & Alerting | 5 | 6h | 2 | 4 | **24/28** | **GO** |
| B2 | Advanced Sales Reporting | 4 | 6h | 1 | 3 | **22/28** | **GO** |
| B3 | Performance Monitoring | 3 | 4h | 1 | 1 | **19/28** | **GO** |
| B4 | Audit Log Viewer | 3 | 10h | 1 | 2 | **17/28** | **GO** |
| B5 | Refund Processing (PayOS) | 4 | 6h | 2 | 3 | **20/28** | **GO** |
| B6 | Remaining UI Polish | 3 | 2h | 1 | 1 | **19/28** | **GO** |
| C1 | Multi-tenant Architecture | 4 | 40h | 4 | 5 | **18/28** | **HOLD Q1 2027** |
| C2 | Mobile App (React Native) | 3 | 60h | 3 | 3 | **14/28** | **HOLD** |
| C3 | AI Agent Features | 4 | 30h | 3 | 4 | **17/28** | **DEEP RESEARCH** |
| C4 | Franchise Expansion Tools | 5 | 50h | 4 | 5 | **18/28** | **HOLD** |

**Scoring Formula:** Impact + (Revenue Impact x 2) + (5 - Risk) + (5 - Effort_Tier)
where Effort_Tier: <3h=5, <6h=4, <10h=3, <20h=2, >20h=1

### Phase Summary

| Phase | Items | Total Effort | Impact | Priority |
|-------|-------|-------------|--------|----------|
| **Phase A** — Design System + Quality | A1, A2, A3, A4, A5 | 14-17h | Foundation | **P1 NOW** |
| **Phase B** — Operations + Hardening | B1, B2, B3, B4, B5, B6 | 40-53h | Revenue Protect | **P1 NEXT** |
| **Phase C** — Forward Looking | C1, C2, C3, C4 | 180h+ | Growth | **HOLD** |

---

## 3. 90-Day Roadmap Overview / Lộ Trình 90 Ngày

```
Thang 7 (Jul)       | Thang 8 (Aug)       | Thang 9 (Sep)
─────────────────────┼──────────────────────┼─────────────────────
Phase A: Design Fix  | Phase B: Operations  | Phase C R&D
  A1 Tokens (2h)     |   B1 Observability   |   Multi-tenant study
  A2 Dark Rem (1.5h) |   B2 Sales Reports   |   AI agent research
  A3 Emoji (3h)      |   B3 Perf Monitor    |   Platform evaluation
  A4 Tests (6h)      |   B4 Audit Logs      |
  A5 A11y (2h)       |   B5 Refunds         |
                     |   B6 Polish          |
                     |                      |
[RE-AUDIT 8/10+]     | [HARDENING COMPLETE] | [STRATEGY DECISION]
```

### Week-by-Week / Tung Tuan

| Week | Focus | Deliverable |
|------|-------|-------------|
| W1 (Jul 3-5) | A1 + A2 | Font fix + dark component backgrounds |
| W2 (Jul 6-9) | A3 | Zero emoji in production UI |
| W3 (Jul 10-13) | A4 | 1200+ tests, all passing |
| W4 (Jul 14-16) | A5 | Re-audit score >= 8/10 |
| W5 (Jul 17-20) | B1 | Metrics collection + Telegram alerts |
| W6 (Jul 21-24) | B2 | Sales period comparison + grouping |
| W7 (Jul 25-27) | B4 | Audit log viewer |
| W8 (Jul 28-31) | B5 | PayOS refund flow |
| W9 (Aug 1-3) | B3, B6 | Web Vitals + container padding |
| W10+ (Aug+) | C Research | Multi-tenant + AI agent strategy |

---

## 4. Investment Summary / Tong Ket Dau Tu

### Phase A: 14-17 hours — Frontend Design Fix
**Cost at $50/hr dev rate:** $700-850
**Value:** Design consistency, brand integrity, accessibility compliance
**No DB changes, no API changes, no new packages**
**ROI:** Direct — improves customer perception and staff efficiency. Indirect — prevents brand erosion from inconsistent visuals.

### Phase B: 40-53 hours — Operations Hardening
**Cost at $50/hr dev rate:** $2,000-2,650
**Value:** Revenue protection, fraud detection, customer service improvement
**DB changes:** 3 new tables + 1 ALTER TABLE migration
**API changes:** 7 new endpoints, 2 enhanced
**Frontend:** 5 new admin pages, 4 widgets, 3 Zustand stores
**ROI:** Direct — refund processing recovers customer trust; alerting prevents revenue loss. Indirect — audit trail deters fraud.

### Phase C: TBD (Research only)
**Investment:** 10-20 hours research + prototyping
**No production code until strategy decision confirmed**

### Total All Phases: 54-70 hours
**Total dev cost (est):** $2,700-3,500
**Monthly ops cost increase:** $0 (existing $5/mo Cloudflare covers all)

---

## 5. Strategic Recommendations / Khuyen Nghi Chien Luoc

### Immediate (Next 2 Weeks)

1. **Prioritize Phase A** — Run A1-A5 in sequence. This is the cheapest, highest-impact work. Fixing fonts, colors, and emoji before anything else ensures all subsequent work builds on a clean foundation.
2. **Track re-audit score** — After Phase A, run UI/UX Pro Max re-audit. Target >= 8/10. If score is lower, identify remaining gaps before Phase B.
3. **Do NOT skip A4** — The test suite must stay green. 1,184 tests protect against regression from 30+ features.

### Short-Term (Weeks 3-8)

4. **B1 first in Phase B** — Metrics collection is the foundation. Without observability, you cannot measure the impact of subsequent changes or detect production issues.
5. **B5 second** — Refund processing has direct revenue impact. Every paid order without refund capability is a customer trust risk.
6. **B2 and B4 in parallel** — Sales reporting and audit logs are independent workstreams that can run concurrently.

### Medium-Term (Post-Day 90)

7. **Do NOT build multi-tenant yet** — Single-location concentration is a risk, but multi-tenant before 200 orders/day is premature. Focus on making AURA the best single-cafe system first.
8. **Evaluate AI agents after observability** — Without metrics (B1), AI features like demand forecasting have no data foundation. Wait until at least 30 days of metrics collected.

---

## 6. Next Steps / Cac Buoc Tiep Theo

### Right Now / Ngay Bay Gio

1. [ ] Read this plan and the 5 detailed documents
2. [ ] Confirm Phase A execution order: A1 -> A2 -> A3 -> A4 -> A5
3. [ ] Verify current build: `npm run build` and `npm test` are green

### Phase A Execution / Thuc Hien Phase A

Phase A is **frontend only, no DB changes, no API changes**. All 5 workstreams have individual plan documents:

| Workstream | Document | Effort | Start |
|------------|----------|--------|-------|
| A1 Design Token Consolidation | `phase-a-detailed.md` Section A1 | 1.5-2h | Day 1 |
| A2 Component Dark Remedy | `phase-a-detailed.md` Section A2 | 1.5-2h | Day 1 (after A1) |
| A3 Emoji to Lucide Migration | `phase-a-detailed.md` Section A3 | 3-4h | Day 1 (parallel with A1) |
| A4 Test Suite Stabilization | `phase-a-detailed.md` Section A4 | 5-6h | Day 2 (after A1-A3) |
| A5 A11y & UX Polish | `phase-a-detailed.md` Section A5 | 2-3h | Day 2 (parallel anytime) |

### Phase B Readiness / San Sang Phase B

Phase B requires Phase A completion first (clean design foundation). Detailed plans in `phase-b-detailed.md`.

### Communication / Giao Tiep

- All documents are bilingual VN+EN
- CEO HANDOVER (`CEO-HANDOVER.md`) will be updated after each phase
- Status updates via Telegram (@Sophia_Bbot /status)

---

## 7. Key Contacts / Lien He

| Role | Contact | Channel |
|------|---------|---------|
| Technical Lead | Mekong CLI Team | Claude Code |
| Production URL | https://auraspace.cafe | Web |
| Admin Panel | /admin/login | Web |
| API Health | GET /api/health | HTTP |

---

## Appendices

- Phase A Detailed: `phase-a-detailed.md`
- Phase B Detailed: `phase-b-detailed.md`
- Phase C Overview: `phase-c-detailed.md`
- Research & Gap Analysis: `reports/research-report.md`
- Existing Phase A plans: `../260703-aura-next-phase-a/`
- Existing Phase B plans: `../260703-1849-aura-phase-b/`
