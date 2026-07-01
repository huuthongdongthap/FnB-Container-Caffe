# Phase 01 — Mixpost Docker + API Setup

**Status:** complete
**Priority:** High
**TDD:** N/A (infrastructure setup)

## Overview

Deploy Mixpost via Docker on cafe VPS/RPi. Install REST API add-on. Generate API token. Configure at least 1 social account (Facebook or Instagram). Document every step for non-technical cafe owner.

## Requirements

### Functional
- Mixpost Docker Compose up and running on `http://<cafe-ip>:9000`
- Mixpost REST API add-on installed (`composer require inovector/mixpost-api`)
- API token generated via POST `/api/mixpost/auth/tokens`
- At least 1 social account connected (Facebook Page or Instagram Business)
- Env vars documented: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`

### Non-functional
- Docker Compose file with MySQL + Redis (3 containers: mixpost, db, redis)
- Guide uses copy-paste commands, zero dev jargon
- Bilingual VN+EN callouts for key steps

## Implementation Steps

1. [ ] Research Mixpost Docker Compose exact config (image tag, env vars, port mapping)
2. [ ] Write `docker-compose.mixpost.yml` with correct settings
3. [ ] Document Mixpost Pro vs Lite API compatibility (verify API add-on works with Lite)
4. [ ] Write setup guide Section 1: Docker deployment
5. [ ] Write setup guide Section 2: API token generation
6. [ ] Write setup guide Section 3: Facebook/Instagram account connection
7. [ ] Test Docker Compose on local machine (verify Mixpost starts, UI accessible, API responds)
8. [ ] Document env vars for CF Worker: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`

## Files

- **NEW:** `docs/mixpost-setup-guide.md` (partial — Sections 1-3)
- **NEW:** `docker-compose.mixpost.yml` (or inline in guide)

## Success Criteria

- [ ] Mixpost Docker starts with `docker-compose up -d`
- [ ] Mixpost UI accessible at `http://localhost:9000`
- [ ] API token generated and tested with curl
- [ ] At least 1 social account shows in Mixpost dashboard
- [ ] Setup guide verified with fresh Docker install
