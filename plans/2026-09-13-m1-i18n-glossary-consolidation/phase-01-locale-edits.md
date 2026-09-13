# Phase 1 — Locale edits + glossary ratify + regression test

Priority: P1 · Status: pending · 2026-09-13

## Context

- `src/locales/vi.json` (2182 lines, 1833 flat keys) / `en.json` (2191 lines)
- `.ai/context/glossary.vi-en.yaml` — 167 lines, status draft
- i18n bootstrap: `src/lib/i18n.ts` (`fallbackLng: 'vi'`)
- Usage of missing key: `src/components/stitch/StitchAccountDashNew-empty.tsx:30`
  (fallback 'Something went wrong...'), `src/components/stitch/StitchAccountNew-error.tsx:35`
- Test mock overrides key in `src/components/stitch/__tests__/StitchAccountNew.test.tsx:29`
- Plan: `../plan.md`

## Implementation steps

1. **vi.json** — 2 edits:
   - `"nav.referral": "Giới thiệu bạn"` → `"Giới thiệu bạn bè"`
   - `"footer.referral": "Giới thiệu bạn"` → `"Giới thiệu bạn bè"`
   (order: `nav` block ~line 60-80; `footer` block; verify via grep first)
2. **vi.json** — 1 add: `stitch.accountDashboard.errorDescription` with vi
   translation of en value "Could not load your account data. Please check
   your connection and try again." → "Không tải được dữ liệu tài khoản.
   Vui lòng kiểm tra kết nối và thử lại." (place beside sibling
   `failedToLoad` key alphabetically inside `accountDashboard` object)
3. **glossary.vi-en.yaml** — status → `ratified (2026-09-13, owner G10)`;
   add note under `referral` entry: "nav.referral + footer.referral aligned
   to 'Giới thiệu bạn bè' in M1 Batch 2"
4. **New test** `src/__tests__/locales-glossary.test.ts` (matches repo
   convention — flat tests in `src/__tests__/`, vitest include
   `src/**/*.test.{ts,tsx}`):
   - vi `nav.referral` === 'Giới thiệu bạn bè'
   - vi `footer.referral` === 'Giới thiệu bạn bè'
   - vi has `stitch.accountDashboard.errorDescription` with non-empty value
   - JSON parse: both locale files valid JSON
   - No test/snapshot pins 'Giới thiệu bạn' (verified — grep clean)
5. **Verify** (NOTE: `vitest.config.ts` include covers BOTH `src/**` AND
   `worker/src/**/*.test.ts` — one run = full suite):
   - `npm test --silent` full suite green (FE + worker in same run)
   - `npx tsc --noEmit` clean

## Todo

- [x] vi.json nav.referral + footer.referral → "Giới thiệu bạn bè"
- [x] vi.json add stitch.accountDashboard.errorDescription (vi translation)
- [x] glossary.vi-en.yaml status ratified + referral convergence note
- [x] locale regression test created + passing
- [x] tsc clean
- [x] Full suite green (npm test = FE + worker via shared vitest config)

## Out-of-scope fixes included (pre-existing bugs, proven by stash-isolation)

- `worker/src/tree/loyalty/phone-auth-handler.ts` — safeWaitUntil helper: Hono's
  executionCtx getter throws under router.request() in tests → Batch 1 wiring
  returned 500 in tests/loyalty.test.ts "creates new customer". Both background
  call sites wrapped; prod behavior unchanged.
- `src/components/promotions/__tests__/promotion-card.test.tsx` — time-bomb:
  fixture expiresAt 2026-12-31 → "Con 110 ngay" collided with /10/ regex →
  "multiple elements". Fixed to exact match `/^10\/100 luot dung$/`. Test-only.

## Success criteria

- Rendered diff: exactly 2 FE labels change; vi Account-Dashboard error
  state shows translated copy instead of en fallback
- 3249+ tests green; no key renamed/deleted; JSON valid (parse check)
- Old bundle deployable

## Risks

- Test snapshot referencing 'Giới thiệu bạn' for referral labels → grep
  test files for the string before edit; update if snapshot-tested
- Glossary yaml edit must stay valid YAML (indentation 2-space)

## Rollback

- 3 file edits + 1 new test file; `git checkout -- <files>` reverts fully.
