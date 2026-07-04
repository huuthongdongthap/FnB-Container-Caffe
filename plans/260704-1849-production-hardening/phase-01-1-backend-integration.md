---
phase: 1
title: "Backend Integration"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Backend Integration

## Overview

Wire frontend stores to real D1/Cloudflare Worker API endpoints. Currently many stores rely on mock data.

## Focus Areas

- **Orders:** useOrderStore to POST /api/orders, GET /api/orders/:id
- **Menu:** useCart/useMenu to GET /api/menu-items
- **Loyalty:** useLoyaltyStore to GET /api/loyalty
- **Auth:** useAuthStore to POST /api/auth/login

## Files

- Modify: src/hooks/stores/use-order-store.ts
- Modify: src/hooks/use-cart.ts
- Modify: src/hooks/stores/use-loyalty-store.ts
- Worker: worker/src/index.ts (verify API routes exist)

## Success Criteria

- [ ] Orders created via real API
- [ ] Menu loads from database
- [ ] Loyalty from real data
- [ ] Build + tests pass
