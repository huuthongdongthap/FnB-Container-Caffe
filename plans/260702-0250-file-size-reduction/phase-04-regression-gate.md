---
phase: 4
title: Phase 4 — Regression Gate + Final Verification
status: completed
priority: P0
effort: 1h
dependencies: [1, 2, 3]
---

# Phase 4: Regression Gate

Final verification after all 10 files extracted. Must be 100% green.

## Checks

### 1. File Size Audit
```bash
wc -l worker/src/routes/subscriptions.ts worker/src/routes/loyalty.ts worker/src/routes/orders.ts worker/src/routes/auth.ts worker/src/routes/mautic-bridge.ts worker/src/routes/mixpost.ts worker/src/routes/referrals.ts worker/src/routes/pretix.ts worker/src/routes/zalo.ts worker/src/routes/cal-booking-webhook.ts
```
Must show all ≤ 200 lines.

### 2. Test Gate
```bash
npm test
```
Must pass 1,033+/1,033 (should match or exceed pre-refactor count).

### 3. Build Gate
```bash
npm run build
```
Must exit 0.

### 4. Worker Type Check
```bash
cd worker && npx tsc --noEmit
```
Must exit 0 with no errors.

### 5. Export Contract Audit
Verify all exports consumed by `worker/src/index.ts` are preserved:

```bash
# orders.ts exports (used directly in index.ts)
grep -n "export.*\(createOrder\|getOrder\|updateOrder\|getLatestOrderTimestamp\|getAdminOrders\|getStats\|notifyTelegram\)" worker/src/routes/orders.ts

# auth.ts exports (used directly in index.ts)
grep -n "export.*\(registerUser\|loginUser\|logoutUser\|getCurrentUser\|registerStaff\|listStaff\|bootstrapOwner\|resetPassword\|changePassword\)" worker/src/routes/auth.ts

# mixpost.ts exports
grep -n "export.*\(handleMixpostRequest\|autoPostDailySpecials\|autoPostNewPromotions\|autoPostWeeklyHighlights\)" worker/src/routes/mixpost.ts

# mautic-bridge.ts exports
grep -n "export.*\(handleMauticBridgeRequest\|detectWinbackCandidates\|detectBirthdayCandidates\|syncMauticContacts\|toMauticContact\|triggerPromoCampaign\)" worker/src/routes/mautic-bridge.ts
```

### 6. :any Audit
```bash
grep -rn ":any\|as any" worker/src/tree/ --include="*.ts" | wc -l
```
Should be 0 in new tree/ modules. (Pre-existing any's in routes/ are the 8 known excluded-scope instances.)

### 7. Tree Module Count
```bash
find worker/src/tree -name "*.ts" | wc -l
```
Should show 35+ tree modules created.

### 8. Import Path Audit
No route file should import from another route file. No tree module should import from routes/. All tree modules import from seed/lib/tree only.

```bash
grep -rn "from '\.\./routes\|from '\./routes" worker/src/tree/
```
Must return empty.

## Success Criteria

- [ ] All 10 route files ≤ 200 lines
- [ ] 1,033+ tests pass (0 regressions)
- [ ] Build: 0 errors
- [ ] Worker type check: 0 errors
- [ ] All index.ts import contracts preserved
- [ ] Zero new `:any` in tree/ modules
- [ ] No circular deps (tree → routes forbidden)
- [ ] ~35 new tree/ files, all following kebab-case naming
