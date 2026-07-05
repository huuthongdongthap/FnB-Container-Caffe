---
phase: 2
title: Digital Gap Closure
status: pending
duration: Month 1-3 (parallel with physical buildout)
effort: ~120h
depends_on: []
blocker: false
parallel_safe: true
---

# Phase 2: Digital Gap Closure

## Mục tiêu / Objective

Close all P1/P2 digital gaps identified in the ideation gap report.
All work is code changes to existing project — no new systems needed.

## Gap Closure Matrix

| ID | Gap | Effort | Priority | Implementation Notes |
|----|-----|--------|----------|----------------------|
| G2 | MoMo payment integration | 4h | P1 | Add MoMo as payment method alongside PayOS. Follow existing PayOS webhook pattern in `worker/src/routes/payment/`. Test with sandbox. |
| G3 | 28 Stitch screens → React | 70h | P1 | 10 customer + 18 admin screens. Convert Stitch JSON export → React + Tailwind + Bazi tokens. Pattern: see existing `src/components/*` conversion examples. |
| G4 | Staff mobile app (FOH notifications) | 16h | P1 | Web Push notifications for order alerts, shift reminders. Use existing push infrastructure (`src/components/push/`). |
| G5 | Real-time inventory management | 12h | P2 | D1 inventory table + ERPNext sync cron. Build on existing ERPNext sync pattern. |
| G6 | ERPNext full wiring | 16h | P2 | Wire stub endpoints to live ERPNext API. Invoice creation, POS sales orders, CRM leads. |
| G7 | Custom domain auraspace.cafe | 1h | P2 | Link custom domain to Cloudflare Pages. Update DNS records. Delete old pages.dev URL. |
| G9 | PWA full offline mode | 8h | P2 | Extend existing `public/sw.js` with offline menu cache, offline order queue. |

## Implementation Order (by dependency)

### Sprint 1 (Week 1-2): Quick Wins
1. **G7** — Custom domain (1h) — zero risk, immediate value
2. **G2** — MoMo payment (4h) — follow existing PayOS pattern, low risk
3. **G5** — Real-time inventory (12h) — unblock kitchen ops

### Sprint 2 (Week 3-6): UI Completion
4. **G3** — 28 Stitch screens (70h) — batch 5 screens per sprint
   - Batch 1 (Week 3): 5 high-traffic customer screens
   - Batch 2 (Week 4): 5 more customer screens + KDS improvements
   - Batch 3 (Week 5): 5 admin screens
   - Batch 4 (Week 6): 3 admin screens + integration testing

### Sprint 3 (Week 7-8): Infrastructure
5. **G9** — PWA offline mode (8h)
6. **G4** — Staff mobile notifications (16h)

### Sprint 4 (Month 2-3): ERP Integration
7. **G6** — ERPNext full wiring (16h) — requires ERPNext credentials from owner

## Files to Modify (Known Touchpoints)

| Gap | Files to touch |
|-----|---------------|
| G2 MoMo | `worker/src/routes/payment/` (new file: `momo.ts`) |
| G3 Screens | `src/components/` (28 new or modified components) |
| G4 Staff app | `src/components/push/`, new `src/components/staff/` |
| G5 Inventory | `worker/src/routes/inventory/`, new D1 table |
| G6 ERPNext | `worker/src/routes/erpnext/` (existing stubs) |
| G7 Domain | CF Pages settings (no code change) |
| G9 PWA | `public/sw.js` (modify existing) |

## Token Remediation (Prerequisite)

Before Sprint 2 (Stitch screens), the 916 `--st-*` CSS tokens must be migrated to `--aura-*`:
- Option A: Manual per-component verification (high quality, slow)
- Option B: Bulk sed replace + visual regression testing (faster, riskier)
- Option C: Hybrid — bulk replace then spot-check 10% highest-traffic screens
- **Recommendation: Option C** — bulk replace + automated + spot-check

## Unresolved Questions

1. Token migration: manual vs bulk replace? → Blocks G3 screens
2. ERPNext credentials from owner? → Blocks G6
3. Which 28 screens are missing? → Need to enumerate from Stitch export
