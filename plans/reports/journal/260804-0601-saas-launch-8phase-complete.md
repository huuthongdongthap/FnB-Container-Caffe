---
**Date**: 2026-08-04 05:15
**Severity**: High
**Component**: SaaS Platform (FnB Container Caffe)
**Status**: Resolved (pending deploy + smoke validation)
---

# SaaS Launch Plan — 8-Phase Completion

## What Happened

All 8 phases of the SaaS launch plan shipped and merged to main. The platform now supports end-to-end self-service onboarding: registration with email verification, workspace creation, subscription billing via NowPayments, a 4-step onboarding wizard, billing history with receipt download, subscription cancellation UX, and a smoke test suite. The implementation touches 12+ files across Hono worker routes, React pages, email verification middleware, and D1 migration `012_email_verification.sql`.

## The Brutal Truth

What should have been a clean 8-phase rollout turned into a late-stage fix in phases 01/02. The original auth flow assumed owner-only registration with hardcoded role assignment. Mid-stream we refactored to `requireVerifiedEmail` middleware so any verified user can create tenants. That single design mismatch triggered a full re-review of `auth-register.ts` and `saas-tenants.ts`. Not catastrophic, but the kind of "we should have designed for multi-tenant from day one" pain that lingers.

## Technical Details

- **Migration**: `worker/migrations/012_email_verification.sql` (added `email_verified`, `verification_token`, `verification_expires` columns on users table)
- **New routes**: `auth-register.ts` (`registerWithVerification`), `auth-verify.ts` (`verifyEmail`), `auth-session.ts` (`getAuthSession`), `subscription-receipt.ts` (`GET /api/subscriptions/:id/receipt`)
- **Dashboard**: `src/pages/saas/dashboard/index.tsx` — subscription status card, invoice table, cancel modal with confirmation
- **Onboarding**: `src/pages/saas/onboard/index.tsx` — 4-step wizard (business name → container size → zone → confirmation)
- **Smoke artifacts**: `scripts/smoke-saas.sh`, `smoke-checklist.md`
- **IPN**: `nowPaymentsIPN` handler in subscriptions route, with manual fallback for edge cases

## What We Tried

1. Owner-only registration initially — abandoned when we realized multi-tenant was the actual requirement
2. `requireAuth` alone for tenant creation — rejected because unverified emails could create workspaces
3. Final: `requireVerifiedEmail` middleware — verified users can create tenants, unverified users get 403

## Root Cause Analysis

The fundamental mistake was designing auth around a single-tenant assumption. Phase 02 forced us to confront this when replacing the owner-only guard. This wasn't a bug — it was a spec gap that became visible only when we started wiring the remaining phases. The fix was correct and the refactor was clean, but it should have been caught in the planning phase of phase 01.

## Lessons Learned

- Design auth flows for multi-tenant from the start, even if the MVP seems single-tenant
- Read the full spec before implementing phase 01 — the requirements for phases 03-08 imply multi-tenancy
- Mid-stream API signature changes (`requireAuth` → `requireVerifiedEmail`) should trigger a spec review, not just a code change
- The `requireAuth` → `requireVerifiedEmail` refactor was the right call but should have been planned upfront

## Next Steps

1. **Deploy to Cloudflare Workers**: run `npm run deploy:full` from `apps/sophia-ai-factory/`
2. **Run smoke-saas.sh against live env**: execute `scripts/smoke-saas.sh` with production URL
3. **Verify NowPayments IPN**: test a fresh subscription flow end-to-end on staging first
4. **Apply migration 012**: `bash scripts/apply-migrations.sh` if not already applied
5. **Confirm email delivery**: verify verification emails reach inbox (not spam) — test with real email provider
6. **Monitor for 24h post-deploy**: watch `/api/version` SHA match and error rates
