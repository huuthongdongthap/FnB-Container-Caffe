#!/bin/bash
# verify-docs.sh
# Documentation verification script - checks completeness and broken links

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs"
REPORT_FILE="$PROJECT_ROOT/plans/reports/docs-verification-$(date +%Y%m%d-%H%M%S).md"

echo "=== Documentation Verification ==="
echo "Project: $PROJECT_ROOT"
echo "Docs dir: $DOCS_DIR"
echo ""

# Create report directory
mkdir -p "$(dirname "$REPORT_FILE")"

# Start report
cat > "$REPORT_FILE" << 'EOF'
# Documentation Verification Report

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Project:** $(basename "$PROJECT_ROOT")

EOF

# Function to log to both console and report
log() {
    echo "[*] $1"
    echo "- $1" >> "$REPORT_FILE"
}

# 1. Check required files exist
log "1. Checking required files..."

REQUIRED_FILES=(
    "00_FOUNDER_MANIFESTO.md"
    "01_GOAL.md"
    "02_AGENTS.md"
    "03_ARCHITECTURE.md"
    "04_ROADMAP.md"
    "05_TASKS/orders.md"
    "05_TASKS/loyalty.md"
    "05_TASKS/menu.md"
    "05_TASKS/reservations.md"
    "05_TASKS/payments.md"
    "05_TASKS/admin.md"
    "05_TASKS/integration.md"
    "05_TASKS/infrastructure.md"
    "06_ADR/0001-use-cloudflare-workers.md"
    "06_ADR/0002-d1-sqlite-over-postgresql.md"
    "06_ADR/0003-static-html-vanilla-js-over-spa-framework.md"
    "06_ADR/0004-hono-framework-over-plain-workers.md"
    "06_ADR/0005-jwt-auth-over-sessions.md"
    "06_ADR/0006-bazi-design-system-v5-1.md"
    "06_ADR/0007-rate-limiting-at-worker-layer.md"
    "06_ADR/0008-audit-logging-to-git-tracked-files.md"
    "06_ADR/0009-payment-webhook-sync-over-polling.md"
    "06_ADR/0010-kds-polling-over-websocket.md"
    "06_ADR/0011-payos-as-primary-payment-gateway.md"
    "06_ADR/0012-multi-tier-loyalty-structure.md"
    "07_EVALUATION.md"
    "08_BUSINESS_MODEL.md"
    "09_BEHAVIOR_GRAPH.md"
    "10_RISK_REGISTER.md"
    "11_GLOSSARY.md"
    "12_CHANGELOG.md"
    "README.md"
    "../prompts/goal.prompt.md"
    "../prompts/architect.prompt.md"
    "../prompts/reviewer.prompt.md"
    "../prompts/security.prompt.md"
    "../prompts/business.prompt.md"
    "../.github/pull_request_template.md"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$DOCS_DIR/$file" ]]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (MISSING)"
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    log "FAILED: ${#MISSING_FILES[@]} missing files"
    exit 1
else
    log "All required files present!"
fi

echo ""

# 2. Check for broken internal links
log "2. Checking for broken internal links..."

# Find all markdown files
MARKDOWN_FILES=$(find "$DOCS_DIR" -name "*.md" -type f)

BROKEN_LINKS=()
for file in $MARKDOWN_FILES; do
    # Extract markdown links [text](path)
    # Exclude external links (http://, https://, mailto:)
    grep -oE '\[[^]]+\]\([^http:][^mailto:][^)]+\)' "$file" | while read -r link; do
        # Extract the path part
        path=$(echo "$link" | sed -n 's/.*(\([^)]+\)).*/\1/p')
        if [ -n "$path" ]; then
            # Handle relative paths
            link_dir=$(dirname "$file")
            full_path="$link_dir/$path"
            # Normalize path (remove ./ and ../)
            full_path=$(realpath -m "$full_path" 2>/dev/null || echo "$full_path")
            if [ ! -e "$full_path" ] && [[ ! "$path" =~ ^# ]]; then
                echo "  ✗ $file: broken link to $path"
                BROKEN_LINKS+=("$file: link to $path")
            fi
        fi
    done
done

if [ ${#BROKEN_LINKS[@]} -gt 0 ]; then
    log "FAILED: ${#BROKEN_LINKS[@]} broken links found"
    for link in "${BROKEN_LINKS[@]}"; do
        echo "  - $link" >> "$REPORT_FILE"
    done
    exit 1
else
    log "No broken internal links found!"
fi

echo ""

# 3. Check for placeholder tokens (common patterns)
log "3. Checking for unfilled placeholders..."

PLACEHOLDER_PATTERNS=(
    "{VISION_STATEMENT}"
    "{PROJECT_NAME}"
    "{DESCRIPTION}"
    "TODO"
    "FIXME"
    "XXX"
)

PLACEHOLDER_FOUND=()
for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
    found=$(grep -r "$pattern" "$DOCS_DIR" --include="*.md" | wc -l)
    if [ "$found" -gt 0 ]; then
        echo "  ⚠ Found '$pattern' in $found files"
        PLACEHOLDER_FOUND+=("$pattern ($found files)")
    fi
done

if [ ${#PLACEHOLDER_FOUND[@]} -gt 0 ]; then
    log "WARNING: Placeholder tokens remaining:"
    for ph in "${PLACEHOLDER_FOUND[@]}"; do
        echo "  - $ph" >> "$REPORT_FILE"
    done
else
    log "No common placeholder tokens found!"
fi

echo ""

# 4. Check file sizes (basic sanity)
log "4. Checking file sizes..."

EMPTY_FILES=()
for file in $(find "$DOCS_DIR" -name "*.md" -type f); do
    lines=$(wc -l < "$file")
    if [ "$lines" -lt 5 ]; then
        echo "  ⚠ $file: only $lines lines"
        EMPTY_FILES+=("$file")
    fi
done

if [ ${#EMPTY_FILES[@]} -gt 0 ]; then
    log "WARNING: ${#EMPTY_FILES[@]} files are nearly empty"
else
    log "All files have substantial content!"
fi

echo ""

# Final summary
cat >> "$REPORT_FILE" << EOF

## Summary

- **Required files:** $((${#REQUIRED_FILES[@]} - ${#MISSING_FILES[@]}))/$((${#REQUIRED_FILES[@]})) present
- **Broken links:** ${#BROKEN_LINKS[@]}
- **Placeholder tokens:** ${#PLACEHOLDER_FOUND[@]} types found
- **Nearly empty files:** ${#EMPTY_FILES[@]}

**Overall Status:** $(if [ ${#MISSING_FILES[@]} -eq 0 ] && [ ${#BROKEN_LINKS[@]} -eq 0 ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)

EOF

echo "=== Verification Complete ==="
echo "Report saved to: $REPORT_FILE"

if [ ${#MISSING_FILES[@]} -eq 0 ] && [ ${#BROKEN_LINKS[@]} -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED"
    exit 0
else
    echo "❌ SOME CHECKS FAILED"
    exit 1
fi