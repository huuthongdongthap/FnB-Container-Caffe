---
date: 2026-09-13
status: complete (2026-09-13, commit a52f465)
scope: M1 Batch 5 — translate untranslated English in vi.json
source: TARGET_STATE.md §9 "split vi keys"; user decision "Translate-only"
---

# M1 Batch 5 — vi.json English-phrase translation

## Goal

`src/locales/vi.json` and `en.json` share 77 keys with identical values ("split
vi keys" per TARGET_STATE §9). Most are proper nouns / brands / acronyms /
addresses / phone placeholders / slugs / version strings / i18n templates —
those STAY English. Only genuine English UI **phrases** get Vietnamese
translations. This closes the i18n item in M1's spec without touching D1, code,
or any other file.

## Codebase context

- `src/lib/i18n.ts` consumes vi.json + en.json; vi is fallbackLng.
- `src/__tests__/locales-glossary.test.ts` locks 4 values (referral term +
  stitch errorDescription). This batch touches none of them.
- `src/pages/admin/CampaignsManager-constants.ts` consumes
  `TRIGGER_EN_LABEL_KEYS` (trigger*En) for English display — those 5 KEYS MUST
  STAY (translating breaks an active display map).
- No other locale-key consumers are affected by value-only edits.

## Categorization (77 total)

- **69 KEEP** — brand names, product names, event titles, social platforms,
  addresses, phone/email placeholders, slugs, version strings, payment codes
  (COD/MoMo/PayOS/QRPay), acronyms (POS/SMS/KDS/ERR/OK), tier names
  (GROW/LAUNCH/SCALE), common loanwords (Email/Hotline), i18n templates
  (`{{badge}}`, `x{{count}}`), and 1 value already-Vietnamese on both sides
  (`footer.descriptionVi`).
- **8 TRANSLATE** — genuine English UI phrases (see phase-01).

Rule applied (verbatim user constraint): "proper nouns (Zalo, Facebook, address)
giữ nguyên, câu tiếng Anh thật dịch sang tiếng Việt."

## Work breakdown

| Phase | Task | File | Status |
|-------|------|------|--------|
| 01 | Translate 8 phrases in vi.json | src/locales/vi.json | proposed |
| 02 | Run i18n test suite (vitest) | — | proposed |
| 03 | Commit + changelog | CHANGELOG.md | proposed |

## Verification

- `npm test` (vitest) — full suite green, locales-glossary test passes.
- `git diff --stat` shows exactly 1 file (vi.json), 8 value hunks, 0 key changes.

## Out of scope (explicit)

- No D1 DDL, no new files, no other locale files, no code changes.
- `en.json` untouched.
- Non-translatable follow-ups (en-side referral assertions, safeWaitUntil
  promotion, promotion-card fixture) remain separate.

## Risk

Low. Value-only edits to a single JSON file, no key structure changes, glossary
test's locked keys untouched. Worst case: revert vi.json, re-run tests.
