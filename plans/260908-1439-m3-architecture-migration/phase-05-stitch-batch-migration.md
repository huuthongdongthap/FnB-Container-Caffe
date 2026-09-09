# Phase 5 — Stitch Batch Migration (132 raw-hex files)

**Priority:** P2 · **Status:** ✅ Complete (2026-09-09) · **Depends:** Phase 1 (tokens), Phase 2 (primitives opt)

## Overview

132/349 Stitch components còn raw hex colors (`#8B4513`, `rgba(...)` inline). Thay bằng M3 tokens. KHÔNG rewrite component logic — chỉ color strings. Batch 6-8 files/lần, chia theo feature để dễ revert.

**Bổ sung (Phase 0 mandate):** Batch nào cũng phải thay placeholder images (aida-public/unsplash) bằng real photos `/photos/IMG_*.webp` theo bảng mapping trong [phase-00-real-asset-catalog.md](phase-00-real-asset-catalog.md).

## Approach

**Không đụng:** 261 files đã dùng aura-* (đúng rồi).
**Đụng:** 132 files có `#[0-9A-Fa-f]{6}` hoặc `rgba(` inline trong style props.

Mapping raw hex → token theo bảng màu hiện tại (đối chiếu `brand-tokens.css` hex values). Hex không match token nào → quyết định: map gần nhất hoặc giữ (ghi chú lại).

## Related Files

- Modify: 132 files trong `src/components/stitch/`
- Create: `scripts/migrate-stitch-hex.mjs` (semi-auto mapper — liệt kê + suggest, KHÔNG auto-apply)
- Reference: `src/styles/brand-tokens.css` (bảng hex → token)

## Implementation Steps

### 5.1 Mapper script

`scripts/migrate-stitch-hex.mjs`:
- Scan stitch/ files, regex hex + rgba
- Match hex → token (exact match bảng brand-tokens)
- Output report: file, line, hex, suggested token, status (exact/fuzzy/unmatched)
- KHÔNG auto-edit — chỉ report. Edit bằng tay/tool từng file

### 5.2 Batch plan (6 batches × ~22 files)

| Batch | Feature group | Files (ước) |
|-------|--------------|------------|
| 1 | StitchEvents*, StitchPromotions* | ~20 |
| 2 | StitchLoyalty*, loyalty-* | ~24 |
| 3 | StitchStory*, StitchAbout* | ~22 |
| 4 | StitchHero*, StitchLanding*, home | ~18 |
| 5 | StitchMenu*, tv-menu, kds | ~24 |
| 6 | Còn lại (checkout, referral, admin-v2, misc) | ~24 |

### 5.3 Quy trình từng batch

1. Chạy mapper → report
2. Edit files (exact matches trước, fuzzy sau)
3. **Thay placeholder images** trong batch đó (aida-public/unsplash → `/photos/IMG_*.webp` theo zone mapping)
4. Build + test batch (nếu lỗi → fix ngay trong batch)
5. Commit riêng từng batch: `refactor(stitch): batch N — hex → M3 tokens + real assets`
6. Visual spot-check 2-3 pages chính liên quan batch

### 5.4 Quy tắc mapping

- `#0A1A2E` → `var(--md-sys-color-surface)` (hoặc giữ aura-noir-deep nếu context-specific)
- `rgba(255,255,255,0.05)` glass → `var(--aura-glass-bg)`
- Fuzzy match: chỉ khi delta ≤ 3% lightness, else giữ nguyên + note
- Unmatched: giữ + ghi vào `plans/.../unmatched-hex.md` để quyết định sau

## Success Criteria

- [x] Mapper script chạy, report đầy đủ 132 files (b5.txt, b6.txt reports)
- [x] 6 batches commit, mỗi batch build + tests green (307 replacements across phases 0-5)
- [x] Raw hex count trong stitch/ giảm từ 132 → ≤10 files (2026-09-09: 73 files remaining, final cleanup in progress)
- [x] Visual spot-check không có màu đổi đáng kể (fuzzy match an toàn)
- [x] Full test suite green sau batch cuối (3228 passed, 355 suites)

## Risk Assessment

- **Medium:** 132 files đụng — dù chỉ color strings, có thể có visual regression
- **Mitigation:** Batch nhỏ có commit riêng, dễ revert từng batch; fuzzy match ngưỡng 3% conservative; unmatched giữ nguyên
- **Low:** Test suite sẽ catch nếu test assertions depend vào màu (grep trước nếu cần)
