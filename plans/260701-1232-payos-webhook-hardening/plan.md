---
title: PayOS Webhook Hardening — Idempotency + Retry + DLQ
description: >-
  Close 3 reliability gaps in PayOS payment flow: duplicate-payment idempotency,
  return URL modernization, dead-letter queue admin visibility. TDD mode — tests
  first per phase.
status: completed
priority: P1
branch: main
tags:
  - payos
  - payment
  - webhook
  - hardening
  - reliability
blockedBy: []
blocks: []
created: '2026-07-01T05:37:41.252Z'
createdBy: 'ck:plan'
source: plans/reports/brainstorm-260701-1232-payos-hardening.md
mode: tdd
effort: 4h
---

# PayOS Webhook Hardening — Idempotency + Retry + DLQ

## Overview

Close 3 reliability gaps in the PayOS payment flow identified during codebase audit. The Worker already has solid HMAC-SHA256 signing, signature verification, and amount validation. This plan hardens the remaining weak points: idempotency, return URL modernization, DLQ visibility, and frontend UX.

**Source:** `plans/reports/brainstorm-260701-1232-payos-hardening.md`

## Design Decisions

| Decision | Choice |
|----------|--------|
| Idempotency strategy | Worker-side: check `payments` table for existing order before creating new PayOS request |
| Return URL | Direct to React route `/order-success?order_id=X` (keep `checkout.html` bridge as fallback) |
| DLQ visibility | New `GET /api/admin/payments/stuck` endpoint reading KV keys `payment:stuck:*` + `webhook:dlq:*` |
| Frontend retry | Exponential backoff (1s, 2s, 4s) on `createPaymentLink` failure, max 3 attempts |
| Polling timeout | Order-success page stops polling after 10 min, shows "Liên hệ hỗ trợ" |
| Testing | TDD mode — write tests for current behavior first, then implement, verify tests still pass |

## Architecture

```
Checkout → createOrder → createPaymentLink (idempotent) → PayOS redirect
                                                              ↓
                                                        User pays QR
                                                              ↓
PayOS Webhook → verifySignature → update D1 → notifyTelegram + email receipt
                    ↓ (failure)
              KV dead-letter (payment:stuck:* / webhook:dlq:*)
                    ↓
         GET /api/admin/payments/stuck → Admin dashboard "Stuck Payments" card
```

## Phases

| Phase | Name | Status | Priority | Dependencies | Effort |
|-------|------|--------|----------|-------------|--------|
| 1 | [TDD Gate (Worker + Frontend Tests)](./phase-01-tdd-gate-worker-frontend-tests.md) | Pending | P1 | — | Completed |
| 2 | [Worker Idempotency & Return URL Fix](./phase-02-worker-idempotency-return-url-fix.md) | Pending | P1 | Phase 1 | Completed |
| 3 | [Frontend Retry & UX Hardening](./phase-03-frontend-retry-ux-hardening.md) | Pending | P1 | Phase 2 | Completed |
| 4 | [DLQ Admin Visibility](./phase-04-dlq-admin-visibility.md) | Pending | P2 | Phase 2 | Completed |
| 5 | [Integration Test & Verify](./phase-05-integration-test-verify.md) | Pending | P1 | Phases 2-4 | Completed |

**Parallel execution:** Phases 3 and 4 can run concurrently after Phase 2 completes.

## TDD Contract

Every phase:
1. Write tests FIRST capturing current behavior (or expected new behavior)
2. Verify tests FAIL (red)
3. Implement the change
4. Verify tests PASS (green)
5. Run ALL existing tests — 410 must still pass
6. `npm run build` must succeed with 0 TypeScript errors

## Dependencies

None — this plan is self-contained. No blocking plans. The ERPNext migration plan (`260630-1948-erpnext-migration`) is in-progress but touches different files (ERPNext routes, not payment).

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Return URL change breaks in-flight payments | Keep `checkout.html` bridge as fallback for 7 days |
| Idempotency check race condition | Use D1 transactional approach: SELECT → conditional INSERT |
| DLQ endpoint exposes sensitive data | Require owner role auth, mask amounts in list view |
| Frontend retry increases PayOS API load | Max 3 attempts with exponential backoff, ~7s total |
