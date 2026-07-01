# Phase 01 — ERPNext Deployment Research (3h)

**Status:** pending
**Priority:** High
**TDD:** N/A (documentation output)

## Overview

Research ERPNext deployment options, write step-by-step guide for non-tech user to provision ERPNext instance.

## Requirements

### Functional
- Compare 3 deployment methods: Docker, Frappe Cloud, manual install
- Recommend best option for small cafe (cost, simplicity, CF compatibility)
- Write guide in bilingual VN+EN
- Include cost estimates, hardware requirements, security checklist

### Non-functional
- Guide must be followable by non-technical cafe owner
- Include screenshots or copy-paste commands
- Vietnamese first, English summary

## Output

- `docs/deployment/erpnext-setup-guide.md` — main guide
- Optional: `docs/deployment/erpnext-docker-compose.yml` — ready-to-use config

## Implementation Steps

1. Research ERPNext v15+ deployment options via WebSearch
2. Test Docker quickstart viability (Frappe docker image)
3. Compare:
   - Docker self-hosted (VPS 4GB RAM, ~300K VND/mo)
   - Frappe Cloud (managed, free tier limited, paid from $50/mo)
   - Manual install (complex, not recommended)
4. Write guide with:
   - Prerequisites (VPS, domain, DNS)
   - Step-by-step Docker install
   - ERPNext initial setup (site creation, admin password)
   - API key + secret generation for CF Worker integration
   - Security: firewall, SSL, backup
   - Env vars to set in CF Worker: ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET
5. Validate guide by following steps mentally (cannot E2E test without actual VPS)

## Success Criteria

- [ ] Guide written in docs/deployment/
- [ ] Step-by-step copy-paste commands
- [ ] Cost estimates for each option
- [ ] Recommendation with rationale
- [ ] Bilingual VN+EN

## Touchpoints

- No code changes — docs only
- References: worker/src/clients/erpnext-client.js (env vars needed)
