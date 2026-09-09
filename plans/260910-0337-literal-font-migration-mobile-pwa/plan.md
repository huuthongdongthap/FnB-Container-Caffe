# Literal Font Stack Migration — Mobile/PWA + Internal Pages

**Ngày:** 2026-09-10 · **Nguồn:** `/cook next /plan` (follow-up từ journal 260910-0230-font-token-migration)
**Mode:** fast (scout đã xong, scope chốt) · **Brand:** AURA CAFE
**Status:** ✅ Done 2026-09-10 — 12 files, 29/29 balanced swaps. Tester PASS 4/4 (tsc 0, build 3.27s, vitest 355/355 suites 3228/3228, eslint exit 0). Reviewer PASS (0 critical/high/medium; 3 Low informational). Committed standalone, excluded 11 out-of-scope dirty files.

## Mục tiêu

Xoá toàn bộ literal font stack ("Space Grotesk", "EB Garamond", `system-ui`, token stale `--font-display`) khỏi src ngoài stitch/md3, thay bằng aura font tokens. **Chỉ font — không đụng raw hex màu.**

## Scope đã scout (20 match / 9 files)

| Nhóm | File | Chỗ | Fix |
|------|------|-----|-----|
| P0 Space Grotesk (font không load) | `src/pages/mobile/waiter-orders-constants.ts` | 7 | `'Space Grotesk', sans-serif` → `var(--aura-font-body)` |
| P0 | `src/components/pwa/push-notification-toggle-styles.ts` | 6 | idem |
| P0 | `src/pages/mobile/kitchen-display-styles.ts` | 3 | idem |
| P0 | `src/pages/mobile/mobile-layout-styles.ts` | 3 | idem |
| P0 | `src/pages/saas/onboard/tenant-create.tsx` | 1 | `system-ui, sans-serif` → `var(--aura-font-body)` |
| P0 | `src/pages/register/index.tsx` | 1 | idem |
| P0 | `src/pages/verify-email/index.tsx` | 1 | idem |
| P1 EB Garamond (font không load) | `src/components/menu/recommendation-section.tsx:69` | 1 | `"EB Garamond", Georgia, serif` → `var(--aura-font-display-serif)` |
| P1 | `src/pages/ReviewsPage-write-review-form.tsx:53` | 1 | collapse var() fallback: `var(--aura-font-display-serif, "EB Garamond", Georgia, serif)` → `var(--aura-font-display-serif)` |
| P0 token stale | `src/components/home/hero-section.tsx:123` | 1 | `var(--font-display)` → `var(--aura-font-display)` |

**Giữ nguyên (out-of-scope):**
- `TypographyShowcase.tsx` — font showcase, aura fallback đã đúng
- `RevenueChart.tsx`, `PeriodComparisonChart-svg.tsx`, các file mobile đã dùng aura token
- Raw hex màu (#F97316, #3b82f6...) — user quyết định scope "chỉ font"
- `BrandGuideline.tsx` — brand copy, intentional

## Acceptance Criteria

1. `grep -rE "'(Space Grotesk|EB Garamond)|system-ui, sans-serif" src/` (ngoài stitch/md3/__tests__) → 0 match
2. `grep -rn "var(--font-display)" src/` → 0 match (token stale bị xoá)
3. `tsc --noEmit` PASS
4. `vite build` PASS
5. `vitest run` full suite PASS (355 suites baseline)
6. ESLint không có error mới trên các file chạm
7. Không thay đổi raw hex màu — diff chỉ chứa fontFamily/font-family

## Non-goals

- Raw hex migration màu (defer, scope riêng)
- Stitch/md3 components (đã migrate xong)
- Webfont loading (index.html đã đúng: Quicksand + Be Vietnam Pro)

## Plan phases

### Phase 1 — Token swap (single pass, 10 files)

Sắp edit tuần tự (mỗi file 1 Edit chunk, KHÔNG full rewrite):

1. `waiter-orders-constants.ts` — replace_all `'Space Grotesk', sans-serif` → `var(--aura-font-body)` (7 chỗ, chuỗi literal giống nhau)
2. `push-notification-toggle-styles.ts` — replace_all `"Space Grotesk", system-ui, sans-serif` → `var(--aura-font-body)` (6 chỗ)
3. `kitchen-display-styles.ts` — replace_all (3 chỗ)
4. `mobile-layout-styles.ts` — replace_all (3 chỗ)
5. `tenant-create.tsx`, `register/index.tsx`, `verify-email/index.tsx` — `system-ui, sans-serif` → `var(--aura-font-body)` (1 chỗ/file)
6. `recommendation-section.tsx:69` — `"EB Garamond", Georgia, serif` → `var(--aura-font-display-serif)`
7. `ReviewsPage-write-review-form.tsx:53` — collapse fallback
8. `hero-section.tsx:123` — `var(--font-display)` → `var(--aura-font-display)`

### Phase 2 — Verification (gate chuẩn)

- `npx tsc --noEmit`
- `npx vite build` (silent, grep error)
- `npx vitest run` (silent, tail summary)
- `npx eslint <10 files>`

### Phase 3 — Finalize

- Commit `refactor(fonts): migrate literal font stacks to aura tokens in mobile/pwa/internal pages`
- Journal entry
- Sync plan status

## Key Decisions

1. **`var(--aura-font-body)` cho Space Grotesk/system-ui thay vì `--aura-font-display`** — các file này toàn body/labels (forms, buttons, lists), không phải display headings. Be Vietnam Pro body đúng semantic.
2. **Bare var() không fallback hex** — token được đảm bảo trên `:root` (brand-tokens.css:104-105)
3. **Không đụng màu** — user chốt scope "chỉ font"
4. **CSSProperties files giữ nguyên cấu trúc** — chỉ đổi giá trị fontFamily string

## Risk

- **Thấp** — thuần string swap, không đổi logic. Mobile staff tools đổi font hiển thị từ Space Grotesk (fallback system) sang Be Vietnam Pro — cần mắt xác nhận quick visual trên 1-2 screen.
- Miệm nguy: 2 file (`kitchen-display-styles.ts`, `waiter-orders-constants.ts`) dùng chung font cho btn/input — swap đồng nhất nên không lệch.
