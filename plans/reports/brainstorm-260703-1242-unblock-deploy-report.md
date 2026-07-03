# Brainstorm: Next — Unblock Push + Deploy to Production

**Date:** 2026-07-03T12:42
**Status:** Approved → Quick action

## Problem

3-stream work (Analytics Dashboard + UI/UX Fix + Image Optimization) is committed but cannot be pushed to GitHub. Push protection blocks due to GCP API key in old commit `71e71bdf` (`.mcp.json:7`).

Fix already applied in latest commit `c1ad62e` — key removed from file. But old commit still flagged by GitHub push protection.

## Chosen Approach

**Unblock push → Deploy to production**

1. Git filter-branch to strip the key from commit `71e71bdf`
2. Force push with `--force` (branch not yet shared)
3. `git push origin main`
4. `npm run deploy:full` to Cloudflare

## Success Criteria

- [ ] Push succeeds to GitHub (0 secret violations)
- [ ] `npm run build` passes before deploy
- [ ] Production deploy exits 0
- [ ] `/api/version` returns new shortSha
