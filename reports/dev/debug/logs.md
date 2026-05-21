# Logs Report — Git Log + Code Patterns

**Date:** 2026-05-19

---

## Recent Commits (last 20)

| Hash | Message |
|------|---------|
| a32bf47 | feat(admin): loyalty dashboard 8 widgets + CSV export |
| ec2b82f | feat(loyalty): bonus campaigns + idempotency + signup bonus (Task 09) |
| 6dcade2 | Merge PR #25 feat/loyalty-schema-v2-launch |
| 5e497f2 | feat(loyalty): schema v2 — 4 tier + bonus campaigns + idempotency |
| 2365e9e | feat(auth): change-password endpoint |
| 4e10def | feat(mobile): X100 responsive |
| 9c70482 | perf(web): X100 optimize |
| ... | ... (older UI/brand work) |

**Pattern:** 5 commits in loyalty domain in last sprint. High churn = higher bug surface.

---

## console.log / console.error Usage

All `console.*` calls in worker/src are either:
- Gated behind `if (DEBUG)` → fine
- In `cron.js` (unconditional logs): lines 16, 32, 36, 50, 53 → acceptable for cron
- In `loyalty.js:197,204,234` → unconditional `console.error` (non-fatal bonus + referral errors)
- In `index.js:67` → global error handler (intentional)

**No unguarded debug console.log found in hot paths.** Cron logs are noisy but benign.

---

## TODOs / FIXMEs

None found in worker/src/ via grep. The codebase is clean of explicit debt markers.

One comment in `index.js:126`:
> `// ── Seed menu from JSON (temporary — remove after use) ──`

This is a functional issue (unauthenticated endpoint still deployed), not just a comment.

---

## Deprecated Patterns

1. **`auth.js:11`** — `typeof AURA_DEBUG !== 'undefined'` global variable check is
   non-standard for CF Workers (should be `c.env.AURA_DEBUG` but `DEBUG` is module-scope).
   Effectively DEBUG is always `false` at runtime.

2. **`auth.js:145-198`** — `legacyHashPassword` (plain SHA-256 no salt) kept for migration.
   No cleanup path / migration deadline noted. Risk: accounts that never re-login retain
   weak hash indefinitely.

3. **`auth.js:285`** — `'silver'` tier hardcode. v2 changed default to `'bronze'`.
   Not updated in auth flow.

---

## Error Patterns from Commit History

- `fix(hero-task)` commit suggests prior worker context loss — resolved
- No rollback commits or hotfixes in the loyalty sprint (good sign for stability)
- Schema v2 migration (`20260518_03_loyalty_v2_launch.sql`) uses `ALTER TABLE ADD COLUMN`
  which fails silently on re-run (expected, documented in file)

---

## Hardcoded Secrets Scan

**None found.** All sensitive values (`JWT_SECRET`, `PAYOS_*`, `TELEGRAM_*`, `RESET_KEY`)
are accessed via `c.env.*` or `env.*` — Cloudflare Worker secrets binding. Clean.

---

## Dead Code

- `legacyHashPassword` — technically still needed for migration but no automated cleanup
- `app.post('/api/test/telegram-sim', ...)` in index.js — dev testing endpoint, no auth guard
