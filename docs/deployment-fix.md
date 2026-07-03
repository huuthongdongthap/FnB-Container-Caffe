# Deployment Fix: auraspace.cafe Custom Domain

**Date:** 2026-07-03
**Status:** Pending — needs Cloudflare Dashboard access

## Problem

`auraspace.cafe` is serving OLD content (title: "AURA CAFÉ — Rooftop Container Café").
Latest deploy at `fnb-caffe-container-biy.pages.dev` has new UI (title: "AURA CAFE — Container Caffe Sa Đéc").

## Root Cause

Pages project `fnb-caffe-container` only has domain `fnb-caffe-container-biy.pages.dev`.
`auraspace.cafe` is NOT configured as a custom domain on this Pages project.

## Fix (Cloudflare Dashboard)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **fnb-caffe-container**
2. Tab **Custom Domains** → **Set up a custom domain**
3. Enter `auraspace.cafe` → **Continue** → **Activate Domain**
4. Purge cache: **Speed** → **Cache** → **Purge Everything**
5. Verify: `curl -s https://auraspace.cafe | grep '<title>'` should show "AURA CAFE — Container Caffe Sa Đéc"

## Latest Deploy

| Component | URL | SHA |
|-----------|-----|-----|
| Frontend | `fnb-caffe-container-biy.pages.dev` | `a3aa103` |
| Worker | `aura-space-worker.agencyos-openclaw.workers.dev` | `a3aa103` |

## Files Changed This Session

13 production pages updated to match Stitch AI designs 100%:
- checkout.tsx, KDS.tsx, loyalty.tsx, account/index.tsx, AboutUs.tsx
- ReviewsPage.tsx, events.tsx, referral.tsx, admin/Login.tsx
- admin/POS.tsx, order-success.tsx, App.tsx, test fixes
