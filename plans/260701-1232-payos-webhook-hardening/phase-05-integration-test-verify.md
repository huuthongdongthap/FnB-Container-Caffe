---
phase: 5
title: Integration Test & Verify
status: completed
priority: P1
dependencies:
  - 2
  - 3
  - 4
effort: 30min
---

# Phase 5: Integration Test & Verify

## Overview

Final gate: run full test suite (worker + frontend), build, verify no regressions. Smoke test the complete PayOS checkout → webhook → order-success flow with mock responses.

## Requirements

- Functional: All worker + frontend tests pass. Build succeeds. No regressions in non-payment flows.
- Non-functional: 0 TypeScript errors, 0 console.log in production code.

## Related Code Files

- All files modified in Phases 2-4
- `src/App.tsx` — verify routes unchanged
- `worker/src/index.ts` / `worker/src/index.js` — verify new route mounted

## Implementation Steps

### Gate 1: Full Test Suite

1. **Run worker tests** — `cd worker && npx vitest run` — all must pass
2. **Run frontend tests** — `npx vitest run` — all 410+ tests pass
3. **Check for test regressions** — compare test count before/after; any decrease requires investigation

### Gate 2: Build

4. **Frontend build** — `npm run build` — 0 TypeScript errors, 0 warnings
5. **Worker type check** — `cd worker && npx tsc --noEmit` — 0 errors

### Gate 3: Code Quality

6. **Run lint** — `npm run lint` — fix any new errors
7. **Verify zero `console.log`** — `grep -r "console\.log" src/ worker/src/` — none in production code
8. **Verify zero `:any` types** — `grep -r ": any" src/ --include="*.ts" --include="*.tsx"` — only pre-existing in `use-checkin.ts`

### Gate 4: Integration Smoke Test

9. **Mock PayOS flow end-to-end:**
   - Cart with 1 item → checkout → select PayOS → submit
   - Verify: order created in D1, payment link returned, redirect URL correct
   - Mock webhook: POST `/api/webhook/payos` with valid signature
   - Verify: payment status `completed`, order `payment_status: paid`
   - Verify: order-success page shows "Thanh toán thành công"
10. **Idempotency test:**
    - Call `createPaymentLink` twice with same order_id
    - Verify: second call returns cached URL (200, not new PayOS request)
11. **DLQ test:**
    - Trigger webhook error (invalid data) → verify KV key written
    - `GET /api/admin/payments/stuck` → verify card shows count = 1

### Gate 5: Deploy Verify

12. **Deploy to Cloudflare Pages preview** — `npx wrangler pages deploy dist --project-name=fnb-caffe-container --branch=main`
13. **Verify deployed site** — JS/CSS MIME types correct, SPA routing works
14. **Smoke test on deployed preview** — checkout flow with COD (to avoid real PayOS calls)

## Success Criteria

- [ ] `cd worker && npx vitest run` — 100% pass
- [ ] `npx vitest run` (frontend) — 416+ tests pass (410 existing + 6+ new)
- [ ] `npm run build` — 0 errors
- [ ] `cd worker && npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — no new errors
- [ ] Zero new `console.log` in production code
- [ ] Zero new `:any` types in production code
- [ ] PayOS idempotency verified (duplicate request → cached response)
- [ ] DLQ endpoint verified (stuck payment visible in admin)
- [ ] Order-success polling timeout verified (stops after 10 min)
- [ ] Deploy to Cloudflare Pages preview succeeds
- [ ] Deployed site loads correctly (JS MIME type, SPA routing)
- [ ] COD checkout unaffected

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Test count regression from parallel agent changes | Run full suite twice, compare counts. Investigate any decrease. |
| Worker deploy breaks existing payment flow | Deploy frontend only first; worker changes are backward-compatible |
| PayOS sandbox unavailable for E2E test | Mock PayOS API responses using vitest; real E2E requires sandbox credentials |
