---
phase: 3
title: "E2E Tests"
status: pending
priority: P1
dependencies: []
---

# Phase 3: E2E Tests

## Overview

Add Playwright tests for 6 new routes. Follow existing patterns in tests/.

## Tests

- tests/order-flow.test.ts — mobile ordering renders
- tests/container-page.test.ts — container cafe loads
- tests/events-v2.test.ts — events v2 displays
- tests/admin-order-mgmt.test.ts — order management loads

## Files

- Create: tests/order-flow.test.ts
- Create: tests/container-page.test.ts
- Create: tests/events-v2.test.ts
- Create: tests/admin-order-mgmt.test.ts

## Success Criteria

- [ ] All new E2E pass
- [ ] Existing tests unaffected
- [ ] Build passes
