#!/bin/zsh
# ═════════════════════════════════════════════════════
# 🌊 send-hero-task.sh — v2 (task-file based)
#
# Sends a TINY ASCII command to the worker pane that tells it to read
# a markdown task file from disk. This avoids tmux send-keys encoding
# issues with multiline Vietnamese content.
#
# The worker is also force-cd'd into the repo root and reminded to
# follow CLAUDE.md before executing.
#
# Usage:
#   ./scripts/send-hero-task.sh <pane> [phase]
#
# Phases: 1, 2 (default), 3, 4, all
#
# Examples:
#   ./scripts/send-hero-task.sh 2 2
#   FEEDBACK="Ripple chậm hơn 9s" ./scripts/send-hero-task.sh 2 3
# ═════════════════════════════════════════════════════

set -e

PANE="${1:-2}"
PHASE="${2:-2}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR=".claude-tasks"
SEND_TASK="${REPO_ROOT}/send_task.sh"

if [[ ! -f "$SEND_TASK" ]]; then
  echo "❌ Không tìm thấy ${SEND_TASK}"
  exit 1
fi

if [[ ! -d "${REPO_ROOT}/${TASKS_DIR}" ]]; then
  echo "❌ Không tìm thấy ${TASKS_DIR}/. Pull branch claude/focused-tharp trước."
  exit 1
fi

echo "══════════════════════════════════════════════════"
echo "🌊 Hero AURA Task Dispatcher v2"
echo "   Pane:  P${PANE} (tmux: tom_hum:fnb.${PANE})"
echo "   Phase: ${PHASE}"
echo "   Repo:  ${REPO_ROOT}"
echo "══════════════════════════════════════════════════"
echo

# ─────────────────────────────────────────────────────
# Helper: send a one-liner ASCII command pointing to a task file
# ─────────────────────────────────────────────────────
send_phase() {
  local phase_num="$1"
  local task_file="${TASKS_DIR}/hero-phase-${phase_num}.md"

  if [[ ! -f "${REPO_ROOT}/${task_file}" ]]; then
    echo "❌ Task file không tồn tại: ${task_file}"
    exit 1
  fi

  # ASCII-only command. Worker will read CLAUDE.md when it cd's in.
  local CMD="cd ${REPO_ROOT} && cat CLAUDE.md && cat ${task_file} && echo READY_TO_EXECUTE_PHASE_${phase_num}"

  echo "🚀 Phase ${phase_num}: sending pointer to ${task_file}"
  "$SEND_TASK" "$PANE" "$CMD"
}

# ─────────────────────────────────────────────────────
# Phase 3 — dynamic: writes task file with FEEDBACK injected
# ─────────────────────────────────────────────────────
run_phase_3() {
  if [[ -z "$FEEDBACK" ]]; then
    echo "⚠️  Phase 3 cần FEEDBACK env var."
    echo "   Ví dụ: FEEDBACK=\"Ripple chậm hơn 9s, particles 30\" $0 $PANE 3"
    exit 1
  fi

  local phase3_file="${REPO_ROOT}/${TASKS_DIR}/hero-phase-3.md"

  echo "✍️  Writing ${phase3_file} with FEEDBACK"
  cat > "$phase3_file" <<EOF
# Phase 3 — Apply Feedback Tweaks

**Read this entire file before doing anything.**

Follow CLAUDE.md execution protocol.

## Feedback from anh Thông

\`\`\`
${FEEDBACK}
\`\`\`

## Steps

1. Read \`plans/hero-aura-integration.md\` section "TASK 3".
2. Parse the feedback above into atomic tweaks.
3. For EACH tweak:
   a. Identify which file(s) need to change (only css/hero-aura.css, js/hero-aura.js, hero-demo.html)
   b. Use str_replace / Edit tool (NOT full file rewrite)
   c. Commit with message: \`tweak(hero): <what changed> per feedback\`
4. Push to \`claude/focused-tharp\`:
   \`\`\`
   git push origin claude/focused-tharp
   \`\`\`
5. Comment summary to issue #16:
   \`\`\`bash
   gh issue comment 16 --repo huuthongdongthap/FnB-Container-Caffe --body "..."
   \`\`\`

## Hard Rules

- Touch ONLY: \`css/hero-aura.css\`, \`js/hero-aura.js\`, \`hero-demo.html\`
- One commit per atomic tweak
- If feedback is ambiguous or out-of-scope: STOP, comment a question on issue #16, do NOT improvise
- Print \`[PHASE 3 DONE]\` when finished
EOF

  send_phase 3
}

# ─────────────────────────────────────────────────────
# Main dispatcher
# ─────────────────────────────────────────────────────
case "$PHASE" in
  1) send_phase 1 ;;
  2) send_phase 2 ;;
  3) run_phase_3 ;;
  4) send_phase 4 ;;
  all)
    send_phase 1
    sleep 5
    send_phase 2
    echo
    echo "⏸  Phase 1+2 sent. Worker sẽ:"
    echo "   - cd vào repo + load CLAUDE.md"
    echo "   - Đọc task file và execute"
    echo "   - Comment kết quả vào issue #16"
    echo
    echo "   Sau khi xong + anh đã cho feedback, chạy:"
    echo "   FEEDBACK=\"...\" $0 $PANE 3"
    echo "   $0 $PANE 4"
    ;;
  *)
    echo "❌ Phase không hợp lệ: ${PHASE}"
    echo "   Dùng: 1, 2, 3, 4, hoặc all"
    exit 1
    ;;
esac

echo
echo "✅ Dispatcher exit. Check pane P${PANE}."
