#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
#  FnB Container Caffe — Branded Deploy Script
#  Deploy a branded instance (client-specific) to Cloudflare Workers + Pages.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$PROJECT_DIR/worker"

show_help() {
  cat <<EOF
Usage: bash scripts/deploy-branded.sh <client-name> <domain> [options]

Deploy a branded FnB Container Caffe instance to Cloudflare.

Arguments:
  client-name    Short kebab-case name for the client (e.g. "aura-cafe")
  domain         Custom domain for this instance (e.g. "auraspace.cafe")

Options:
  --worker-only                Deploy only the Cloudflare Worker
  --pages-only                 Deploy only Cloudflare Pages
  --skip-tests                 Skip test gate before deploy
  --skip-migrations            Explicitly skip D1 migrations (default behavior)
  --migration-file <name.sql>  Explicitly apply a single forward migration from worker/db/migrations/
  --skip-verify                Skip post-deploy health + SHA verification
  --help                       Show this help message

Example:
  bash scripts/deploy-branded.sh my-cafe mybrand.com
  bash scripts/deploy-branded.sh aura-cafe auraspace.cafe --skip-tests
EOF
  exit 0
}

# ── Parse arguments ────────────────────────────────────────────────────────
CLIENT_NAME=""
DOMAIN=""
WORKER_ONLY=false
PAGES_ONLY=false
SKIP_TESTS=false
SKIP_MIGRATIONS=false
SKIP_VERIFY=false
REQUESTED_BULK_MIGRATIONS=false
MIGRATION_FILES=()
MIGRATIONS_DIR="$WORKER_DIR/db/migrations"

validate_migration_target() {
  local raw_target="$1"
  if [[ -z "${raw_target}" ]]; then
    echo "ERROR: Empty migration filename passed to --migration-file." >&2
    exit 1
  fi
  if [[ "${raw_target}" == *"*"* || "${raw_target}" == *"?"* || "${raw_target}" == *"["* ]]; then
    echo "ERROR: Wildcard/glob migration selection is forbidden (fail-closed): ${raw_target}" >&2
    exit 1
  fi
  if [[ "${raw_target}" == *".."* ]]; then
    echo "ERROR: Path traversal is forbidden in --migration-file: ${raw_target}" >&2
    exit 1
  fi

  local normalized="${raw_target#./}"
  if [[ "${normalized}" == worker/db/migrations/* ]]; then
    normalized="${normalized#worker/db/migrations/}"
  elif [[ "${normalized}" == db/migrations/* ]]; then
    normalized="${normalized#db/migrations/}"
  fi

  if [[ "${normalized}" == *"/"* ]]; then
    echo "ERROR: Migration file must reside directly in worker/db/migrations/: ${raw_target}" >&2
    exit 1
  fi
  if [[ "${normalized}" == *.down.sql ]]; then
    echo "ERROR: Refusing to apply rollback migration (.down.sql) during forward deploy: ${normalized}" >&2
    exit 1
  fi
  if [[ "${normalized}" != *.sql ]]; then
    echo "ERROR: Migration file must end with .sql: ${normalized}" >&2
    exit 1
  fi
  if [[ ! "${normalized}" =~ ^[0-9]{8}_[0-9]{2}_[a-z0-9_]+\.sql$ ]]; then
    echo "ERROR: Invalid canonical migration filename format (expected YYYYMMDD_NN_slug.sql): ${normalized}" >&2
    exit 1
  fi
  if [[ "${normalized}" == "20260706_11_notifications_push_loyalty.sql" || "${normalized}" == "20260824_02_users_table.sql" ]]; then
    echo "ERROR: Refusing to apply superseded migration per worker/db/migrations/README.md: ${normalized}" >&2
    exit 1
  fi
  if [[ ! -f "${MIGRATIONS_DIR}/${normalized}" ]]; then
    echo "ERROR: Migration file not found in ${MIGRATIONS_DIR}: ${normalized}" >&2
    exit 1
  fi

  local existing
  for existing in "${MIGRATION_FILES[@]+"${MIGRATION_FILES[@]}"}"; do
    if [[ "${existing}" == "${normalized}" ]]; then
      echo "ERROR: Duplicate migration file specified in single invocation (fail-closed): ${normalized}" >&2
      exit 1
    fi
  done

  MIGRATION_FILES+=("${normalized}")
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      show_help
      ;;
    --worker-only)
      WORKER_ONLY=true
      shift
      ;;
    --pages-only)
      PAGES_ONLY=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    --migration-file)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: Missing filename argument after --migration-file" >&2
        exit 1
      fi
      validate_migration_target "$2"
      shift 2
      ;;
    --migration-file=*)
      validate_migration_target "${1#*=}"
      shift
      ;;
    --apply-migrations|--run-migrations|--all-migrations)
      REQUESTED_BULK_MIGRATIONS=true
      shift
      ;;
    --skip-verify)
      SKIP_VERIFY=true
      shift
      ;;
    --*)
      echo "ERROR: Unknown option: $1"
      exit 1
      ;;
    *)
      if [[ -z "$CLIENT_NAME" ]]; then
        CLIENT_NAME="$1"
      elif [[ -z "$DOMAIN" ]]; then
        DOMAIN="$1"
      else
        echo "ERROR: Unexpected argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$CLIENT_NAME" || -z "$DOMAIN" ]]; then
  echo "ERROR: Missing required arguments <client-name> and <domain>"
  echo ""
  show_help
fi

if [[ "$WORKER_ONLY" == "true" && "$PAGES_ONLY" == "true" ]]; then
  echo "ERROR: Cannot combine --worker-only and --pages-only." >&2
  exit 1
fi

if [[ "$REQUESTED_BULK_MIGRATIONS" == "true" && ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  echo "ERROR: Fail-closed guard — refusing bulk historical D1 migration execution without explicit --migration-file=<name.sql>." >&2
  exit 1
fi

if [[ "$SKIP_MIGRATIONS" == "true" && ${#MIGRATION_FILES[@]} -gt 0 ]]; then
  echo "ERROR: Cannot combine --skip-migrations with --migration-file." >&2
  exit 1
fi

PROJECT_NAME="fnb-container-${CLIENT_NAME}"
WORKER_URL="https://worker-${CLIENT_NAME}.agencyos-openclaw.workers.dev"
PAGES_URL="https://${PROJECT_NAME}.pages.dev"
CORS_ORIGIN="${DOMAIN},https://${PROJECT_NAME}.pages.dev"

echo ""
echo "========================================"
echo "  FnB Container Caffe — Branded Deploy"
echo "  Client:  $CLIENT_NAME"
echo "  Domain:  $DOMAIN"
echo "========================================"
echo ""

# ── 0. Prerequisites check ─────────────────────────────────────────────────
echo "[0/6] Checking prerequisites..."
if ! command -v node &>/dev/null; then
  echo "ERROR: node is not installed or not in PATH."
  exit 1
fi
if ! command -v wrangler &>/dev/null; then
  # npx wrangler may work; check that too
  if ! npx --no-install wrangler --version &>/dev/null; then
    echo "ERROR: wrangler is not installed or not in PATH."
    echo "  Install: npm install -g wrangler"
    exit 1
  fi
fi
echo "  node:  $(node --version)"
echo "  wrangler: $(npx wrangler --version 2>&1 | head -1)"
echo "  OK"

# ── 1. Generate .env from template ────────────────────────────────────────
echo ""
echo "[1/6] Generating .env from template..."
ENV_FILE="$PROJECT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  echo "  .env already exists at $ENV_FILE — keeping existing file"
else
  if [[ -f "$PROJECT_DIR/.env.example" ]]; then
    cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
    echo "  Created $ENV_FILE from .env.example"
    echo ""
    echo "  ATTENTION: Edit $ENV_FILE and set real credentials before proceeding:"
    echo "    - PayOS credentials (COD needs no provider credentials)"
    echo "    - SendGrid API key"
    echo "    - Analytics IDs (VITE_GA_MEASUREMENT_ID, VITE_FB_PIXEL_ID)"
    echo ""
    echo "  When ready, re-run this script."
    echo "  (Hint: set SKIP_DOTENV=1 to skip this check)"
    echo ""
    if [[ "${SKIP_DOTENV:-}" != "1" ]]; then
      read -r -p "  Have you configured .env? (y/N) " REPLY
      if [[ "$REPLY" != "y" && "$REPLY" != "Y" ]]; then
        echo "  Exiting — configure .env first, then re-run."
        exit 1
      fi
    fi
  else
    echo "  No .env.example found at $PROJECT_DIR/.env.example — skipping"
  fi
fi
echo "  OK"

# ── 2. Install dependencies ────────────────────────────────────────────────
echo ""
echo "[2/6] Installing dependencies..."
cd "$PROJECT_DIR"
npm install --silent 2>&1 | tail -3
echo "  OK"

# Worker dependencies
cd "$WORKER_DIR"
npm install --silent 2>&1 | tail -3
cd "$PROJECT_DIR"
echo "  OK"

# ── 3. Run tests (optional gate) ─────────────────────────────────────────
if [[ "$SKIP_TESTS" == "false" ]]; then
  echo ""
  echo "[3/6] Running tests..."
  npx vitest run 2>&1 | tail -10
  echo "  OK"
else
  echo ""
  echo "[3/6] Skipping tests (--skip-tests)"
fi

# ── 4. Deploy worker ────────────────────────────────────────────────────
if [[ "$PAGES_ONLY" == "false" ]]; then
  echo ""
  echo "[4/6] Deploying Cloudflare Worker..."
  cd "$WORKER_DIR"
  GIT_COMMIT_SHA=$(cd "$PROJECT_DIR" && git rev-parse HEAD 2>/dev/null || echo "unknown")

  # Temporarily patch wrangler.toml with branded vars
  WRANGLER_CONFIG="$WORKER_DIR/wrangler.toml"
  WRANGLER_BACKUP="$WORKER_DIR/wrangler.toml.bak"
  cp "$WRANGLER_CONFIG" "$WRANGLER_BACKUP"

  # Update worker name, CORS_ORIGIN, and project references in wrangler.toml
  # This is a minimal substitution; for full customization, maintain per-client configs.
  sed -i.tmp "s/^name = \".*\"/name = \"${PROJECT_NAME}\"/" "$WRANGLER_CONFIG"
  rm -f "${WRANGLER_CONFIG}.tmp"
  if grep -q '^CORS_ORIGIN' "$WRANGLER_CONFIG"; then
    sed -i.tmp "s|^CORS_ORIGIN = \".*\"|CORS_ORIGIN = \"${CORS_ORIGIN}\"|" "$WRANGLER_CONFIG"
    rm -f "${WRANGLER_CONFIG}.tmp"
  fi

  # Deploy
  echo "  Deploying worker: ${PROJECT_NAME}..."
  npx wrangler deploy --config wrangler.toml \
    --var GIT_COMMIT_SHA:"$GIT_COMMIT_SHA" 2>&1 | tail -5

  # Restore original wrangler.toml
  mv "$WRANGLER_BACKUP" "$WRANGLER_CONFIG"
  cd "$PROJECT_DIR"
  echo "  OK"
fi

# ── 5. Build + Deploy frontend to Pages ─────────────────────────────────
if [[ "$WORKER_ONLY" == "false" ]]; then
  echo ""
  echo "[5/6] Building and deploying frontend to Cloudflare Pages..."
  npx vite build --mode production 2>&1 | tail -5

  cp robots.txt sitemap.xml dist/ 2>/dev/null || true
  mkdir -p dist/signage && cp -r signage-widgets/*.html dist/signage/ 2>/dev/null || true
  cp -r assets dist/ 2>/dev/null || true

  # ── Cache-busting: generate version.json that Cloudflare sees as a new file ──
  GIT_COMMIT_SHA_FULL=$(cd "$PROJECT_DIR" && git rev-parse HEAD 2>/dev/null || echo "unknown")
  GIT_COMMIT_SHORT=$(echo "$GIT_COMMIT_SHA_FULL" | cut -c1-8)
  BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > dist/version.json << VERSIONEOF
{
  "sha": "$GIT_COMMIT_SHA_FULL",
  "shortSha": "$GIT_COMMIT_SHORT",
  "buildTime": "$BUILD_TIMESTAMP",
  "client": "$CLIENT_NAME",
  "deployScript": "deploy-branded.sh"
}
VERSIONEOF
  echo "  Cache-busting version.json written: $GIT_COMMIT_SHORT @ $BUILD_TIMESTAMP"

  npx wrangler pages deploy dist \
    --project-name="$PROJECT_NAME" \
    --branch=main 2>&1 | tail -5

  echo "  OK"
fi

# ── 6. (Optional) D1 Migrations (Fail-closed: explicit --migration-file only) ─
if [[ ${#MIGRATION_FILES[@]} -gt 0 ]]; then
  echo ""
  echo "[6/6] Applying explicitly selected D1 migration(s)..."
  APPLY_ARGS=()
  for migration_name in "${MIGRATION_FILES[@]}"; do
    APPLY_ARGS+=(--file "$migration_name")
  done
  bash "$WORKER_DIR/scripts/apply-migrations.sh" "${APPLY_ARGS[@]}"
  echo "  OK"
else
  echo ""
  echo "[6/6] Skipping D1 migrations by default (fail-closed: pass --migration-file=<name.sql> to apply an explicit migration)"
fi

# ── Post-deploy verification ─────────────────────────────────────────────
if [[ "$SKIP_VERIFY" == "false" ]]; then
  VERIFY_WORKER_URL="${DEPLOY_HEALTH_URL:-$WORKER_URL}"
  VERIFY_PAGES_DOMAIN="${DEPLOY_PAGES_URL:-https://$DOMAIN}"
  LOCAL_SHA="$(cd "$PROJECT_DIR" && git rev-parse HEAD 2>/dev/null | cut -c1-8 || echo "unknown")"
  MAX_RETRIES="${DEPLOY_VERIFY_RETRIES:-3}"
  RETRY_DELAY="${DEPLOY_VERIFY_RETRY_DELAY:-5}"

  echo ""
  echo "--- Post-deploy Verification ---"
  echo "  Worker URL: $VERIFY_WORKER_URL"
  echo "  Pages URL:  $PAGES_URL"
  echo "  Custom domain: $VERIFY_PAGES_DOMAIN"
  echo ""

  if [[ "$PAGES_ONLY" == "false" ]]; then
    # Health check
    for i in $(seq 1 $MAX_RETRIES); do
      echo "[Verify $i/$MAX_RETRIES] Checking /api/health..."
      HEALTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$VERIFY_WORKER_URL/api/health" 2>/dev/null || echo "000")
      if [[ "$HEALTH_STATUS" == "200" ]]; then
        echo "  Health: OK (HTTP $HEALTH_STATUS)"
        break
      fi
      if [[ $i -lt $MAX_RETRIES ]]; then
        echo "  Health: Got HTTP $HEALTH_STATUS, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
      else
        echo "  Health: FAILED after $MAX_RETRIES attempts (HTTP $HEALTH_STATUS)"
        echo "ERROR: Health endpoint not healthy. Deploy may have failed."
        exit 1
      fi
    done

    # SHA match
    for i in $(seq 1 $MAX_RETRIES); do
      echo "[Verify $i/$MAX_RETRIES] Checking /api/version SHA match..."
      VERSION_JSON=$(curl -s --max-time 5 "$VERIFY_WORKER_URL/api/version" 2>/dev/null || echo '{}')
      LIVE_SHA=$(echo "$VERSION_JSON" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "MISSING")

      if [[ "$LIVE_SHA" == "$LOCAL_SHA" ]]; then
        echo "  SHA Match: $LIVE_SHA == $LOCAL_SHA"
        break
      fi
      if [[ $i -lt $MAX_RETRIES ]]; then
        echo "  SHA Mismatch: live=$LIVE_SHA local=$LOCAL_SHA, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
      else
        echo "  SHA MISMATCH after $MAX_RETRIES attempts: live=$LIVE_SHA local=$LOCAL_SHA"
        echo "ERROR: Deployed version does not match local commit. Deploy may not have propagated."
        exit 1
      fi
    done
  fi

  if [[ "$WORKER_ONLY" == "false" ]]; then
    # Custom domain version match
    echo ""
    echo "[Verify] Checking custom domain $VERIFY_PAGES_DOMAIN/version.json..."
    for i in $(seq 1 $MAX_RETRIES); do
      echo "[Verify $i/$MAX_RETRIES] ..."
      PAGES_VERSION_JSON=$(curl -s --max-time 5 "$VERIFY_PAGES_DOMAIN/version.json" 2>/dev/null || echo '{}')
      PAGES_SHA=$(echo "$PAGES_VERSION_JSON" | grep -o '"shortSha"[^,]*' | cut -d'"' -f4 || echo "MISSING")
      PAGES_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$VERIFY_PAGES_DOMAIN/version.json" 2>/dev/null || echo "000")

      if [[ "$PAGES_SHA" == "$LOCAL_SHA" ]]; then
        echo "  Custom domain SHA Match: $PAGES_SHA == $LOCAL_SHA (HTTP $PAGES_HTTP)"
        break
      fi
      if [[ $i -lt $MAX_RETRIES ]]; then
        echo "  Custom domain SHA Mismatch: pages=$PAGES_SHA local=$LOCAL_SHA, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
      else
        echo "  Custom domain SHA DISCREPANCY after $MAX_RETRIES attempts: pages=$PAGES_SHA local=$LOCAL_SHA (HTTP $PAGES_HTTP)"
        echo "ERROR: Custom domain version does not match local commit. Run 'bash scripts/deploy-fix.sh' or investigate caching."
        exit 1
      fi
    done
  fi

  echo "--- Verification PASSED ---"
else
  echo ""
  echo "Skipping post-deploy verification (--skip-verify)"
fi

# ── Output URLs and next steps ──────────────────────────────────────────
echo ""
echo "========================================"
echo "  DEPLOY COMPLETE"
echo "========================================"
echo ""
echo "  Client:          $CLIENT_NAME"
echo "  Domain:          $DOMAIN"
echo ""
echo "  Worker URL:      $WORKER_URL"
echo "  Pages URL:       $PAGES_URL"
echo ""
echo "  Next Steps:"
echo "  1. Point DNS:   CNAME $DOMAIN -> ${PROJECT_NAME}.pages.dev"
echo "  2. Set secrets: npx wrangler secret put JWT_SECRET"
echo "  3. Set secrets: npx wrangler secret put PAYOS_CLIENT_ID"
echo "  4. Set secrets: npx wrangler secret put PAYOS_API_KEY"
echo "  5. Set secrets: npx wrangler secret put PAYOS_CHECKSUM_KEY"
echo "  6. Verify:      curl $WORKER_URL/api/health"
echo ""
echo "  Secrets reference: $WORKER_DIR/wrangler.toml (lines 39+)"
echo ""
echo "========================================"
