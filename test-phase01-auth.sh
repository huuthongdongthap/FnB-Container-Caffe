#!/bin/bash
# Phase 01 Auth Smoke Test
# Usage: ./test-phase01-auth.sh [base_url]
BASE_URL="${1:-http://localhost:8787}"

echo "=== Phase 01 Auth Smoke ==="

# 1. Register test user
REGISTER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "content-type: application/json" \
  -d '{"phone":"84912345678","password":"Test123456","email":"smoke+test@example.com"}')
HTTP_CODE=$(echo "$REGISTER_RESP" | tail -1)
BODY=$(echo "$REGISTER_RESP" | head -1)
echo "POST /api/auth/register → HTTP $HTTP_CODE"
echo "  Body: ${BODY:0:120}"

# 2. Get verification code from DB if needed (skip if email mock sends 200)
# 3. Verify email
VERIFY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/verify-email" \
  -H "content-type: application/json" \
  -d '{"email":"smoke+test@example.com"}')
HTTP_CODE=$(echo "$VERIFY_RESP" | tail -1)
echo "POST /api/auth/verify-email → HTTP $HTTP_CODE"

# 4. Session
SESSION_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/session" \
  -H "content-type: application/json" \
  -d '{"phone":"84912345678","password":"Test123456"}')
HTTP_CODE=$(echo "$SESSION_RESP" | tail -1)
echo "POST /api/auth/session → HTTP $HTTP_CODE"

# 5. Check email_verified flag in session
SESSION_BODY=$(echo "$SESSION_RESP" | head -1)
if echo "$SESSION_BODY" | grep -q '"email_verified"'; then
  echo "  ✓ email_verified present in session"
else
  echo "  ✗ email_verified missing from session"
fi

echo "=== Phase 01 smoke done ==="
