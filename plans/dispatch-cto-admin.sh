#!/bin/zsh
# ═══════════════════════════════════════════
# 🚀 CTO Admin Fix — Claude Code CLI Dispatch
# Giao task fix admin panel + deploy
# Usage: zsh plans/dispatch-cto-admin.sh
# ═══════════════════════════════════════════

WORK_DIR="$HOME/mekong-cli/FnB-Container-Caffe"
TASK_FILE="$WORK_DIR/plans/tasks/cto-admin-fix.md"

echo "⚔️ AURA SPACE — Dispatching Admin Fix to CTO"
echo "═══════════════════════════════════════════"

cd "$WORK_DIR" || exit 1

# Launch Claude Code CLI with task
cat "$TASK_FILE" | claude --dangerously-skip-permissions -p "$(cat $TASK_FILE)"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ CTO Task dispatched!"
echo "═══════════════════════════════════════════"
