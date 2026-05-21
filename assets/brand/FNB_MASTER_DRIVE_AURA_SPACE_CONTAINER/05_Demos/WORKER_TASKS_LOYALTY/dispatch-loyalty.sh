#!/bin/zsh
# ═══════════════════════════════════════════════════════════
# 🚀 LOYALTY DISPATCHER — 4 P0 Tasks (Pre-Launch 6/6)
# ═══════════════════════════════════════════════════════════
#
# Usage:
#   chmod +x dispatch-loyalty.sh
#   ./dispatch-loyalty.sh [pane]
#
# Dispatches in order với pause cho anh review + merge mỗi PR:
#   08 → 09 → 10 → 11 (Task 12 chạy sau 6/6)
# ═══════════════════════════════════════════════════════════

set -e

PANE="${1:-2}"
REPO="/Users/mac/mekong-cli/FnB-Container-Caffe"
TASKS_DIR="$REPO/.claude-tasks/loyalty"
SEND_TASK="$REPO/send_task.sh"

if [[ ! -f "$SEND_TASK" ]]; then
  echo "❌ Mekong send_task.sh not found at $SEND_TASK"
  exit 1
fi

SOURCE_TASKS="/Users/mac/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY"
mkdir -p "$TASKS_DIR"
for task in 08-loyalty-schema-v2 09-loyalty-bonus-campaigns 10-signup-page-qr 11-membership-card-pos 12-admin-loyalty-widgets 13-zalo-oa-zns; do
  cp "$SOURCE_TASKS/${task}.md" "$TASKS_DIR/${task}.md" 2>/dev/null || {
    echo "⚠️  Source not found at $SOURCE_TASKS — adjust path nếu cần"
    exit 1
  }
done

dispatch_phase() {
  local task_num="$1"
  local task_name="$2"
  local task_file="$3"
  local emoji="$4"

  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "$emoji TASK $task_num — $task_name"
  echo "═══════════════════════════════════════════════════"

  "$SEND_TASK" "$PANE" "$TASKS_DIR/$task_file"
  local exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    echo "❌ Task $task_num failed (exit $exit_code). Stopping."
    exit 1
  fi

  echo ""
  echo "⏸  Task $task_num DONE. Review + merge PR trên GitHub."
  echo "   Press Enter để tiếp task kế..."
  read -r
}

# ─────────────────────────────────────────
# Task 08 — Schema v2 (P0, ~2h)
# ─────────────────────────────────────────
dispatch_phase "08" "Loyalty Schema v2 Migration" "08-loyalty-schema-v2.md" "🗄"

# ─────────────────────────────────────────
# Task 09 — Bonus Campaigns + Critical Bug Fixes (P0, ~3h)
# ─────────────────────────────────────────
dispatch_phase "09" "Bonus Campaigns + Bug Fixes" "09-loyalty-bonus-campaigns.md" "🎁"

# ─────────────────────────────────────────
# Task 10 — Signup Page + QR (P0, ~2h)
# ─────────────────────────────────────────
dispatch_phase "10" "Signup Page + QR Generator" "10-signup-page-qr.md" "📝"

# ─────────────────────────────────────────
# Task 11 — Membership Card + POS Wallet (P0, ~2h)
# ─────────────────────────────────────────
dispatch_phase "11" "Membership Card + POS Wallet Display" "11-membership-card-pos.md" "🪪"

# ─────────────────────────────────────────
# Verify Cloudflare deploy
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "🚀 ALL P0 TASKS DONE — Verifying Cloudflare deploy"
echo "═══════════════════════════════════════════════════"

cd "$REPO"
git fetch origin && git pull origin main

echo ""
echo "📡 Force Cloudflare Pages redeploy:"
npx wrangler pages deploy . \
  --project-name=fnb-caffe-container \
  --branch=main \
  --commit-dirty=true 2>&1 | tail -20 || echo "⚠️  manual deploy needed"

echo ""
echo "📡 Force Worker redeploy:"
cd worker
npx wrangler deploy 2>&1 | tail -20 || echo "⚠️  manual deploy needed"
cd ..

# ─────────────────────────────────────────
# Final summary
# ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ LOYALTY P0 COMPLETE — READY FOR 6/6 LAUNCH"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Production URL:        https://fnb-caffe-container.pages.dev"
echo "Signup page:           https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien"
echo "Loyalty lookup:        https://fnb-caffe-container.pages.dev/loyalty"
echo "PR list:               https://github.com/huuthongdongthap/FnB-Container-Caffe/pulls"
echo ""
echo "Verify checklist:"
echo "  [ ] /dang-ky-thanh-vien form works mobile + desktop"
echo "  [ ] Campaign banner shows 'Tặng 50.000đ vào ví khai trương'"
echo "  [ ] Test signup mock customer → ví show +50k"
echo "  [ ] Mock order delivered → cashback x2 applied"
echo "  [ ] Idempotency: same order 2 lần → only 1 cashback"
echo "  [ ] POS lookup SĐT → wallet panel hiển thị đẹp"
echo "  [ ] Receipt template có loyalty section + QR"
echo "  [ ] Thẻ giấy PDF generate được"
echo ""
echo "Tasks POST-LAUNCH:"
echo "  [ ] 12 admin dashboard (~7/6 sau 6/6):"
echo "      ./send_task.sh $PANE $TASKS_DIR/12-admin-loyalty-widgets.md"
echo "  [ ] 13 Zalo OA + ZNS (~25/6 sau 1 tháng launch):"
echo "      ./send_task.sh $PANE $TASKS_DIR/13-zalo-oa-zns.md"
echo ""
echo "🎉 Sẵn sàng khai trương AURA CAFE 06/06/2026!"
