# Phase 3: Offline Sync + PWA Shell

**Duration:** 3h | **Agents:** pwa-agent, sync-agent

## Context

Staff work in container with spotty WiFi. App must work fully offline and sync when reconnected.

## Requirements

1. **Offline-first data layer**:
   - KDS data cached in IndexedDB (last known state of all active orders)
   - Table states cached (last known table status)
   - Mutations queued in `offline-db.ts` SyncQueue
   - Sync replay on `online` event + app foreground

2. **PWA Shell**:
   - `public/manifest-mobile.json` — standalone display, theme_color #0A1A2E, name "AURA Mobile"
   - `public/sw-mobile.js` — Workbox SW: cache shell, network-first for API, stale-while-revalidate for menu
   - Service worker auto-registers in `MobileLayout.tsx`
   - Install prompt component for "Add to Home Screen"

3. **Connectivity indicator**:
   - Green dot = online, sync clean
   - Yellow = online, sync pending
   - Red = offline, queueing mutations
   - Count of pending mutations shown in badge

## Files

- `public/manifest-mobile.json` (new)
- `public/sw-mobile.js` (new)
- `src/components/pwa/OfflineIndicator.tsx` (new) or extend existing `OfflineBanner`
- `src/hooks/use-offline-sync.ts` (new)
- `vite.config.js` — copy manifest-mobile.json + sw-mobile.js to dist/ in closeBundle

## Constraints

- SW only intercepts `/mobile/*` + `/api/mobile/*` — don't cache customer pages
- Max queue size: 500 mutations (prevent runaway offline writes)
- TTL for queued mutations: 24h (drop stale updates)
- Sync uses exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 retries)
