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

echo "=== D1 Backup ==="
echo "Database: $DB_NAME"
echo "Mode: $REMOTE_FLAG"
echo "Output: $OUTPUT_FILE"
echo ""

npx wrangler d1 export "$DB_NAME" $REMOTE_FLAG --output "$OUTPUT_FILE"

echo ""
echo "=== Backup Complete ==="
echo "File: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"

# Also save time-travel bookmark for point-in-time recovery
BOOKMARK=$(npx wrangler d1 time-travel info "$DB_NAME" 2>/dev/null | grep "bookmark" | awk -F"'" '{print $2}')
if [[ -n "$BOOKMARK" ]]; then
  echo "$BOOKMARK" > "$OUTPUT_DIR/${DB_NAME}-${TIMESTAMP}.bookmark"
  echo "Bookmark: $BOOKMARK (saved to .bookmark file)"
fi
