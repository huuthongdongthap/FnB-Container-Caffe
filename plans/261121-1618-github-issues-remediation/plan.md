---
title: "Open GitHub Issues Remediation / Xử lý toàn bộ issue đang mở"
description: "Local implementation, regression tests, isolated review, and local commit handoff for open issues #96, #95, #94, #93, #92, #91, #90, #82, #79."
status: completed
priority: P1
branch: minhlongs/porpoise
tags: [issues, frontend, worker, testing, local-handoff]
created: 2026-11-21
---

# Scope & Constraints / Phạm vi và giới hạn

- **Objective / Mục tiêu**: Resolve all evidence-backed open GitHub issues (`#96`, `#95`, `#94`, `#93`, `#92`, `#91`, `#90`, `#82`, `#79`) locally on branch `minhlongs/porpoise` with regression tests, isolated final code review, and clean local commit(s).
- **Boundaries / Giới hạn**:
  - Collaborator-only local handoff: no `git push`, no PR/issue creation or edits on GitHub, no deploy, no production data mutations, no paid external services.
  - Preserve existing public API contracts, UI design system, and unrelated functionality unless an issue explicitly calls for a UX/copy fix.
  - No `:any` in production TypeScript, no `console.log` in production app code, no new dependencies, no secrets printed.
  - Cleanup all temporary agent worktrees and owned build/test artifacts before finishing.

# Workstreams & Disjoint File Ownership / Phân luồng và sở hữu tệp

| Phase / Stream | Issues | Ownership Scope | Status |
|---|---|---|---|
| Stream A | `#93`, `#94` | `src/pages/stitch/reservation-new/**`, `src/pages/admin/Reservations*`, `src/hooks/stores/admin/use-admin-reservations-store*`, `src/pages/checkout.tsx`, `packages/domain/reservation/src/routes/reservations.ts`, reservation tests | Integrated & verified (28 files / 201 tests PASS; worktree cleaned) |
| Stream B | `#92`, `#90` | `src/pages/KDS*`, `src/hooks/use-kds*`, `src/components/stitch/StitchKDS*`, `src/pages/mobile/kitchen-display*`, `src/pages/TableOrder-components.tsx`, `src/components/stitch/StitchCheckoutNew-payment-selector.tsx`, KDS/checkout/table-order tests | Integrated & verified (7 files / 48 tests PASS; worktree cleaned) |
| Stream C | `#96`, `#91` | `src/pages/admin/Orders*`, `src/components/admin/manual-order-refund.tsx`, `src/components/admin/customer-detail.tsx`, `src/components/admin/rewards-manager.tsx`, `src/pages/admin/Customers*`, `worker/src/routes/refunds-handlers/mutation-handlers.ts`, `worker/db/migrations/20261121_01_refund_manual_transfer_ledger*.sql`, refund/CRM tests | Integrated & verified (4 files / 42 tests PASS; worktree cleaned) |
| Stream D | `#82` | `worker/src/routes/saas-commercial.ts`, SaaS signup attribution tests | Verified already implemented (`saas-commercial.ts:228`, `saas-provisioning.ts:219,489`, `hq-saas.ts:276`); 2 files / 18 tests PASS |
| Stream E | `#95`, `#79` | Active table transfer, staff UI, customer copy, and session open/close interoperation / Chuyển bàn, giao diện nhân viên, nội dung khách hàng và đồng bộ mở/đóng phiên | `#95` integrated & verified: atomic session open/close/transfer with scoped per-table schema probing & mock D1 fallback (`table-session-transfer.test.ts` 38/38 PASS, `multi-tenant-franchise.test.ts` 159/159 PASS). `#79`: discovery 10/10 PASS (`28471200` on branch); prior report notes 45 undersized touch targets and unverified Chrome smoke test (out of scope for non-UI-redesign local handoff). |

# Dependencies & Integration Order / Thứ tự tích hợp

1. Verify Stream D (`#82`) directly against `worker/src/routes/saas-commercial.ts` and its Vitest suite.
2. Receive Stream E assessment (`#95`, `#79`) and dispatch bounded implementation worktree(s) for `#95` (and any concrete, verified gaps in `#79` without breaking UI contracts or colliding with Streams A–C).
3. Integrate completed worktree diffs sequentially into `minhlongs/porpoise`, inspecting every diff and resolving any shared-file overlap (e.g., `TableOrder.tsx` between `#90` and `#95`, or `StitchAdminTerminalNew-constants.ts`).
4. Run full verification gates in orchestrator:
   - `npm run --silent lint`
   - `npm run --silent typecheck:all`
   - `npm run --silent lint:migrations`
   - `npm run --silent build`
   - `TZ=Asia/Saigon npm test -- --silent`
   - `TZ=UTC npm test -- --silent`
   - `git diff --check`
5. Run isolated `code-reviewer` on the integrated diff; fix any confirmed blockers and re-verify.
6. Remove all temporary agent worktrees, create focused local conventional commit(s), and deliver final bilingual (VI/EN) handoff report.
