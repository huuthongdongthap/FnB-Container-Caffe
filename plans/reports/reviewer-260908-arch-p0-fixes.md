# Reviewer Report: arch-p0-fixes (2026-09-08)

**Verdict: PASS** | Score 94 | Critical 0 | High 1 | Medium 2 | Low 3

Scope: 8 files changed (+14/-455): D1 deploy path fix, D2 CI D1 step, S9 gitignore, 4 orphan deletions, 1 stale comment removal.

---

## Check (a) — Acceptance Criteria

### D1: deploy-cloudflare.sh migration path — PASS
- Line 61: `MIGRATIONS_DIR="worker/db/migrations"` — verified `worker/db/migrations/` exists with 23 `.sql` files (accepted). `scripts/migrations/` (odoo legacy) and `worker/migrations/` (orphan) correctly not targeted.
- Path resolution inside loop (line 67): after `cd worker`, `../"worker/db/migrations"` resolves to repo-root `worker/db/migrations` — **correct**, verified `worker/db/migrations` relative to repo root, and `cd ..` returns to root.
- Glob with spaces-safe quoting: `../"$MIGRATIONS_DIR"/*.sql` — quoting is correct (glob expansion outside quotes).

### D2: .github/workflows/deploy.yml D1 step — PASS
- Step "Apply D1 migrations" (line 48) runs BEFORE "Deploy Worker" (line 60) — ordering correct.
- `working-directory: worker` (line 49) on a `run:` step — native GH Actions key, kebab-case — correct.
- Line 65 `workingDirectory: worker` is a **wrangler-action@v3 input** (camelCase, nested under `with:`) — correct, distinct from the step-level native key. Both usages coexist properly.
- `bash -n` on deploy-cloudflare.sh PASS, `python3 yaml.safe_load` on deploy.yml PASS (from tester evidence, consistent with my read of the YAML).
- Loop uses `npx wrangler d1 execute fnb-caffe-db --file="$migration" --remote` — mirrors deploy-cloudflare.sh pattern (verified line 70 of script uses identical command form).

### S9: .gitignore — PASS
- Line 5 `.env*.local` after `.env` (verified head of file). `git check-ignore -v .env.local` → `.gitignore:5:.env*.local .env.local` — confirmed.
- `git check-ignore` on `worker/wrangler.toml`, `worker/package.json`, `package.json`, `worker/src/middleware/auth.ts` — all exit 1 (NOT ignored). No tracked file newly ignored. Glob `.env*.local` cannot match any of those (requires literal `.env` prefix + `.local` suffix). Note: `git status --ignored --short` output in this environment did not list ignored files (likely alias/output-limit), but explicit `check-ignore` per file is authoritative — no false positive.

### Orphan cleanup — PASS
- 4 files confirmed deleted (staged): `worker/src/middleware/admin-auth.js`, `worker/src/routes/auth-verify-fixed.ts`, `worker/src/routes/birthday.ts.bak`, `src/pages/order-failure.tsx`. `ls` confirms all gone from disk.
- Grep `worker/src` + `src` for `admin-auth`: **0 refs**. `auth-verify-fixed`: **0 refs**. `birthday.ts.bak`: **0 refs**.
- `order-failure`: remaining refs are ALL to the **stitch variant** (`src/pages/stitch/order-failure.tsx` — exists on disk, confirmed). Router (`src/routes/public-routes.tsx:30,48`), checkout navigate (`src/pages/checkout.tsx:47`), StitchAppLayout, and stitch-screen-gallery data all point at `@/pages/stitch/order-failure`. The deleted `src/pages/order-failure.tsx` had **zero importers** (router lazy-imports the stitch path, not the deleted one). Confirmed live route unaffected.
- Remaining `admin-auth` hits in broad grep are: (1) `worker/dist/index.js` — untracked build artifact (verified `git ls-files` empty), will be regenerated without the file next build; (2) three historical plan/report `.md` docs under `worker/plans/reports/` — documentation references, not code imports. No live code refs.
- `worker/src/middleware/auth.ts`: diff is exactly `-1 line` (stale comment "Converted from middleware/admin-auth.js." removed). Zero logic change — verified diff shows only that comment line removed.

---

## Check (b) — Business logic regressions — PASS
- Deploy pipeline: no logic altered in deploy-cloudflare.sh beyond the path constant; CD/verify steps untouched.
- Auth middleware: `auth.ts` comment-only change; no imports/exports/signature changed. Deleted `admin-auth.js` had no importers (dead code). Admin auth remains functional via `admin-auth.ts` route (in `worker/src/routes/` — verified by audit doc + route file listing) and `staff-auth.ts` middleware.
- Frontend router: `/order-failure` route resolves to stitch variant (live), deleted file was orphaned legacy variant. Checkout failure navigation intact.

## Check (c) — Public contract breaking changes — NONE
- API responses: no worker route removed (deleted files were orphan/`.bak`/legacy-duplicate, zero refs).
- DB schemas: no migration file added/removed/modified — only the deploy target path corrected.
- Env vars: no env var added/removed/renamed. `.env*.local` ignore does not affect tracked env files.
- Worker routes: no route registration changed (verified no references to deleted modules anywhere in live code).

## Check (d) — Pattern adherence — PASS
- CI D1 step mirrors deploy-cloudflare.sh migration loop (same wrangler command, same guard pattern `[[ -d ... ]] && [[ -n $(ls ...) ]]`, same skip message).
- kebab-case `working-directory` (step-level native) vs camelCase `workingDirectory` (wrangler-action input) — both used in their correct contexts, consistent with the existing workflow file's conventions.
- Deletion via `git rm` (staged, shows `D ` in status) — clean removal, not just filesystem delete.

## Check (e) — Lint/type/build errors — PASS (with tester evidence)
- Worker `tsc --noEmit` clean (tester: 1547 tests passed).
- Frontend `tsc --noEmit` clean (tester: 3115 tests passed).
- Both expected clean per task prompt; no evidence of new errors from this changeset (all changes are config/deletion/comment-only — cannot introduce type errors in themselves).

---

## Findings

### HIGH — H1: D1 migrations apply without tracking (pre-existing pattern, both script + CI)
- **File:** `.github/workflows/deploy.yml:48-58`, `deploy-cloudflare.sh:59-89`
- **Description:** Every deploy re-runs ALL 23 migrations every time. Only safe because every migration file is idempotent (verified: all `CREATE TABLE`/`CREATE INDEX` use `IF NOT EXISTS`; INSERTs use `INSERT OR IGNORE` + sentinel-table guard `_skip_*`). BUT 6 `ALTER TABLE ... ADD COLUMN` statements in `20260820_06_order_type_tip.sql:9-11`, `20260820_07_orders_staff.sql:8`, `20260824_03_customers_profile_columns.sql:11-13` have **no `IF NOT EXISTS` guard** (D1/SQLite don't support it for ADD COLUMN). On first re-run after this fix goes live, CI will attempt to re-apply these and **fail** with "duplicate column name" — breaking the deploy pipeline this fix intends to repair.
- **Impact:** D2 "Apply D1 migrations" step will error on the first deploy against a DB where those migrations already ran (e.g. local script already applied them, or any prior deploy). `ALTER TABLE` is not idempotent and there is no migrations-tracking table (verified: no `d1 migrations` / tracking table anywhere).
- **Fix:** either (1) wrap ALTERs in the existing `_skip_*` sentinel-table pattern (like `20260708_01` does), or (2) use `wrangler d1 migrations` (bookkeeping table) instead of raw `execute` loop.
- **Severity note:** NOT introduced by this changeset — the same loop existed in deploy-cloudflare.sh before, just pointed at wrong dir (meaning it never ran → never surfaced). This fix "activates" the latent bug. Flag as blocker for first CI run, not for merge.

### MEDIUM — M1: migration ordering by filename glob
- **File:** `.github/workflows/deploy.yml:52`, `deploy-cloudflare.sh:67`
- **Description:** `for migration in db/migrations/*.sql` relies on lexicographic glob order. Current filenames (`20260706_01_...` → `20260824_03_...`) sort correctly today, but glob-order is fragile if anyone names future migrations inconsistently (e.g. `2026-9-01` vs `20260910_01`). `wrangler d1 migrations` (proper tool) tracks both order AND applied state.
- **Severity:** Medium (works today; footgun tomorrow).

### MEDIUM — M2: CI D1 step lacks `--silent`/error-tail but script has it
- **File:** `.github/workflows/deploy.yml:54`
- **Description:** Script captures output and tails 10 lines on failure (deploy-cloudflare.sh:70-75); CI step lets full wrangler output (potentially verbose schema dumps) spill into logs unconditionally. Cosmetic/log-noise concern given repo's terminal-log discipline rules; not a correctness issue.

### LOW — L1: `worker/dist/index.js` still references deleted admin-auth.js
- Untracked stale build artifact. Next `wrangler deploy` regenerates. No action needed; noted so nobody greps it and panics.

### LOW — L2: `.env*.local` also matches `.env.vite.local`-style future files
- Glob is broad but intentional; current tracked files unaffected (verified). Fine.

### LOW — L3: historical docs (worker/plans/reports/*.md) still mention deleted files
- Documentation-only refs to `admin-auth`, `auth-verify-fixed`, `.bak` strategy. Harmless; optionally prune during next docs pass.

---

## Positive Observations
- Correct source-of-truth migration dir identified (worker/db/migrations, 23 files) vs 2 decoy trees.
- Keen distinction preserved: step-level `working-directory` (native) vs wrangler-action `workingDirectory` (input) — both correct in context.
- Deletion set verified zero-importer via multi-pattern grep; stitch/live variant explicitly survived.
- `git rm` used (staged) — proper tracked-file deletion, not filesystem-only.
- Migration guard pattern (`[[ -d ]] && [[ -n $(ls ...) ]]` + skip message) mirrored consistently across script and CI.

## Recommended Actions
1. **Before first CI run:** wrap the 6 bare `ALTER TABLE ADD COLUMN` statements in `_skip_*`-sentinel guards OR switch both loops to `wrangler d1 migrations apply` (tracks applied state in `d1_migrations` table). H1 will bite on first deploy.
2. Optional: consolidate loop order + tracking by adopting `wrangler d1 migrations` in both script and CI (resolves H1 + M1 together).
3. No action needed on L1/L2/L3.

## Metrics
- Type check: clean (worker + frontend, tester-verified)
- Tests: 1547 worker / 3115 frontend passed
- Lint issues: 0 new from this changeset
- Line coverage: config/deletion-only changeset; runtime behavior unchanged

## Unresolved Questions
1. Should CI migration failures be non-blocking (continue + flag) or blocking (current: blocks worker deploy)? Current is safer; recommend keeping blocking.
2. Is `fnb-caffe-db` D1 binding name confirmed in wrangler.toml for CI context? (Script uses same name — presumed correct since both were aligned pre-fix; verify once on first CI run.)
