# Session Wrap-Up: Five Residual Bugs That Almost Sunk the Ship

**Date**: 2026-07-04 23:30
**Severity**: Medium (blocking polish, not blocking ship -- but would have looked broken on any second look)
**Component**: StitchAppLayout, i18n locale files, react-helmet-async, SEO infrastructure
**Status**: Resolved

## What Happened

After 7 hours of hitting the AURA CAFE Stitch pipeline -- quality pass, production hardening, all 18 routes wired -- we had what looked like a green build and passing tests. Visual smoke test revealed 5 separate bugs that were invisible in the CI pipeline but obvious to any human viewing the site:

1. **Duplicate nav bar** -- StitchHeader component rendered alongside a separate header baked into the Stitch layout component. Two navigations stacked vertically. Every page had it.

2. **Raw i18n keys everywhere** -- The locale files had 88 keys (44 EN + 44 VI) where the translation value was literally the key name. The site displayed `menu.title`, `contact.description` as visible text on-screen.

3. **react-helmet-async completely dead** -- Missing `<HelmetProvider>` wrapper in `main.tsx`. Every `<Helmet>` call was silently failing. No page title, no meta tags, no SEO metadata anywhere.

4. **Menu and About pages had no `<HelmetHead>` at all** -- Even if HelmetProvider was fixed, these pages didn't import or render a HelmetHead component. They'd show the default HTML title regardless.

5. **Auto-generated translations were garbage** -- 88 keys had raw key text as their value. Some automated locale generation step (or a Stitch export script) populated translation files with the key names as placeholders, treating them as completed translations.

The root cause behind all of this: the locale file in this project has a mixed structure of flat dot-notation keys AND nested objects. Both approaches were used in different sections of `en.json`/`vi.json`, but the `t()` function in code only respected one of them. Code calling `t('menu.title')` returned the nested object path, but keys stored as `contact.seoTitle` at top level resolved to the nested object `contact: { seoTitle: "..." }`. The fix merged both approaches: flat keys stayed accessible, nested objects were promoted to top-level namespaces.

## The Brutal Truth

This is the most frustrating kind of bug: the kind that exists in plain sight but never surfaces in CI. Every single one of these would have been caught by a human loading the site and scrolling down. We had tests passing. Build green. Chunks split. E2E tests running. And the site looked like a broken, half-translated prototype with a double navigation bar.

The i18n key leak is particularly embarrassing. 88 translations where the value IS the key. That means someone (possibly an automated script, possibly a previous developer) ran a locale generation step that wrote `"menu.title": "menu.title"` as a placeholder and never came back to fill in the real translations. These were not `t()` calls falling through to `defaultValue` -- the keys existed in the JSON, they just contained the key as their value. The i18n system was working perfectly. It was faithfully rendering the garbage we put in.

The HelmetProvider is pure process failure. If the SEO pass added HelmetHead components to 4 pages as production hardening, but nobody checked whether the `<HelmetProvider>` existed in the React tree, then the entire SEO layer was a paper tiger. Tests pass because react-helmet-async silently no-ops when the provider is missing. No error, no warning, just zero page titles and zero meta tags in production.

The duplicate header is a classic integration duplicate: the Stitch layout component was imported from a template that included its own header/nav, then we also mounted the app-level StitchHeader separately because that's how the router layout works. Two sources of truth for the same navigation element.

## Technical Details

**Bug 1 -- Duplicate Navigation:**

- Root: `StitchAppLayout.tsx` rendered a `<nav>` element as part of its layout template. The router also mounted `<StitchHeader>` as a separate component in the app shell.
- Fix: Added a conditional hide on StitchHeader via a layout context flag. When `StitchAppLayout` detected it was rendered inside the app shell (via a passed prop or context), it suppressed its own internal header. Alternative considered: removing the header from StitchAppLayout entirely. Rejected because the header is part of the Stitch template design and removing it would break component isolation.

**Bug 2 -- i18n Key Leak:**

- 88 entries in `en.json` / `vi.json` had values matching their key path:
  ```json
  "menu.title": "menu.title",
  "contact.description": "contact.description",
  "about.heroTitle": "about.heroTitle"
  ```
  (44 in EN, 44 in VI -- symmetric, suggesting a codegen step produced both files identically)
- Fix: Replaced all 88 entries with proper Vietnamese (primary) and English (secondary) translations.
- Note: Several of these files were also auto-replaced by an i18n namespace promotion pass, so the exact count shifted during the fix.

**Bug 3 -- Missing HelmetProvider:**

- File: `src/main.tsx` (or equivalent entry point)
- Fix: Wrapped the entire app tree with `<HelmetProvider>` imported from `react-helmet-async`.
- No tests caught this because Helmet silently no-ops without the provider.

**Bug 4 -- Missing HelmetHead on Menu/About:**

- Files: `src/pages/menu.tsx`, `src/pages/about.tsx`
- Fix: Imported and rendered `<HelmetHead>` with proper Vietnamese titles and descriptions. These were two of the 4+ pages the hardening pass was supposed to cover but only covered the landing page.
- This is a scope leak: the SEO phase in the hardening plan said "4+ customer-facing pages" but only wrapped `/` (landing). Menu and About were listed but never wired.

**Bug 5 -- Auto-Generated Translation Garbage:**

- Same 88 keys as Bug 2, but treated separately because the root cause is different. Bug 2 is about the visible symptom. Bug 5 is about the generation pipeline that produced the garbage.
- Root: Some automated step (likely the Stitch i18n integration script or a previous locale management tool) detected the namespace structure and generated keys with the key path as placeholder values. This is a common pattern in i18n tools that treat missing translations as "use the key" -- except here the tool wrote the key into the value field instead of leaving it as a fallback.

## What We Tried

**Namespace promotion (i18n fix approach):** The locale file had a mixed structure: some keys were flat dot-notation (`menu.title`), others were nested objects (`seo: { defaultTitle: "..." }`). The `t()` function supports both, but code using `t('menu.title')` would fail if `menu.title` was stored as a nested object path instead of a flat key. The fix promoted all nested objects to top-level namespace keys. This was the right approach but created a merge conflict with itself when applied on top of another in-flight i18n change.

**Selective header hiding:** Considered removing the header from StitchAppLayout entirely, but the layout component is designed as a self-contained template. Hiding the internal header via a prop was the minimal-impact fix. The trade-off is a new prop on the layout component that only one consumer uses.

## Root Cause Analysis

1. **i18n key leak (88 entries):** The locale generation pipeline treated key paths as valid translation values. This is a pipeline bug that happened once (the initial Stitch export or a locale management script) and was never caught because someone looked at the locale files, saw keys present, and assumed they were real translations. The fix today replaces the garbage, but the pipeline that produced it is still in our toolchain.

2. **Missing HelmetProvider:** The SEO layer was added in the production hardening phase without verifying the React component tree could support it. The hardening plan's SEO phase specified HelmetHead with react-helmet-async, and the implementation added HelmetHead components, but nobody checked whether the Provider existed at the app root. This is a checklist failure: the implementation step did not include "verify HelmetProvider is mounted in main.tsx."

3. **Missing HelmetHead on Menu/About:** The SEO phase said "4+ pages" but scoped creeped down to just the landing page. The oversight was never caught because the hardening phase review focused on whether HelmetHead worked (provider missing -- it couldn't) rather than which pages had it.

4. **Duplicate header:** Classic integration bug. Two independent code paths (template layout and app shell) each assumed they owned the navigation. No integration test caught this because unit tests mount components in isolation.

5. **Test coverage blindness:** All 1161 tests passed. Zero caught any of these bugs. Unit tests don't verify layout composition. E2E tests don't check for duplicate nav elements or i18n key leakage. No test validates HelmetProvider presence or SEO metadata output.

## Lessons Learned

1. **Locale files with key-as-value entries are undetectable in CI.** A `t()` call with a valid key returns its value -- whether the value is "Xin chao" or "menu.title". No system can distinguish between a valid translation and a placeholder that happens to look like a key. The only fix is a manual audit of all locale entries, or a tool that flags keys whose values match their key path.

2. **HelmetProvider must be validated at the integration level.** Add a smoke test that mounts the full app tree and checks that `<title>` elements rendered via Helmet actually appear in the DOM. Without this, the entire SEO infrastructure is untested.

3. **Integration bugs require integration tests, not unit tests.** The duplicate nav, missing HelmetProvider, and i18n key leak are all state that only exists when the full app mounts. Component-level tests cannot catch them. We need a smoke test that loads the app and verifies: one nav bar, no raw keys visible, correct page title.

4. **The 7-hour session produced fatigue-driven quality decay.** Bug 3 and 4 (HelmetProvider missing, pages not wired) would have been caught if the SEO implementation had been reviewed with fresh eyes. By the 6th hour, the pace of checking slowed and the completion standard slipped from "verify it works" to "verify it compiles."

5. **Stitch exports that include i18n keys without values should fail the import gate.** If the Stitch HTML export produces locale entries with key-as-value placeholders, the import pipeline should reject those entries and require real translations before merging.

6. **Mixed locale structures (flat keys + nested objects) are a maintenance minefield.** The codebase inherited both patterns because different developers (or AI exports) used different approaches. Dot-notation keys are cleaner and more predictable for tree-shaking. The namespace promotion was necessary cleanup, but it should have been a one-time migration, not an ongoing support burden.

## Next Steps

- **Add a locale integrity check script** that flags any translation entry where the value matches the key path (e.g., `"menu.title": "menu.title"`). Run this in CI or as a pre-commit hook. Owner: dev. By: next sprint.
- **Add a smoke test for HelmetProvider presence.** Mount the app shell in a test and verify `<title>` contains the expected app name. Must use `react-helmet-async`'s HelmetData API or DOM query. Owner: dev. By: next commit.
- **Add an integration smoke test for duplicate headers.** Mount the full app layout, count `<nav>` elements, assert count === 1. Owner: dev. By: next commit.
- **Audit the locale generator script** that produced the 88 key-as-value entries. Identify whether it's part of the Stitch export pipeline, a custom i18n tool, or leftover from a previous automation. If it's in the active toolchain, fix it to fail instead of producing garbage. Owner: dev. By: next sprint.
- **Add SEO metadata E2E test** that loads each customer-facing page and asserts `<title>` and `<meta name="description">` are present and non-empty. Owner: QA. By: next week.
- **Document the locale convention:** flat dot-notation keys at top level only, no nested objects. Update the i18n contribution guide. Owner: dev. By: next commit.
- **Consider a pre-push visual smoke test** using Playwright screenshot comparison for the 4 key customer-facing pages. Catches layout duplications, missing content, and style regressions that unit tests cannot. Owner: dev. By: next sprint.
