---
phase: 5
title: "Tenant Isolation Architecture (Multi-Tenant SaaS)"
status: completed
priority: P2
effort: "4h"
dependencies: [4]
---

# Phase 5: Tenant Isolation Architecture

## Overview
Add multi-tenant data isolation so each OPC (solo cafe) has completely separate operational data. New tenants are created via self-service signup; existing cafe data remains untouched.

## Requirements
1. Each tenant has unique `tenant_id` stored in session/JWT
2. All cafe queries filter by `tenant_id` automatically
3. Tenant creation on first register (no admin intervention)
4. Zero data bleed between tenants

## Architecture

### New D1 Table
- **Table**: `saas_tenants` (id, slug, name, tier, status, owner_user_id, created_at)

### Middleware
- `worker/src/middleware/tenant.ts` — extracts tenant_id from session, injects into `c.set('tenantId', ...)`

### Query Pattern
- All existing cafe queries scope by `tenant_id` from middleware-injected context

### Implementation Plan

**Step 1**: Create `worker/migrations/011_saas_tenants.sql`:
```sql
CREATE TABLE IF NOT EXISTS saas_tenants (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT,
    tier TEXT DEFAULT 'BASIC',
    status TEXT DEFAULT 'trial',
    owner_user_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saas_tenants_owner ON saas_tenants(owner_user_id);
```

**Step 2**: Create `worker/src/middleware/tenant.ts`:
```typescript
export async function tenantMiddleware(c: any, next: any) {
    const user = c.get('user');
    if (user?.tenantId) {
        c.set('tenantId', user.tenantId);
    }
    await next();
}
```

**Step 3**: Extend auth middleware to map user → tenant
**Step 4**: Add `tenant_id` WHERE clause to all cafe CRUD queries

## TODO List
- [ ] Create migration 011_saas_tenants.sql
- [ ] Apply migration (scripts/apply-migrations.sh)
- [ ] Create tenant middleware (tenant.ts)
- [ ] Extend auth.ts to inject tenantId into session
- [ ] Add tenant_id filter to all cafe queries (menu, orders, customers, etc.)
- [ ] Test: create 2 tenants, verify data isolation

## Success Criteria
- User registers → `saas_tenants` row auto-created
- `tenantId` available in all route handlers via `c.get('tenantId')`
- All queries scoped by `tenant_id`
- No cross-tenant data access possible

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missed query without tenant filter | Medium | High | Grep all `INSERT`/`UPDATE`/`SELECT` in routes |
| Existing data has no tenant_id | Medium | Medium | Default to `default` tenant for backfill |
| Auth session doesn't carry tenant | Low | High | Add tenantId to JWT payload |

## Security Considerations
- `tenantId` from authenticated session only (never from request params)
- Tenant isolation verified in integration tests
