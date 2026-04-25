#!/usr/bin/env bash
set -euo pipefail
DEPLOY_DIR="_deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
rsync -a --exclude-from=.cfignore --exclude="$DEPLOY_DIR" --exclude=".git" ./ "$DEPLOY_DIR/"
wrangler pages deploy "$DEPLOY_DIR" --project-name=fnb-caffe-container --branch=main --commit-dirty=true
