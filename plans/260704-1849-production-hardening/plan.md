---
title: "Production Hardening"
description: "Backend API integration, vendor chunk splitting, E2E tests, SEO + error monitoring."
status: archived
superseded_by: "260705-0241-aura-cafe-all-streams"
priority: P2
branch: "main"
tags: [backend, performance, testing, seo]
blockedBy: []
blocks: []
created: "2026-07-04T11:56:15.304Z"
createdBy: "ck:plan"
source: skill
---

# Production Hardening

## Overview

Stitch frontend complete (18/18 routes). This phase makes production-ready: connect stores to real APIs, split vendor chunks, add E2E tests for new routes, implement SEO + error monitoring.

## Phases

| Phase | Name | Status | Priority |
|-------|------|--------|----------|
| 1 | [Backend Integration](./phase-01-1-backend-integration.md) | Pending | P1 |
| 2 | [Vendor Chunks](./phase-02-2-vendor-chunks.md) | Pending | P2 |
| 3 | [E2E Tests](./phase-03-3-e2e-tests.md) | Pending | P1 |
| 4 | [SEO + Monitoring](./phase-04-4-seo-monitoring.md) | Pending | P3 |
| 5 | [Verify](./phase-05-5-verify.md) | Pending | P0 |

## Success Criteria

- [ ] Build 0 errors, Tests 1161/1161
- [ ] Frontend stores call real API endpoints
- [ ] Main JS chunk < 500KB
- [ ] Playwright E2E coverage for new routes
- [ ] Meta tags + error boundaries on all pages
