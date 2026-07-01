---
phase: 5
title: "Atomic Deploy + Verify"
status: completed
priority: P2
dependencies: [4]
effort: 2-3h
---

# Phase 5: Atomic Deploy + Verify

## Overview

Deploy via `bash deploy-cloudflare.sh` to Cloudflare Pages + Workers. Create `/api/version` route for SHA verification. Walk all protected flows (including PayOS payment). Verify legacy `.html` URLs redirect correctly. Archive all superseded plans.

## TDD Structure

```
Step A: Create /api/version route    → worker endpoint returning CF_PAGES_COMMIT_SHA
Step B: Deploy smoke test            → verify build + tests green
Step C: Atomic production deploy     → bash deploy-cloudflare.sh
Step D: SHA verification             → local SHA vs live /api/version
Step E: Protected flow walkthrough   → 6 customer-facing flows (incl. PayOS)
Step F: Legacy redirect test         → verify .html → SPA 301 redirects
Step G: Health check                 → HTTP 200, CSP, HSTS
Step H: Archive + cleanup            → mark superseded plans complete
Step I: Regression Gate              → all tests still green, deploy verified
```

## Requirements

- Functional: `bash deploy-cloudflare.sh` must succeed with exit 0
- Functional: `/api/version` returns `CF_PAGES_COMMIT_SHA` matching local `git rev-parse HEAD`
- Functional: HTTP 200 on production URL
- Functional: All 6 protected flows work end-to-end (including PayOS payment)
- Functional: Legacy .html URLs redirect 301 → SPA routes
- Non-functional: Minimal downtime (Cloudflare Pages atomic swap for SPA, Worker deploy may have brief cold start)

## Architecture

```
Deploy Flow
├── Step 1: Create /api/version worker route (before deploy — see Step A)
├── Step 2: git push origin main
├── Step 3: bash deploy-cloudflare.sh
│   ├── Build React SPA (npm run build → Vite)
│   ├── cp -r assets dist/ (IMPORTANT: only images/fonts — verify no .html copied)
│   ├── Deploy to Cloudflare Pages (wrangler pages deploy)
│   └── Deploy Worker (wrangler deploy) — ⚠️ version skew: Worker may deploy AFTER Pages
├── Step 4: Verify SHA
│   ├── LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
│   ├── LIVE_SHA=$(curl -s https://aura.cafe/api/version | jq -r '.shortSha')
│   └── assert LOCAL_SHA === LIVE_SHA
├── Step 5: Walk Protected Flows (6 flows)
│   ├── Checkout: browse menu → add to cart → PayOS payment → success page
│   ├── Loyalty: sign in → view tier → view points → redeem cashback (modal)
│   ├── Reservation: book table → confirm → view reservation
│   ├── KDS: place order → verify appears on KDS screen
│   ├── POS: admin login → create order → process payment
│   └── PayOS: verify API connection, test webhook IPN endpoint
├── Step 6: Verify Legacy Redirects
│   ├── Test wildcard: /menu.html → 301 → /menu
│   ├── Test exception: /checkout.html → 301 → /checkout?payment=pending
│   ├── Test exception: /brand-guideline.html → 301 → /brand
│   ├── Test exception: /index-legacy.html → 301 → /
│   ├── Test exception: /signup/index.html → 301 → /signup
│   ├── Test /admin/login.html → 301 → /admin/login
│   └── (spot-check 5 more from parity matrix)
├── Step 7: Health Check
│   ├── https://aura.cafe → 200
│   ├── https://aura.cafe/api/health → 200
│   ├── https://aura.cafe/api/version → 200 + SHA
│   └── https://aura.cafe/admin/dashboard → 200 (auth redirect OK)
└── Step 8: Archive Old Plans (already done pre-plan)
```

## Related Code Files

- Create: `worker/src/routes/version.ts` (new `/api/version` endpoint)
- Modify: `worker/src/index.ts` (register `/api/version` route)
- Deploy: `deploy-cloudflare.sh` (review before running)
- Verify: `_redirects` (in deployed `dist/` output)
- Verify: `_headers` (CSP, HSTS)

## Implementation Steps

### Step A: Create `/api/version` Route (BEFORE deploy)
1. Create `worker/src/routes/version.ts`:
   ```ts
   import { Hono } from 'hono';
   const app = new Hono();
   app.get('/api/version', (c) => {
     return c.json({
       shortSha: (c.env?.CF_PAGES_COMMIT_SHA as string || 'unknown').slice(0, 8),
       commitSha: c.env?.CF_PAGES_COMMIT_SHA || 'unknown',
       timestamp: Date.now(),
     });
   });
   export default app;
   ```
2. Register in `worker/src/index.ts`: `app.route('/', versionRoute)`
3. Verify locally: `curl http://localhost:8787/api/version`
4. Note: `CF_PAGES_COMMIT_SHA` is injected by Cloudflare Pages on deploy

### Step B: Deploy Smoke Test
1. Run `npm run build` — confirm 0 errors
2. Run `npm test` — confirm 100% pass
3. Run `npx playwright test` — confirm 100% pass
4. Verify `dist/_redirects` exists in build output
5. Verify `find dist -name "*.html"` returns only `dist/index.html`

### Step C: Push + Production Deploy
1. `git push origin main` — push all commits
2. `bash deploy-cloudflare.sh` — must exit 0
3. Wait for Cloudflare Pages deploy to complete (1-2 min)
4. ⚠️ **Version skew risk:** Pages deploys before Worker. If new SPA calls new Worker routes, there's a brief window where Worker hasn't been updated yet. Mitigation: TS conversion (Phase 3) doesn't add new routes — only types existing ones.

### Step D: SHA Verification
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://aura.cafe/api/version | jq -r '.shortSha')
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
# Must match. If mismatch: check deploy logs, re-deploy if needed.
# CF_PAGES_COMMIT_SHA takes effect on next Pages deploy — may need Worker re-deploy
```

### Step E: Protected Flow Walkthrough
1. **Checkout Flow:**
   - Navigate to `/menu` → select items → add to cart
   - Go to `/checkout` → review order → verify `?payment=pending` query param handled
   - Process payment → verify success page at `/order-success`
   - Status: ✅ / ❌ (document result)
2. **PayOS Payment:**
   - Verify `_headers` CSP includes `https://api-merchant.payos.vn` in `connect-src`
   - Test payment initiation → verify redirect to PayOS
   - Test webhook IPN endpoint receives POST
   - Status: ✅ / ❌
3. **Loyalty Flow:**
   - Navigate to `/loyalty` → sign in with phone
   - View tier card → verify points balance
   - Test cashback redemption modal (NOT window.prompt)
   - Status: ✅ / ❌
4. **Reservation Flow:**
   - Navigate to `/table-reservation` → select date/time
   - Choose table from seat grid → confirm booking
   - Verify reservation appears in `/admin/reservations`
   - Status: ✅ / ❌
5. **KDS (Kitchen Display System):**
   - Place order from POS → verify appears on KDS screen
   - Mark order as preparing → ready → served
   - Status: ✅ / ❌
6. **POS (Point of Sale):**
   - Login to `/admin/login` → navigate to `/admin/pos`
   - Create order → add items → process payment
   - Verify order appears in `/admin/orders`
   - Status: ✅ / ❌

### Step F: Legacy Redirect Verification
```bash
# Test wildcard .html → SPA redirects
curl -sI https://aura.cafe/menu.html | grep "HTTP/2 301"
curl -sI https://aura.cafe/about-us.html | grep "HTTP/2 301"
curl -sI https://aura.cafe/loyalty.html | grep "HTTP/2 301"
curl -sI https://aura.cafe/events.html | grep "HTTP/2 301"
curl -sI https://aura.cafe/checkout.html | grep "HTTP/2 301"
curl -sI https://aura.cafe/admin/login.html | grep "HTTP/2 301"

# Test SPA fallback (unknown route → index.html with 200)
curl -sI https://aura.cafe/some-unknown-route | grep "HTTP/2 200"

# Test security blocks
curl -sI https://aura.cafe/docs/secret | grep "HTTP/2 404"
curl -sI https://aura.cafe/worker/config | grep "HTTP/2 404"
```

### Step G: Health Check
1. `curl -sI https://aura.cafe` → HTTP 200
2. `curl -s https://aura.cafe/api/health` → JSON with status "ok"
3. `curl -sI https://aura.cafe/admin/dashboard` → HTTP 200 (auth redirect to login is OK)
4. Check CSP headers: `curl -sI https://aura.cafe | grep -i content-security`
5. Check HSTS: `curl -sI https://aura.cafe | grep -i strict-transport`

### Step H: Archive Superseded Plans
(Already done pre-plan — verify status is correct)
1. Verify `260701-0942-fnb-fullstack-redesign`: status = cancelled
2. Verify `260701-1259-housekeeping-sprint`: status = cancelled
3. Verify `260701-1655-x100-design-polish`: status = completed

### Step I: Regression Gate
1. Confirm SHA still matches (no drift between verification and this step)
2. `npm test` — still 100% pass
3. `npx playwright test` — still 100% pass
4. All 5 protected flows still working
5. Legacy redirects still correct

## Test Scenario Matrix

| Check | Method | Expected |
|-------|--------|----------|
| Deploy exit code | `bash deploy-cloudflare.sh` | 0 |
| SHA match | `/api/version` vs `git rev-parse` | identical |
| HTTP status | `curl -sI https://aura.cafe` | 200 |
| API version | `curl https://aura.cafe/api/version` | `{"shortSha":"...","commitSha":"..."}` |
| Checkout flow | Manual walkthrough | ✅ complete |
| PayOS payment | Webhook IPN test | ✅ working |
| Loyalty flow | Manual walkthrough | ✅ complete |
| Reservation flow | Manual walkthrough | ✅ complete |
| KDS flow | Manual walkthrough | ✅ complete |
| POS flow | Manual walkthrough | ✅ complete |
| .html → SPA redirect | `curl -sI` | 301 |
| Security blocks | `curl -sI` | 404 |
| SPA fallback | `curl -sI /unknown` | 200 |

## Success Criteria

- [ ] `bash deploy-cloudflare.sh` exit 0
- [ ] `/api/version` returns SHA matching local `git rev-parse HEAD`
- [ ] HTTP 200 on production URL
- [ ] All 6 protected flows verified working (incl. PayOS)
- [ ] Legacy .html URLs redirect 301 → SPA routes
- [ ] `signage-widgets/*.html` still accessible (NOT deleted)
- [ ] Security blocks return 404
- [ ] CSP + HSTS headers present
- [ ] `npm test` + `npx playwright test` still 100% green

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Deploy fails mid-way | High | Cloudflare Pages atomic deploy — old version stays live. Worker deploy is separate; old Worker keeps serving |
| Version skew (Pages vs Worker) | Medium | Pages deploys before Worker in `deploy-cloudflare.sh`. Phase 3 doesn't add new routes, only adds types. Old Worker handles new SPA requests. If race condition: wait 2 min, test, re-deploy Worker if needed |
| SHA mismatch after deploy | Medium | `CF_PAGES_COMMIT_SHA` injected at Pages deploy time. Worker may lag behind. Use Pages deploy SHA as source of truth |
| Protected flow broken | Critical | Rollback: `wrangler pages deploy --project-name=fnb-caffe-container` with previous commit |
| Legacy redirect doesn't work | Medium | Verify `dist/_redirects` exists after build. Explicit exceptions tested before wildcard |
| PayOS webhook broken | High | CSP `connect-src` must include `api-merchant.payos.vn`. Test IPN webhook after deploy |
| CSP too strict after removing legacy files | Medium | Check browser console for CSP violations. Relax if needed |
