---
phase: 4
title: "SEO + Monitoring"
status: pending
priority: P3
dependencies: []
---

# Phase 4: SEO + Monitoring

## Overview

SEO meta tags for new pages + error monitoring infrastructure. 2 sub-tasks.

## 4a: SEO

- Add HelmetHead to /order, /container, /events pages
- JSON-LD structured data for AURA CAFE business on home page
- Update sitemap.xml

## 4b: Error Monitoring

- ErrorBoundary component wrapping StitchAppLayout
- API error interceptor in api-client.ts
- User-friendly error fallback UI

## Files

- Modify: src/pages/order/index.tsx
- Modify: src/pages/container/index.tsx
- Modify: src/pages/events.tsx
- Modify: src/components/stitch/StitchAppLayout.tsx
- Modify: src/lib/api-client.ts

## Success Criteria

- [ ] Meta tags on all new pages
- [ ] JSON-LD on homepage
- [ ] ErrorBoundary wrapping layout
- [ ] API errors caught and displayed
- [ ] Build + tests pass
