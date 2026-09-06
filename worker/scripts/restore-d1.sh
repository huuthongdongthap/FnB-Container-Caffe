#!/bin/bash
# D1 Restore Script for F&B Caffe Container
# Usage: bash scripts/restore-d1.sh <backup-file.sql> [--remote|--local] [--target-db name]

set -e

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: bash scripts/restore-d1.sh <backup-file.sql> [--remote|--local] [--target-db name]"
  echo ""
  echo "Available backups:"
  ls -la ./backups/*.sql 2>/dev/null | head -10
  exit 1
fi

TARGET_DB="fnb-caffe-db"
REMOTE_FLAG="--remote"
shift

while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      REMOTE_FLAG="--local"
      shift
      ;;
    --target-db)
      TARGET_DB="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo "=== D1 Restore ==="
echo "Backup file: $BACKUP_FILE"
echo "Target DB: $TARGET_DB"
echo "Mode: $REMOTE_FLAG"
echo ""

# Confirm
read -p "This will OVERWRITE the target database. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Execute restore
npx wrangler d1 execute "$TARGET_DB" $REMOTE_FLAG --file "$BACKUP_FILE"

echo ""
echo "=== Restore Complete ==="
echo "Verify by running: npx wrangler d1 execute $TARGET_DB $REMOTE_FLAG --command \"SELECT COUNT(*) FROM orders\""
