# Plan: Fix CI/CD Failures + Commit Verification

**Created:** 2026-08-14 18:26 (Asia/Saigon)
**Repo:** FnB-Container-Caffe
**Branch:** main

## Current State

| Check | Status |
|-------|--------|
| CI (ESLint) | 🔴 FAIL — 9 errors (`quotes` rule) |
| Deploy (Pages) | 🟢 Would pass (untested, blocked by worker) |
| Deploy (Worker) | 🔴 FAIL — `npm ci --silent` exit code 1 |
| Commit Verification | 🟡 All commits `verified: false` (GPG key not linked) |
| Local vs Remote | 🟡 1 unpushed commit |

## Root Causes

1. **ESLint `quotes` rule**: Double-quotes in `error-handler.ts` + `momo.ts`. Auto-fixable.
2. **Worker `npm ci`**: Lock file mismatch or `--silent` flag issue. Needs investigation.
3. **GPG key not linked**: Commits signed but GitHub can't verify — key not added to GitHub account settings.

---

## Phase 1: Fix ESLint Errors (CI)

**Files:**
- `worker/src/middleware/error-handler.ts` (4 errors)
- `worker/src/routes/webhooks/momo.ts` (5 errors)

**Steps:**
1. Run `npm run lint:fix` — auto-fixes all 9 `quotes` errors
2. Run `npm run lint` — verify 0 errors, only warnings remain
3. Commit: `fix(lint): resolve ESLint single-quote errors in worker`

**Success:** `npm run lint` exits 0

---

## Phase 2: Fix Worker Deploy (Deploy)

**Investigation:**
1. Check `worker/package-lock.json` vs `worker/package.json` for mismatch
2. Run `cd worker && npm ci` locally — check for errors
3. If lock file stale: `cd worker && npm install && commit lock file`
4. If `--silent` is the issue: remove `--silent` from workflow OR keep and fix root cause

**Steps:**
1. Test `cd worker && npm ci` locally
2. Fix any lock file issues
3. Commit fix
4. Verify CI/Deploy pass on GitHub

**Success:** Deploy workflow passes

---

## Phase 3: Push + Verify

**Steps:**
1. Push all fixes to `origin/main`
2. Wait for CI + Deploy workflows to complete
3. Verify both show ✅ on GitHub

**Success:** All workflows green

---

## Phase 4: Link GPG Key (Commit Verification)

**Manual steps (user action required):**
1. Export public key: `gpg --armor --export <KEY_ID>`
2. Go to GitHub → Settings → SSH and GPG keys → New GPG key
3. Paste public key
4. Configure git to use GPG key:
   ```bash
   git config --global user.signingkey <KEY_ID>
   git config --global commit.gpgsign true
   ```
5. Re-sign existing commits (optional — `git rebase -i` + `git commit --amend -S`)

**Note:** GitHub requires the GPG key to be added to the account. Signing alone isn't enough — the key must be registered.

---

## Phase 5: Push Unpushed Commit

**Steps:**
1. Push `4773291` (test fix) to origin
2. Verify it shows on GitHub

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `npm run lint:fix` changes more than expected | Low | Only `quotes` rule auto-fixable, review diff |
| Worker deploy fails for other reasons | Medium | Check logs after fix, may need wrangler auth |
| GPG key linking requires GitHub UI | Low | Manual step, clear instructions above |

## Unresolved Questions

- Why does `worker/npm ci` fail? Need to test locally.
- Is the `CLOUDFLARE_API_TOKEN` secret still valid in GitHub?
