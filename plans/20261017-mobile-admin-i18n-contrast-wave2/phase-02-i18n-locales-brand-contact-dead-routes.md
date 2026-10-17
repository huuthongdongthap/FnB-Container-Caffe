# Phase 02: i18n Flat-Key Corruption Fix, Missing Namespaces, OG Asset & Dead Routes

## Context Links
- Overview Plan: `plans/20261017-mobile-admin-i18n-contrast-wave2/plan.md`
- Locale Loader: `src/lib/i18n.ts`

## Overview
- **Priority**: P0 (Customer & Admin UI Text Integrity)
- **Current Status**: Pending
- **Description**: Fix the 264 flat dot-keys appended at the bottom of `src/locales/vi.json` and `src/locales/en.json` that overwrite valid nested translations with raw camelCase identifiers; add missing translation keys for `promotions`, `checkin`, `reservations`, `chat`, and `common`; fix broken `DEFAULT_OG_IMAGE` asset path; and repair dead navigation links and inconsistent store contact metadata.

## Key Insights
1. `src/lib/i18n.ts:31-40` (`buildNamespaces`) processes flat dot-keys (`"account.error.retry": "retry"`) after nested objects, overwriting valid translations in `account`, `adminPromotions`, `adminSubscriptions`, `order`, `reviews`, `trackOrder`, `subsPage`, `contact`, `events`, and `loyalty`.
2. `src/components/seo/HelmetHead.tsx:12` and `src/pages/home.tsx:41` reference `/photos/IMG_6691.webp`, which does not exist in `public/photos/` (valid hero image is `/photos/space-exterior-overview.webp`).
3. Dead route links exist in `five-zone-showcase.tsx:104` (`/about-us` → `/about`), `register/index.tsx:111` (`/login` → `/account`), `verify-email/index.tsx:46` (`/dashboard` → `/account`), and `StitchReferralNew1-layout.tsx:55,69,78` (`/referrals` → `/referral`, `/rewards` → `/loyalty`, `/profile` → `/account`).
4. Dummy phone `+84 277 123 456` in `luxury-landing/index.tsx:114` and `vi.json`/`en.json`, `0901234567` in `order-failure/index.tsx:97`, and `"TP. Hồ Chí Minh"` in `events.manifestoLocation` conflict with canonical `0946 013 633` and Sa Đéc, Đồng Tháp.

## Requirements
- **Functional**:
  - Prevent flat dot-keys with raw camelCase values from overwriting nested keys in `src/locales/vi.json` and `src/locales/en.json` (and guard `buildNamespaces` in `src/lib/i18n.ts`).
  - Provide complete Vietnamese & English translations for `common.loading`, `common.retry`, `stitch.theDigitalReserve`, `promotions.*`, `checkin.*`, `reservations.*`, and `chat.*`.
  - Update `DEFAULT_OG_IMAGE` in `HelmetHead.tsx` and `home.tsx` to `/photos/space-exterior-overview.webp` and `config/brand.json` to canonical dark theme + Sa Đéc address + `0946 013 633`.
  - Fix all dead routes to canonical registered paths.

## Related Code Files
- `src/lib/i18n.ts`
- `src/locales/vi.json`
- `src/locales/en.json`
- `config/brand.json`
- `src/components/seo/HelmetHead.tsx`
- `src/pages/home.tsx`
- `src/components/home/five-zone-showcase.tsx`
- `src/pages/register/index.tsx`
- `src/pages/verify-email/index.tsx`
- `src/components/stitch/StitchReferralNew1-layout.tsx`
- `src/pages/stitch/luxury-landing/index.tsx`
- `src/pages/stitch/order-failure/index.tsx`
- `src/hooks/use-stitch-container-new2-default-data.ts`

## Implementation Steps
1. Clean up corrupted flat dot-keys at the bottom of `src/locales/vi.json` (lines 1655–1908) and `src/locales/en.json` (lines 1653–1914), and add a guard in `src/lib/i18n.ts` so a flat dot-key never overwrites an existing non-empty nested translation when the flat value equals the leaf key name.
2. Add missing namespaces/keys (`common.loading`, `common.retry`, `promotions`, `checkin`, `reservations`, `chat`, `tvMenu`, `stitch.theDigitalReserve`) to `src/locales/vi.json` and `src/locales/en.json`.
3. Update `events.manifestoLocation` and `stitch.landing.phoneValue` in `vi.json` and `en.json` to Sa Đéc, Đồng Tháp and `+84 946 013 633`.
4. Fix `DEFAULT_OG_IMAGE` in `src/components/seo/HelmetHead.tsx` and `src/pages/home.tsx` to `/photos/space-exterior-overview.webp`, and update `config/brand.json`.
5. Fix dead links in `five-zone-showcase.tsx`, `register/index.tsx`, `verify-email/index.tsx`, `StitchReferralNew1-layout.tsx`, `luxury-landing/index.tsx`, `order-failure/index.tsx`, and `use-stitch-container-new2-default-data.ts`.

## Todo List
- [ ] Remove corrupted flat dot-keys in `src/locales/vi.json` and `src/locales/en.json` and harden `src/lib/i18n.ts`
- [ ] Add missing i18n keys (`common`, `promotions`, `checkin`, `reservations`, `chat`, `tvMenu`)
- [ ] Fix `DEFAULT_OG_IMAGE` in `HelmetHead.tsx`, `home.tsx`, and `config/brand.json`
- [ ] Repair dead routes (`/about-us`, `/login`, `/dashboard`, `/referrals`, `/rewards`, `/profile`) and dummy phone/location strings

## Success Criteria
- Zero flat dot-keys overwriting valid translations with raw key names.
- All OG image paths resolve to existing files in `public/photos/`.
- Canonical phone `0946 013 633` and address `29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp` consistent across all locales and configs.
