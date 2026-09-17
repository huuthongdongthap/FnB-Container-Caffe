# Phase 05: End-to-End Verification & Build Audit

## Context Links
- Master Plan: [plan.md](plan.md)
- Engineering Law: `docs/architecture/BLUEPRINT.md` §4
- Target State: `docs/architecture/TARGET_STATE.md`

## Overview
- **Priority**: High (P1)
- **Current Status**: Completed (All 4 Quality Gates Passed)
- **Description**: Thực hiện kiểm thử toàn diện sau khi hoàn thành 4 giai đoạn dọn dẹp và tái cấu trúc. Đảm bảo toàn bộ 3.374+ tests tiếp tục pass, 0 lỗi TypeScript compile, và bản build production hoạt động hoàn hảo.

## Key Insights
1. **Nguyên tắc an toàn tuyệt đối**:
   - Mọi thay đổi trong các phase trước (loại bỏ file thừa, decouple dependency order -> customer, đồng nhất schema, gom MD3 primitives) phải được kiểm chứng tự động bằng test suite hiện hữu.
   - Không được phép "chữa cháy" bằng cách comment out test hay nới lỏng assertions.
2. **Các chốt chặn kiểm tra (Quality Gates)**:
   - Gate 1: TypeScript typecheck (`npx tsc --noEmit`) trên toàn bộ monorepo (root, `packages/domain/*`, `worker/`, `src/`).
   - Gate 2: Unit & Integration tests (`npx vitest run --reporter=dot`) - 369 files, 3.374+ tests.
   - Gate 3: Frontend Vite production build (`npm run build`).
   - Gate 4: Git worktree & filesystem status check (`git status`, `git worktree list`).

## Requirements
### Functional
- 100% tests trong Vitest pass (0 failures).
- 0 lỗi TypeScript compiler (`tsc --noEmit`).
- `npm run build` tạo bundle production thành công trong `dist/`.

### Non-Functional
- Giữ vững hiệu năng runtime và không tăng dung lượng bundle frontend.
- Cây thư mục git gọn gàng, không còn file rác (`.bak`, `_dist_backup`).

## Verification Steps
1. Chạy Type Check:
   ```bash
   npx tsc --noEmit
   ```
2. Chạy Vitest Suite:
   ```bash
   npx vitest run --reporter=dot
   ```
3. Chạy Vite Production Build:
   ```bash
   npm run build
   ```
4. Kiểm tra Git Clean State:
   ```bash
   git status
   git worktree list
   ```

## Todo List
- [x] Xác nhận `npx tsc --noEmit` hoàn thành với 0 lỗi
- [x] Xác nhận toàn bộ 3.374+ tests pass
- [x] Xác nhận `npm run build` thành công
- [x] Kiểm tra `git status` xác nhận không có file rác phát sinh
- [x] Tổng hợp báo cáo hoàn thành tái cấu trúc

## Success Criteria
- 3.374+ tests pass 100%.
- Không có bất kỳ cảnh báo hoặc lỗi TypeScript nào.
- Production build sạch sẽ, sẵn sàng triển khai.
