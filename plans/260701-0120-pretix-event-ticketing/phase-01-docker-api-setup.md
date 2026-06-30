# Phase 01 — pretix Docker + API Setup

**Status:** complete
**Priority:** HIGH
**Effort:** 3h
**TDD:** N/A (infrastructure setup)

## Overview

Deploy pretix via Docker Compose on cafe VPS. Configure PostgreSQL, Redis, reverse proxy. Generate API token. Create first organizer + event to validate API.

## Requirements

- pretix Docker running on VPS port 9001
- API token generated with read/write access
- At least 1 organizer + 1 event created for API testing
- pretix cron running every 15min

## Docker Compose

```yaml
# docker-compose.pretix.yml
services:
  pretix_db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: pretix
      POSTGRES_PASSWORD: <random>
      POSTGRES_DB: pretix
    volumes:
      - pretix_db:/var/lib/postgresql/data

  pretix_redis:
    image: redis:7-alpine

  pretix_app:
    image: pretix/standalone:stable
    ports:
      - "9001:80"
    environment:
      PRETIX_CONFIG_FILE: /etc/pretix/pretix.cfg
      NUM_WORKERS: 2
    volumes:
      - ./pretix.cfg:/etc/pretix/pretix.cfg:ro
      - pretix_data:/data
    depends_on:
      - pretix_db
      - pretix_redis

  pretix_cron:
    image: pretix/standalone:stable
    command: pretix cron
    environment:
      PRETIX_CONFIG_FILE: /etc/pretix/pretix.cfg
    volumes:
      - ./pretix.cfg:/etc/pretix/pretix.cfg:ro
      - pretix_data:/data
    depends_on:
      - pretix_db
      - pretix_redis

volumes:
  pretix_db:
  pretix_data:
```

## API Token Generation

```bash
# Via pretix admin UI: User → API tokens → Create
# Or via manage.py:
docker exec pretix_app pretix createuser --email admin@cafe.com
docker exec pretix_app pretix createtoken --user admin@cafe.com --name "aura-bridge"
```

## Steps

1. [ ] SSH to cafe VPS, create `/opt/pretix/` directory
2. [ ] Write `pretix.cfg` with PostgreSQL + Redis config, VND currency
3. [ ] Write `docker-compose.pretix.yml`
4. [ ] `docker-compose up -d`
5. [ ] Run migrations: `docker exec pretix_app pretix migrate`
6. [ ] Create admin user + generate API token
7. [ ] Create organizer: "aura-cafe"
8. [ ] Create test event: "Workshop Tháng 7" with 2 ticket types (free, paid)
9. [ ] Test API: `curl -H "Authorization: Token <key>" http://VPS:9001/api/v1/organizers/`
10. [ ] Add env vars to `wrangler.toml`:
    - `PRETIX_API_URL` = `https://tickets.auraspace.cafe`
    - `PRETIX_API_TOKEN` = `<token>`
    - `PRETIX_ORGANIZER` = `aura-cafe`

## Success Criteria

- [ ] pretix accessible at `https://tickets.auraspace.cafe`
- [ ] API returns organizers list with valid token
- [ ] Test event visible via API
- [ ] Cron running (check logs)
