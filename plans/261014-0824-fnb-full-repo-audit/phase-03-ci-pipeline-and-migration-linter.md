# Phase 03: CI Pipeline & Migration Linter

## Context Links
- Master Plan: [plan.md](plan.md)
- Audit Findings: [phase-01-audit-findings-and-severity-matrix.md](phase-01-audit-findings-and-severity-matrix.md)
- GitHub Actions CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Deployment Policy: [packages/domain/deployment/src/policies/deployment-policy.ts](../../packages/domain/deployment/src/policies/deployment-policy.ts)

---

## Overview
- **Priority:** P2 Medium
- **Current Status:** Complete
- **Description:** Close pipeline gaps in GitHub Actions by adding frontend production build verification and static SQL migration sequence linting prior to deployment.

---

## Key Insights
1. **Frontend Build Verification**: Current `ci.yml` runs typechecks and vitest, but does not run `npm run build` (Vite/Rollup bundle generation). A subtle asset import or terser plugin syntax mismatch could pass typechecking but break at bundle time.
2. **Migration Sequence Linting**: The database engine (Cloudflare D1) requires strict, sequential, idempotent SQL migration files under `worker/db/migrations/`.
3. **Contract Logic Exists**: Invariant checks for migration gaps, duplicate timestamps, and destructive schema changes are already coded in `@aura/domain-deployment` (`packages/domain/deployment/src/policies/deployment-policy.ts:96-130`). Wiring this logic as an automated script prevents broken migrations from merging into `main`.

---

## Architecture & Pipeline Plan

### 1. GitHub Actions Workflow Enhancement (`.github/workflows/ci.yml`)
Add the following steps to the `lint-and-test` job:
```yaml
    - name: Validate D1 Migration Sequence
      run: npm run lint:migrations

    - name: Production Bundle Build (Vite)
      run: npm run build
```

### 2. Standalone Migration Linter Script
Wire a dedicated package.json script:
```json
"lint:migrations": "node scripts/lint-d1-migrations.mjs"
```
Rules verified:
- Monotonic timestamp/prefix ordering (`YYYYMMDD_XX_*.sql`).
- Idempotency guards (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- Zero un-sandboxed `DROP TABLE` or destructive column truncations.

---

## Todo List
- [x] Create `scripts/lint-d1-migrations.mjs` executing migration contract validation
- [x] Add `npm run lint:migrations` script to `package.json`
- [x] Add migration lint step to `.github/workflows/ci.yml`
- [x] Add `npm run build` production bundle step to `.github/workflows/ci.yml`
- [x] Validate locally in dry-run mode

---

## Success Criteria
- CI runs migration lint and Vite production build on every pull request.
- Broken migrations and bundle regressions blocked before merge.

---

## Next Steps
Proceed to Phase 04 for staging smoke verification checklist and production go-live gates.
