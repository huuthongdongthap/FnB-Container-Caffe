# Phase 05: PWA Service Worker, Manifest/SEO Canonicalization, Signage & Release Gates

## Context Links
- [Plan Overview](plan.md)

## Overview
- **Priority**: P1 (PWA Reliability, SEO, Signage & Release Verification)
- **Status**: Pending
- **Description**: Register `/sw.js` properly in `use-sw-registration.ts`, fix `public/sw.js` offline `GET /api/*` handling and notification clicks, unify `index.html` + `public/manifest.json` + `public/manifest-mobile.json` + `config/brand.json` with AURA M3 Dark (`#0A1A2E`) and `29 Nguyễn Tất Thành, Sa Đéc`, place canonical `robots.txt` and `sitemap.xml` (`https://auraspace.cafe`) in `public/`, update `signage-widgets/*.html` to AURA M3 Dark and copy to `public/signage/`, remove raw camera asset copy in `deploy-cloudflare.sh`, and pass all verification gates.

## Key Insights
- `use-sw-registration.ts` awaits `navigator.serviceWorker.ready` without ever calling `navigator.serviceWorker.register('/sw.js')`, and `skipWaiting()` posts to `registration.active` instead of `registration.waiting`.
- `public/sw.js` returns HTTP `200 OK { offline: true, queued: true }` on failed `GET /api/*` requests, breaking `apiFetch` callers.
- `robots.txt` and `sitemap.xml` live only at repo root (not in `public/`) and reference `https://auraspace.vn` instead of `https://auraspace.cafe`.
- `signage-widgets/*.html` hardcode `API_BASE = 'https://fnb-caffe-container.pages.dev'` (which returns `index.html`) instead of the Worker URL `https://aura-space-worker.sadec-marketing-hub.workers.dev` and use `#1a1a2e`/`#d4a853`.

## Related Code Files
- `src/hooks/use-sw-registration.ts`
- `src/components/pwa/SWUpdatePrompt.tsx`
- `public/sw.js`
- `public/offline.html`
- `public/manifest.json`
- `public/manifest-mobile.json`
- `index.html`
- `config/brand.json`
- `robots.txt` & `public/robots.txt`
- `sitemap.xml` & `public/sitemap.xml`
- `signage-widgets/menu-board.html`
- `signage-widgets/promo-screen.html`
- `signage-widgets/welcome-screen.html`
- `deploy-cloudflare.sh`

## Implementation Steps
1. **PWA Registration (`src/hooks/use-sw-registration.ts` & `SWUpdatePrompt.tsx`)**:
   - Call `navigator.serviceWorker.register('/sw.js')` (falling back to `.ready` if already registered) in `use-sw-registration.ts`.
   - Send `{ type: 'SKIP_WAITING' }` to `registration?.waiting || registration?.active`.
2. **Service Worker (`public/sw.js` & `public/offline.html`)**:
   - In `public/sw.js`, only queue non-GET mutation requests for offline sync; when a `GET /api/*` fails and has no cached response, return status `503` (`{ success: false, offline: true }`) so `apiFetch` handles the offline error cleanly.
   - In `notificationclick`, open `targetUrl` when `event.action === 'view' || !event.action`.
   - Update `public/offline.html` background from `#FFF7ED` to `#0A1A2E` (AURA M3 Dark).
3. **Manifest, `index.html` & `config/brand.json`**:
   - Add `<meta name="theme-color" content="#0A1A2E" />` and `29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp` to `index.html` and `config/brand.json`.
   - Update `public/manifest.json` and `public/manifest-mobile.json` `theme_color` and `background_color` to `#0A1A2E`, fix `"name": "AURA SPACE — Container Café Sa Đéc"`, and include `"purpose": "any maskable"`.
4. **Canonical `robots.txt` & `sitemap.xml`**:
   - Update `robots.txt` and `sitemap.xml` to use `https://auraspace.cafe` and canonical routes (`/about`, `/menu`, `/reservation`, `/loyalty`, `/contact`), and copy both into `public/robots.txt` and `public/sitemap.xml`.
5. **Signage Widgets (`signage-widgets/*.html` & `public/signage/*.html`)**:
   - Update `API_BASE` default to `https://aura-space-worker.sadec-marketing-hub.workers.dev`, theme colors to `#0A1A2E` / `#C9D6DF`, and address to `29 Nguyễn Tất Thành, Sa Đéc` while keeping existing DOM IDs/classes tested by `tests/signage-widgets.test.ts`. Copy to `public/signage/`.
6. **Deploy Script (`deploy-cloudflare.sh`)**:
   - Remove `cp -r assets dist/ 2>/dev/null` so raw `.MOV`/`.HEIC` camera files are never copied into `dist/`.
7. **Verification Gates**:
   - `npm run check:contrast`
   - `npx tsc --noEmit` & `npx tsc -p worker/tsconfig.json --noEmit`
   - `npm run lint --silent`
   - `npx vitest run`
   - `npm run build`

## Todo List
- [ ] Fix `use-sw-registration.ts`, `public/sw.js`, and `public/offline.html`
- [ ] Update `index.html`, `public/manifest.json`, `public/manifest-mobile.json`, and `config/brand.json`
- [ ] Update & sync `robots.txt` and `sitemap.xml` into `public/`
- [ ] Theme `signage-widgets/*.html` and sync to `public/signage/`
- [ ] Remove raw `assets/` copy in `deploy-cloudflare.sh` and pass all 5 verification gates
