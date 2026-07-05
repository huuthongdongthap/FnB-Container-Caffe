---
type: final-gap-report
date: 2026-07-05
project: AURA CAFE
status: READY FOR PHYSICAL LAUNCH
---

# Final Gap Report — AURA CAFE

## Overall Status: READY FOR PHYSICAL LAUNCH

Digital platform fully deployed. Physical buildout is the only remaining blocker.

## Digital Platform Summary
- 318 TypeScript files, 1,163 tests (1,063 unit + 129 E2E)
- 27 Stitch components, 26 D1 tables, 5 migrations
- 45+ API endpoints, 27 routes
- Production at https://auraspace.cafe (DNS set, not linked to CF Pages)

## Gap Matrix — 12 Gaps

| ID | Gap | Category | Blocker? | Effort | Status |
|----|-----|----------|----------|--------|--------|
| G1 | Physical container build + PCCC + GPKD | Physical | 🔴 YES | 8 weeks | T-8 |
| G2 | MoMo payment integration | Integration | 🟡 P1 | 1 day | Backlog |
| G3 | 28 Stitch screens → React components | UI | 🟡 P1 | 70h total | Backlog |
| G4 | Staff mobile app (FOH notifications) | Feature | 🟡 P1 | 1 sprint | Backlog |
| G5 | Real-time inventory management | Feature | 🟡 P2 | 1 sprint | Backlog |
| G6 | ERPNext full wiring (not stub) | Integration | 🟡 P2 | 1 sprint | Backlog |
| G7 | Custom domain auraspace.cafe → CF Pages | Infra | 🟡 P2 | 30 min | Backlog |
| G8 | Multi-branch support | Architecture | 🟢 Future | Q2 2027 | Future |
| G9 | PWA full offline mode | Feature | 🟢 Future | 1 sprint | Backlog |
| G10 | AI menu recommendations (OpenClaw) | AI | 🟢 Future | 2 sprints | Future |
| G11 | Blockchain loyalty tokens | Web3 | 🟢 Future | — | Future |
| G12 | Team hiring (0/10) | Human | 🔴 YES | Recruiting | W-8 |

## Financial Summary
- Monthly revenue target: 228M VND (3,000 orders/month)
- Break-even: 2,500–3,100 orders/month
- Peak cash requirement: ~190M VND (~$7,600 USD) before Month 1
- Staffing: 7–9 FTE + 2–3 PT

## Critical Path
```
[NOW] Container quote + order (W-8)
  → Hire head barista (W-8)
  → File GPKD/PCCC/VSATTP (W-6)
  → Marketing presale launch (W-6)
  → Container delivery + build (W-5 → W-0)
  → Interior fitout (W-4 → W-1)
  → Soft launch friends/family (W-1)
  → GRAND OPENING (W-0)
  → Stabilize M1 → Scale M2-3 → Grow M4+
```

## Unresolved Questions
1. Container vendor Đồng Tháp — frame vs turnkey?
2. Coffee bean supplier — local roasted or HCMC import?
3. Staff housing availability near 39 Nguyễn Tất Thành?
4. Zalo OA approval timeline — có kịp trước launch?
5. Token migration: manual verification vs automated bulk replace?
