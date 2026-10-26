#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_CONFIG="$PROJECT_DIR/worker/wrangler.toml"
TARGET="pages"
PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-fnb-caffe-container}"

usage() {
  echo "Usage: bash scripts/deploy-rollback.sh [--target pages|worker|d1] <deployment-id|timestamp|bookmark> [d1-database]"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ $# -eq 0 ]]; then
  usage
  npx wrangler pages deployment list --project-name "$PROJECT_NAME"
  exit 0
fi

if [[ "$1" == "--target" || "$1" == "-t" ]]; then
  [[ $# -ge 3 ]] || fail "Target and rollback identifier are required"
  TARGET="$2"
  shift 2
fi
case "$TARGET" in
  pages|worker|d1) ;;
  *) fail "Unknown rollback target: $TARGET" ;;
esac

ROLLBACK_ID="$1"
shift
[[ -n "$ROLLBACK_ID" ]] || fail "Rollback identifier is required"
[[ $# -eq 0 || ( "$TARGET" == "d1" && $# -eq 1 ) ]] || fail "Unexpected rollback arguments"

if [[ "$TARGET" == "pages" || "$TARGET" == "worker" ]]; then
  [[ "$ROLLBACK_ID" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$ ]] || fail "Deployment/version identifier must be a UUID"
fi

if [[ "$TARGET" == "worker" ]]; then
  [[ -f "$WORKER_CONFIG" ]] || fail "Worker configuration is missing"
  npx wrangler rollback "$ROLLBACK_ID" --config "$WORKER_CONFIG"
elif [[ "$TARGET" == "d1" ]]; then
  [[ -f "$WORKER_CONFIG" ]] || fail "Worker configuration is missing"
  DB_NAME="${1:-fnb-caffe-db}"
  [[ "$DB_NAME" =~ ^[A-Za-z0-9_][A-Za-z0-9_-]*$ ]] || fail "Invalid D1 database name"
  if [[ "$ROLLBACK_ID" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{8}-[[:xdigit:]]{8}-[[:xdigit:]]{32}$ ]]; then
    npx wrangler d1 time-travel restore "$DB_NAME" --bookmark "$ROLLBACK_ID" --config "$WORKER_CONFIG"
  elif [[ "$ROLLBACK_ID" =~ ^[0-9]+$ || "$ROLLBACK_ID" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$ ]]; then
    npx wrangler d1 time-travel restore "$DB_NAME" --timestamp "$ROLLBACK_ID" --config "$WORKER_CONFIG"
  else
    fail "D1 restore requires a Unix/RFC3339 timestamp or a D1 bookmark"
  fi
else
  ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-}}"
  API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
  [[ "$ACCOUNT_ID" =~ ^[[:xdigit:]]{32}$ ]] || fail "Set CLOUDFLARE_ACCOUNT_ID (or CF_ACCOUNT_ID)"
  [[ -n "$API_TOKEN" ]] || fail "Set CLOUDFLARE_API_TOKEN (or CF_API_TOKEN)"
  [[ "$PROJECT_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "Invalid Cloudflare Pages project name"
  RESPONSE_FILE="$(mktemp)"
  trap 'rm -f "$RESPONSE_FILE"' EXIT
  curl --fail --silent --show-error --max-time 30 --request POST \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME/deployments/$ROLLBACK_ID/rollback" \
    --header "Authorization: Bearer $API_TOKEN" --header "Content-Type: application/json" --output "$RESPONSE_FILE"
  node -e '
    const fs = require("node:fs");
    const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (response.success !== true || response.result?.id !== process.argv[2]) {
      console.error("ERROR: Cloudflare did not confirm the requested Pages rollback");
      process.exit(1);
    }
  ' "$RESPONSE_FILE" "$ROLLBACK_ID"
fi

echo "Rollback command completed for $TARGET. Verify the target version and health before resuming traffic."
