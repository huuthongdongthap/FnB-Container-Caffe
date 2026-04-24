#!/usr/bin/env bash
# CHECKOUT FIX — CC CLI execution sequence
# Paste từng block vào Claude Code CLI, chờ PASS trước khi chuyển phase.
# Stop on 2-strikes (CLAUDE.md).

set -e
cd /Users/mac/mekong-cli/FnB-Container-Caffe

# PHASE 1 — Regression gate
echo ">>> /qa-regression"
# -> CC CLI runs

# PHASE 2 — Cart persistence
echo ">>> /aura-cart-debug"

# PHASE 3 — OAuth/Auth
echo ">>> /sec-scan"

# PHASE 4 — Diff review
echo ">>> /review"

# PHASE 5 — E2E smoke
echo ">>> /qa-e2e"

# PHASE 6 — SHIP
echo ">>> /ship \"fix: checkout flow — cart persist, CSS MIME, form submit, payment scoping, OAuth fallback\""

# PHASE 7 — Post-deploy health
echo ">>> /ops-health"
echo ">>> /obs-logs --status=error"

# PHASE 8 — Rollback if fail
# echo ">>> /rollback both"
