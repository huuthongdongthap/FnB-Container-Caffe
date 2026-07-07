# QR Phases 4–5: i18n Migration — Table Management

**Status:** Complete
**Date:** 2026-07-07
**Author:** project-manager (closing agent)

## Phases

| ID | Phase | Status |
|---|---|---|
| P4 | Generator Print-Groups + Bulk ZIP + i18n | completed |
| P5 | Staff Table Management i18n | completed |

## Files Modified (4)

- `src/pages/admin/GenerateQR.tsx` — Phases 4 & 5 i18n completion
- `src/pages/admin/TableManagement.tsx` — Phase 5 full i18n coverage
- `src/locales/en.json` — added/updated translation keys
- `src/locales/vi.json` — added/updated translation keys

## Verification

- `tsc --noEmit`: 0 errors
- `vitest`: 1516/1522 pass (6 pre-existing worker failures, untouched)
- Zero `:any` types in modified files
- All UI strings route through `useTranslations('qrCodes')` and `useTranslations('admin.tableManagement')`

## Acceptance Checklist

- [x] P4: `window.print()` A4 with zone section breaks per-group
- [x] P4: Bulk ZIP button triggers blob download with `AURA-CAFE-qr-<date>.zip`
- [x] P4: All strings through `useTranslations` (no hardcoded text)
- [x] P5: Every visible string routes through `t('admin.tableManagement.*')`
- [x] P5: Locale switch re-renders page without reload

## Dependencies on Other Phases

- Requires Phase 1–3 (QR generation, print groups, bulk ZIP endpoint) to be shipped. No forward dependencies.

## Blockers

None.

## Next Steps

1. Ready for commit to `main`
2. Changelog entry recommended under docs/ — deferred to ops decision
3. Flows: no protected flows affected (Setup Wizard, Telegram Bot, Payment Flow all untouched)
