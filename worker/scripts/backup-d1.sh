#!/bin/bash
# D1 Backup Script for F&B Caffe Container
# Usage: bash scripts/backup-d1.sh [--remote|--local] [--allow-plaintext-local]

set -euo pipefail
umask 077

DB_NAME="fnb-caffe-db"
REMOTE_FLAG="--remote"
OUTPUT_DIR="./backups"
ALLOW_PLAINTEXT_LOCAL="false"

for arg in "$@"; do
  case "$arg" in
    --remote)
      REMOTE_FLAG="--remote"
      OUTPUT_DIR="./backups"
      ;;
    --local)
      REMOTE_FLAG="--local"
      OUTPUT_DIR="./backups/local"
      ;;
    --allow-plaintext-local)
      ALLOW_PLAINTEXT_LOCAL="true"
      ;;
    *)
      echo "Error: Unknown argument '$arg'. Usage: bash scripts/backup-d1.sh [--remote|--local] [--allow-plaintext-local]" >&2
      exit 1
      ;;
  esac
done

if [[ "$REMOTE_FLAG" == "--remote" && -z "${D1_BACKUP_ENCRYPTION_KEY:-}" ]]; then
  echo "Error: D1_BACKUP_ENCRYPTION_KEY environment variable is required for remote D1 backups." >&2
  exit 1
fi

if [[ "$REMOTE_FLAG" == "--local" && -z "${D1_BACKUP_ENCRYPTION_KEY:-}" && "$ALLOW_PLAINTEXT_LOCAL" != "true" ]]; then
  echo "Error: D1_BACKUP_ENCRYPTION_KEY environment variable is required for local D1 backups unless --allow-plaintext-local is explicitly set." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="$OUTPUT_DIR/${DB_NAME}-${TIMESTAMP}.sql"
ENCRYPTED_FILE="${OUTPUT_FILE}.enc"
HMAC_FILE="${ENCRYPTED_FILE}.hmac"

PLAINTEXT_CLEANUP_REQUIRED="true"
TARGET_OUTPUT="$ENCRYPTED_FILE"
if [[ -z "${D1_BACKUP_ENCRYPTION_KEY:-}" && "$REMOTE_FLAG" == "--local" && "$ALLOW_PLAINTEXT_LOCAL" == "true" ]]; then
  PLAINTEXT_CLEANUP_REQUIRED="false"
  TARGET_OUTPUT="$OUTPUT_FILE"
fi

cleanup_plaintext_backup() {
  local rc=$?
  if [[ "$PLAINTEXT_CLEANUP_REQUIRED" == "true" || "$rc" -ne 0 ]]; then
    if [[ -n "${OUTPUT_FILE:-}" && -f "$OUTPUT_FILE" ]]; then
      shred -u "$OUTPUT_FILE" 2>/dev/null || rm -f "$OUTPUT_FILE"
    fi
  fi
}
trap cleanup_plaintext_backup EXIT INT TERM

echo "=== D1 Backup ==="
echo "Database: $DB_NAME"
echo "Mode: $REMOTE_FLAG"
echo "Output: $TARGET_OUTPUT"
echo ""

npx wrangler d1 export "$DB_NAME" $REMOTE_FLAG --output "$OUTPUT_FILE"
test -s "$OUTPUT_FILE"

if [[ -n "${D1_BACKUP_ENCRYPTION_KEY:-}" ]]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
    -in "$OUTPUT_FILE" \
    -out "$ENCRYPTED_FILE" \
    -pass env:D1_BACKUP_ENCRYPTION_KEY
  shred -u "$OUTPUT_FILE" 2>/dev/null || rm -f "$OUTPUT_FILE"
  test -s "$ENCRYPTED_FILE"
  ENCRYPTED_FILE="$ENCRYPTED_FILE" HMAC_FILE="$HMAC_FILE" node -e '
    const crypto = require("node:crypto");
    const fs = require("node:fs");
    const path = require("node:path");
    const key = process.env.D1_BACKUP_ENCRYPTION_KEY;
    if (!key) process.exit(1);
    const hmac = crypto.createHmac("sha256", key);
    const stream = fs.createReadStream(process.env.ENCRYPTED_FILE);
    stream.on("data", (chunk) => hmac.update(chunk));
    stream.on("end", () => {
      const digest = hmac.digest("hex");
      fs.writeFileSync(process.env.HMAC_FILE, `${digest}  ${path.basename(process.env.ENCRYPTED_FILE)}\n`, { mode: 0o600 });
    });
    stream.on("error", (err) => {
      console.error(err);
      process.exit(1);
    });
  '
  test -s "$HMAC_FILE"
  FINAL_FILE="$ENCRYPTED_FILE"
else
  FINAL_FILE="$OUTPUT_FILE"
fi

echo ""
echo "=== Backup Complete ==="
echo "File: $FINAL_FILE"
if [[ -f "$HMAC_FILE" ]]; then
  echo "HMAC: $HMAC_FILE"
fi
echo "Size: $(du -h "$FINAL_FILE" | cut -f1)"

# Also save time-travel bookmark for point-in-time recovery
BOOKMARK=$(npx wrangler d1 time-travel info "$DB_NAME" 2>/dev/null | grep "bookmark" | awk -F"'" '{print $2}' || true)
if [[ -n "$BOOKMARK" ]]; then
  echo "$BOOKMARK" > "$OUTPUT_DIR/${DB_NAME}-${TIMESTAMP}.bookmark"
  echo "Bookmark: $BOOKMARK (saved to .bookmark file)"
fi
