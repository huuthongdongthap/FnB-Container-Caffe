#!/bin/bash
# Deploy worker with local git SHA in wrangler.toml
set -euo pipefail

LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
FULL_SHA=$(git rev-parse HEAD)

echo "Local SHA: $FULL_SHA"

# Update wrangler.toml with current git SHA
sed -i '' "s/^GIT_COMMIT_SHA = .*/GIT_COMMIT_SHA = \"$FULL_SHA\"/" wrangler.toml

echo "Deploying..."
npx wrangler deploy

echo ""
echo "=== Verify deployment ==="
LIVE_SHA=$(curl -s https://aura-space-worker.agencyos-openclaw.workers.dev/api/version | python3 -c "import json,sys; print(json.load(sys.stdin).get('shortSha','?'))" 2>/dev/null || echo "N/A")
echo "Local:  $LOCAL_SHA"
echo "Live:   $LIVE_SHA"

if [ "$LOCAL_SHA" = "$LIVE_SHA" ]; then
  echo "✅ SHA match — deploy verified"
  exit 0
else
  echo "❌ SHA mismatch"
  exit 1
fi
