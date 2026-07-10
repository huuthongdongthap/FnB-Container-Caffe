#!/bin/bash
# PayOS Sandbox Dry-Run Test
# Usage: bash scripts/tools/payos-sandbox-test.sh [OWNER_JWT_TOKEN]
# Prerequisites:
#   - PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY set in wrangler secrets
#   - OWNER_JWT_TOKEN from admin login (POST /api/auth/login)

set -euo pipefail

BASE_URL="${1:-https://aura-space-worker.agencyos-openclaw.workers.dev}"
AUTH_TOKEN="${2:-}"   # Owner JWT from /api/auth/login
WEBHOOK_URL="$BASE_URL/api/webhook/payos"
ORDER_ID="TEST-$(date +%s)"
AMOUNT=50000

auth_header=""
if [ -n "$AUTH_TOKEN" ]; then
  auth_header="-H \"Authorization: Bearer $AUTH_TOKEN\""
fi

echo "=============================================="
echo "  PayOS Sandbox Dry-Run Test"
echo "=============================================="
echo ""

# Step 1: Create payment link
echo "📝 Step 1: Create payment link for order $ORDER_ID"
CREATE_CMD="curl -s -X POST \"$BASE_URL/api/payment/create-link\" \
  -H \"Content-Type: application/json\" \
  -d '{\"order_id\":\"$ORDER_ID\",\"amount\":$AMOUNT,\"description\":\"Sandbox test\"}'"
if [ -n "$AUTH_TOKEN" ]; then
  CREATE_CMD="$CREATE_CMD -H \"Authorization: Bearer $AUTH_TOKEN\""
fi
CREATE_RESP=$(eval $CREATE_CMD)
echo "$CREATE_RESP" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESP"
LINK=$(echo "$CREATE_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('checkoutUrl',''))" 2>/dev/null || echo "")

if [ -z "$LINK" ]; then
  echo "❌ FAILED: Could not create payment link"
  echo "$CREATE_RESP"
  exit 1
fi
echo "✅ Payment link: $LINK"
echo ""

# Step 2: Simulate PayOS IPN webhook
echo "📨 Step 2: Simulate PayOS IPN webhook → $WEBHOOK_URL"
WEBHOOK_RESP=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Payos-Signature: test-sig-sandbox" \
  -d "{\"orderCode\":\"$ORDER_ID\",\"amount\":$AMOUNT,\"code\":\"00\",\"success\":true}")
echo "$WEBHOOK_RESP" | python3 -m json.tool 2>/dev/null || echo "$WEBHOOK_RESP"
echo ""

# Step 3: Check order via admin
echo "🔍 Step 3: Verify order in D1"
if [ -n "$AUTH_TOKEN" ]; then
  ORDERS=$(curl -s "$BASE_URL/api/admin/orders" -H "Authorization: Bearer $AUTH_TOKEN")
  echo "$ORDERS" | python3 -c "import json,sys; d=json.load(sys.stdin); orders=d.get('orders',[]); print(f'Found {len(orders)} orders')" 2>/dev/null || echo "$ORDERS"
else
  echo "⚠️  Skipped — need OWNER_JWT_TOKEN (arg \$2)"
  echo "   Get token: POST $BASE_URL/api/auth/login {\"email\":\"owner@...\",\"password\":\"...\"}"
fi
echo ""
echo "=============================================="
echo "  Done. Open PayOS Dashboard → verify test transaction."
echo "=============================================="
