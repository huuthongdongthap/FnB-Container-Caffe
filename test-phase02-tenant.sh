#!/bin/bash
# Phase 02 Tenant Creation Smoke Test
BASE_URL="${1:-http://localhost:8787}"
SESSION_COOKIE="$2"  # Optional: session cookie from Phase 01

echo "=== Phase 02 Tenant Smoke ==="

HEADERS=""
if [ -n "$SESSION_COOKIE" ]; then
  HEADERS="-H 'cookie: $SESSION_COOKIE'"
fi

# Create tenant
TENANT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/saas-tenants/create" \
  -H "content-type: application/json" \
  -H "x-tenant-create: 1" \
  -d '{"name":"Smoke Cafe","container_number":"A-10","zone":"A"}')
HTTP_CODE=$(echo "$TENANT_RESP" | tail -1)
BODY=$(echo "$TENANT_RESP" | head -1)
echo "POST /api/saas-tenants/create → HTTP $HTTP_CODE"
echo "  Body: ${BODY:0:150}"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "  ✓ Tenant created"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "  ✗ 403 — email not verified (expected if Phase 01 incomplete)"
else
  echo "  ✗ Unexpected status"
fi

echo "=== Phase 02 smoke done ==="
