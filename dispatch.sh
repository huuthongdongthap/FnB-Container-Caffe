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
  tmux capture-pane -t ${SESSION}:${WINDOW}.$1 -p -S -5 2>/dev/null | grep -q "❯"
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

  # Gửi task
  log "📨 P${pane}: Gửi → ${task:0:60}..."
  tmux send-keys -t ${SESSION}:${WINDOW}.${pane} C-u 2>/dev/null
  sleep 0.3
  tmux send-keys -t ${SESSION}:${WINDOW}.${pane} -l "$task"
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

while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  PANE="${line%%:*}"
  TASK="${line#*:}"
  log ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  send_one_task "$PANE" "$TASK"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
done < "$QUEUE_FILE"

log ""
log "═══════════════════════════════════════"
log "🎉 TẤT CẢ TASKS HOÀN THÀNH"
log "═══════════════════════════════════════"
