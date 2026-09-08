# Phase 4 — M3 Accessibility + Motion Tokens

**Priority:** P1 · **Status:** ✅ Done · **Depends:** Phase 1, 2

## Overview

Audit WCAG 2.1 AA trên M3 token layer + áp motion tokens vào primitives + reduced-motion support. M3 mặc định đã a11y-ready nhưng brand palette tùy chỉnh cần verify contrast từng cặp màu.

## Related Files

- Modify: `src/styles/brand-tokens.css` (contrast fixes nếu fail)
- Modify: `src/components/md3/*` (motion tokens áp vào transitions)
- Create: `src/components/md3/__tests__/a11y-audit.test.tsx` (contrast matrix test)
- Create: `scripts/contrast-check.mjs` (Node script — tính contrast ratio, không cần browser)

## Implementation Steps

### 4.1 Contrast Audit (WCAG AA matrix)

Các cặp bắt buộc ≥4.5:1 (normal text) / ≥3:1 (large text, icons):

| Foreground | Background | Dự kiến | Cần verify |
|-----------|-----------|---------|------------|
| on-surface (F5F5F5) | surface (#0A1A2E) | ~15:1 ✓ | auto-test |
| on-surface-variant (C5C8CC) | surface-container (#1A2A4E) | ~8:1 ✓ | auto-test |
| on-primary (F5F5F5) | primary (#4A7C59) | ~4.6:1 | auto-test |
| primary (4A7C59) | surface (#0A1A2E) | ~2.5:1 | icons/large only |
| on-secondary (0A1A2E) | secondary (C9D6DF) | ~10:1 ✓ | auto-test |
| on-tertiary (0A1A2E) | tertiary (A8C5A0) | ~9:1 ✓ | auto-test |
| on-error-container (FCA5A5) | error-container | ~4.5:1 | auto-test |
| text-muted (8A8E96) | surface (#0A1A2E) | ~4.2:1 ⚠️ | có thể cần bump |

Tạo `scripts/contrast-check.mjs`:
- Parse tokens từ brand-tokens.css (regex hex + var alias resolve)
- Tính ratio (WCAG formula)
- Output: PASS/FAIL table, exit 1 nếu FAIL
- Add npm script: `"check:contrast": "node scripts/contrast-check.mjs"`

### 4.2 Fix contrast fails

- Nếu `text-muted` fail → bump lên #9CA1A9 hoặc tương đương đạt ≥4.5:1
- Không đổi brand hue — chỉ adjust lightness
- Ghi chú vào m3-token-mapping.md nếu có thay đổi

### 4.3 Motion tokens áp vào primitives

Update 12 primitives từ Phase 2:
- Transition duration: dùng `--md-sys-motion-duration-*` (short3 hover, medium2 open/close)
- Easing: `standard` cho hầu hết, `emphasized` cho FAB/dialog/sheet
- CSS: `transition: transform var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard)`

### 4.4 Reduced-motion support

Global CSS:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
+ primitives kiểm tra matchMedia nếu cần logic skip animation.

### 4.5 A11y test vào CI

- Unit test: contrast matrix (gọi contrast-check logic), a11y render tests (axe-core nếu có, else role/label assertions)
- Đảm bảo không regress: chạy full suite 3115 tests

## Success Criteria

- [x] Contrast check script pass 100% (tất cả cặp ≥4.5:1 hoặc ≥3:1 large)
- [x] 12 primitives dùng motion tokens (grep verify — không raw duration)
- [x] Reduced-motion CSS hoạt động (test media query trong vitest)
- [x] Build + tests green
- [x] `npm run check:contrast` exit 0

## Risk Assessment

- **Low:** Motion refactor không đổi hành vi — chỉ transition values
- **Medium:** text-muted bump có thể ảnh hưởng vài components mong đợi màu cũ — grep verify các chỗ dùng text-muted trước/sau
- **Mitigation:** Contrast script exit 1 chặn CI nếu fail — không thể merge lén
