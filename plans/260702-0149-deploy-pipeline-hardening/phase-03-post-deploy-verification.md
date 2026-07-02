---
title: "Phase 03 — Post-deploy Verification"
description: "Auto-verify /api/health returns 200 and /api/version SHA matches local git HEAD after deploy"
status: completed
priority: P2
effort: 1h
phase: 03
depends_on: [01, 02]
blocks: []
---

## Overview

After deploying the Worker, `deploy-cloudflare.sh` must automatically verify:
1. `/api/health` returns HTTP 200
2. `/api/version` `shortSha` matches local `git rev-parse HEAD`

Fail the deploy script (non-zero exit) if either check fails.

## Current State

**File:** `deploy-cloudflare.sh:27-36`

The worker deploy section just runs `wrangler deploy` and exits. No verification step exists. The script uses `set -euo pipefail` so any failure will halt.

## Requirements

- After worker deploy, curl `/api/health` with timeout (5s), verify HTTP 200
- After worker deploy, curl `/api/version`, extract `shortSha`, compare to `git rev-parse HEAD | cut -c1-8`
- Retry up to 3 times with 3s delay between (Cloudflare takes seconds to propagate)
- `--skip-verify` flag to bypass (for emergency deploys where health endpoint itself is broken)
- Verbose output: print what was expected vs actual on mismatch
- Worker URL must be configurable (hardcoded default + env var override)

## Worker URL

**Default:** `https://aura-space-worker.agencyos-openclaw.workers.dev`
**Override:** `DEPLOY_HEALTH_URL` environment variable

The Pages deploy (`[2/3]`) does not need health verification — Pages is static hosting. Only the Worker is verified.

## Implementation Steps

### Step 1: Add verification function to `deploy-cloudflare.sh`

Insert after the worker deploy section (line 33 `cd ..`):

```bash
# ── 3b. Post-deploy verification ──────────────────────────────────────────
if [[ "${1:-}" != "--skip-verify" && "${2:-}" != "--skip-verify" && "${3:-}" != "--skip-verify" ]]; then
  WORKER_URL="${DEPLOY_HEALTH_URL:-https://aura-space-worker.agencyos-openclaw.workers.dev}"
  LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
  MAX_RETRIES=3
  RETRY_DELAY=3

  echo ""
  echo "--- Post-deploy Verification ---"
  echo "Worker URL: $WORKER_URL"

  # Check 1: Health endpoint
  for i in $(seq 1 $MAX_RETRIES); do
    echo "[Verify $i/$MAX_RETRIES] Checking /api/health..."
    HEALTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$WORKER_URL/api/health" 2>/dev/null || echo "000")
    if [[ "$HEALTH_STATUS" == "200" ]]; then
      echo "  Health: OK (HTTP $HEALTH_STATUS)"
      break
    fi
    if [[ $i -lt $MAX_RETRIES ]]; then
      echo "  Health: Got HTTP $HEALTH_STATUS, retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
    else
      echo "  Health: FAILED after $MAX_RETRIES attempts (HTTP $HEALTH_STATUS)"
      echo "ERROR: Health endpoint not healthy. Deploy may have failed."
      exit 1
    fi
  done

  # Check 2: Version SHA match
  for i in $(seq 1 $MAX_RETRIES); do
    echo "[Verify $i/$MAX_RETRIES] Checking /api/version SHA match..."
    VERSION_JSON=$(curl -s --max-time 5 "$WORKER_URL/api/version" 2>/dev/null || echo '{}')
    LIVE_SHA=$(echo "$VERSION_JSON" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "MISSING")

    if [[ "$LIVE_SHA" == "$LOCAL_SHA" ]]; then
      echo "  SHA Match: $LIVE_SHA == $LOCAL_SHA"
      break
    fi
    if [[ $i -lt $MAX_RETRIES ]]; then
      echo "  SHA Mismatch: live=$LIVE_SHA local=$LOCAL_SHA, retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
    else
      echo "  SHA MISMATCH after $MAX_RETRIES attempts: live=$LIVE_SHA local=$LOCAL_SHA"
      echo "ERROR: Deployed version does not match local commit. Deploy may not have propagated."
      exit 1
    fi
  done

  echo "--- Verification PASSED ---"
else
  echo "Skipping post-deploy verification (--skip-verify flag)"
fi
```

### Step 2: Update usage comment

Add `[--skip-verify]` to the usage line.

### Step 3: Add `--worker-only` flow awareness

The verification must only run when the worker is deployed. The `--pages-only` flag skips worker deploy entirely, so verification is implicitly skipped too. No extra logic needed — the `cd "$WORKER_DIR"` block is gated by `--pages-only` check already.

### Step 4: Verify manually

```bash
# Test health endpoint
curl -s -o /dev/null -w '%{http_code}' https://aura-space-worker.agencyos-openclaw.workers.dev/api/health

# Test version endpoint
curl -s https://aura-space-worker.agencyos-openclaw.workers.dev/api/version

# Dry-run deploy verification
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
echo "Local SHA: $LOCAL_SHA"
```

## Test Matrix

| Scenario | Expected |
|----------|----------|
| Health endpoint 200, SHA matches | Script completes, prints PASSED |
| Health endpoint 500 | Retries 3x, exits non-zero |
| SHA mismatch | Retries 3x, exits non-zero |
| `--skip-verify` flag | Skips verification entirely |
| `--pages-only` flag | Skips worker deploy (verification implicitly skipped) |
| Worker deployed but slow propagate | Retry with delay catches propagation window |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Cloudflare propagation delay > 9s | Low | High | Retry count and delay are configurable by editing script |
| Worker URL changes | Low | Medium | `DEPLOY_HEALTH_URL` env var override |
| curl not installed | Low | High | `set -e` catches; all macOS/Linux have curl; error message clear |
| Health endpoint returning 200 but semantically wrong | Low | Low | SHA check is the ground truth; health is a smoke test |
| No internet connectivity during local deploy | Low | High | Script is run locally; same internet needed for `wrangler deploy` anyway |

## Related Files

- `deploy-cloudflare.sh` — modify (add verification section after worker deploy)
- No worker code changes in this phase
