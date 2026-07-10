# Phase 6: Tests + Deploy Integration

**Duration:** 2h | **Agent:** tester

## Requirements

### Tests (50+ new)

| Suite | Count | Focus |
|-------|-------|-------|
| auth | 8 | staff login, PIN validation, role claims, token refresh |
| kds-mobile | 10 | status transitions, role guards, elapsed timer |
| tables-mobile | 8 | status updates, merge (manager), role guards |
| orders-mobile | 10 | create, update, role guards, today filter |
| offline-sync | 8 | queue mutations, replay on reconnect, dedup, TTL |
| notifications | 4 | subscribe, unsubscribe, trigger |
| integration | 4 | KDS update → push, table change → sync |

### Zero Regression Checks
- [ ] All existing `/api/orders` tests pass
- [ ] All existing `/api/kds` tests pass
- [ ] QR ordering `/guest-checkin` + `/checkout` unchanged
- [ ] Existing `/admin/*` routes unchanged
- [ ] No new console.log in production

### Deploy
- [ ] Vite build includes manifest-mobile.json + sw-mobile.js (closeBundle copy)
- [ ] Worker deploy includes new `/mobile/*` routes
- [ ] D1 migration `260710_staff_roles.sql` applied
- [ ] VAPID keys generated and set as env vars
- [ ] Service worker scoped to `/mobile/` — no impact on customer pages

## Run Order

1. Run new tests (vitest run mobile/)
2. Run existing tests (vitest run) — verify zero regression
3. Build (vite build) — verify output includes SW + manifest
4. Deploy (deploy-cloudflare.sh — existing)
