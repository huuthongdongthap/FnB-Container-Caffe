---
title: "Phase 01 — Pre-deploy Test Gate"
description: "Add npm test gate to deploy-cloudflare.sh so broken code never ships"
status: completed
priority: P2
effort: 0.5h
phase: 01
depends_on: []
blocks: [03, 04]
---

## Overview

`deploy-cloudflare.sh` currently builds and deploys without running tests. Add a pre-deploy test gate that runs `npm test` before anything else. If tests fail, the script exits with error immediately.

## Current State

**File:** `deploy-cloudflare.sh:1-37`

The script jumps straight into Vite build. No test step exists. The `package.json:9` defines `"test": "vitest run"` — this is what we gate on.

## Requirements

- `deploy-cloudflare.sh` runs `npm test` as step 1 before any build/deploy
- Exit code non-zero on test failure (handled by `set -euo pipefail`)
- Skip tests with `--skip-tests` flag for emergency hotfixes
- Tests run from repo root (where `package.json` and `vitest.config` live)

## Implementation Steps

### Step 1: Add test gate to `deploy-cloudflare.sh`

Insert after the `set -euo pipefail` line and before the Vite build section:

```bash
# ── 0. Pre-deploy test gate ────────────────────────────────────────────────
if [[ "${1:-}" != "--skip-tests" && "${2:-}" != "--skip-tests" ]]; then
  echo "[0/3] Running tests..."
  npm test 2>&1 | tail -20
  echo "Tests passed."
else
  echo "[0/3] Skipping tests (--skip-tests flag)"
fi
```

### Step 2: Update usage comment at top of file

Change the usage comment from:
```bash
# Usage: bash deploy-cloudflare.sh [--worker-only | --pages-only]
```
to:
```bash
# Usage: bash deploy-cloudflare.sh [--worker-only | --pages-only] [--skip-tests]
```

### Step 3: Re-number existing steps

Change `[1/3]` to `[1/3]` (stays), `[2/3]` to `[2/3]` (stays), `[3/3]` to `[3/3]` (stays). The test gate is step 0 so existing numbering is preserved.

### Step 4: Verify

```bash
# Should pass and deploy
bash deploy-cloudflare.sh --skip-tests --worker-only 2>&1 | head -5

# Should run tests first
bash deploy-cloudflare.sh --skip-tests --worker-only
```

## Test Matrix

| Scenario | Expected |
|----------|----------|
| Tests pass | Proceeds to build + deploy |
| Tests fail | Script exits non-zero, no deploy |
| `--skip-tests` flag | Skips tests, proceeds to deploy |
| `--worker-only --skip-tests` | Skips both tests (flag detected) |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `npm test` hangs in CI-like env | Low | Low | `--skip-tests` escape hatch documented |
| Slow tests delay deploy | Medium | Low | Tests take ~12s (verified); acceptable |
| Flag parsing collision with existing flags | Low | Low | `--skip-tests` is unique; checked against both $1 and $2 |

## Related Files

- `deploy-cloudflare.sh` — modify
- `package.json:9` — `"test": "vitest run"` (read only)
