#!/bin/zsh
# ═══════════════════════════════════════════════════════
# 🔒 send_task.sh — BLOCKING dispatcher
# Script KHÔNG RETURN cho đến khi worker XONG.
# Claude CLI không thể gửi task tiếp vì bash chưa trả.
# 
# Usage: ./send_task.sh <pane> <task-file-path>
# ═══════════════════════════════════════════════════════

PANE="$1"
TASK_FILE="$2"
SESSION="mekong-cto"
WINDOW="cto-worker"
TARGET="${SESSION}:${WINDOW}.${PANE}"
POLL=10
MAX_WAIT=600  # 10 phút timeout

if [[ -z "$PANE" || -z "$TASK_FILE" ]]; then
  echo "❌ Usage: ./send_task.sh <pane> <task-file-path>"
  exit 1
fi

echo "[$(date +%H:%M:%S)] 📨 Gửi task cho P${PANE} từ file ${TASK_FILE}..."

# Gửi task
tmux send-keys -t "$TARGET" C-u 2>/dev/null
sleep 0.3
tmux send-keys -t "$TARGET" -l "Please read and execute the task defined in ${TASK_FILE}."
sleep 1
tmux send-keys -t "$TARGET" Enter
echo "[$(date +%H:%M:%S)] ✅ Đã gửi. Đợi P${PANE} bắt đầu..."

# PHASE 1: Đợi worker BẮT ĐẦU (❯ biến mất hoặc thấy thinking)
sleep 5
STARTED=0
for i in {1..20}; do
  OUTPUT=$(tmux capture-pane -t "$TARGET" -p -S -8 2>/dev/null)
  if echo "$OUTPUT" | tail -5 | grep -qE "thinking|Cogitat|Reading|Writing|Editing|Search|Proofing|Crunched|tool"; then
    STARTED=1
    echo "[$(date +%H:%M:%S)] 🔄 P${PANE} đang xử lý..."
    break
  fi
  # Nếu không còn ❯ ở dòng prompt cuối → đang xử lý
  LAST_PROMPT=$(echo "$OUTPUT" | grep "❯" | tail -1)
  if [[ -z "$LAST_PROMPT" ]]; then
    STARTED=1
    echo "[$(date +%H:%M:%S)] 🔄 P${PANE} đang xử lý..."
    break
  fi
  sleep 3
done

if [[ $STARTED -eq 0 ]]; then
  echo "[$(date +%H:%M:%S)] ⚠️ Không detect xử lý, đợi 60s..."
  sleep 60
fi

# PHASE 2: Đợi worker XONG (❯ quay lại ổn định)
echo "[$(date +%H:%M:%S)] ⏳ Đợi P${PANE} hoàn thành..."
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  sleep $POLL
  ELAPSED=$((ELAPSED + POLL))
  
  OUTPUT=$(tmux capture-pane -t "$TARGET" -p -S -8 2>/dev/null)
  
  # Check: có ❯ VÀ không có thinking/running
  if echo "$OUTPUT" | grep -q "❯"; then
    if ! echo "$OUTPUT" | tail -5 | grep -qE "thinking|Cogitat|Reading|Writing|Editing|Search|Proofing|running"; then
      # Double check sau 5s
      sleep 5
      OUTPUT2=$(tmux capture-pane -t "$TARGET" -p -S -8 2>/dev/null)
      if echo "$OUTPUT2" | grep -q "❯"; then
        if ! echo "$OUTPUT2" | tail -5 | grep -qE "thinking|Cogitat|Reading|Writing|Editing|Search|Proofing|running"; then
          echo "[$(date +%H:%M:%S)] ✅ P${PANE} HOÀN THÀNH! (${ELAPSED}s)"
          echo "--- Kết quả ---"
          tmux capture-pane -t "$TARGET" -p -S -45 2>/dev/null | tail -15
          echo "--- Hết ---"
          exit 0
        fi
      fi
    fi
  fi
  
  echo "[$(date +%H:%M:%S)] ⏳ P${PANE} vẫn đang chạy... (${ELAPSED}s)"
done

echo "[$(date +%H:%M:%S)] ⏰ TIMEOUT sau ${MAX_WAIT}s"
exit 2
