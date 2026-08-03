---
phase: 6
title: "Auth Tier Gating (BASIC | PREMIUM | ENTERPRISE | MASTER)"
status: completed
priority: P2
effort: "3h"
dependencies: [5]
---

# Phase 6: Auth Tier Gating

## Overview
Extend auth system to assign and enforce SaaS tiers. Users register → get `BASIC` trial → upgrade via pricing page → tier unlocks features.

## Requirements
1. Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER (uppercase only)
2. On registration: assign BASIC (14-day trial)
3. Tier-gated routes: premium features require PREMIUM+
4. Upgrade flow: pricing page → payment → tier activation

## Architecture

### Tier Enum
```typescript
export type UserTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
```

### Tier Gate Middleware
- `worker/src/middleware/tier-gate.ts`:
  ```typescript
  export function requireTier(minTier: UserTier) {
    return async (c, next) => {
      const userTier = c.get('userTier');
      const tierOrder = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
      if (tierOrder.indexOf(userTier) < tierOrder.indexOf(minTier)) {
        return c.json({ error: 'Upgrade required' }, 403);
      }
      await next();
    }
  }
  ```

### Auth Extension
- `worker/src/routes/auth.ts`: add `tier` to user creation, return tier in login response

### Database
- Reuse existing `subscription_plans` table or extend `saas_tenants.tier`

### Tier-Period Database Migration (011_saas_tenants)
This migration includes `saas_tenants` table with `tier`, `status`, `trial_ends_at`, `current_period_end` columns to support:
- Auto-upgrade BASIC→PREMIUM after trial expiry
- Tier-based feature access control

## TODO List
- [ ] Create `worker/src/middleware/tier-gate.ts`
- [ ] Extend `worker/src/routes/auth.ts` (add tier on register)
- [ ] Add tier to session/JWT payload
- [ ] Add `requireTier()` middleware
- [ ] Gate premium routes (analytics, integrations, etc.)
- [ ] Write tier enforcement tests

## Success Criteria
- New user gets BASIC tier with 14-day trial
- `requireTier(['PREMIUM'])` blocks BASIC users (403)
- Tier persists in session across requests

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tier bypass via direct API call | Medium | High | All premium routes use `requireTier()` middleware |
| Trial expiry not auto-upgraded | Low | Medium | Cron job to check and upgrade expired trials |

## Security Considerations
- Tier checked server-side only (never trust client)
- 403 response for unauthorized tier access
