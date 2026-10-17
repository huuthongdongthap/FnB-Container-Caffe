# Phase 01: Brand Truth, Store Address, Master Logo & Assets

## Context Links
- Audit Report: [`plans/reports/ui-ux-deep-audit-20261017.md`](../reports/ui-ux-deep-audit-20261017.md)
- Memory Spec: `aura-store-address-and-logo-spec.md`, `viva-star-supplier-brand-truth.md`

## Overview
- **Priority:** P0 (Critical Brand Compliance)
- **Current Status:** Completed
- **Description:** Enforce the official store address (`29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp — Đối diện Khách sạn Thảo Trâm 2`), eliminate circular masks (`rounded-full object-cover`) on the AURA Master Logo, and fix broken asset references (`AuraImage.tsx`, `HelmetHead.tsx`, `index.html`).

## Key Insights
- 37 occurrences still reference `39 Nguyễn Tất Thành`, 2 reference `27 Nguyễn Tất Thành`, and 19 have wrong ward/street/typos (`Ward 2`, `Phường Sa Đéc`, `29 Nguyen Tat Than`, `Đường Nguyễn Sinh Sắc`, `đường Hùng Vương`).
- 6 logo containers apply `rounded-full ... object-cover`, clipping the left wing of the first `A`, the ribbon tail of `R`, and the right wing of the second `A`.
- `AuraImage.tsx:42-58` rewrites `.webp` sources to non-existent `.png` fallbacks, and `.jpg` sources to non-existent `.webp` sources.
- `index.html:23` loads `/brand-tokens.css` a second time (already bundled via `src/styles/global.css:3`) and references missing `/icons/mask-icon.svg`.

## Requirements
### Functional Requirements
1. Standardize all Vietnamese address strings to `29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp` (with landmark `Đối diện Khách sạn Thảo Trâm 2` in contact/location sections) and English strings to `29 Nguyen Tat Thanh, Ward 1, Sa Dec City, Dong Thap (Opposite Thao Tram 2 Hotel)`.
2. Frame all AURA Master Logo / emblem instances in an unclipped rectangular M3 plaque (`rounded-xl object-contain p-1`) without `rounded-full` or `object-cover`.
3. Fix `AuraImage.tsx` so `.webp` images render directly without rewriting `<img>` `src` to non-existent `.png` files.
4. Point `DEFAULT_OG_IMAGE` in `HelmetHead.tsx:12` and `home.tsx:41` to an existing high-res asset (`/photos/IMG_6691.webp` or `/images/aura-master-logo.png`).

### Non-Functional Requirements
- Zero broken image requests (`404`) on initial page load.
- Maintain all existing unit tests by updating test assertions that checked for `39 Nguyễn Tất Thành`.

## Architecture
- Localization JSONs (`src/locales/{vi,en}.json`, `public/locales/{vi,en}/translation.json`, `public/translations.json`) serve as the primary source of truth for address strings.
- Logo components use rectangular `rounded-xl` (`--md-sys-shape-corner-medium`) containers with `object-contain`.

## Related Code Files
- **Files to Modify:**
  - `README.md`
  - `index.html`
  - `public/brand-tokens.css`
  - `public/translations.json`
  - `public/locales/vi/translation.json`
  - `public/locales/en/translation.json`
  - `public/stitch-designs/landing-alt.html`
  - `public/stitch-designs/landing-full.html`
  - `src/locales/vi.json`
  - `src/locales/en.json`
  - `src/components/home/hero-section.tsx`
  - `src/components/home/location-map.tsx`
  - `src/components/contact/LocationMap.tsx`
  - `src/components/seo/HelmetHead.tsx`
  - `src/components/ui/AuraImage.tsx`
  - `src/components/stitch/StitchLayout.tsx`
  - `src/components/stitch/StitchLandingNew-footer.tsx`
  - `src/components/stitch/StitchContactNew.tsx`
  - `src/components/stitch/StitchContactNew-contact-info.tsx`
  - `src/components/stitch/StitchContactNew-map-section.tsx`
  - `src/pages/home.tsx`
  - `src/pages/SystemHub.tsx`
  - `src/pages/stitch/our-story/our-story-hero.tsx`
  - `src/pages/stitch/contact-new/index.tsx`
  - `src/pages/stitch/luxury-landing/index.tsx`
- **Files to Create:** None
- **Files to Delete:** None

## Implementation Steps
1. Update `src/locales/vi.json`, `src/locales/en.json`, `public/locales/{vi,en}/translation.json`, and `public/translations.json` to replace all `39 Nguyễn Tất Thành`, `27 Nguyễn Tất Thành`, `Ward 2`, and `đường Hùng Vương` occurrences with `29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp` (and landmark `Đối diện Khách sạn Thảo Trâm 2`).
2. Fix hardcoded address/phone/ward defects in `src/components/contact/LocationMap.tsx:9-11`, `src/components/stitch/StitchContactNew-contact-info.tsx:22-33`, `src/pages/stitch/our-story/our-story-hero.tsx:20`, `src/pages/stitch/contact-new/index.tsx:21,55`, `src/pages/stitch/luxury-landing/index.tsx:112`, `README.md:3`, `public/brand-tokens.css:5`, and `public/stitch-designs/*.html:362`.
3. Remove `rounded-full` + `object-cover` from logo elements in `src/components/home/hero-section.tsx:122-133`, `src/components/stitch/StitchLayout.tsx:31-38`, `src/components/stitch/StitchLandingNew-footer.tsx:27-34`, and `src/pages/SystemHub.tsx:411-418` (replace with `rounded-xl object-contain p-1`). *(Note: `md3-app-shell.tsx` and `StitchLandingNew-nav.tsx` are handled in Phase 03 to respect file ownership).*
4. Fix `src/components/ui/AuraImage.tsx:42-58` so `.webp` images do not rewrite `<img src>` to `.png` and `.jpg` images do not emit `.webp` `<source>` unless explicitly provided.
5. Update `src/components/seo/HelmetHead.tsx:12` and `src/pages/home.tsx:41` from `/images/night-4k.webp` to `/photos/IMG_6691.webp`, and in `index.html:16,23` point `mask-icon` to `/favicon.svg` and remove the duplicate `<link rel="stylesheet" href="/brand-tokens.css" />`.

## Todo List
- [x] Replace all `39` / `27 Nguyễn Tất Thành` and wrong ward/street occurrences across locales, pages, and public HTML
- [x] Add `Đối diện Khách sạn Thảo Trâm 2` landmark to Contact and Location components
- [x] Replace circular `rounded-full object-cover` logo styling with rectangular M3 plaque (`rounded-xl object-contain`)
- [x] Fix `AuraImage.tsx` broken `.webp`/`.png` source rewrite
- [x] Fix missing OG image `/images/night-4k.webp` and duplicate `brand-tokens.css` link in `index.html`

## Success Criteria
- `grep -rn "39 Nguyễn Tất Thành\|27 Nguyễn Tất Thành\|Nguyen Tat Than," src/ public/ README.md` returns `0` matches in production files.
- All AURA logos render with `object-contain` and non-circular border radius (`rounded-xl` / `rounded-2xl`).

## Risk Assessment
- **Risk:** Existing unit tests (`StitchAbout.test.tsx`, `our-story.test.tsx`, `contact-new.test.tsx`) assert `/39 Nguyễn Tất Thành/i`.
- **Mitigation:** Update those test expectations in Phase 05 to assert `/29 Nguyễn Tất Thành/i`.

## Security Considerations
- Remove external placeholder/broken links where possible; ensure all static assets resolve locally from `public/`.

## Next Steps
- Proceed in parallel with Phases 02, 03, and 04; verify in Phase 05.
