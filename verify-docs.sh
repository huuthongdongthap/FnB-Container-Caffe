#!/bin/bash
# Verify documentation integrity: check internal links, file existence

echo "=== Documentation Verification ==="
echo ""

# Check all required files exist
echo "1. Checking required files..."
REQUIRED=(
  "docs/00_FOUNDER_MANIFESTO.md"
  "docs/01_GOAL.md"
  "docs/02_AGENTS.md"
  "docs/03_ARCHITECTURE.md"
  "docs/04_ROADMAP.md"
  "docs/05_TASKS/orders.md"
  "docs/05_TASKS/loyalty.md"
  "docs/05_TASKS/menu.md"
  "docs/05_TASKS/reservations.md"
  "docs/05_TASKS/payments.md"
  "docs/05_TASKS/admin.md"
  "docs/05_TASKS/integration.md"
  "docs/05_TASKS/infrastructure.md"
  "docs/06_ADR/0001-use-cloudflare-workers.md"
  "docs/06_ADR/0002-d1-sqlite-over-postgresql.md"
  "docs/06_ADR/0003-static-html-vanilla-js-over-spa-framework.md"
  "docs/06_ADR/0004-hono-framework-over-plain-workers.md"
  "docs/06_ADR/0005-jwt-auth-over-sessions.md"
  "docs/06_ADR/0006-bazi-design-system-v5-1.md"
  "docs/06_ADR/0007-rate-limiting-at-worker-layer.md"
  "docs/06_ADR/0008-audit-logging-to-git-tracked-files.md"
  "docs/06_ADR/0009-payment-webhook-sync-over-polling.md"
  "docs/06_ADR/0010-kds-polling-over-websocket.md"
  "docs/06_ADR/0011-payos-as-primary-payment-gateway.md"
  "docs/06_ADR/0012-multi-tier-loyalty-structure.md"
  "docs/07_EVALUATION.md"
  "docs/08_BUSINESS_MODEL.md"
  "docs/09_BEHAVIOR_GRAPH.md"
  "docs/10_RISK_REGISTER.md"
  "docs/11_GLOSSARY.md"
  "docs/12_CHANGELOG.md"
  "docs/README.md"
  "prompts/goal.prompt.md"
  "prompts/architect.prompt.md"
  "prompts/reviewer.prompt.md"
  "prompts/security.prompt.md"
  "prompts/business.prompt.md"
  ".github/pull_request_template.md"
)

MISSING=0
for file in "${REQUIRED[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ MISSING: $file"
    MISSING=$((MISSING+1))
  fi
done

echo ""
if [ $MISSING -eq 0 ]; then
  echo "✅ All required files present!"
else
  echo "❌ $MISSING file(s) missing!"
fi

# Check for broken markdown links (basic check for [[file]] or [text](file))
echo ""
echo "2. Checking for broken internal links..."
# Find all markdown files in docs/ and look for [text](file.md) or [[file]] patterns
BROKEN=0
while IFS= read -r file; do
  # Extract markdown links to local files
  grep -oE '\[[^]]+\]\(([^)]+\.md)\)' "$file" | sed 's/.*(\([^)]*\)).*/\1/' | while read -r target; do
    # Skip URLs (http, https, /)
    if [[ "$target" =~ ^https?:// ]] || [[ "$target" =~ ^/ ]]; then
      continue
    fi
    # If target doesn't start with docs/, prepend docs/ (relative link)
    if [[ ! "$target" =~ ^docs/ ]] && [[ ! "$target" =~ ^\.\./ ]]; then
      target="docs/$target"
    fi
    # If file doesn't exist, report
    if [ ! -f "$target" ]; then
      echo "  ❌ $file: broken link to $target"
      BROKEN=$((BROKEN+1))
    fi
  done
done < <(find docs -name "*.md" -type f)

if [ $BROKEN -eq 0 ]; then
  echo "✅ No broken internal links found!"
else
  echo "❌ $BROKEN broken link(s) found!"
fi

# Summary
echo ""
echo "=== Verification Complete ==="
if [ $MISSING -eq 0 ] && [ $BROKEN -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED"
  exit 0
else
  echo "⚠️  Issues found — please fix before finalizing"
  exit 1
fi
