# Phase 04: UI Primitives & MD3 Token Consolidation

## Context Links
- Master Plan: [plan.md](plan.md)
- Design Guidelines: `docs/design-guidelines.md`
- MD3 Strict Rules: `.claude/rules/m3-strict.md`

## Overview
- **Priority**: Medium (P2)
- **Current Status**: Completed (commit `891deb0`)
- **Description**: Hợp nhất thư viện UI components theo chuẩn Material Design 3 (MD3). Chuẩn hoá export từ `src/components/ui/` sang `src/components/md3/` và loại bỏ code dư thừa/inconsistent giữa hai thư mục UI primitives.

## Key Insights
1. **Thực trạng UI Primitives**:
   - `src/components/md3/`: Bộ components chuẩn Material Design 3 mới được xây dựng hoàn chỉnh với đầy đủ variants, accessibility, và token chuẩn (`bg-md-primary`, `rounded-md-full`, v.v.).
   - `src/components/ui/`: Thư viện component cũ (244 lượt import), sử dụng tailwind tokens cũ (`bg-accent`, `hover:bg-secondary`).
   - Cần cầu nối tương thích ngược để `src/components/ui/index.ts` re-export các MD3 primitives tương ứng (như `MD3Button`, `MD3Card`, `MD3TextField`), cho phép nâng cấp dần các màn hình UI mà không gây breaking changes hàng loạt.
2. **Design Tokens Đồng Bộ**:
   - `src/styles/global.css` đã map đầy đủ các biến `--color-md-*` vào CSS variables `--md-sys-color-*`.
   - Cần đảm bảo các component mới hoàn toàn tuân thủ token hệ thống thay vì hardcode hex colors.

## Requirements
### Functional
- Re-export các MD3 primitives qua `src/components/ui/index.ts` để tiện cho việc dùng song song trong quá trình chuyển dịch.
- Đảm bảo các component MD3 cốt lõi (`MD3Button`, `MD3Card`, `MD3Dialog`, `MD3TextField`) có đủ props tương thích.
- Giữ 100% hoạt động của các frontend page hiện tại (`src/pages/*`).

### Non-Functional
- Giữ nguyên các test của frontend trong `src/**/__tests__`.
- Không tăng bundle size bất thường.

## Architecture
```
[src/styles/global.css] (MD3 Design Tokens)
         │
         ▼
[src/components/md3/*] (Canonical MD3 Implementation)
         │
         ▼ (re-exported / bridged)
[src/components/ui/index.ts] (Backwards-compatible Primitives)
         │
         ▼
[src/pages/* & src/components/*] (Consumer Views)
```

## Related Code Files
### Files to Review & Update
- `src/components/ui/index.ts`
- `src/components/md3/index.ts`
- `src/styles/global.css`

## Implementation Steps
1. Rà soát danh sách primitives trong `src/components/ui/index.ts` so với `src/components/md3/index.ts`.
2. Mở rộng `src/components/ui/index.ts` để xuất khẩu cả MD3 primitives (`MD3Button`, `MD3Card`, `MD3TextField`, `MD3Dialog`, v.v.).
3. Kiểm tra các component composite (như `navbar.tsx`, `bottom-nav.tsx`) để xác định khả năng thay thế dần bằng `MD3NavigationBar` và `MD3TopAppBar`.
4. Chạy `npx vitest run src/components/` xác nhận toàn bộ test UI pass.
5. Chạy `npm run build` để kiểm tra compile và bundle output của Vite.

## Todo List
- [x] Khảo sát đối chiếu giữa `src/components/ui/` và `src/components/md3/`
- [x] Export MD3 primitives tại `src/components/ui/index.ts`
- [x] Đảm bảo CSS variables MD3 hoạt động đồng bộ
- [x] Chạy test suite của UI components
- [x] Xác nhận `npm run build` hoàn thành không có lỗi

## Success Criteria
- MD3 components trở thành nguồn tham chiếu chuẩn cho toàn bộ giao diện mới.
- Không có lỗi type hay component mismatch nào xảy ra tại frontend.

## Next Steps
- Chuyển sang [Phase 05: End-to-End Verification & Build Audit](phase-05-verification-and-test-suite-safety.md).
