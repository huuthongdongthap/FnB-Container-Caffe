#!/bin/zsh
# ═══════════════════════════════════════════════════════════════════════
# cleanup-hero-artifacts.sh
#
# Xóa toàn bộ artifacts em tạo nhầm trước đây:
# - MEKONG_CLI_CONVENTIONS.md (Mekong CLI đã global, không cần per-project)
# - plans/hero-aura-integration.md (plan cũ với custom bash)
# - plans/2026-05-04-hero-aura-integration/ (plan v2 vẫn quá detail)
# - scripts/send-hero-task.sh (custom dispatcher, đã có /worker-* commands)
# - .claude-tasks/ (task files cũ)
#
# GIỮ LẠI:
# - css/hero-aura.css     (production code)
# - js/hero-aura.js       (production code)
# - hero-demo.html        (production preview)
#
# Usage: chạy trong claude code cli ở repo root
# ═══════════════════════════════════════════════════════════════════════

set -e

cd "$(git rev-parse --show-toplevel)"

echo "🧹 Xóa artifacts không cần thiết..."

git rm -f MEKONG_CLI_CONVENTIONS.md 2>/dev/null || echo "  (đã xóa) MEKONG_CLI_CONVENTIONS.md"
git rm -f plans/hero-aura-integration.md 2>/dev/null || echo "  (đã xóa) plans/hero-aura-integration.md"
git rm -rf plans/2026-05-04-hero-aura-integration 2>/dev/null || echo "  (đã xóa) plans/2026-05-04-hero-aura-integration/"
git rm -f scripts/send-hero-task.sh 2>/dev/null || echo "  (đã xóa) scripts/send-hero-task.sh"
git rm -rf .claude-tasks 2>/dev/null || echo "  (đã xóa) .claude-tasks/"

# Xóa thư mục scripts nếu rỗng (chỉ còn finalize-merge.sh là legitimate)
# → KHÔNG đụng vào finalize-merge.sh

echo
echo "📋 Files còn lại trong scripts/:"
ls -la scripts/ 2>/dev/null || echo "  (folder không tồn tại)"

echo
echo "📋 Files còn lại trong plans/:"
ls -la plans/ 2>/dev/null || echo "  (folder không tồn tại)"

echo
echo "✅ Cleanup xong. Review thay đổi:"
git status --short

echo
echo "Khi OK thì chạy:"
echo "  /worker-commit cleanup \"remove hero-aura plan/script artifacts (Mekong CLI is global, not per-project)\""
echo "  /worker-push"
