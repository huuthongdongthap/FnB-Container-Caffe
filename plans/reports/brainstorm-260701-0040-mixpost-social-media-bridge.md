# Brainstorm Report: Mixpost Social Media Bridge

**Date:** 2026-07-01
**Status:** Approved → `/ck:plan`
**Pillar:** #11 Mixpost — Social Media Scheduling
**Effort:** 20h

## Problem

Cafe owner manually posts to Facebook/Instagram for daily specials, promotions, events. No automation, no scheduling, inconsistent posting. Existing Aura data (menu, promos) never reaches social media automatically.

## Solution

Self-hosted Mixpost (Docker) as publishing engine + CF Worker bridge that auto-generates social posts from Aura D1 data.

**Architecture:**
```
Aura CF Worker → Mixpost API (Docker) → Facebook / Instagram / TikTok
                    ↑
            Mixpost UI (cafe owner schedules manually too)
```

## Why Mixpost (not direct FB/IG API)

- Mixpost provides content calendar, queue, analytics, multi-platform — all free (MIT)
- Direct Facebook/Instagram API requires app review, no calendar, fragile token management
- Docker deploy pattern identical to Xibo — cafe owner already knows the workflow
- Mixpost REST API add-on (`inovector/mixpost-api`) gives full programmatic control

## Phases (20h)

| # | Phase | Effort | Key deliverables |
|---|-------|--------|------------------|
| 01 | Mixpost Docker + API Setup | 3h | Docker compose guide, API token config, Facebook/Instagram account setup, bilingual guide |
| 02 | CF Worker Bridge (TDD) | 8h | `POST /api/mixpost/posts` CRUD, `POST /api/mixpost/generate` from promo/menu, media upload |
| 03 | Auto-Scheduling Cron | 4h | Daily specials auto-post (07:00), promo activation post, content templates with Aura branding |
| 04 | Setup Guide + Finalize | 5h | Bilingual VN+EN guide, integration tests, code review |

## Acceptance Criteria

- [ ] Mixpost Docker running, API token configured, at least 1 social account connected
- [ ] CF Worker can create a scheduled post in Mixpost from a D1 promotion
- [ ] Auto-generated posts have Aura branding (hashtags, cafe name, location)
- [ ] Daily cron pushes today's menu highlights to Mixpost queue
- [ ] Setup guide: copy-paste commands, 0 dev jargon, bilingual VN+EN
- [ ] All tests pass, 0 build errors, 0 regressions
- [ ] Mixpost UI accessible at `http://<cafe-ip>:9000`

## Scope Boundary

**IN:** Docker deployment, CF Worker ↔ Mixpost API bridge, auto-generate from promos/menu, cron scheduling, setup docs
**OUT:** Facebook/Instagram app review (cafe owner), Mixpost Pro features, social analytics in Aura admin, custom post editor (use Mixpost UI)

## Touchpoints

- **NEW:** `worker/src/routes/mixpost.js` — bridge routes
- **NEW:** `tests/mixpost-bridge.test.js` — TDD tests
- **NEW:** `docs/mixpost-setup-guide.md` — bilingual setup guide
- **MODIFIED:** `worker/src/index.js` — register `/api/mixpost` routes
- **READ-ONLY:** `promotions`, `products`, `categories` D1 tables

## Risks

| Risk | Mitigation |
|------|------------|
| Mixpost REST API add-on requires Mixpost Pro (not Lite) | Verify during Phase 01; Lite has basic API, add-on may need Pro |
| Facebook/Instagram API token expiry | Document token refresh in setup guide; Mixpost handles renewal |
| Docker resource usage (competing with Xibo) | Mixpost Lite is lightweight; can share VPS with Xibo if 2GB+ RAM |
| Cafe owner doesn't use it (UX friction) | Auto-cron provides value even without manual use; content templates reduce effort |

## Next Step

`/ck:plan --tdd` recommended — new API routes + cron, need test coverage from start.
