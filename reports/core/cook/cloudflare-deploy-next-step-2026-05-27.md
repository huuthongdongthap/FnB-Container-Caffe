# Cook Next Step — Cloudflare Deploy

**Date:** 2026-05-27  
**Project:** FnB-Container-Caffe  
**Goal:** Deploy AURA loyalty/cashback fixes for `GRAND_OPENING_6_6_2026`

## Current Status

| Check | Result |
|---|---|
| `CLOUDFLARE_API_TOKEN` in agent shell | Missing |
| `CLOUDFLARE_API_TOKEN` in fresh login shell | Missing |
| Unit tests | Pass, 22 tests |
| Worker dry-run deploy | Pass |
| Worker bundle | 212.28 KiB, gzip 46.82 KiB |
| User terminal deploy | Complete |
| Pages deployment | `https://8182d373.fnb-caffe-container.pages.dev` |
| Worker deployment | `https://aura-space-worker.sadec-marketing-hub.workers.dev` |
| Worker version | `72ca8229-a779-4bb5-86ed-3376e626f4a3` |

## Agent Environment Blocker

The deploy succeeded from the user's terminal, but this agent environment still cannot resolve Cloudflare hostnames, so final production curl verification must run from the user's terminal/network.

## Deploy Commands

Already completed from the user's terminal:

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
WRANGLER_LOG_PATH=/private/tmp/wrangler-logs npx wrangler deploy
```

Full Pages + Worker deploy completed from the user's terminal:

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
WRANGLER_LOG_PATH=/private/tmp/wrangler-logs bash deploy-cloudflare.sh
```

## Post-Deploy Verify

```bash
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/active-campaign

curl -s -o /dev/null -w "Signup page: %{http_code}\n" \
  https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien

curl -s -o /dev/null -w "Launch monitor: %{http_code}\n" \
  https://fnb-caffe-container.pages.dev/admin/launch-monitor
```

Before `2026-06-06 00:00:00`, `/api/loyalty/active-campaign` can correctly return `campaign: null`. During the launch window, it must return `code: GRAND_OPENING_6_6_2026`, `signup_bonus_vnd: 50000`, and `cashback_multiplier: 2`.
