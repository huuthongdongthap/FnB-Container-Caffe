#!/bin/zsh
# ═══════════════════════════════════════════════════════
# 🌊 send-hero-task.sh — Hero AURA Integration Dispatcher
#
# Wraps send_task.sh with pre-built task content for the
# hero-aura-integration plan. Sends instructions to a
# Claude Code CLI worker pane in tmux session tom_hum:fnb.
#
# Usage:
#   ./scripts/send-hero-task.sh <pane> [phase]
#
# Phases:
#   1   Smoke test only (Task 1)
#   2   Smoke test + report screenshot (Task 1+2) [DEFAULT]
#   3   Apply user feedback tweaks (Task 3) — requires FEEDBACK env var
#   4   Final validation (Task 4)
#   all Run all phases sequentially (1 → 2 → wait → 3 → 4)
#
# Examples:
#   ./scripts/send-hero-task.sh 2
#   ./scripts/send-hero-task.sh 3 3
#   FEEDBACK="Ripple chậm hơn, particles 30" ./scripts/send-hero-task.sh 3 3
# ═══════════════════════════════════════════════════════

set -e

PANE="${1:-2}"
PHASE="${2:-2}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN_PATH="plans/hero-aura-integration.md"
SEND_TASK="${REPO_ROOT}/send_task.sh"

if [[ ! -f "$SEND_TASK" ]]; then
  echo "❌ Không tìm thấy ${SEND_TASK}"
  exit 1
fi

if [[ ! -f "${REPO_ROOT}/${PLAN_PATH}" ]]; then
  echo "❌ Không tìm thấy ${PLAN_PATH}"
  echo "   Pull branch claude/focused-tharp trước nhé."
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "🌊 Hero AURA Task Dispatcher"
echo "   Pane:  P${PANE} (tmux: tom_hum:fnb.${PANE})"
echo "   Phase: ${PHASE}"
echo "   Plan:  ${PLAN_PATH}"
echo "═══════════════════════════════════════════════════"
echo

# ─────────────────────────────────────────────────────
# Phase 1 — Smoke test
# ─────────────────────────────────────────────────────
run_phase_1() {
  echo "🚀 Phase 1: Smoke test"
  local TASK=$(cat <<'EOF'
Đọc plan plans/hero-aura-integration.md, sau đó CHỈ làm Pre-flight Checks + TASK 1 (Smoke test local). Không làm task khác. Báo cáo:
1. Pre-flight pass/fail (4 mục)
2. URL hero-demo đang chạy (localhost port nào)
3. Console error count
4. 4 ambient ring có animate đúng không
Dừng sau khi xong TASK 1, đợi instruction tiếp.
EOF
)
  "$SEND_TASK" "$PANE" "$TASK"
}

# ─────────────────────────────────────────────────────
# Phase 2 — Smoke test + report
# ─────────────────────────────────────────────────────
run_phase_2() {
  echo "🚀 Phase 2: Smoke test + screenshot report"
  local TASK=$(cat <<'EOF'
Đọc plan plans/hero-aura-integration.md. Làm Pre-flight Checks + TASK 1 (Smoke test) + TASK 2 (Report). Đặc biệt:
- Verify đầy đủ Acceptance Criteria mục Visual + Functional trong plan
- Comment lên GitHub Issue về hero-aura-integration với:
  + Pre-flight result
  + Console error count (phải = 0)
  + Acceptance criteria checklist (mark ✅/❌)
  + Câu hỏi: "Anh xem hero-demo có gì cần chỉnh không ạ?"
- Tuyệt đối KHÔNG làm TASK 3 hay tweak gì cả. DỪNG đợi feedback.
EOF
)
  "$SEND_TASK" "$PANE" "$TASK"
}

# ─────────────────────────────────────────────────────
# Phase 3 — Apply feedback tweaks
# ─────────────────────────────────────────────────────
run_phase_3() {
  if [[ -z "$FEEDBACK" ]]; then
    echo "⚠️  Phase 3 cần FEEDBACK env var."
    echo "   Ví dụ: FEEDBACK=\"Ripple chậm hơn 9s, particles 30\" $0 $PANE 3"
    exit 1
  fi

  echo "🚀 Phase 3: Apply feedback"
  echo "   Feedback: ${FEEDBACK}"
  local TASK=$(cat <<EOF
Đọc plan plans/hero-aura-integration.md mục TASK 3. Apply feedback sau từ anh Thông:

--- FEEDBACK ---
${FEEDBACK}
--- END ---

Quy tắc:
1. Chỉ đụng 3 file: css/hero-aura.css, js/hero-aura.js, hero-demo.html
2. Mỗi tweak là 1 commit nhỏ với message format: tweak(hero): <gì đổi> per feedback
3. Sau mỗi tweak: reload browser, verify, check console error
4. Push lên claude/focused-tharp sau khi xong tất cả tweak
5. Nếu feedback mơ hồ/conflict/out-of-scope: DỪNG, comment hỏi anh Thông trên issue
EOF
)
  "$SEND_TASK" "$PANE" "$TASK"
}

# ─────────────────────────────────────────────────────
# Phase 4 — Final validation
# ─────────────────────────────────────────────────────
run_phase_4() {
  echo "🚀 Phase 4: Final validation"
  local TASK=$(cat <<'EOF'
Đọc plan plans/hero-aura-integration.md mục TASK 4. Chạy validation cuối:
1. npx eslint js/hero-aura.js (phải pass)
2. Mở hero-demo trong browser, check 0 console error
3. Lighthouse Performance score (mobile, only-performance)
4. git status sạch + git log --oneline -10

Comment final lên issue với:
- ✅/❌ checklist từng mục Acceptance Criteria trong plan
- Lighthouse score number
- List commit SHA của các tweak (git log)
- Question: "Em đã xong, anh review nhé?"
EOF
)
  "$SEND_TASK" "$PANE" "$TASK"
}

# ─────────────────────────────────────────────────────
# Main dispatcher
# ─────────────────────────────────────────────────────
case "$PHASE" in
  1) run_phase_1 ;;
  2) run_phase_2 ;;
  3) run_phase_3 ;;
  4) run_phase_4 ;;
  all)
    run_phase_1
    sleep 5
    run_phase_2
    echo
    echo "⏸  Phase 1+2 done. Chờ anh Thông cho feedback rồi chạy:"
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
echo "✅ Dispatcher exit. Check pane P${PANE} để xem worker progress."
