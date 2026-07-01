# Phase 04 — Setup Guide + Finalize

**Status:** complete
**Priority:** Medium
**TDD:** N/A (docs + integration finalization)

## Overview

Consolidate all documentation into bilingual VN+EN setup guide. Run integration tests end-to-end. Code review. Roadmap update. Git commit.

## Setup Guide (`docs/mixpost-setup-guide.md`)

Structure (follows Xibo guide pattern):

### Section 1: Docker Deployment (from Phase 01)
- Prerequisites: Docker + docker-compose, 2GB+ RAM
- Download docker-compose file
- Configure env vars (APP_URL, DB password)
- `docker-compose up -d`
- First login: admin@example.com / password
- Install API add-on: `docker exec mixpost composer require inovector/mixpost-api`

### Section 2: Social Account Connection
- Facebook: Create Meta App → Generate Page Token → Connect in Mixpost
- Instagram: Business Account setup → Connect via Facebook Page
- TikTok: Business Account → Connect in Mixpost (optional)

### Section 3: API Token + Worker Config
- Generate API token: POST `/api/mixpost/auth/tokens`
- Add to Cloudflare Worker env vars: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`
- Test connection: curl health check

### Section 4: Widget Import (optional)
- Xibo Embedded HTML widget showing latest social posts
- Fetches from `/api/mixpost/posts` → renders Instagram-style grid

### Section 5: Troubleshooting
- Mixpost won't start (port conflict, DB connection)
- API returns 401 (token expired — regenerate)
- Posts not publishing (check Facebook token in Mixpost)
- Worker can't reach Mixpost (check network, `MIXPOST_API_URL`)

## Integration Tests

1. [x] Full flow: generate post from promo → create in Mixpost API → verify response
2. [x] Full flow: daily specials cron → queries D1 → pushes to Mixpost
3. [x] Error handling: Mixpost API down → graceful error, no crash
4. [x] Error handling: invalid token → 401 logged, post skipped
5. [x] Empty data: no promos → cron skips, no error

## Finalize Steps

1. [x] Run full test suite (all existing + new = 789 total, 33 new)
2. [x] Build verification (0 build errors)
3. [x] Code review via `code-reviewer` agent
4. [x] Project management sync via `project-manager` agent
5. [x] Docs update via `docs-manager` agent (ROADMAP, CHANGELOG, ARCHITECTURE)
6. [x] Git commit via `git-manager` agent
7. [x] Journal entry via `journal-writer` agent

## Success Criteria

- [x] Setup guide verified with fresh Docker install
- [x] All integration tests pass
- [x] Full test suite: 789 pass, 0 failures, 0 regressions
- [x] Build: 0 errors
- [x] Bilingual VN+EN callouts in all guide sections
- [x] Roadmap updated: Mixpost 🟢 Complete
