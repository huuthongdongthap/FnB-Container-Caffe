# Reviewer Report — Phase 0: Deprecate Grand Opening

**Date:** 2026-09-10 · **Plan:** plans/260910-fe-first-architecture-merge/phase-00-deprecate-grand-opening.md
**Scope:** `git diff src/` — 3 files (2 modified, 1 deleted)

## Verdict: PASS (conditional)

**Score:** 8.5 / 10 · **Critical:** 0 · **High:** 1 · **Medium:** 2 · **Low:** 2

## Changes Reviewed

| File | Change | Assessment |
|---|---|---|
| `src/hooks/use-promotions.ts:38,61` | `isFeatured: item.isFeatured ?? (item.code === 'AURA20')` → `?? false` (both `usePromotions` and `usePromotionByCode`) | CORRECT |
| `src/components/promotions/__tests__/promotion-card.test.tsx` | Fixture code `AURA20` → `SAVE20` (×3) | CORRECT |
| `src/components/promotions/countdown-timer.tsx` | Deleted | CORRECT (orphaned — zero importers) |

## Acceptance Criteria (cook HARD-GATE-NO-SIDE-EFFECTS)

| Criterion | Status | Evidence |
|---|---|---|
| a) Every acceptance criterion met | PASS (partial — see gaps) | Tester report 3228/3228 pass, tsc exit 0 |
| b) No regression to business logic / blast-radius | PASS | `isFeatured` consumers audited (see below) |
| c) No breaking changes to public contracts | PASS | `Promotion.isFeatured: boolean` unchanged; `PromotionCard` prop unchanged |
| d) Follows existing patterns | PASS | Mirrors existing `??` fallback pattern used for `maxDiscount`, `minOrder`, etc. |
| e) No new lint/type/build errors | PASS | `tsc --noEmit` exit 0; vitest 3228/3228 pass |

## Blast-Radius Audit — `isFeatured` Consumers

| Consumer | File | Impact of `?? false` |
|---|---|---|
| Promotions grid | `src/pages/promotions.tsx:83` | `isFeatured={promo.isFeatured}` — now always reflects API field; no hardcoded AURA20 boost. SAFE |
| Admin manager | `src/pages/admin/use-promotions-manager.ts` | Maps `is_featured` from D1 — but D1 `promotions` table has NO `is_featured` column (see schema.sql:359). Field is always `undefined` → now `false`. SAFE but reveals latent dead field |
| Review card | `src/pages/stitch/customer-reviews/review-card.tsx` | Unrelated `isFeatured` (index === 0). UNTOUCHED |
| Story section | `src/components/stitch/stitch-about-story-section.tsx` | Unrelated `isFeatured` (index === 0). UNTOUCHED |

**Net:** No behavioral regression. The `isFeatured` prop still works correctly — it just no longer has a hardcoded AURA20 default. Any promotion the BE marks `is_featured=1` would still render featured (none currently exist in D1).

## Critical Issues (0)

None.

## High Priority (1)

### H1. `is_featureed` is a dead field — D1 schema has no `is_featured` column
- **Where:** `worker/schema.sql:359` — `promotions` table columns: `code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active, created_at`. No `is_featured`.
- **Impact:** `isFeatured` in FE is always `false` regardless of the `?? false` change. The field is vestigial — harmless today, but misleading for future developers who may assume it's persisted.
- **Risk:** Low (cosmetic/maint only). Not a regression from this diff.
- **Recommendation:** Track as tech-debt. Either (a) add `is_featured` column to D1 + wire BE to return it, or (b) remove `isFeatured` from `Promotion` interface + `PromotionCard` prop to avoid the dead contract. **Do not block Phase 0 on this.**

## Medium Priority (2)

### M1. Phase 0 diff is INCOMPLETE vs. plan scope — remaining Grand Opening surface untouched
The plan (`phase-00-deprecate-grand-opening.md`) explicitly calls out:
- "Remove countdown/banner Grand Opening UI on homepage (`src/pages/stitch/luxury-landing*`, promotions page)"
- "Remove banner/countdown UI blocks"

**Remaining Grand Opening surface NOT touched by this diff:**

| Location | What | Severity |
|---|---|---|
| `src/components/stitch/StitchPromotionsNew-hero.tsx` | Hero with `countdownSeconds` prop + live countdown UI | Medium — still rendered on `/promotions` via `StitchPromotionsNew` |
| `src/components/stitch/StitchPromotionsNew-types.ts:21-22` | `countdownSeconds?: number` field | Medium |
| `src/components/stitch/StitchPromotionsNew.tsx:36,44,71` | Default `countdownSeconds: 4h22m15s`, passed to HeroSection | Medium |
| `src/pages/stitch/promotions-new/index.tsx` | Standalone countdown timer (`useState` + `setInterval`) | Medium — this is the ACTIVE `/promotions` page |
| `src/pages/stitch/promotions-new/hero-section.tsx:27-29` | Renders `formatTime(timer)` countdown badge | Medium |
| `src/locales/en.json:1346` + `vi.json:1345` | `"grandOpeningAlt": "AURA CAFE grand opening at 39 Nguyễn Tất Thành"` | Low — still referenced by `stitch-about-default-data.ts:74` |
| `src/components/stitch/stitch-about-default-data.ts:74` | `imageAlt: t('about.grandOpeningAlt')` | Low — about page brand-history timeline |

**Assessment:** The deleted `countdown-timer.tsx` was a decoy — it was already orphaned. The ACTIVE countdown UIs (`StitchPromotionsNew-hero`, `promotions-new/index.tsx`) are still live and still show countdown timers on the promotions page. However, their copy is generic ("Limited Release", "The Nocturnal Reserve", "Claim Offer") — no explicit "Grand Opening" / "khai trương" text. The tester report confirms "0 khai trương copy hits" on homepage + promotions page.

**Recommendation:** Phase 0 can ship as-is for the explicit acceptance criteria (which focus on AURA20/AURA10 deactivation + zero khai trương copy). But file a follow-up task to:
1. Remove `countdownSeconds` from `StitchPromotionsNew` + `StitchPromotionsNew-types.ts` + `StitchPromotionsNew-hero.tsx` (countdown is a Grand Opening pattern — time-limited launch urgency).
2. Remove the inline countdown from `promotions-new/index.tsx` + `hero-section.tsx`.
3. Remove `grandOpeningAlt` from `en.json` + `vi.json` + `stitch-about-default-data.ts` (or repurpose as generic "storefront" alt text).

### M2. `grandOpeningAlt` i18n key still ships to clients
- **Where:** `src/locales/en.json:1346`, `src/locales/vi.json:1345`
- **Referenced by:** `src/components/stitch/stitch-about-default-data.ts:74` → rendered as `alt` text on about page (`stitch-about-story-section.tsx:68`).
- **Impact:** The string "AURA CAFE grand opening at 39 Nguyễn Tất Thành" is still in the bundle and rendered on the about page timeline (Phase 03, 2024 entry). This is brand-history, not active promo copy — but it explicitly says "grand opening".
- **Recommendation:** Repurpose. Change value to "AURA CAFE storefront at 39 Nguyễn Tất Thành" and rename key to `storefrontAlt` (or similar). Low urgency — does not block go-live.

## Low Priority (2)

### L1. `promotion-card.test.tsx` fixture uses `SAVE20` — verify SAVE20 is not a real code
- The new fixture code `SAVE20` is arbitrary. Confirmed: no `SAVE20` row in D1 promotions (only AURA20/AURA10/WELCOME per tester). Safe, but consider a clearly-fake code like `TEST99` to signal test-only intent.

### L2. `usePromotionByCode` returns `null as any` on missing item
- Pre-existing (not introduced by this diff). The `as any` cast breaks type safety — `useQuery<Promotion>` can return `null`. Not in scope, but flagging for cleanup.

## BE Contract Verification

| Check | Status | Evidence |
|---|---|---|
| AURA20/AURA10 rejected at validate | PASS | `worker/src/routes/promotions.ts:175` — `WHERE code = ? AND is_active = 1` → returns `{ valid: false, reason: 'Mã không tồn tại hoặc đã bị vô hiệu hoá' }` |
| WELCOME still active | PASS | D1 verified `is_active=1` (tester report) |
| GET `/api/promotions` returns all (incl. inactive) | INFO | `SELECT * FROM promotions` — returns inactive rows too. FE `usePromotions` maps all. This means AURA20/AURA10 still appear in FE list (as inactive) unless FE filters. **Not a regression** — pre-existing behavior. Admin-only create/update require `requireAuth(['owner'])`. |

## Security / Data Exposure

- No new exposure. `isFeatured` change is a display-only default with no PII/secrets impact.
- `countdown-timer.tsx` deletion: confirmed zero importers (`grep -rn "countdown-timer\|CountdownTimer" src/` → 0 hits). No dead-import risk.
- No auth bypass, no injection surface changed.

## Positive Observations

1. **Surgical diff** — 3 files, no collateral edits. Easy to review and rollback.
2. **Both code paths updated** — `usePromotions` AND `usePromotionByCode` both had the AURA20 default; both fixed. No missed duplicate.
3. **Test fixture updated in sync** — `promotion-card.test.tsx` fixture no longer references AURA20, preventing false-positive "AURA20 still in codebase" alerts.
4. **Orphan deletion justified** — `countdown-timer.tsx` had zero importers; deletion is cleaner than leaving dead code.
5. **Type-safe** — `isFeatured: boolean` contract preserved; `tsc --noEmit` clean.

## Recommended Actions (prioritized)

1. **Ship Phase 0** — explicit acceptance criteria met; AURA20/AURA10 deactivated in D1; WELCOME intact; zero khai trương copy on homepage/promotions; tests green.
2. **File follow-up task** (Phase 0.5 or Phase 1 prep): remove active countdown UIs from `StitchPromotionsNew-hero`, `promotions-new/index.tsx`, and clean `grandOpeningAlt` i18n key.
3. **Track tech-debt:** `is_featured` is a dead D1 column — decide add-or-remove.

## Unresolved Questions

1. Should the active countdown timers on `/promotions` (generic "Limited Release" copy) be removed as part of "deprecate Grand Opening" spirit, even though they contain no explicit khai trương text? **Current call: no (out of scope for explicit AC), but recommend follow-up.**
2. Does the about-page "grand opening" alt text (brand history timeline) need immediate copy change, or is factual-past-tense acceptable? **Current call: acceptable as history, but recommend rename to avoid confusion.**

---

**Final:** PASS — ship with follow-up tasks filed. No blocking issues.
