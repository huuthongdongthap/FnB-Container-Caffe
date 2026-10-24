# Full menu imagery delivery

## Result
49 of 49 canonical menu entries have distinct photographs in the approved warm daylight style. Six accepted images were reused; 43 additional images were generated with built-in image_gen. The complete local collection covers ten categories.

## Files
- PNG masters: `assets/menu/aura-drinks/` (49 files, 1448 × 1086).
- WebP assets: `public/menu/aura-drinks/` (49 files, 1200 × 900, approximately 5.99 MiB total).
- Review page: `public/menu/aura-drinks/preview.html`, with category filters, accent-insensitive search, download links and illustrative-image notes.
- Review inventory: `public/menu/aura-drinks/collection.json`.
- Full shared prompt, per-product subjects, source reference and generated output paths: `generation-manifest.json` in this plan directory. Initial six prompts remain in `plans/261023-1627-menu-drink-imagery/generation-manifest.json`.
- Contact sheets: `contact-sheet-1.jpg` through `contact-sheet-4.jpg`.
- Rebuild review assets: `node plans/261023-1703-full-menu-imagery/build-review.mjs` from project root.

## Integration
`src/lib/menu-drink-images.ts` owns canonical ID mappings and fallback yogurt aliases. Known legacy image URLs and empty images resolve to the new collection, while custom administrator images remain unchanged. Customer menu hooks, individual item hooks, general menu hooks and menu store online/offline paths use the resolver. Existing combined smoothie fallback keeps avocado as its representative serving. Product names, prices, options and catalog structure are preserved.

## Verification
- Visually inspected all 49 photographs on four labeled contact sheets: intended drink identity and vessel framing retained; no visible Viva Star marks on backgrounds or vessels.
- Verified 49 unique mappings, 49 existing PNG masters, and 49 decodable 1200 × 900 WebP files. Details: `asset-checks.json`.
- 27 tests passed across image resolver, existing Stitch menu and menu store suites. Checks include canonical coverage, unique assets, yogurt aliases, distinct iced/hot/blended matcha imagery, custom image preservation and unknown IDs.
- `npm run typecheck` passed after final code changes.
- Scoped `git diff --check` passed.
- Chrome preview at 1440px desktop and 390px mobile: all 49 images decoded, no horizontal overflow, all ten category filters returned expected counts, search with and without accents and empty results worked. Evidence: `visual-checks.json`, preview screenshots.
- Actual `/menu` page checked in Chrome at both widths using an intercepted canonical 49-item API fixture with empty image URLs. All 49 distinct new photographs rendered and decoded without horizontal overflow. Evidence: `menu-browser-checks.json`, `menu-desktop.png`, `menu-mobile.png`; repeat with `verify-menu-browser.mjs`.
- An initial coverage test used an import-meta URL rewritten by the browser test environment; corrected to project-root filesystem paths and reran successfully.

## Scope boundaries
These are AI-generated illustrations. Entries combining hot/iced preparation or multiple flavors show one representative serving. Packaged mineral water, soft drinks and energy drink show unbranded illustrative packaging; actual brands are selected through the existing product entry. The preview explains these details.

No production API or database was changed. Browser menu verification used fixtures, not production responses. No deployment, publication, commit or external messaging occurred. Existing source reference assets and unrelated working-tree changes remain intact.

## Unresolved questions
None blocking local delivery.
