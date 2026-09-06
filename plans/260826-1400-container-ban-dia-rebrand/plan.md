# Plan — Container Bản Địa Rebrand (v6)

Source spec: `plans/reports/uiux-design-260826-1300-local-cafe-rebrand-vietnamize-report.md`

## Brand asset audit conclusion (feeds UX Question #3)
- Logo artwork (`assets/brand/fnb_water_logo.png`) = AURA CAFE chrome wordmark + water ripple, EST.2023, tagline **"LUXURY COFFEE EXPERIENCE"**.
- Palette (navy/silver) compliant with Bát tự rules; **tagline conflicts** with "bản địa" positioning.
- In-app render sites: logo images are NOT referenced by any component (`grep` clean) — only text `brandName: "AURA CAFE"` via `use-stitch-container-new2-default-data.ts:93` and `LogoUsage.tsx` guideline stubs. So rebrand is copy-level, no `<img>` swap needed.
- Decision (auto mode, low-risk): keep wordmark "AURA CAFE" (recognition), change surrounding copy. Tagline replacement handled in vi.json/en.json strings.

## Phases
- **P1 Tokens+Fonts**: remap `src/styles/brand-tokens.css` values per §2.2 table; `index.html:15-16` font links → Quicksand + Be Vietnam Pro; remove 4 hardcoded gold hexes (`StitchLandingNew-hero.tsx:76`, `luxury-landing/index.tsx:33`).
- **P2 Copy VI/EN**: `src/locales/{vi,en}.json` zone names + luxury strings (~20 keys incl. `heroTagline`, zones, seoDescription, ogDescription).
- **P3 Verify**: tsc FE + FE tests + grep residual gold hex / EN zone names in vi.json.

## Out of scope
- Route rename `/stitch/luxury-landing` (internal URL).
- `luxuryTax` checkout term — already reads "Phí dịch vụ (5%)" at line 431; line 276/1789 duplicates updated to neutral wording.
- Any logo image regeneration (no code references it).
