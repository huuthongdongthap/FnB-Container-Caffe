# AURA CAFE Productization — Brainstorm Report

**Date:** 2026-07-03 | **Status:** Brainstorm Complete
**Decision:** White-label License + Full Setup Service
**Target Market:** Any independent F&B in Vietnam

---

## 1. Current State

AURA CAFE is a production-validated single-cafe management system (30+ features, 1184 tests). Phase A (design) + B (operations) complete. Now ready to productize.

## 2. Why White-label License (Not SaaS)

| Factor | White-label | Multi-tenant SaaS |
|--------|-------------|-------------------|
| Time to revenue | 2-3 weeks | 6-8 weeks |
| Ops burden | Low (setup per client) | High (24/7 platform ops) |
| Risk | Low | High |
| Margins | High (setup fee) | Recurring (scales) |
| Technical change | Minimal | Full rewrite |

White-label lets you sell the system as a premium product with your setup expertise as the differentiator — no infra overhead, no platform SLA risk.

## 3. Product Structure

### What the Client Gets
- Custom domain (e.g., `cafex.auraspace.cafe` or their own)
- Their branding (logo, colors, cafe name)
- Isolated Cloudflare deployment (Worker + D1 + Pages)
- Full feature set (menu, QR ordering, payments, loyalty, admin)
- Setup + training session
- Monthly support (optional tier)

### What You Provide
- **Setup CLI tool:** `aura-deploy init <cafe-name> --domain x.y` — clones config, deploys to CF
- **Branding template:** Logo placeholder → swap, CSS vars → their colors
- **Deployment script:** Auto-deploy to their Cloudflare account (BYO CF)
- **Documentation:** Bilingual (VN+EN) setup guide + admin manual
- **Update mechanism:** Git-based update channel (optional)

### Pricing Model (Suggestion)
- **Setup fee:** 15-30M VND (one-time) — includes domain setup, branding, training
- **Monthly support:** 2-5M VND — includes updates, bug fixes, phone support
- **Annual maintenance:** 20-40M VND — includes all updates + priority support

## 4. Technical Design

### Architecture
```
┌──────────────────┐     ┌──────────────────┐
│  Client A        │     │  Client B        │
│  cafe-x.workers.dev│   │  cafe-y.workers.dev│
│  ┌──────────────┐│     │  ┌──────────────┐│
│  │ D1 (tenant A)││     │  │ D1 (tenant B)││
│  │ KV (tenant A)││     │  │ KV (tenant B)││
│  └──────────────┘│     │  └──────────────┘│
│  Domain: custom  │     │  Domain: custom  │
└──────────────────┘     └──────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
          ┌──────────┴──────────┐
          │  Template Repo      │
          │  aura-cafe-template │
          │  (shared core)      │
          └─────────────────────┘
```

### Setup CLI Tool (`aura-deploy`)
A Node.js CLI that:
1. `aura-deploy init` — asks cafe name, domain, CF account
2. Clones template repo → replaces branding tokens
3. Runs `wrangler deploy` targeting client's CF account (BYO token)
4. Seeds initial data (categories, default menu items)
5. Outputs: URLs, admin credentials

### What Changes in Code
- **brand-tokens.css** → Make all values env-configurable
- **index.html** → Title, meta tags from env
- **Admin login** → Configurable default credentials
- **Remove hardcoded AURA CAFE branding** from source → template variables
- **Add `setup/` directory** → CLI tool + templates

### What Stays the Same
- All features (no feature changes, just branding isolation)
- All backend logic (no DB schema changes)
- All tests (1184 should still pass)
- Architecture (Worker + D1 + KV)

## 5. Phase Plan

### Phase 1: Branding Isolation (10-15h)
- Extract hardcoded brand strings → env vars (cafe name, logo, colors)
- Make brand-tokens.css generate from config
- Add `config/brand.json` as source of truth
- Create deployment template
- **Deliverable:** One `DEPLOY.md` and one script to stand up a new instance

### Phase 2: Setup CLI Tool (8-10h)
- Build `aura-deploy` CLI (Node.js/TypeScript)
- `aura-deploy init` interactive wizard
- Template engine (brand.json → env vars + CSS vars)
- CF deploy integration via `wrangler` or `cloudflare API`
- **Deliverable:** Working CLI that deploys a branded instance

### Phase 3: Documentation + Support (5-8h)
- Bilingual setup guide
- Admin manual customization guide
- Pricing page template
- Support ticket system or simple Zalo-based support flow
- **Deliverable:** Client-facing docs + support process

### Phase 4: First Client Deployment (5-8h)
- Dogfood: Deploy second instance for a real cafe
- Validate: full feature set works in isolation
- Fix: any issues found during real deployment
- **Deliverable:** Reference deployment + lessons learned

## 6. Investment Summary

| Phase | Hours | Cost ($50/hr) | Revenue Potential |
|-------|-------|---------------|-------------------|
| 1. Branding Isolation | 10-15 | $500-750 | — (prerequisite) |
| 2. Setup CLI Tool | 8-10 | $400-500 | — (prerequisite) |
| 3. Documentation | 5-8 | $250-400 | — (prerequisite) |
| 4. First Client | 5-8 | $250-400 | 15-30M VND ($600-1200) |
| **Total** | **28-41h** | **$1,400-2,050** | **Breakeven at 1-2 clients** |

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Client's CF account setup friction | Medium | High | Provide pre-recorded video guide + remote support |
| Feature gap vs competitors | Medium | Medium | Version 1 = current feature set; iterate based on feedback |
| Support burden | Medium | Medium | Set clear SLA in contract; batch updates monthly |
| Payment integration per client | Low | High | PayOS works nationally; test per client's PayOS account |
| Client churn after setup | Medium | Low | Month-to-month support; keep system working without support |

## 8. Competitive Positioning

| Competitor | Price | Fit for Container Cafe | AURA Advantage |
|-----------|-------|----------------------|----------------|
| KiotViet | 200K-1M/month | Generic retail | Built for cafe workflow |
| Sapo | 300K-2M/month | F&B module exists | QR ordering + KDS native |
| iPOS | 500K-3M/month | F&B focused | More expensive, less modern UI |
| **AURA** | **15-30M setup + 2-5M/month** | **Purpose-built** | **Industrial-luxury design, modern stack, no monthly minimum** |

## 9. Next Steps

1. [ ] Approve Phase 1 plan
2. [ ] Execute branding isolation
3. [ ] Build CLI tool
4. [ ] Deploy first client
5. [ ] Iterate based on feedback
