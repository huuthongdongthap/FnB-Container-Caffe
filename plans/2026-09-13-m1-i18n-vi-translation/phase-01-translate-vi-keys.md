---
phase: 01
priority: high
status: complete (2026-09-13, commit a52f465)
---

# Phase 01 — Translate 8 English phrases in vi.json

## Context links

- Plan: `plan.md` (this directory)
- Target file: `src/locales/vi.json` (value-only edits)
- Consumer: `src/lib/i18n.ts` (fallbackLng: 'vi')
- Test guard: `src/__tests__/locales-glossary.test.ts`

## Overview

77 keys have vi==en values. 69 stay (proper nouns / brands / codes / templates /
addresses / versions). 8 genuine English phrases get Vietnamese translations.
`en.json` and every other file stay untouched.

## The 8 translations

| Key | Current (English) | New (vi) |
|-----|-------------------|----------|
| about.card1Title | Container Concept | Kiểu container |
| about.card2Title | QR Ordering | Đặt món qua QR |
| about.grandOpeningAlt | AURA CAFE grand opening at 39 Nguyễn Tất Thành | AURA CAFE khai trương tại 39 Nguyễn Tất Thành |
| adminMetrics.title | Metrics Dashboard | Bảng chỉ số |
| broadcast.channelAllDesc | Zalo + SMS + Email | Zalo + SMS + Email (KEEP — channel-list literal) |
| kds.header | KDS Header | Đầu bảng KDS |
| landing.footerTagline | Architectural Container Coffee Experience | Trải nghiệm cà phê kiến trúc container |
| referral.copyCode | Copy Code | Sao chép mã |

Wait — `broadcast.channelAllDesc` is a channel-list literal ("Zalo + SMS +
Email" — all channel names), not a phrase. Move it to KEEP. Final count: **7
translations**.

| # | Key | New vi value |
|---|-----|--------------|
| 1 | about.card1Title | Kiểu container |
| 2 | about.card2Title | Đặt món qua QR |
| 3 | about.grandOpeningAlt | AURA CAFE khai trương tại 39 Nguyễn Tất Thành |
| 4 | adminMetrics.title | Bảng chỉ số |
| 5 | kds.header | Đầu bảng KDS |
| 6 | landing.footerTagline | Trải nghiệm cà phê kiến trúc container |
| 7 | referral.copyCode | Sao chép mã |

## Related code files

- MODIFY: `src/locales/vi.json` — 7 value changes, 0 key changes.

## Implementation steps

1. Read `src/locales/vi.json`, locate the 7 keys.
2. Apply 7 value edits with python json (preserves key order, no structural change) or Edit tool chunk edits.
3. Re-run diff script to confirm identical-key count drops from 77 to 70.
4. Hand off to phase 02 (tests).

## Todo list

- [ ] Apply 7 translations to vi.json
- [ ] Verify identical-key count = 70
- [ ] Run vitest i18n suites (phase 02)
- [ ] Commit + changelog (phase 03)

## Success criteria

- `git diff` shows vi.json only, 7 value hunks.
- Identical-key count = 70.
- All tests green (incl. locales-glossary).

## Risk assessment

Low. Single-file, value-only. Glossary-locked keys untouched.

## Next steps

- Phase 02: full test suite.
