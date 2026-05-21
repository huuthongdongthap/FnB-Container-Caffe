#!/bin/zsh
# ═══════════════════════════════════════════════════════
# 🚀 AUDIT X100 DISPATCHER — Mekong CLI Worker Pipeline
# Chạy 4 task lần lượt qua ./send_task.sh
# Mỗi task: 1 PR riêng (anh review + merge từng phase)
# ═══════════════════════════════════════════════════════
#
# Usage:
#   chmod +x dispatch-all.sh
#   ./dispatch-all.sh [pane]
#
# Default pane = 2 (cto-worker pane 2 per mekong.config)
# ═══════════════════════════════════════════════════════

set -e

PANE="${1:-2}"
REPO="/Users/mac/mekong-cli/FnB-Container-Caffe"
TASKS_DIR="$REPO/.claude-tasks/x100"
SEND_TASK="$REPO/send_task.sh"

# Verify Mekong CLI tools exist
if [[ ! -f "$SEND_TASK" ]]; then
  echo "❌ Mekong send_task.sh not found at $SEND_TASK"
  exit 1
fi

# Copy task files from Cowork workspace to local repo
SOURCE_TASKS="/Users/mac/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_X100"  # adjust path nếu khác
mkdir -p "$TASKS_DIR"
for task in 01-hero-seamless 02-ui-polish 03-perf-a11y 04-mobile-responsive; do
  cp "$SOURCE_TASKS/${task}.md" "$TASKS_DIR/${task}.md" 2>/dev/null || true
done

# ─────────────────────────────────────────
# PHASE 1 — Hero seamless (CRITICAL)
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "🎯 PHASE 1/4 — Hero phân mảng fix"
echo "═══════════════════════════════════════════════════"
"$SEND_TASK" "$PANE" "$TASKS_DIR/01-hero-seamless.md"
PHASE1_EXIT=$?

if [[ $PHASE1_EXIT -ne 0 ]]; then
  echo "❌ Phase 1 failed (exit $PHASE1_EXIT). Stopping."
  exit 1
fi

# Pause for anh review + merge PR
echo ""
echo "⏸  Phase 1 DONE. Anh review + merge PR trên GitHub trước khi tiếp tục."
echo "   Press Enter để tiếp Phase 2 (sau khi merge)..."
read -r

# ─────────────────────────────────────────
# PHASE 2 — UI polish
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "🎨 PHASE 2/4 — UI polish toàn site"
echo "═══════════════════════════════════════════════════"
"$SEND_TASK" "$PANE" "$TASKS_DIR/02-ui-polish.md"
PHASE2_EXIT=$?

if [[ $PHASE2_EXIT -ne 0 ]]; then
  echo "❌ Phase 2 failed (exit $PHASE2_EXIT). Stopping."
  exit 1
fi

echo ""
echo "⏸  Phase 2 DONE. Anh review + merge PR. Press Enter để tiếp Phase 3..."
read -r

# ─────────────────────────────────────────
# PHASE 3 — Performance + A11y
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "⚡ PHASE 3/4 — Performance + Accessibility"
echo "═══════════════════════════════════════════════════"
"$SEND_TASK" "$PANE" "$TASKS_DIR/03-perf-a11y.md"
PHASE3_EXIT=$?

if [[ $PHASE3_EXIT -ne 0 ]]; then
  echo "❌ Phase 3 failed (exit $PHASE3_EXIT). Stopping."
  exit 1
fi

echo ""
echo "⏸  Phase 3 DONE. Anh review + merge PR. Press Enter để tiếp Phase 4..."
read -r

# ─────────────────────────────────────────
# PHASE 4 — Mobile responsive
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "📱 PHASE 4/4 — Mobile responsive"
echo "═══════════════════════════════════════════════════"
"$SEND_TASK" "$PANE" "$TASKS_DIR/04-mobile-responsive.md"
PHASE4_EXIT=$?

if [[ $PHASE4_EXIT -ne 0 ]]; then
  echo "❌ Phase 4 failed (exit $PHASE4_EXIT). Stopping."
  exit 1
fi

# ─────────────────────────────────────────
# FINAL — Cloudflare deploy verify
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "🚀 ALL 4 PHASES DONE — Verifying Cloudflare Pages deploy"
echo "═══════════════════════════════════════════════════"

cd "$REPO"
git fetch origin && git pull origin main

# Force redeploy nếu cần
echo ""
echo "📡 Force Cloudflare Pages redeploy (đảm bảo latest main):"
npx wrangler pages deploy . \
  --project-name=fnb-caffe-container \
  --branch=main \
  --commit-dirty=true 2>&1 | tail -20 || echo "⚠️  wrangler not available - manual deploy needed"

# Final report
echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ AUDIT X100 COMPLETE"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Production URL:  https://fnb-caffe-container.pages.dev"
echo "PR list:         https://github.com/huuthongdongthap/FnB-Container-Caffe/pulls"
echo ""
echo "Anh verify final state, hard refresh trên trình duyệt."
