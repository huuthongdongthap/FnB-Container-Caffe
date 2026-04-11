#!/bin/bash
# ============================================================
# finalize-merge.sh — Hoàn tất merge release/merged
# Chạy từ Terminal LOCAL (không phải sandbox)
# cd ~/mekong-cli/FnB-Container-Caffe && bash scripts/finalize-merge.sh
# ============================================================

set -e
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "▶ [1/5] Xóa git lock files..."
rm -f .git/index.lock .git/MERGE_HEAD .git/MERGE_MSG 2>/dev/null || true

echo "▶ [2/5] Xóa legacy .min files..."
# ── JS ────────────────────────────────────────────────────
rm -f js/cart.min.js
rm -f js/checkout.min.js
rm -f js/i18n.min.js
rm -f js/kds-app.min.js
rm -f js/loyalty-ui.min.js
rm -f js/loyalty.min.js
rm -f js/menu.min.js
rm -f js/reviews.min.js
rm -f js/script.min.js
rm -f js/theme.min.js
rm -f js/ui-animations.min.js
rm -f js/ui-enhancements.min.js
# ── CSS ───────────────────────────────────────────────────
rm -f css/about-m3.min.css
rm -f css/admin.min.css
rm -f css/checkout-styles.min.css
rm -f css/kds-m3.min.css
rm -f css/kds-styles.min.css
rm -f css/loyalty-m3.min.css
rm -f css/loyalty-styles.min.css
rm -f css/payment-modal.min.css
rm -f css/print-receipt.min.css
rm -f css/styles.min.css
rm -f css/track-order-styles.min.css
rm -f css/ui-enhancements.min.css
echo "   ✓ Đã xóa $(ls js/*.min.js css/*.min.css 2>/dev/null | wc -l) files còn lại (0 = sạch)"

echo "▶ [3/5] Stage tất cả thay đổi..."
git add \
  index.html checkout.html menu.html contact.html \
  admin/dashboard.html kitchen-display.html table-reservation.html \
  about-us.html failure.html success.html kds.html loyalty.html track-order.html \
  css/styles.css \
  dashboard/admin.html dashboard/dashboard.js \
  dashboard/dashboard-api.js dashboard/dashboard-render.js \
  js/checkout.js js/kds-app.js js/script.js \
  js/checkout/cart-summary.js js/checkout/payment.js js/checkout/qr-code.js \
  js/kds/kds-api.js js/kds/kds-render.js \
  js/landing/form-validation.js js/landing/gallery.js \
  package.json vite.config.js \
  tests/checkout.test.js tests/dashboard.test.js \
  tests/kds-system.test.js tests/order-system.test.js \
  _archive/ \
  scripts/finalize-merge.sh \
  2>/dev/null || true

# Remove deleted .min files from index
git rm --cached \
  js/cart.min.js js/checkout.min.js js/i18n.min.js js/kds-app.min.js \
  js/loyalty-ui.min.js js/loyalty.min.js js/menu.min.js js/reviews.min.js \
  js/script.min.js js/theme.min.js js/ui-animations.min.js js/ui-enhancements.min.js \
  css/about-m3.min.css css/admin.min.css css/checkout-styles.min.css \
  css/kds-m3.min.css css/kds-styles.min.css css/loyalty-m3.min.css \
  css/loyalty-styles.min.css css/payment-modal.min.css css/print-receipt.min.css \
  css/styles.min.css css/track-order-styles.min.css css/ui-enhancements.min.css \
  2>/dev/null || true

echo "▶ [4/5] Commit..."
git commit -m "release: merge focused-tharp UI + optimistic-khorana modularization

- HTML: New AURA SPACE UI (from claude/focused-tharp)
  * index, menu, checkout, contact, admin/dashboard
  * kitchen-display, table-reservation + new admin/pos.html
- JS: ES module split (from claude/optimistic-khorana)
  * js/checkout/ → cart-summary, payment, qr-code
  * js/kds/ → kds-api, kds-render
  * js/landing/ → form-validation, gallery
  * dashboard/ → dashboard-api, dashboard-render
- Build: vite.config.js updated (subdirs + EXCLUDED_HTML)
- Cleanup: removed 23x legacy .min.js/.min.css files
- Archive: _archive/legacy-monolith-js/ + legacy-min-files/

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "▶ [5/5] Push branch..."
git push origin release/merged

echo ""
echo "✅ DONE — Branch release/merged pushed."
echo "   PR URL: gh pr create --base main --head release/merged --title 'release: merge UI rebuild + JS modularization'"
