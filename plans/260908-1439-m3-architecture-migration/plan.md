# M3 Architecture Migration — Full Audit & Rebuild

**Ngày:** 2026-09-08 · **Nguồn:** `/plan` "dựng lại toàn bộ kiến trúc theo chuẩn M3, dựa trên commits tháng 6"
**Mode:** standard (balanced research → structured plan)

## Mục tiêu

Migrate toàn bộ design system sang **Material Design 3 (M3)** chuẩn — design tokens, components, patterns, accessibility — **giữ nguyên brand palette** (Navy + Forest + Chrome, Tokens v6.0) và áp dụng cho **toàn bộ 31 feature dirs + 349 Stitch components**.

## Hiện trạng (scout 2026-09-08)

| Khía cạnh | Trạng thái |
|-----------|-----------|
| Design tokens | `brand-tokens.css` v6.0 — 357 custom properties (aura-*), KHÔNG có md-sys-* |
| Tailwind mapping | `global.css` @theme map aura → TW v4 utilities (đúng hướng, thiếu M3 naming) |
| Theme TS layer | `theme/` ThemeTokens interface — song song CSS vars, chưa sync M3 |
| Components | 349 Stitch + 31 feature dirs — 261 files dùng aura-*, 132 files còn raw hex |
| M3 components | **0** — không có md-sys-*, không có MD3Card/MD3Button, chỉ có hint naming (top-app-bar, bottom-nav) |
| UI libs | Tailwind v4, lucide-react, react 19, không radix/shadcn/Material Web |
| Tests | 341 files, 3115 tests — xanh |

## Chiến lược: 3 lớp token bridge (KHÔNG rewrite 349 components)

1. **Lớp M3 semantic tokens** (mới): `md-sys-color-*`, `md-sys-typescale-*`, `md-sys-shape-*`, `md-sys-elevation-*`, `md-sys-motion-*` — định nghĩa trong `brand-tokens.css`, alias sang aura values (giữ brand)
2. **Lớp TW v4 @theme mapping**: map md-sys tokens → Tailwind utilities (bg-surface-container, text-on-surface...)
3. **Lớp component primitives**: ~12 M3 wrapper components (MD3Button, MD3Card, MD3Fab, MD3Chip, MD3NavigationBar, MD3TopAppBar, MD3TextField, MD3Switch, MD3Dialog, MD3List, MD3Snackbar, MD3ProgressIndicator) — Tailwind-based, không thêm dependency

Components cũ KHÔNG phải sửa — aura-* tokens tiếp tục hoạt động (chỉ là alias 2 chiều). Migration từng page tự nguyện khi refactor.

## Phases

| Phase | Nội dung | Status | Priority |
|-------|----------|--------|----------|
| [Phase 1](phase-01-m3-design-tokens.md) | M3 design token layer + TW v4 mapping | Pending | P0 |
| [Phase 2](phase-02-m3-component-primitives.md) | 12 M3 component primitives + docs + tests | Pending | P0 |
| [Phase 3](phase-03-m3-navigation-patterns.md) | Navigation patterns (TopAppBar/NavigationBar) áp vào core layouts | Pending | P1 |
| [Phase 4](phase-04-m3-a11y-motion.md) | Accessibility (WCAG AA) + motion tokens + reduced-motion | Pending | P1 |
| [Phase 5](phase-05-stitch-batch-migration.md) | Stitch batch migration — 132 files raw hex → tokens | Pending | P2 |
| [Phase 6](phase-06-verification.md) | Full verification: build + 3115 tests + visual audit 16 pages | Pending | P0 |

## Dependencies

- Phase 1 → 2 → 3 → 4 tuần tự (mỗi phase build trên layer trước)
- Phase 5 độc lập sau Phase 2 (chỉ cần token layer)
- Phase 6 cuối cùng, verify tất cả

## Key Decisions

1. **Không thêm Material Web Components / @material/web dependency** — Tailwind-based primitives, nhẹ, không xung đột React 19
2. **Giữ 357 aura tokens** — M3 layer là alias, không thay thế. Zero breaking changes
3. **Không rewrite 349 Stitch components** — token bridge + primitives, migration tự nguyện từng page
4. **md-sys naming theo spec M3** (material.io) — chuẩn tra cứu được, future-proof

## Next Steps

User review plan → approve → Phase 1 (tokens) → Phase 2 (primitives) → Phase 3-4 (patterns/a11y) → Phase 5 (batch) → Phase 6 (verify).
