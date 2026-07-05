---
name: 260706-0053-g4-g9-g5-digital-gap-closure-remaining
title: Phase 2 Remaining — G4 Push Notifications + G9 PWA Offline + G5 ERPNext Sync
status: pending
date: 2026-07-06
depends_on: [G3 token migration — committed 5d05f26]
---

# Phase 2 Remaining: G4, G9, G5

## Mục tiêu

Complete the remaining Digital Gap Closure items after G3 (token migration, committed).
Fokus: Staff push notifications, PWA full offline mode, ERPNext sync wiring.

## Gaps

| ID | Gap | Effort | Priority | Status |
|----|-----|--------|----------|--------|
| G4 | Staff push notifications | 16h | P1 | Existing infra, needs staff triggers |
| G9 | PWA full offline mode | 8h | P2 | Basic SW exists, needs menu cache + order queue |
| G5 | ERPNext sync wiring | 10h | P2 | Stubs exist, need live API wiring |

## Phase Files

| Phase | File | Gap |
|-------|------|-----|
| phase-01-g4-staff-push-notifications.md | G4 (P1, 16h) |
| phase-02-g9-pwa-full-offline-mode.md | G9 (P2, 8h) |
| phase-03-g5-erpnext-sync.md | G5 (P2, 10h) |

## Execution Order

G4 (P1) → G9 (P2) → G5 (P2). G9 and G5 are independent — can parallelize after G4.

## Existing Infrastructure (do not rebuild)

- Push: `worker/src/routes/push.ts`, `worker/src/tree/push/notifier.ts`, `src/hooks/use-push-notifications.ts`
- PWA: `public/sw.js` (cache-first, network-first, push, sync-orders, retry-queued-api)
- ERPNext: `worker/src/routes/erpnext-sync.ts`, `worker/src/clients/erpnext-client.ts`
- Inventory: `worker/src/routes/inventory/crud.ts`, `order-deduction.ts`

## Progress

| Phase | Gap | Status |
|-------|-----|--------|
| G3 | Token Migration | ✅ Done (commit 5d05f26) |
| G4 | Staff Push Notifications | ⏳ Pending — plan ready |
| G9 | PWA Full Offline Mode | ⏳ Pending — plan ready |
| G5 | ERPNext Sync Wiring | ⏳ Pending — plan ready |
