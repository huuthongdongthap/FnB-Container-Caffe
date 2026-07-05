---
name: 260705-2230-aura-cafe-production-implementation
title: AURA CAFE — Production Implementation Plan (5 Phases, Deep + Parallel)
status: pending
date: 2026-07-05
stage: Zero→PSF
verdict: GO (from ideation)
ideation: /plans/260705-2219-aura-cafe-25-step-complete-ideation/
previous: 260705-0241-aura-cafe-all-streams (token audit + CLI + quality gates DONE)
---

# AURA CAFE — Production Implementation Plan

## Context

Digital platform: **LIVE** (1,163 tests, 318 TS files, 27 routes, 26 D1 tables)
Physical buildout: **NOT STARTED** (this plan's primary focus)
Team: **0/10 hired**

Previous completed work (from `260705-0241-aura-cafe-all-streams`):
- Token migration audit (916 `--st-*` tokens identified)
- aura-deploy CLI scaffolded at `setup/aura-deploy/`
- Quality gates fixes (HelmetHead + i18n gaps closed)
- 1,091 tests passing

## 5 Implementation Phases

### Phase 1: Physical Container Buildout (BLOCKER)
**Duration:** T-8 to W-0 (8 weeks) | **Owner:** External contractor + Owner
**Effort:** ~750M VND | **Critical Path:** longest pole

### Phase 2: Digital Gap Closure
**Duration:** Month 1-3 | **Effort:** ~120h | **Parallel-safe with Phase 1**

### Phase 3: Regulatory + Compliance
**Duration:** T-6 to W-0 (6 weeks) | **Effort:** ~40h | **Owner action items**

### Phase 4: Marketing + Launch Campaign
**Duration:** T-3 to Month 3 | **Effort:** ~80h | **Parallel-safe**

### Phase 5: Steady-State Operations
**Duration:** Month 3+ | **Effort:** Ongoing | **Depends on Phases 1-4**

## Parallel Execution Model

```
Phase 1 (8 weeks) ──────────────────────────────┐
  Container → Interior → Equipment               │
Phase 3 (6 weeks, overlap) ─────────┐            │
  GPKD + PCCC + VSATTP              │            │
Phase 2 (Month 1-3) ----------------┤──→ LAUNCH ←┤── Phase 4 (Month 1-3)
  28 screens, MoMo, domain, etc.    │            │   TikTok, IG, FB, Zalo
Phase 5 (Month 3+) ─────────────────┴────────────┘
  Hiring, ERPNext, events, OKR
```

## Phase Detail Files

| Phase | File | Effort | Owner |
|-------|------|--------|-------|
| 1 — Physical Buildout | `phase-01-physical-buildout.md` | 8 weeks | External contractor |
| 2 — Digital Gap Closure | `phase-02-digital-gap-closure.md` | ~120h | Fullstack dev |
| 3 — Regulatory | `phase-03-regulatory-compliance.md` | ~40h | Owner action |
| 4 — Marketing + Launch | `phase-04-marketing-launch.md` | ~80h | Marketing |
| 5 — Steady-State Ops | `phase-05-steady-state-ops.md` | Ongoing | Owner + team |

## Unresolved Questions (Blocking)

1. Container vendor Đồng Tháp — frame vs turnkey? → **Blocks Phase 1**
2. Coffee bean supplier — local roasted or HCMC import? → **Blocks Phase 1**
3. Staff housing near 39 Nguyễn Tất Thành? → **Blocks hiring**
4. Zalo OA approval timeline? → **Blocks Phase 4**
5. Token migration: manual vs bulk script (916 `--st-*` → `--aura-*`)? → **Blocks Phase 2**
