# Code Review — M1 Batch 2: i18n D9 Glossary Consolidation

**Date:** 2026-09-13
**Scope:** Uncommitted working-tree changes (git diff + untracked test file)
**Files reviewed:**
- `src/locales/vi.json` (+3/-2)
- `worker/src/tree/loyalty/phone-auth-handler.ts` (+12/-2)
- `src/components/promotions/__tests__/promotion-card.test.tsx` (+3/-2, test-only)
- `src/__tests__/locales-glossary.test.ts` (NEW, untracked)
- `.ai/context/glossary.vi-en.yaml` (untracked dir)

## VERDICT: PASS

All 5 acceptance criteria met. No critical or high findings. 2 low observations.

---

## Acceptance Criteria Verification

### (a) Exactly 2 FE label changes + 1 added key — MET
Verified via flat-key diff against `HEAD:src/locales/vi.json`:
- `changed: ['nav.referral', 'footer.referral']` — both "Giới thiệu bạn" → "Giới thiệu bạn bè"
- `added: ['stitch.accountDashboard.errorDescription']` — exactly 1 key
- `removed: []` — nothing removed
- vi.json parses as valid JSON (python json.load OK)
- No stale old-term keys remain (grep for "Giới thiệu bạn" without "bè" → 0 matches)
- `failedToLoad` key preserved (not replaced by errorDescription — both coexist)

### (b) errorDescription added, non-empty, differs from en — MET
- vi: "Không tải được dữ liệu tài khoản. Vui lòng kiểm tra kết nối và thử lại."
- en: "Could not load your account data. Please check your connection and try again."
- Both non-empty, values differ. Glossary test (lines 33-41) asserts truthy + `not.toBe(en)`.
- Component consumer confirmed: `StitchAccountNew-error.tsx` uses the key (grep verified).

### (c) safeWaitUntil never breaks signup — MET
Verified at `worker/src/tree/loyalty/phone-auth-handler.ts:17-25`:
- Hono's `executionCtx` getter throws `Error("This context has no ExecutionContext")` when absent (confirmed at `node_modules/hono/dist/context.js:90-104`). The old `c.executionCtx?.waitUntil?.(p)` pattern does NOT guard this because the optional chaining happens AFTER the getter throws — the getter itself is the throw site. This is the actual latent bug; fix is correct.
- **Both call sites wrapped** (line 97: referral apply; line 106: customer capture). No other raw waitUntil calls remain in this file.
- **Prod behavior unchanged:** when ExecutionContext exists, `c.executionCtx?.waitUntil?.(p)` executes identically to before. Only the no-context path changes (crash → catch → log + drain promise via `p.catch(...)` preventing unhandled rejection).
- **Bonus correctness:** the catch branch attaches `.catch` to the orphaned promise, preventing a secondary unhandled-rejection crash in tests. Good defensive detail.

### (d) No public contract change — MET
- No API response shape, DB schema, exported signature, or env var modified. Diff is purely: locale values, one new private helper + 2 internal call-site swaps, one test regex. Batch is additive-only as constrained.

### (e) No regression to business logic — MET
- `promotion-card.tsx` component NOT modified (git diff shows only `__tests__/promotion-card.test.tsx`). The exact-match regex `/^10\/100 luot dung$/` matches the rendered `{usageCount}/{usageLimit} luot dung` (line 132) precisely; root cause (fixture expiresAt 2026-12-31 → 110 days → "Con 110 ngay" matching `/10/`) is real and the fix disambiguates.
- phone-auth signup flow, referral flow, customer capture logic untouched — only the waitUntil invocation wrapped.
- Tests/loyalty.test.ts "creates new customer" (line 204) uses `router.request(...)` which lacks ExecutionContext — this is the path that previously 500'd; now safely caught.

---

## Findings (ranked by severity)

### LOW-1: `.ai/context/glossary.vi-en.yaml` is working-tree-only
The glossary "source of truth" file lives in an untracked directory (`.ai/` never committed, not in .gitignore either). The status header update ("ratified 2026-09-13, owner G10") and referral note exist only on this machine. If the glossary is meant to be durable repo context for future batches, it should be committed (or intentionally tracked via plan docs). If intentionally local-only, document that decision. Not blocking — no code depends on the yaml at build/test time.

### LOW-2: Glossary test doesn't cover en referral labels / en→vi key parity generally
`src/__tests__/locales-glossary.test.ts` locks vi values well (referral nav/footer/referEarn + errorDescription) but doesn't assert en.nav.referral/en.footer.referral still exist (en-locale glossary drift would pass silently). Acceptable for Batch 2 scope (vi-first consolidation); suggest adding en assertions in a follow-up batch if glossary covers en secondary terms.

### INFO: Other files still use raw `c.executionCtx?.waitUntil?.()` pattern
Grep found 25+ files with the same unguarded pattern (orders-hono.ts, webhooks.ts, payments.ts, refunds.ts, analytics-hono.ts, etc.). Those routes may have the same latent crash when hit via `router.request()` in tests — but none are in this batch's blast radius, and analytics-hono.ts:270 already has its own try/catch variant. Worth a follow-up cleanup ticket to standardize on safeWaitUntil (or a shared util), NOT this batch.

### INFO: Tests use fixture with future expiry (2026-12-31)
promotion-card test will flip to "expired" state around 2027-01-01, at which point the usage-count row disappears (component renders usage only when `usageLimit > 0`; expired styling changes layout). The current exact-match assertion would still pass today but the fixture is time-sensitive. Consider a relative future date (e.g. `new Date(Date.now() + 110*86400000).toISOString()`) in a follow-up. Not blocking; pre-existing pattern.

---

## Checks Checklist (cook skill)
- [x] (a) every acceptance criterion met — verified above with code/JSON evidence
- [x] (b) no regression to business logic — component untouched; handler logic identical, only invocation wrapped
- [x] (c) no breaking changes to public contracts — additive-only confirmed
- [x] (d) follows existing patterns — safeWaitUntil mirrors the try/catch pattern already in analytics-hono.ts:270 and orders-hono.ts:131; glossary test follows existing locale-test conventions (compares vi/en like i18n-bilingual.test.ts)
- [x] (e) no new lint/type/build errors — full suite 359 files/3269 tests green, tsc --noEmit exit 0 (per caller, not re-run)

## Positive Observations
- safeWaitUntil catch branch drains the orphaned promise (`p.catch(...)`) — prevents the fixed crash from resurfacing as an unhandled-rejection warning in test runners
- Comment on safeWaitUntil (lines 17-18) explains the WHY (Hono getter throws) not the plan origin — complies with comment rules
- Glossary test is a genuine regression lock (CI-fail on drift) rather than snapshot noise
- Test regex fix root-caused (date collision), not band-aided (e.g. removing the assertion)

## Recommended Actions (non-blocking)
1. Decide `.ai/` tracking (commit glossary yaml or document local-only) — LOW-1
2. Follow-up batch: extend glossary test to en labels — LOW-2
3. Follow-up ticket: standardize safeWaitUntil as shared util for other 25+ waitUntil call sites — INFO
4. Follow-up: time-relative fixture for promotion-card expiry — INFO

## Unresolved Questions
- Is `.ai/` intended as committed repo context or local-only working notes? (affects LOW-1 action)
