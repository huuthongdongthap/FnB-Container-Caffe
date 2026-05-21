#!/bin/zsh
# ═══════════════════════════════════════════════════════════
# 🚀 BRAND v6 DISPATCHER — AURA CAFE Mineral + Cobalt
# Phase 1: Rename AURA SPACE → AURA CAFE toàn web (~5 phút)
# Phase 2: Brand v6 MINERAL + COBALT styling (~20 phút)
# ═══════════════════════════════════════════════════════════
#
# Usage:
#   chmod +x dispatch-v6.sh
#   ./dispatch-v6.sh [pane]
#
# Default pane = 2 (cto-worker)
# ═══════════════════════════════════════════════════════════

set -e

PANE="${1:-2}"
REPO="/Users/mac/mekong-cli/FnB-Container-Caffe"
TASKS_DIR="$REPO/.claude-tasks/v6"
SEND_TASK="$REPO/send_task.sh"

if [[ ! -f "$SEND_TASK" ]]; then
  echo "❌ Mekong send_task.sh not found at $SEND_TASK"
  exit 1
fi

SOURCE_TASKS="/Users/mac/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_V6"
mkdir -p "$TASKS_DIR"
for task in 06-rename-aura-cafe 07-brand-v6-mineral; do
  cp "$SOURCE_TASKS/${task}.md" "$TASKS_DIR/${task}.md" 2>/dev/null || {
    echo "⚠️  Source not found at $SOURCE_TASKS — please adjust path"
    exit 1
  }
done

# ─────────────────────────────────────────
# PHASE 1 — Rename AURA SPACE → AURA CAFE
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "🏷  PHASE 1/2 — Rename AURA SPACE → AURA CAFE"
echo "═══════════════════════════════════════════════════"
"$SEND_TASK" "$PANE" "$TASKS_DIR/06-rename-aura-cafe.md"
PHASE1_EXIT=$?

if [[ $PHASE1_EXIT -ne 0 ]]; then
  echo "❌ Phase 1 failed (exit $PHASE1_EXIT). Stopping."
  exit 1
fi

echo ""
echo "⏸  Phase 1 DONE. Anh review + merge PR feat/rename-aura-cafe."
echo "   Hard refresh production verify AURA CAFE hiển thị đúng."
echo "   Press Enter để tiếp Phase 2 (sau khi merge)..."
read -r

# ─────────────────────────────────────────
# PHASE 2 — Brand v6 MINERAL + COBALT
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "🎨 PHASE 2/2 — Brand v6 MINERAL + COBALT lift"
echo "═══════════════════════════════════════════════════"
"$SEND_TASK" "$PANE" "$TASKS_DIR/07-brand-v6-mineral.md"
PHASE2_EXIT=$?

if [[ $PHASE2_EXIT -ne 0 ]]; then
  echo "❌ Phase 2 failed (exit $PHASE2_EXIT). Stopping."
  exit 1
fi

# ─────────────────────────────────────────
# FINAL — Cloudflare deploy verify
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "🚀 BOTH PHASES DONE — Verifying Cloudflare Pages"
echo "═══════════════════════════════════════════════════"

cd "$REPO"
git fetch origin && git pull origin main

echo ""
echo "📡 Force Cloudflare redeploy (đảm bảo latest main):"
npx wrangler pages deploy . \
  --project-name=fnb-caffe-container \
  --branch=main \
  --commit-dirty=true 2>&1 | tail -20 || echo "⚠️  wrangler not available - manual deploy needed"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ BRAND v6 AURA CAFE COMPLETE"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Production URL:  https://fnb-caffe-container.pages.dev"
echo "PR list:         https://github.com/huuthongdongthap/FnB-Container-Caffe/pulls"
echo ""
echo "Anh hard refresh trình duyệt verify final state."
echo ""
echo "Expected mood arc:"
echo "  🌑 Hero (navy + ripple)"
echo "  🌕 Menu cream + crisscross"
echo "  🌕 Spaces light"
echo "  🌕 Loyalty pearl + cobalt"
echo "  🌕 About soft mineral"
echo "  🌑 CTA navy + cobalt btn"
echo "  🌑 Footer void + warm glow"
