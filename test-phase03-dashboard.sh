#!/bin/bash
# Phase 03 Dashboard Smoke Test
BASE_URL="${1:-http://localhost:8787}"

echo "=== Phase 03 Dashboard Smoke ==="

# Check dashboard page loads (HTML)
DASH_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/saas/dashboard")
HTTP_CODE=$(echo "$DASH_RESP" | tail -1)
echo "GET /saas/dashboard → HTTP $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  BODY=$(echo "$DASH_RESP" | head -1)
  if echo "$BODY" | grep -qi "dashboard\|subscription\|plan"; then
    echo "  ✓ Dashboard content detected"
  else
    echo "  ⚠ 200 but dashboard content unclear"
  fi
elif [ "$HTTP_CODE" = "404" ]; then
  echo "  ✗ Dashboard route not found — page not created or not mounted"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "  ✗ 403 — auth required, cannot verify content without login"
else
  echo "  ✗ Unexpected status"
fi

echo "=== Phase 03 smoke done ==="
