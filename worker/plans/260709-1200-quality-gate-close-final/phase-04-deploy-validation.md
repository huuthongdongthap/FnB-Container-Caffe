# Phase 4: Deploy Contract Validation

## Requirements
Verify the deploy pipeline works end-to-end.

## Steps
1. `git push origin main` (required by deploy-with-sha.sh)
2. `cd worker && npm run deploy:full`
3. Verify `/api/version` `shortSha` matches `git rev-parse HEAD | cut -c1-8`
4. Check HTTP 200 on production URL

## Acceptance
- deploy:full exit 0
- SHA match confirmed
- Production returns 200
