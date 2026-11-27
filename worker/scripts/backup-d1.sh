#!/bin/bash
# D1 Backup Script for F&B Caffe Container
# Usage: bash scripts/backup-d1.sh [--remote|--local]

set -e

DB_NAME="fnb-caffe-db"
REMOTE_FLAG="--remote"
OUTPUT_DIR="./backups"

# Parse args
if [[ "$1" == "--local" ]]; then
  REMOTE_FLAG="--local"
  OUTPUT_DIR="./backups/local"
fi

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="$OUTPUT_DIR/${DB_NAME}-${TIMESTAMP}.sql"
ENCRYPTED_FILE="${OUTPUT_FILE}.enc"

if [[ "$REMOTE_FLAG" == "--remote" && -z "${D1_BACKUP_ENCRYPTION_KEY:-}" ]]; then
  echo "Error: D1_BACKUP_ENCRYPTION_KEY environment variable is required for remote D1 backups." >&2
  exit 1
fi

echo "=== D1 Backup ==="
echo "Database: $DB_NAME"
echo "Mode: $REMOTE_FLAG"
echo "Output: $ENCRYPTED_FILE"
echo ""

npx wrangler d1 export "$DB_NAME" $REMOTE_FLAG --output "$OUTPUT_FILE"

if [[ -n "${D1_BACKUP_ENCRYPTION_KEY:-}" ]]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
    -in "$OUTPUT_FILE" \
    -out "$ENCRYPTED_FILE" \
    -pass env:D1_BACKUP_ENCRYPTION_KEY
  rm -f "$OUTPUT_FILE"
  FINAL_FILE="$ENCRYPTED_FILE"
else
  FINAL_FILE="$OUTPUT_FILE"
fi

echo ""
echo "=== Backup Complete ==="
echo "File: $FINAL_FILE"
echo "Size: $(du -h "$FINAL_FILE" | cut -f1)"

# Also save time-travel bookmark for point-in-time recovery
BOOKMARK=$(npx wrangler d1 time-travel info "$DB_NAME" 2>/dev/null | grep "bookmark" | awk -F"'" '{print $2}')
if [[ -n "$BOOKMARK" ]]; then
  echo "$BOOKMARK" > "$OUTPUT_DIR/${DB_NAME}-${TIMESTAMP}.bookmark"
  echo "Bookmark: $BOOKMARK (saved to .bookmark file)"
fi
