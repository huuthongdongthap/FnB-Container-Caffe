# Codebase Cleanup & Redundancy Refactoring Plan

## Overview
- **Slug**: `2026-09-16-codebase-cleanup-and-refactor`
- **Objective**: Dọn sạch code rác, loại bỏ file thừa/backup/duplicate, chuẩn hoá dependency domain theo DDD, và gom cụm UI primitives theo MD3.
- **Safety Law**: Bảo toàn 100% test pass (3.374+ tests) và 0 TypeScript errors. Tuân thủ nguyên tắc "NEVER DELETE → REWRITE → HOPE".

## Phases

| Phase | Title | Scope | Status |
|---|---|---|---|
| [Phase 01](phase-01-filesystem-hygiene.md) | Filesystem & Backup Hygiene | Xoá `.bak`, `_dist_backup`, dọn dẹp worktrees cũ | ✅ Completed |
| [Phase 02](phase-02-customer-domain-and-tree-cleanup.md) | Customer Domain & Tree Consolidation | Sửa leaky imports `order -> worker/src/tree`, xoá 5 file trùng lặp tại `worker/src/tree/customer/` | ✅ Completed |
| [Phase 03](phase-03-schema-and-contract-consolidation.md) | Schema & Contract Single Source of Truth | Đồng nhất Zod schemas giữa `worker/src/schemas` và `packages/domain/*/schemas` | ✅ Completed |
| [Phase 04](phase-04-frontend-ui-primitives-consolidation.md) | UI Primitives & MD3 Token Consolidation | Hợp nhất `src/components/md3/` & `src/components/ui/`, chuẩn hoá design tokens | ✅ Completed |
| [Phase 05](phase-05-verification-and-test-suite-safety.md) | End-to-End Verification & Build Audit | Chạy 3.374 unit tests, `tsc --noEmit`, và `vite build` | ✅ Completed |

## Key Dependencies & Execution Order
```
Phase 01 (Filesystem) ──▶ Phase 02 (Domain Inversion) ──▶ Phase 03 (Schemas)
                                                                 │
Phase 05 (Verification) ◀── Phase 04 (UI Primitives) ────────────┘
```
