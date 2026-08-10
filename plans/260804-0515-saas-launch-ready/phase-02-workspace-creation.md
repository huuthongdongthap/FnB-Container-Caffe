--- phase: 2
title: "Workspace (Tenant) Creation Flow"
status: completed
priority: P0
effort: "1d"
dependencies: [1]
---

# Phase 02: Workspace (Tenant) Creation Flow

## Overview
Allow any verified-authenticated customer to create a workspace (tenant) via self-service, replacing the owner-only guard.

## Requirements
- Any verified user with role `owner` or `customer` can create tenant
- Unverified users rejected at 403 with email verification prompt
- TenantId persists via X-Tenant-Id header + localStorage on frontend
- After creation, user proceeds to onboarding wizard

## Architecture
- `worker/src/routes/saas-tenants.ts`: middleware stack `requireAuth(['owner','customer'])` then `requireVerifiedEmail` on `/create` sub-path. Role check relaxed to `owner|customer`.
- `worker/src/middleware/tenant.ts`: header-first resolution — reads `X-Tenant-Id` header before falling back to JWT claim.
- Frontend: `src/pages/saas/onboard/tenant-create.tsx` — simple form, POSTs to `/api/saas/tenants/create` with Bearer token, stores tenantId in localStorage, redirects to `/saas/onboard/1`.

## Related Code Files
- Modify: `worker/src/routes/saas-tenants.ts`, `worker/src/middleware/tenant.ts`
- Create: `src/pages/saas/onboard/tenant-create.tsx`

## Implementation Steps
1. Add `requireAuth(['owner','customer'])` + `requireVerifiedEmail` middleware to `POST /create` route.
2. Relax role check in handler body to accept `customer` in addition to `owner`.
3. Update `tenantMiddleware` to read `X-Tenant-Id` request header before session fallback.
4. Frontend: form with business name input → create tenant → store tenantId in localStorage → redirect to wizard.

## Success Criteria
- [x] Verified `owner` or `customer` can create tenant
- [x] Unverified user gets 403 + JSON error with `email_not_verified`
- [x] tenantId sent as `X-Tenant-Id` header by frontend
- [x] Frontend "Create workspace" screen bilingual (VN labels)
