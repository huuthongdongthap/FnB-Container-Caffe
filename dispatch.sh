#!/bin/zsh
# ═══════════════════════════════════════════════════════
# 🔒 CTO DISPATCHER v3 — 3-PHASE WAIT, ZERO STACKING
# Phase 1: Check ❯ → send task
# Phase 2: Wait for worker to START (no more ❯)
# Phase 3: Wait for worker to FINISH (❯ comes back)
# ═══════════════════════════════════════════════════════

SESSION="tom_hum"
WINDOW="fnb"
QUEUE_FILE="/tmp/fnb_task_queue.txt"
POLL=8

log() { echo "[$(date +%H:%M:%S)] $1"; }

has_prompt() {
  tmux capture-pane -t ${SESSION}:${WINDOW}.$1 -p -S -5 2>/dev/null | grep -q "shortcuts"
}

send_one_task() {
  local pane=$1
  local task="$2"

  # PHASE 1: Đợi worker rảnh (có ❯)
  log "📋 P${pane}: Đợi rảnh..."
  while true; do
    if has_prompt "$pane"; then break; fi
    sleep $POLL
  done

  # Gửi task bằng cách tạo file để tránh rớt chữ trong UI của Claude
  log "📨 P${pane}: Gửi task qua file /tmp/fnb_t_${pane}.txt"
  echo "$task" > "/tmp/fnb_t_${pane}.txt"
  
  tmux send-keys -t ${SESSION}:${WINDOW}.${pane} "Doc va thuc hien cac yeu cau trong file /tmp/fnb_t_${pane}.txt. Khong hoi them."
  sleep 1
  tmux send-keys -t ${SESSION}:${WINDOW}.${pane} Enter

  # PHASE 2: Đợi worker BẮT ĐẦU (❯ biến mất)
  log "⏳ P${pane}: Đợi bắt đầu xử lý..."
  sleep 5  # cho Claude CLI thời gian parse input
  local started=0
  for attempt in {1..30}; do
    if ! has_prompt "$pane"; then
      started=1
      log "🔄 P${pane}: Đang xử lý..."
      break
    fi
    sleep 3
  done

  if [[ $started -eq 0 ]]; then
    log "⚠️  P${pane}: Không detect được xử lý, nhưng vẫn đợi 60s..."
    sleep 60
  fi

  # PHASE 3: Đợi worker XONG (❯ quay lại)
  log "⏳ P${pane}: Đợi xong..."
  while true; do
    sleep $POLL
    if has_prompt "$pane"; then
      # Double check: đợi thêm 5s rồi check lại
      sleep 5
      if has_prompt "$pane"; then
        log "✅ P${pane}: XONG!"
        log "--- Kết quả P${pane} ---"
        tmux capture-pane -t ${SESSION}:${WINDOW}.${pane} -p -S -15 2>/dev/null | tail -8
        log "---"
        return 0
      fi
    fi
  done
}

# ═══ MAIN ═══
log "═══════════════════════════════════════"
log "🔒 DISPATCHER v3 — ZERO STACKING"
log "═══════════════════════════════════════"

if [[ ! -f "$QUEUE_FILE" ]]; then
  log "❌ Không có $QUEUE_FILE"
  exit 1
fi

# Xử lý song song cho từng Pane nhưng vẫn giữ thứ tự tuần tự của mỗi Pane
for current_pane in $(cat "$QUEUE_FILE" | grep -v "^#" | cut -d':' -f1 | sort -u); do
  (
    grep "^${current_pane}:" "$QUEUE_FILE" | while IFS= read -r line; do
      TASK="${line#*:}"
      log ""
      log "━━━━━━━━━━━━━━━━ P${current_pane} ━━━━━━━━━━━━━━"
      send_one_task "$current_pane" "$TASK"
    done
  ) &
done

wait
log ""
log "═══════════════════════════════════════"
log "🎉 TẤT CẢ TASKS ĐÃ HOÀN THÀNH"
log "═══════════════════════════════════════"
