# Phase 6 — Full Verification

**Priority:** P0 · **Status:** Pending · **Depends:** Phase 1-5

## Overview

Verify toàn bộ M3 migration: build + full test suite + contrast check + visual audit 16 pages + token usage stats. Gate cuối trước khi coi plan hoàn tất.

## Implementation Steps

### 6.1 Static checks

1. `npm run build` — vite build green
2. `npm test` — full suite (3115+ tests, gồm md3/__tests__ mới)
3. `npm run check:contrast` — exit 0
4. `npm run lint` — không lỗi mới (nếu lint config có)

### 6.2 Token usage stats

```bash
# M3 token adoption
grep -rl "md-sys-" src/ --include="*.tsx" | wc -l
# Raw hex còn lại trong stitch
grep -rlE '#[0-9A-Fa-f]{6}' src/components/stitch/*.tsx | wc -l  # target ≤10
```

### 6.3 Visual audit (Playwright headless, pattern từ ui-css-deep-check)

16 pages chụp screenshot + check:
- Không layout break (overflow, misplaced)
- M3 primitives render đúng (nếu pages đã áp Phase 3)
- Colors consistent (không trang nào lệch tông)

Pages: /, /menu, /order, /checkout, /loyalty, /events, /promotions, /about, /account, /referral, /container, /gallery, /reservation, /reviews, /contact, 404

### 6.4 Regression sweep

- Cart flow: add → checkout → success
- Events: load pretix data, empty state, error retry
- Loyalty: dashboard render, tier card
- Order: table order không crash (Phase 1 regression check)

### 6.5 Cleanup + finalize

- Xóa temp scripts nếu tạo (migration scripts giữ long-term: contrast-check, migrate-stitch-hex)
- Update `docs/m3-token-mapping.md` + `docs/m3-component-usage.md` final state
- Plan sync: tất cả phase files → Completed

## Success Criteria

- [ ] Build green
- [ ] Full test suite green (0 fail)
- [ ] Contrast check exit 0
- [ ] Visual audit 16 pages — không layout break
- [ ] Raw hex trong stitch ≤10 files (unmatched có note)
- [ ] Regression sweep 4 flows pass
- [ ] Docs updated

## Risk Assessment

- **Low:** Các phase trước đã gate từng bước — Phase 6 chỉ tổng hợp
- **Medium:** Visual audit có thể phát hiện regression mà tests không catch (visual-only)
- **Mitigation:** Screenshot compare với baseline trước migration (nếu có baseline từ ui-css-deep-check)
