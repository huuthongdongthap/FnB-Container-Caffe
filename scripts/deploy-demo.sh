#!/usr/bin/env bash
# deploy-demo.sh — Deploy a demo/second instance for testing
# This creates a fully isolated deployment to validate the white-label flow
# without needing an actual client.
#
# Usage:
#   bash scripts/deploy-demo.sh           # Prepare demo directory only
#   bash scripts/deploy-demo.sh --deploy  # Prepare + simulate full deploy

set -euo pipefail

DEMO_NAME="demo-cafe"
DEMO_DIR="/tmp/aura-demo-$(date +%s)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Deploying Demo Instance: $DEMO_NAME ==="
echo ""

# ── Step 1: Create demo directory ──────────────────────────────────────────
mkdir -p "$DEMO_DIR"
echo "[1/5] Created demo directory: $DEMO_DIR"

# ── Step 2: Copy template files ───────────────────────────────────────────
# Copy project source (excluding node_modules, .git, dist)
rsync -a --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "$PROJECT_DIR/" "$DEMO_DIR/"
echo "[2/5] Copied project template to demo directory"

# ── Step 3: Generate demo brand config ────────────────────────────────────
mkdir -p "$DEMO_DIR/config"
cat > "$DEMO_DIR/config/brand.json" << 'BRANDEOF'
{
  "brand": {
    "name": "Demo Cafe — Quan Ca Phe Thu",
    "nameShort": "Demo",
    "tagline": "Quan ca phê thu nghiem / Trial Cafe",
    "description": "Day la phien ban dung thu cua he thong AURA CAFE. This is a trial deployment.",
    "address": "HCMC, Vietnam",
    "domain": "demo-cafe.auraspace.cafe"
  },
  "seo": {
    "title": "Demo Cafe — Trial Instance",
    "description": "Trial deployment of AURA CAFE system"
  },
  "theme": {
    "colors": {
      "primary": "#c6c6c7",
      "background": "#0A1A2E"
    }
  }
}
BRANDEOF
echo "[3/5] Generated demo brand config"

# ── Step 4: Print summary ─────────────────────────────────────────────────
echo "[4/5] Config ready"
echo ""
echo "  Demo deployment prepared at: $DEMO_DIR"
echo ""
echo "  To simulate deployment:"
echo "    cd $DEMO_DIR && npm install && npm run build"

# ── Step 5: Validate ──────────────────────────────────────────────────────
echo ""
echo "[5/5] Validating brand config..."
if [[ -f "$DEMO_DIR/config/brand.json" ]]; then
  echo "  brand.json: OK"
  echo "  Cafe name:  $(jq -r '.brand.name' "$DEMO_DIR/config/brand.json")"
  echo "  Domain:     $(jq -r '.brand.domain' "$DEMO_DIR/config/brand.json")"
  echo "  Primary:    $(jq -r '.theme.colors.primary' "$DEMO_DIR/config/brand.json")"
fi

# ── Optional: full deploy path via deploy-branded.sh ──────────────────────
if [[ "${1:-}" == "--deploy" ]]; then
  echo ""
  echo "--- Running branded deploy for demo instance ---"
  bash "$SCRIPT_DIR/deploy-branded.sh" "$DEMO_NAME" "demo-cafe.auraspace.cafe" --skip-tests
fi

echo ""
echo "=== Demo instance ready! ==="
echo "  Directory: $DEMO_DIR"
echo ""
echo "To deploy for real:"
echo "  1. Set up Cloudflare credentials"
echo "  2. Run: bash scripts/deploy-demo.sh --deploy"
echo "  3. Or for a real client: bash scripts/deploy-branded.sh \"Cafe Name\" domain.com"
echo ""
