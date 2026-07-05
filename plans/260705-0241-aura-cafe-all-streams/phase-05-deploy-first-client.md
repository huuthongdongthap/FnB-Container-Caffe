---
phase: 5
title: "Deploy + First Client"
status: pending
priority: P2
dependencies: [1, 2, 3, 4]
---

# Phase 5: Deploy + First Client

## Overview

Deploy to production and land the first paying client. The app is already deployed at auraspace.cafe - this phase pushes the Phase 1-4 fixes to production, then uses the aura-deploy CLI to onboard a client.

## Prerequisites

- Phase 1: Token migration complete (visual consistency)
- Phase 2: aura-deploy CLI with deploy + verify commands
- Phase 3: Quality gates accurate, rollback procedure ready
- Phase 4: HelmetHead + i18n gaps closed

## Deployment Model (Scoped)

The app is a single-tenant deployment at `auraspace.cafe`. Multi-tenancy is not implemented. Deployment options for clients:

**Option A: Managed Subdomain (Recommended for first client)**
- Deploy client instance on `{client}.auraspace.cafe` subdomain
- Same Cloudflare account, separate Pages project + Worker
- Operator manages infrastructure; client manages their cafe data
- No client Cloudflare account needed (solves the product doctrine violation)
- Setup: `aura-deploy init --subdomain client-name`

**Option B: Client Self-Deploy (Future capability)**
- Client has their own Cloudflare account
- `aura-deploy init --standalone --domain clientdomain.com`
- Requires client to configure CF account (higher friction)

## Implementation Steps

### Step 1: Pre-deploy checks (30 min)
- `npm run build` - 0 errors
- `npm test` - all 1,091 tests passing
- `npx playwright test` - all 48 E2E tests passing
- Document the current SHA for rollback reference

### Step 2: Deploy to production (15 min)
- `bash deploy-cloudflare.sh`
- Verify: HTTP 200 on auraspace.cafe
- Verify: HTTP 200 on `/api/health`
- Verify: `/api/version` shortSha matches local git HEAD

### Step 3: Dogfood with aura-deploy (30 min)
- Create a second deployment: `aura-deploy init --subdomain test-cafe`
- Run `aura-deploy deploy --project test-cafe`
- Run `aura-deploy verify --url https://test-cafe.auraspace.cafe`
- Document any CLI issues found

### Step 4: Client prospecting (2h)
- Target cafes in Sa Dec missing QR ordering:
  - Container cafes (similar audience to AURA)
  - Coffee shops on Nguyễn Tất Thành street
  - Tea houses with table service
- Outreach via Zalo or direct visit
- Pitch: 15-30M VND setup + 2-5M/month support
- Offer first-month free for early adopter

### Step 5: First client deployment (2h)
- Follow `docs/productization/deployment-checklist.md`
- Use `aura-deploy init` with client's brand info
- Configure PayOS, menu items, staff accounts
- Print table QR codes
- Train staff using `docs/productization/admin-manual.md`

### Step 6: Handover (1h)
- Admin panel access + credentials
- Walk through admin-manual.md
- Schedule Day 3, Day 7, Day 30 follow-ups
- Add to Zalo support channel

## Related Files

- `docs/productization/deployment-checklist.md` - deployment session checklist
- `docs/productization/client-setup-guide.md` - client-facing setup doc
- `docs/productization/admin-manual.md` - admin training manual
- `docs/productization/support-process.md` - support process
- `setup/aura-deploy/` - CLI tool (Phase 2)
- `deploy-cloudflare.sh` - production deploy script
- `scripts/deploy-rollback.sh` - rollback script (Phase 3)

## Success Criteria

- [ ] Production deploy with token + quality fixes rolled out
- [ ] `aura-deploy deploy` works for a second branded instance
- [ ] `aura-deploy verify` reports all checks green
- [ ] At least 1 paying client signed (15-30M VND setup)
- [ ] Client instance running on their subdomain
- [ ] Client can manage orders, menu, staff independently
- [ ] Support process tested and documented

## Commercial Terms

| Item | Price |
|------|-------|
| Setup fee (one-time) | 15-30M VND ($600-1,200) |
| Monthly support | 2-5M VND ($80-200) |
| Annual maintenance | 20-40M VND ($800-1,600) |

## Rollback Plan

If production deploy has issues:
1. `npx wrangler pages deployment list --project-name aura-cafe`
2. `npx wrangler pages rollback <previous-deployment-id>`
3. Verify: `curl -s https://auraspace.cafe` returns previous state
4. Fix issue in local, re-deploy

## Risk Assessment

- Client acquisition is uncertain - focus on warm leads first
- First client deployment will reveal CLI gaps - budget extra time
- Managed subdomain model requires DNS config for *.auraspace.cafe wildcard
- Client churn risk is low (system runs without active support, no lock-in)
- Keep separate git tag per client instance for traceability
