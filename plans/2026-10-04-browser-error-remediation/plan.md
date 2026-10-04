# Plan: Browser Error Remediation & E2E Test Hardening

## Overview
Remediate all browser console errors, React 19 / Zustand v5 infinite render loop crashes, 404 beacon resource requests, and Playwright test assertions across AURA CAFE client SPA routes.

## Phases
- [ ] **Phase 1: React 19 State Synchronization**: Fix uncached `getSnapshot` in `src/pages/TableOrder-hooks.ts`.
- [ ] **Phase 2: Error Beacon & Analytics Dev Handling**: Intercept `/api/vitals` and `/api/errors` in Vite dev server (`vite.config.js`) and client callers.
- [ ] **Phase 3: Centralized API_BASE Resolution**: Replace hardcoded `localhost:8787` and stale domain references with canonical `API_BASE` from `@/lib/api-client`.
- [ ] **Phase 4: Resilient Integration Logging & Mock Harmonization**: Add `silent` option & `AbortError` filter in `src/lib/api-client.ts`, update `use-events.ts`, and harmonize route mock patterns in Playwright test files (`**/mobile/**`).
- [ ] **Phase 5: Comprehensive E2E & Build Verification**: Run Playwright specs, `npm run typecheck:all`, `npm run lint`, and `npm test`.
