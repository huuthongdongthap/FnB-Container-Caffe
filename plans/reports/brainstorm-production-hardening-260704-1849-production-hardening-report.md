# Production Hardening Phase

**Date:** 2026-07-04 18:49
**Project:** FnB-Container-Caffe (AURA CAFE)
**Status:** Stitch frontend complete (18/18 routes, build 0 errors, 1161 tests)

## Context

Stitch pipeline complete. Next: make the app production-ready.

## Tracks

### Track A: Backend Integration
- Wire frontend stores to real D1/Cloudflare Worker API endpoints
- Order creation, payment (PayOS/COD), loyalty points, menu data, customer auth
- Replace mock data in stores with fetch/API calls

### Track B: Vendor Chunk Splitting
- Split 1,150KB main JS bundle
- Route-based code splitting + vendor chunk config in vite.config.js

### Track C: E2E Coverage
- Playwright tests for 6 new routes
- Order flow, container page, events v2

### Track D: SEO + Error Monitoring
- Meta tags + structured data for new pages
- Error boundaries, API error handling

## Success Criteria
- [ ] Build 0 errors
- [ ] 1161+ tests passing (possibly more with E2E)
- [ ] Main chunk < 500KB
- [ ] Backend API integration on 3+ pages
- [ ] E2E tests for new routes
