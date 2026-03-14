#!/bin/zsh
# ═══════════════════════════════════════════════════════
# 🔒 CTO AUTO-DISPATCHER v2 — QUEUE-BASED, NO STACKING
# Chạy trong P0. Tự động dispatch tasks tuần tự.
# ═══════════════════════════════════════════════════════

SESSION="tom_hum"
WINDOW="fnb"
QUEUE_FILE="/tmp/fnb_task_queue.txt"
LOG_FILE="/tmp/fnb_dispatch.log"
CHECK_INTERVAL=10  # giây

log() { echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"; }

# Kiểm tra worker rảnh (có ❯, không thinking)
is_worker_free() {
  local pane=$1
  local output=$(tmux capture-pane -t ${SESSION}:${WINDOW}.${pane} -p -S -10 2>/dev/null)
  if echo "$output" | grep -q "❯"; then
    if echo "$output" | tail -5 | grep -qE "thinking|Cogitat|Reading|Writing|Editing|Searching|running|Proofing"; then
      return 1  # đang bận
    fi
    return 0  # rảnh
  fi
  return 1  # bận
}

# Gửi task cho worker (CÓ KIỂM TRA)
send_task() {
  local pane=$1
  local task="$2"
  
  log "🔍 Checking P${pane}..."
  if is_worker_free "$pane"; then
    log "✅ P${pane} RẢNH. Gửi task..."
    tmux send-keys -t ${SESSION}:${WINDOW}.${pane} C-u 2>/dev/null
    sleep 0.3
    tmux send-keys -t ${SESSION}:${WINDOW}.${pane} -l "$task"
    sleep 0.8
    tmux send-keys -t ${SESSION}:${WINDOW}.${pane} Enter
    log "📨 P${pane}: $task"
    return 0
  else
    log "⏳ P${pane} ĐANG BẬN. Đợi..."
    return 1
  fi
}

# Đợi worker xong
wait_for_worker() {
  local pane=$1
  log "⏳ Đợi P${pane} xong..."
  while true; do
    sleep $CHECK_INTERVAL
    if is_worker_free "$pane"; then
      # Đọc 45 dòng cuối để hiểu kết quả
      log "✅ P${pane} XONG. Đọc kết quả:"
      tmux capture-pane -t ${SESSION}:${WINDOW}.${pane} -p -S -45 2>/dev/null | tail -10 >> "$LOG_FILE"
      return 0
    fi
    log "   P${pane} vẫn đang chạy..."
  done
}

# ═══ MAIN ═══
log "═══════════════════════════════════════"
log "🔒 CTO AUTO-DISPATCHER v2 STARTED"
log "═══════════════════════════════════════"

if [[ ! -f "$QUEUE_FILE" ]]; then
  log "❌ Không có queue file: $QUEUE_FILE"
  log "Tạo queue bằng cách ghi vào file, format:"
  log "PANE:task content"
  log "Ví dụ:"
  log "1:Review index.html branding FnB CAFFE CONTAINER"
  log "2:Grep VIBE CODING con sot va sua het"  
  log "3:Update styles.css FnB color palette"
  exit 1
fi

log "📋 Đọc queue: $QUEUE_FILE"
while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  
  PANE="${line%%:*}"
  TASK="${line#*:}"
  
  log "━━━ Task cho P${PANE}: ${TASK} ━━━"
  
  # Đợi worker rảnh
  while ! send_task "$PANE" "$TASK"; do
    sleep $CHECK_INTERVAL
  done
  
  # ĐỢI WORKER XONG trước khi giao task tiếp
  wait_for_worker "$PANE"
  
  log "━━━ P${PANE} HOÀN THÀNH ━━━"
  echo ""
  
done < "$QUEUE_FILE"

log "═══════════════════════════════════════"
log "🎉 TẤT CẢ TASKS HOÀN THÀNH"
log "═══════════════════════════════════════"
