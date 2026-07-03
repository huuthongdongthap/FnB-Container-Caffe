---
title: "AURA CAFE Productization — White-label License"
description: "Turn AURA CAFE into a white-label product for independent F&B businesses"
status: pending
priority: P1
tags: [productization, white-label, cli-tool, deployment]
---

# AURA CAFE Productization Plan

## Overview

AURA CAFE is a production-validated single-cafe management system (30+ features, 1184 tests). Phases A (design) and B (operations) are complete. This plan covers turning it into a white-label product that can be sold to independent F&B businesses in Vietnam.

**Business model:** White-label license with setup fee + monthly support (not multi-tenant SaaS). The system is deployed as an isolated Cloudflare instance per client on their own CF account, with their branding on their domain.

**Target market:** Any independent F&B business in Vietnam — container cafes, street-side coffee shops, tea houses, juice bars, small bakeries.

**Pricing:**
- Setup fee: 15-30M VND (one-time) — includes domain setup, branding, training
- Monthly support: 2-5M VND — includes updates, bug fixes, phone support
- Annual maintenance: 20-40M VND — includes all updates + priority support

---

## Phases Summary

### Phase 1: Branding Isolation (10-15h)

Extract hardcoded brand strings into env vars and a `config/brand.json` source of truth. Make `brand-tokens.css` generate from config. Create the deployment template. No feature changes — all 1184 tests must still pass.

**Deliverable:** One `DEPLOY.md` and one script to stand up a new branded instance.

[Phase 1 Detail](./phase-01-branding-isolation.md)

### Phase 2: Setup CLI Tool (8-10h)

Build `aura-deploy`, a Node.js/TypeScript CLI tool:
- `aura-deploy init` — interactive wizard asking cafe name, domain, CF account
- Template engine that substitutes `brand.json` into env vars + CSS vars
- Cloudflare deploy integration via `wrangler` or CF API

**Deliverable:** Working CLI that deploys a fully branded instance.

[Phase 2 Detail](./phase-02-setup-cli.md)

### Phase 3: Documentation + Support (5-8h)

Bilingual (VN+EN) client-facing materials:
- Setup guide with screenshots
- Admin manual customization guide
- Pricing page template
- Simple support flow (Zalo-based)

**Deliverable:** Client-facing docs + support process definition.

[Phase 3 Detail](./phase-03-documentation-support.md)

### Phase 4: First Client Deployment (5-8h)

Dogfood deployment for a real cafe. Validate full feature set works in isolation. Fix issues discovered during real deployment.

**Deliverable:** Reference deployment + lessons learned document.

[Phase 4 Detail](./phase-04-first-client.md)

---

## Investment Summary

| Phase | Hours | Cost ($50/hr) | Revenue Potential |
|-------|-------|---------------|-------------------|
| 1. Branding Isolation | 10-15 | $500-750 | (prerequisite) |
| 2. Setup CLI Tool | 8-10 | $400-500 | (prerequisite) |
| 3. Documentation | 5-8 | $250-400 | (prerequisite) |
| 4. First Client | 5-8 | $250-400 | 15-30M VND ($600-1200) |
| **Total** | **28-41h** | **$1,400-2,050** | **Breakeven at 1-2 clients** |

Monthly support revenue (2-5M VND/client/month) adds recurring income after client acquisition.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Client's CF account setup friction | Medium | High | Pre-recorded video guide + remote support session included in setup fee |
| Feature gap vs competitors | Medium | Medium | Ship V1 with current feature set; iterate based on real client feedback |
| Support burden | Medium | Medium | Clear SLA in contract; batch updates monthly; phone support for critical issues only |
| Payment integration per client | Low | High | PayOS works nationally; test per client's PayOS account during setup |
| Client churn after setup | Medium | Low | Month-to-month support; system keeps running without active support (no lock-in) |

---

## Competitive Positioning

| Competitor | Price | Fit for Container Cafe | AURA Advantage |
|-----------|-------|----------------------|----------------|
| KiotViet | 200K-1M/month | Generic retail | Built for cafe workflow, not repurposed POS |
| Sapo | 300K-2M/month | F&B module exists | QR ordering + KDS native, no module needed |
| iPOS | 500K-3M/month | F&B focused | More expensive, less modern UI, dated tech stack |
| **AURA** | **15-30M setup + 2-5M/month** | **Purpose-built** | **Industrial-luxury design, modern Cloudflare stack, zero monthly minimum, full source ownership** |

Key differentiators:
- **Modern architecture** — Edge-deployed on Cloudflare Workers, not legacy server-based POS
- **QR ordering native** — Built for QR-first F&B, not retrofitted from retail POS
- **Industrial-luxury design** — UI designed for modern cafe aesthetics, not generic business software
- **No lock-in** — Client owns their instance; system works without ongoing payment
- **Bilingual (VN+EN)** — All interfaces and documentation in both languages

---

## Phase Files

| File | Description |
|------|-------------|
| [phase-01-branding-isolation.md](./phase-01-branding-isolation.md) | Brand string extraction, config/brand.json, template deployment |
| [phase-02-setup-cli.md](./phase-02-setup-cli.md) | aura-deploy CLI tool, interactive wizard, CF deploy integration |
| [phase-03-documentation-support.md](./phase-03-documentation-support.md) | Bilingual docs, admin manual, support process |
| [phase-04-first-client.md](./phase-04-first-client.md) | First real deployment, validation, lessons learned |
