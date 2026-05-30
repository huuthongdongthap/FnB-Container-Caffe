# Plan — PWA Cache Busting & Visual Polish

## Milestones

### Milestone 1: R1 UI/UX Refined Overlap Fix & Visual Polish
- [ ] Task 1.1: Audit `.sr-only` and `.aura-sr-only` CSS styles.
- [ ] Task 1.2: Refine `.sr-only` and `.aura-sr-only` definitions in `css/brand-tokens.css` and other style sheets to use highly robust styles (modern standard, `!important`, `clip-path`, zero width/height) to prevent visual overlap on any screen resolution.
- [ ] Task 1.3: Verify that `index.html` uses these classes properly on the `<h1>` element.

### Milestone 2: R2 PWA Cache-Busting & Immediate SW Update
- [ ] Task 2.1: Locate and inspect all service worker implementation files (`sw.js`, `public/sw.js`, `js/sw.js`, etc.).
- [ ] Task 2.2: Ensure Service Worker has immediate activation (i.e. `self.skipWaiting()` in `install` event and `self.clients.claim()` in `activate` event).
- [ ] Task 2.3: Configure cache-busting version strings (e.g. `?v=2.2.1` or similar) on links for `brand-tokens.css`, `hero-v8-bazi.css`, and `ui-polish-v5.css` in all relevant HTML files (`index.html`, etc.) so browser immediately loads the new styles.

### Milestone 3: R3 Automated Testing & Code Health
- [ ] Task 3.1: Execute all Jest unit tests to verify 100% pass rate.
- [ ] Task 3.2: Execute Vite build (`npm run build`) to ensure successful compilation.
- [ ] Task 3.3: Verify ESLint rules and fix any outstanding blockers.
