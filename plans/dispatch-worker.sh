#!/bin/zsh
# ═══════════════════════════════════════════════════════
# 🚀 dispatch-worker.sh — Setup + Dispatch Phase 1 Tasks
# Tạo tmux session → khởi Worker Claude CLI (Qwen 3.6+)
# → Gửi Task 1.1 đầu tiên
#
# Usage: ./plans/dispatch-worker.sh
# ═══════════════════════════════════════════════════════

SESSION="tom_hum"
WINDOW="fnb"
PROFILE_DIR="$HOME/.claude-dashscope"
WORK_DIR="$HOME/mekong-cli/FnB-Container-Caffe"

echo "⚔️ AURA SPACE — CTO Worker Dispatch"
echo "Model: Qwen 3.6 Plus (DashScope)"
echo "Repo: $WORK_DIR"
echo "═══════════════════════════════════"

# Step 1: Tạo tmux session nếu chưa có
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "📦 Tạo tmux session: $SESSION..."
  tmux new-session -d -s "$SESSION" -n "$WINDOW" -c "$WORK_DIR"
  sleep 1
else
  echo "✅ Session $SESSION đã tồn tại"
fi

# Step 2: Khởi Claude Code CLI với profile Qwen 3.6 Plus
echo "🤖 Khởi Worker (Qwen 3.6 Plus) tại pane 0..."
tmux send-keys -t "${SESSION}:${WINDOW}.0" \
  "CLAUDE_CONFIG_DIR=$PROFILE_DIR claude --dangerously-skip-permissions" Enter
sleep 8

# Step 3: Kiểm tra Worker sẵn sàng
OUTPUT=$(tmux capture-pane -t "${SESSION}:${WINDOW}.0" -p -S -5 2>/dev/null)
if echo "$OUTPUT" | grep -q "❯"; then
  echo "✅ Worker sẵn sàng! Prompt ❯ detected."
else
  echo "⏳ Worker đang khởi động... đợi 15s"
  sleep 15
fi

echo ""
echo "═══════════════════════════════════"
echo "✅ SETUP HOÀN TẤT!"
echo ""
echo "📋 Giao Task đầu tiên (Task 1.1):"
echo "   ./send_task.sh 0 \"\$(cat plans/tasks/task-1.1.md)\""
echo ""
echo "📋 Hoặc giao manual:"
echo "   tmux attach -t $SESSION"
echo "   (paste task content vào prompt ❯)"
echo "═══════════════════════════════════"
