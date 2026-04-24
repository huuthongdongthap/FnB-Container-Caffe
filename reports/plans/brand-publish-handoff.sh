#!/usr/bin/env bash
# BRAND PUBLISH — CC CLI execution sequence
# Paste từng block vào Claude Code CLI, chờ PASS trước khi chuyển phase.
# Stop on 2-strikes (CLAUDE.md).

set -e
cd /Users/mac/mekong-cli/FnB-Container-Caffe

# PHASE 1 — Pre-flight
echo ">>> /qa-regression"

# PHASE 2 — Git mv + sed path fix
echo ">>> git mv docs/brand-guideline.html brand-guideline.html"
echo ">>> sed -i '' -e 's|../css/brand-tokens.css|css/brand-tokens.css|g' -e 's|../assets/brand/|assets/brand/|g' -e 's|../index.html|index.html|g' brand-guideline.html"
echo ">>> grep -n '../' brand-guideline.html  # expect 0 real refs"

# PHASE 3 — _redirects short URL
echo ">>> append to _redirects:"
echo "/brand            /brand-guideline.html  200"
echo "/brand-guideline  /brand-guideline.html  301"

# PHASE 4 — Local review
echo ">>> /review"

# PHASE 5 — Ship
echo ">>> /ship \"feat(brand): publish brand-guideline at root — fix .cfignore block on docs/\""

# PHASE 6 — Verify
echo ">>> curl -sI -o /dev/null -w '%{http_code} %{content_type}\\n' https://auraspace.cafe/brand-guideline.html"
echo ">>> curl -sI -o /dev/null -w '%{http_code}\\n' https://auraspace.cafe/brand"
echo ">>> curl -sI -o /dev/null -w '%{http_code}\\n' https://auraspace.cafe/docs/brand-guideline.html  # expect 404"
echo ">>> /ops-health"

# PHASE 7 — Rollback nếu fail
# echo ">>> /rollback pages"
