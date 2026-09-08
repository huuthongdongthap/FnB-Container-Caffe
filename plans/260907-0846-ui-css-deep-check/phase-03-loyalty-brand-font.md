# Phase 3 — /loyalty Brand Font Consistency

**Priority:** P2 (minor visual) · **Status:** Pending

## Context
- Deep check (audit v2 font sweep) phát hiện `/loyalty` empty state headings dùng hardcoded `"Libre Caslon Text", serif` — font không có trong brand system
- Brand tokens (`src/styles/brand-tokens.css`): `--aura-font-display: 'Quicksand'`, `--aura-font-body: 'Be Vietnam Pro'`
- Cùng lúc đó, `EventsNew2Error`/`EventsNew2Empty` dùng `var(--aura-font-display)` — đúng pattern

## Offenders

| File | Line | Code |
|------|------|------|
| `src/components/stitch/loyalty-error-state.tsx` | 20 | `style={{ fontFamily: "'Libre Caslon Text', serif", ... }}` |
| `src/components/stitch/loyalty-weekly-streak.tsx` | 30 | `style={{ fontFamily: "'Libre Caslon Text', serif", ... }}` |

(Có thể còn file khác trong loyalty-* family — grep `Libre Caslon` toàn `src/` lúc implement: audit trước compaction tìm thấy trong `StitchEventsNew2-form.tsx`, `stitch-about-timeline-section.tsx`, `StitchHeroNew-types.ts` — kiểm tra từng cái, chỉ sửa các component đang render thực tế trên route chính)

## Fix

Thay `'Libre Caslon Text', serif` bằng `var(--aura-font-display)` (heading) hoặc `var(--aura-font-body)` (body text):

```tsx
// Before
style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)' }}
// After
style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-chrome-bright)' }}
```

## Todo

- [ ] Grep `Libre Caslon` toàn `src/` — liệt kê tất cả occurrences
- [ ] Sửa `loyalty-error-state.tsx:20` → `var(--aura-font-display)`
- [ ] Sửa `loyalty-weekly-streak.tsx:30` → `var(--aura-font-display)`
- [ ] Xử lý các occurrences khác nếu component đó render trên public routes (`StitchEventsNew2-form.tsx` — check có render không; `stitch-about-timeline-section.tsx` — check)
- [ ] Verify `/loyalty` empty state hiển thị Quicksand

## Success Criteria

- Không còn `Libre Caslon` trong các component render public routes
- `/loyalty` heading font khớp brand (Kiểm tra computed style = Quicksand)
- Type-check pass

## Risks

- Thấp — thuần visual, không đụng logic
- Nếu một component bị test snapshot chữ "Libre Caslon" → update snapshot
