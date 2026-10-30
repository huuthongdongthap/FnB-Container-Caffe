#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8787"
EXPECTED_SHA="${EXPECTED_SHA:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-sha)
      EXPECTED_SHA="${2:-}"
      shift 2
      ;;
    *)
      BASE="$1"
      shift
      ;;
  esac
done

EMAIL="smoke+$(date +%s)@aura.test"
PASSWORD="Passw0rd!"
NAME="Smoke User"
PHONE="0900000000"

pass() { printf 'PASS %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*"; exit 1; }

echo "BASE=$BASE"

# 0 Health check (fail-closed JSON readiness)
HEALTH=$(curl -sS "$BASE/api/health") || fail "health-connect"
echo "$HEALTH" | jq -e '.status == "ok" or .status == "healthy"' >/dev/null 2>/dev/null && pass "health" || fail "health: $HEALTH"

# 1 Register
REG_BODY=$(cat <<EOF
{"email":"$EMAIL","password":"$PASSWORD","name":"$NAME","phone":"$PHONE"}
EOF
)
REG=$(curl -sS -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "$REG_BODY") || fail "register-connect"
echo "$REG" | jq -e '.email' >/dev/null 2>/dev/null && pass "register" || fail "register: $REG"

# 2 Verify (lookup latest code from D1 if needed — smoke only confirms endpoint exists)
# Use GET /api/auth/session to extract unverified state
SES=$(curl -sS "$BASE/api/auth/session")
echo "$SES" | jq -e '.email' >/dev/null 2>/dev/null && pass "session-ok" || fail "session: $SES"

# 3 Create tenant (as unverified this may 403 — record that behavior explicitly)
TENANT_BODY=$(cat <<EOF
{"name":"Smoke Tenant","slug":"smoke-tenant","container_size":"20ft","zone":"A"}
EOF
)
TEN=$(curl -sS -X POST "$BASE/api/saas/tenants/create" \
  -H 'Content-Type: application/json' \
  -d "$TENANT_BODY") || TEN=""
echo "$TEN" | jq -e '.id' >/dev/null 2>/dev/null && pass "tenant-create" || {
  if [[ "$TEN" == *"email_not_verified"* ]]; then
    pass "tenant-create-blocked-by-email-verification"
  else
    fail "tenant-create: $TEN"
  fi
}

# 4 Pricing
PRICE=$(curl -sS "$BASE/api/saas/pricing") || fail "pricing-connect"
echo "$PRICE" | jq -e '. | length' >/dev/null 2>/dev/null && pass "pricing" || fail "pricing: $PRICE"

# 5 Subscriptions list
SUB=$(curl -sS "$BASE/api/subscriptions") || fail "subscriptions-connect"
echo "$SUB" | jq -e '. | length' >/dev/null 2>/dev/null && pass "subscriptions-list" || fail "subscriptions-list: $SUB"

# 6 Receipt route exists (requires invoice id — preflight only; expect 401/404, not 500)
REC=$(curl -sS "$BASE/api/subscriptions/invoices/999999/receipt" -w "\n%{http_code}") || fail "receipt-connect"
STATUS=$(echo "$REC" | tail -n1 || echo 000)
BODY=$(echo "$REC" | sed '$d')
if [[ "$STATUS" =~ ^(401|404)$ ]]; then
  pass "receipt-route-returns-expected-status-$STATUS"
else
  fail "receipt-status-$STATUS body: $BODY"
fi

# 7 Version (fail-closed: require valid non-unknown shortSha and optional EXPECTED_SHA match)
VER=$(curl -sS "$BASE/api/version") || fail "version-connect"
SHORT_SHA=$(echo "$VER" | jq -r '.shortSha // empty' 2>/dev/null || true)
if [[ -z "$SHORT_SHA" || "$SHORT_SHA" == "unknown" || "$SHORT_SHA" == "null" ]]; then
  fail "version-invalid-sha: $VER"
fi
if [[ -n "$EXPECTED_SHA" ]]; then
  EXPECTED_SHORT="${EXPECTED_SHA:0:8}"
  if [[ "${SHORT_SHA:0:8}" != "$EXPECTED_SHORT" ]]; then
    fail "version-sha-mismatch: expected $EXPECTED_SHORT, got $SHORT_SHA"
  fi
fi
pass "version ($SHORT_SHA)"

pass "smoke-ok"
