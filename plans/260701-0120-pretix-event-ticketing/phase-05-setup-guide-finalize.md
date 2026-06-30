# Phase 05 — Setup Guide + Finalize

**Status:** complete
**Priority:** Medium
**Effort:** 5h
**TDD:** N/A (docs + integration finalization)

## Overview

Consolidate into bilingual VN+EN setup guide. Run full integration tests. Code review. Roadmap update. Git commit.

## Setup Guide (`docs/pretix-setup-guide.md`)

Structure (follows Xibo + Mixpost pattern):

### Section 1: Docker Deployment
- Prerequisites: Docker + docker-compose, 2GB+ RAM, PostgreSQL + Redis
- Download docker-compose file + pretix.cfg template
- `docker-compose up -d`
- First login: create admin user, run migrations
- Configure nginx reverse proxy with Let's Encrypt

### Section 2: Organizer + Event Setup
- Create organizer (Aura Cafe)
- Create first event with ticket types
- Configure payment method (manual bank transfer or VNPay plugin)
- Set ticket quotas + availability dates

### Section 3: API Token + Worker Config
- Generate API token: pretix Admin → User → API tokens
- Add to Cloudflare Worker env vars:
  - `PRETIX_API_URL` = `https://tickets.auraspace.cafe`
  - `PRETIX_API_TOKEN` = `<token>`
  - `PRETIX_ORGANIZER` = `aura-cafe`
  - `PRETIX_WEBHOOK_SECRET` = `<random 32-char>`
- Test connection

### Section 4: Widget Embed
- Copy widget snippet to `/workshops` page
- Customize CSS for Aura branding
- Test purchase flow end-to-end

### Section 5: Check-in Scanner
- Simple web page at `/checkin` that scans QR codes
- Uses device camera → extracts ticket secret → calls `/api/pretix/checkin`
- Shows green/yellow/red result

### Section 6: Troubleshooting
- pretix won't start (port conflict, DB connection)
- API returns 401 (token expired)
- Webhook not receiving (check nginx, signature secret)
- Widget not loading (CORS, HTTPS)

## Finalize Steps

1. [ ] Write `docs/pretix-setup-guide.md` (bilingual VN+EN)
2. [ ] Run full test suite → 0 failures
3. [ ] Build verification → 0 errors
4. [ ] Code review via `code-reviewer` agent
5. [ ] Docs update via `docs-manager` agent (ROADMAP, CHANGELOG, ARCHITECTURE)
6. [ ] Git commit via `git-manager` agent
7. [ ] Journal entry via `journal-writer` agent

## Success Criteria

- [ ] Setup guide verified — copy-paste commands work
- [ ] All integration tests pass
- [ ] Full test suite: 0 failures, 0 regressions
- [ ] Build: 0 errors
- [ ] Bilingual VN+EN callouts in all guide sections
- [ ] Roadmap updated: pretix 🟢 Complete
