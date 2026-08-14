# Phase 1: Codebase Lock & Delivery-Safe Boundary Definition

## Overview
**Priority:** P1 — Must complete before any other phase
**Status:** completed

Before modifying anything, create an immutable map of the existing codebase: which files are "cafe operations" (must never break) vs "SaaS-extension zone" (safe to modify). This phase produces a CODEBASE_LOCK document and a git tag to freeze the baseline.

## Key Insights
- Worker index (`worker/src/index.ts:17`) registers 40+ route modules — these are delivery-safe to extend, never remove
- Frontend pages are in `src/pages/` (14 page files + `[locale]` folder for i18n)
- D1 schema (`worker/schema.sql`) has 20+ tables — existing tables must never be DROPped
- Wrangler bindings in `worker/wrangler.toml:6-29` define D1, KV, DO — do NOT change bindings

## Requirements
1. Tags git baseline at `v1.0.0-lock-20260803`
2. Produces `CODEBASE_LOCK.md` in `reports/`
3. Defines file ownership rules: no two phases modify same file
4. Documents all existing API routes as "protected"
5. Defines "SaaS Extension Zone" where new code lives

## Architecture

### CODEBASE_LOCK.md Structure
```
CODEBASE_LOCK.md
├── PROTECTED ZONE (no modification)
│   ├── worker/src/routes/*.ts (existing routes)
│   ├── worker/schema.sql (existing tables)
│   ├── worker/wrangler.toml (bindings)
│   ├── src/pages/*.tsx (cafe pages)
│   └── src/components/cafe-* (existing cafe components)
├── EXTENSION ZONE (safe to modify)
│   ├── worker/src/routes/saaS-*.ts (NEW files)
│   ├── src/pages/saas/*.tsx (NEW files)
│   ├── src/components/saas/* (NEW files)
│   └── src/lib/saas-* (NEW files)
└── SHARED (consult before modifying)
    ├── src/lib/validators.ts
    ├── src/lib/logger.ts
    ├── worker/src/middleware/*.ts
    └── src/stores/*
```

### Git Baseline
```powershell
git tag -a v1.0.0-lock-20260803 -m "baseline: SaaS pivot lock point"
git push origin v1.0.0-lock-20260803
```

## Related Code Files
- `worker/src/index.ts:17` — route registration (do not remove lines)
- `worker/wrangler.toml:6` — D1 database binding
- `worker/schema.sql:1` — D1 schema (append only)
- `src/App.tsx:1` — root router (extend, don't replace)
- `package.json:1` — dependency list (add only)

## Implementation Steps
1. **Scan & catalog**: Grep all existing route paths in `worker/src/routes/*.ts` — produce route inventory
2. **Catalog pages**: Read `src/pages/` and `src/pages/[locale]/` — produce page inventory
3. **Catalog components**: Read `src/components/` subdirs — produce component inventory
4. **Tag baseline**: `git tag -a v1.0.0-lock-20260803`
5. **Write CODEBASE_LOCK.md**: Lock document with protected/extension/shared zones
6. **Write FILE_OWNERSHIP.md**: Phase-to-file mapping (no two phases touch same file)

## Todo List
- [ ] Scan all existing API routes (40+ modules)
- [ ] Catalog all frontend pages (14+ files)
- [ ] Catalog all reusable components
- [ ] Define extension zones in CODEBASE_LOCK.md
- [ ] Git tag baseline v1.0.0-lock-20260803
- [ ] Write FILE_OWNERSHIP.md for phase-to-file mapping

## Success Criteria
- Git tag `v1.0.0-lock-20260803` exists and pushable
- CODEBASE_LOCK.md lists every existing route, page, and component
- FILE_OWNERSHIP.md ensures no file conflicts across phases
- Zero existing functionality modified

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missed edge routes | Medium | High | Grep for `app.` / `router.` patterns in all route files |
| Lock too restrictive | Low | Medium | Extension zone is generous; shared zone allows consult-first changes |
| Git tag not pushed | Low | High | Verify with `git ls-remote --tags` |

## Security Considerations
- No API keys or secrets in CODEBASE_LOCK.md
- Route inventory reveals endpoint structure — safe to document (no auth bypass)
- Git tag provides rollback point to unmodified baseline

## Next Steps
- Output feeds Phase 2 (Asset Inventory)
- FILE_OWNERSHIP.md becomes input for all subsequent phases
