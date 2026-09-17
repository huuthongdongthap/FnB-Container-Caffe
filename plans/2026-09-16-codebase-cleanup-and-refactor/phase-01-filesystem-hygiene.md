# Phase 01: Filesystem & Backup Hygiene

## Context Links
- Master Plan: [plan.md](plan.md)
- Target State: `docs/architecture/TARGET_STATE.md`
- Engineering Law: `docs/architecture/BLUEPRINT.md` §4

## Overview
- **Priority**: High (P1)
- **Current Status**: Pending Review
- **Description**: Dọn sạch các file tàn dư, backup tạm thời (`.bak`), thư mục build backup (`_dist_backup`), và prune stale worktree không còn sử dụng.

## Key Insights
- File `worker/src/routes/payments.ts.bak` là bản lưu tạm khi refactor thanh toán sang OpenAPI trong M2, trong khi `worker/src/routes/payments.ts` đã bị xoá. Giữ lại `.bak` gây nhầm lẫn context và lãng phí token khi AI scout code.
- File `src/pages/admin/__tests__/GenerateQR.test.tsx.bak` và `./CEO-HANDOVER.md.bak` là các tệp sao lưu rác không nằm trong CI hay source control logic.
- Thư mục `./_dist_backup` chứa build cũ không còn giá trị do repo đã có git tracking.
- Git worktree cũ `.claude/worktrees/wf_d59099ae-3d5-3` đã hoàn thành và cần được prune.

## Requirements
### Functional
- Loại bỏ triệt để các file đuôi `.bak` trong toàn bộ workspace.
- Loại bỏ thư mục tàn dư `_dist_backup/`.
- Prune stale worktrees trong git.

### Non-Functional
- Không làm ảnh hưởng đến bất kỳ file code chính thức nào trong `src/`, `worker/`, hoặc `packages/`.
- Chạy `git status` xác nhận cây thư mục sạch sẽ.

## Architecture
- Chỉ tác động đến tầng file hệ thống, không thay đổi runtime code hay API routes.

## Related Code Files
### Files to Delete
- `worker/src/routes/payments.ts.bak`
- `src/pages/admin/__tests__/GenerateQR.test.tsx.bak`
- `CEO-HANDOVER.md.bak`
- `_dist_backup/` (thư mục)

## Implementation Steps
1. Xác nhận nội dung các file `.bak` không có delta chưa commit bằng `git status`.
2. Xoá an toàn `worker/src/routes/payments.ts.bak`.
3. Xoá `src/pages/admin/__tests__/GenerateQR.test.tsx.bak` và `CEO-HANDOVER.md.bak`.
4. Xoá thư mục `_dist_backup/`.
5. Chạy `git worktree prune` để dọn dẹp worktrees không hoạt động.
6. Chạy `npx vitest run --reporter=dot` để bảo đảm không có test nào tham chiếu nhầm đến file backup.

## Todo List
- [ ] Xoá `worker/src/routes/payments.ts.bak`
- [ ] Xoá `src/pages/admin/__tests__/GenerateQR.test.tsx.bak`
- [ ] Xoá `CEO-HANDOVER.md.bak`
- [ ] Xoá thư mục `_dist_backup/`
- [ ] Chạy `git worktree prune`
- [ ] Verify test suite tiếp tục 100% pass

## Success Criteria
- Không còn bất kỳ file `*.bak` nào trong repository.
- `git worktree list` chỉ hiển thị các worktree thực sự hợp lệ.
- 3.374 tests tiếp tục pass trơn tru.

## Risk Assessment
- **Nguy cơ**: Vô tình xoá mất logic chưa commit nằm trong file backup.
- **Giảm thiểu**: Đã verify diff và xác nhận tất cả logic payment OpenAPI và QR test đều đã có trong production files (`openapi-payments.ts`, `GenerateQR.test.tsx`).

## Security Considerations
- Loại bỏ các file backup ngăn chặn rủi ro lộ lọt cấu hình hoặc thông tin phân tích cũ khi đóng gói build.

## Next Steps
- Chuyển sang [Phase 02: Customer Domain & Tree Consolidation](phase-02-customer-domain-and-tree-cleanup.md).
