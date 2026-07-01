---
phase: 3
title: "TS Canonical: Delete Remaining JS Dual Files"
status: pending
priority: P1
dependencies: [2]
effort: 1.5h
---

# Phase 3: TS Canonical — Delete Remaining JS Dual Files

## Overview

Delete the remaining 4 JS files that have TS equivalents: payment.js, audit-log.js, admin-auth.js, cors.js. Update imports in remaining .js route files that reference the shims.

## Requirements

- Functional: All .js routes that imported from admin-auth.js and cors.js now import from auth.ts and cors.ts directly
- Non-functional: Worker builds, all tests pass. No remaining references to deleted files.

## Architecture

```
DELETE these JS files (have TS equivalents):

BEFORE:                               AFTER:
middleware/admin-auth.js (shim)  →   DELETED (import auth.ts directly)
middleware/cors.js (shim)        →   DELETED (import cors.ts directly)
middleware/audit-log.js (buggy)  →   DELETED (audit-log.ts canonical)
routes/payment.js (diverged)     →   DELETED (payments.ts canonical)

UPDATE imports in remaining .js files:
  from './middleware/admin-auth.js'  →  from './middleware/auth'
  from '../middleware/admin-auth.js' →  from '../middleware/auth'
  etc.
```

## Related Code Files

- Delete: `worker/src/routes/payment.js`
- Delete: `worker/src/middleware/audit-log.js`
- Delete: `worker/src/middleware/admin-auth.js`
- Delete: `worker/src/middleware/cors.js`
- Modify: `worker/src/routes/*.js` (22 files) — update imports from admin-auth.js → auth.ts
- Modify: `worker/src/middleware/*.js` — update imports from cors.js → cors.ts (if any)

## Implementation Steps

1. **Find all import references** — `grep -r "admin-auth\|cors\.js\|audit-log\.js\|payment\.js" worker/src/ --include="*.js"`
2. **Update imports batch 1: admin-auth.js → auth** — Replace `from './middleware/admin-auth.js'` → `from './middleware/auth'` in all .js route files
3. **Update imports batch 2: cors.js → cors** — Replace `from './middleware/cors.js'` → `from './middleware/cors'` in all .js files
4. **Verify audit-log divergence** — Compare audit-log.ts (5 cols) vs audit-log.js (13 cols). If .ts is missing columns, add them. If .js has junk columns, drop them.
5. **Delete the 4 JS files** — `git rm` each
6. **Build + test** — `npx tsc --noEmit` 0 errors, all tests pass

## Success Criteria

- [ ] 4 JS files deleted: payment.js, audit-log.js, admin-auth.js, cors.js
- [ ] 0 remaining imports referencing deleted files
- [ ] audit-log.ts has correct schema (resolved divergence)
- [ ] `cd worker && npx tsc --noEmit` — 0 errors
- [ ] All worker tests pass
- [ ] `npm run build` — 0 errors

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| audit-log schema change breaks admin audit views | Check frontend admin pages that read audit_log. If columns differ, write migration SQL. |
| .js route files break on import path change | TypeScript resolves .js imports to .ts at build time. Cloudflare Workers runtime resolves them correctly. |
| Missing import after bulk replace | grep for remaining `admin-auth` references after replace. Build catches stale imports. |
