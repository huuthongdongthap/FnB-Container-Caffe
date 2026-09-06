#!/usr/bin/env bash
# Production Smoke Tests for F&B Caffe Container
# Usage: bash scripts/smoke-production.sh <BASE_URL>

set -euo pipefail

BASE="${1:-https://api.auraspace.cafe}"

pass() { printf 'PASS %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*"; exit 1; }

echo "=== Production Smoke Tests ==="
echo "BASE=$BASE"
echo ""

# 1. Health check (deep with DB)
HEALTH=$(curl -sS "$BASE/api/health?db=1") || fail "health-connect"
echo "$HEALTH" | jq -e '.status == "healthy" or .status == "degraded"' >/dev/null && pass "health" || fail "health: $HEALTH"

# 2. Version endpoint
VER=$(curl -sS "$BASE/api/version") || fail "version-connect"
echo "$VER" | jq -e '.sha' >/dev/null && pass "version" || fail "version: $VER"

# 3. Public menu
MENU=$(curl -sS "$BASE/api/menu") || fail "menu-connect"
echo "$MENU" | jq -e '.success == true' >/dev/null && pass "menu" || fail "menu: $MENU"

# 4. Auth register (ephemeral test user)
TEST_EMAIL="smoke-$(date +%s)@aura.test"
REG=$(curl -sS -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Passw0rd!\",\"name\":\"Smoke Test\"}") || fail "register-connect"
echo "$REG" | jq -e '.success == true' >/dev/null && pass "register" || fail "register: $REG"

# 5. Auth login
LOGIN=$(curl -sS -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Passw0rd!\"}") || fail "login-connect"
TOKEN=$(echo "$LOGIN" | jq -r '.token // empty')
[[ -n "$TOKEN" ]] && pass "login" || fail "login: $LOGIN"

# 6. Auth me (protected)
ME=$(curl -sS "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN") || fail "me-connect"
echo "$ME" | jq -e '.email == "'$TEST_EMAIL'"' >/dev/null && pass "auth-me" || fail "auth-me: $ME"

# 7. Order creation (public - guest)
ORDER_BODY=$(cat <<EOJ
{"items":[{"productId":"prod_test_001","quantity":1}],"customerInfo":{"name":"Smoke Test","phone":"0900000001"},"channel":"pos"}
EOJ
)
ORDER=$(curl -sS -X POST "$BASE/api/orders" \
  -H 'Content-Type: application/json' \
  -d "$ORDER_BODY") || fail "order-connect"
ORDER_ID=$(echo "$ORDER" | jq -r '.data.id // .order_id // empty')
[[ -n "$ORDER_ID" ]] && pass "order-create" || fail "order-create: $ORDER"

# 8. Payment link creation (requires auth)
PAY=$(curl -sS -X POST "$BASE/api/payment/create-link" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"amount\":50000,\"description\":\"Smoke test\"}") || fail "payment-connect"
echo "$PAY" | jq -e '.checkoutUrl' >/dev/null && pass "payment-link" || fail "payment-link: $PAY"

# 9. Admin endpoint (requires owner - will 403 for test user, that's expected)
ADMIN=$(curl -sS "$BASE/api/admin/orders" -H "Authorization: Bearer $TOKEN")
if echo "$ADMIN" | jq -e '.success == false' >/dev/null; then
  if echo "$ADMIN" | grep -q "Không đủ quyền"; then
    pass "admin-forbidden-as-expected"
  else
    fail "admin-unexpected: $ADMIN"
  fi
else
  pass "admin-access"
fi

# 10. Webhook endpoint alive (GET returns OK)
WH=$(curl -sS "$BASE/api/webhook/payos") || fail "webhook-connect"
echo "$WH" | jq -e '.message' >/dev/null && pass "webhook-alive" || fail "webhook-alive: $WH"

# 11. Correlation ID header present
HDR=$(curl -sS -D - -o /dev/null "$BASE/api/health" | grep -i "x-request-id" || true)
[[ -n "$HDR" ]] && pass "correlation-header" || fail "correlation-header missing"

# 12. CORS headers on preflight
CORS=$(curl -sS -X OPTIONS -H "Origin: https://auraspace.cafe" -H "Access-Control-Request-Method: POST" -D - -o /dev/null "$BASE/api/health" | grep -i "access-control-allow-origin" || true)
[[ -n "$CORS" ]] && pass "cors-headers" || fail "cors-headers missing"

echo ""
echo "=== ALL SMOKE TESTS PASSED ==="
