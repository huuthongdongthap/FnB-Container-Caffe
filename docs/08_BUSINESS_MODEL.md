---
date: 2025-06-19
version: 1.0
status: stable
---

# BUSINESS MODEL — AURA CAFE CONTAINER

## Value Proposition

**"Where Flavor Meets Design"** — A premium F&B cafe in Sa Đéc that combines:
- Authentic coffee and food with modern Vietnamese design
- Self-sovereign technology stack (no SaaS dependency)
- Cost-optimized cloud infrastructure (~700k VND/month)
- Loyalty-driven customer relationships

---

## Customer Segments

| Segment | Description | Primary Needs |
|---------|-------------|---------------|
| **Walk-in locals** | Residents near Sa Đéc center | Quick service, quality coffee, comfortable seating |
| **Students & coworkers** | Remote workers, students | WiFi, power outlets, quiet space, all-day seating |
| **Event attendees** | Workshop participants, meetups | Space rental, catering, AV equipment |
| **Online orderers** | Delivery/takeaway customers | Fast ordering, accurate fulfillment, contactless payment |
| **Tourists** | Visitors to Sa Đéc | Instagram-worthy design, local flavors, souvenirs |

---

## Revenue Streams

### 1. F&B Sales (Primary — ~85% of revenue)

| Category | Products | Pricing Strategy |
|----------|----------|------------------|
| **Coffee** | Espresso, Filter, Cold Brew, Signature drinks | 25K - 55K VND |
| **Tea** | Herbal, milk tea, specialty | 20K - 40K VND |
| **Food** | Pastries, sandwiches, breakfast sets | 30K - 80K VND |
| **Signature items** | Aura specials, limited editions | Premium pricing (+20%) |
| **Delivery** | Via website (no Grab/Shopee fees) | Same as in-store + delivery fee |

**Revenue model:** Direct payment (COD, QR) — no platform commission.

---

### 2. Event Space Rental (Secondary — ~10%)

- **Workshops:** Coding talks, art classes, community events
- **Private parties:** Birthdays, anniversaries, corporate events
- **Pricing:** 500K - 2M VND/hour depending on space & time

**Integration:** Cal.com booking → automated calendar → invoice generation.

---

### 3. Coworking Memberships (Secondary — ~5%)

- **Daily pass:** 50K VND (includes 1 drink)
- **Monthly:** 1.5M VND (unlimited seating, 10% discount on orders)
- **Quarterly:** 4M VND (2 months free, priority booking)

**Integration:** Odoo Members module to track memberships, access control.

---

### 4. Ticketed Events (Tertiary)

- **Coding workshops:** 200K - 500K VND/person
- **Tasting events:** Coffee/tea tasting sessions
- **Integration:** pretix ticketing platform

---

## Cost Structure

### Fixed Costs (Monthly)

| Item | Cost (VND) | Notes |
|------|------------|-------|
| Cloudflare Workers (Paid plan) | 125,000 | $5/mo for >100k requests |
| D1 Database (storage beyond free) | 0 (within free) | <5GB used |
| Domain & SSL | 50,000 | fnb-caffe-container.pages.dev custom domain |
| SMTP transactional emails | 100,000 | SendGrid/Mailgun ~$5/mo |
| Monitoring (Sentry optional) | 0 (free tier) | Self-hosted Grafana alternative |
| **Total Fixed** | **275,000** | ~$11 USD |

### Variable Costs

| Item | Cost Basis |
|------|------------|
| Payment gateway fees | 2.5% of transaction volume (PayOS) |
| Loyalty cashback | 3-10% depending on tier (offset by increased spend) |
| Coffee/food ingredients | ~30% COGS (cost of goods sold) |
| Staff salaries | 4-6 employees × 8-12M VND/month |
| Rent & utilities | Physical cafe location (outside tech scope) |
| Marketing | 5-10% of revenue (social ads, promotions) |

### Total Tech Costs: ~300K - 700K VND/month

**Savings vs SaaS:** Using 12 OSS pillars saves ~2-3M VND/month compared to commercial SaaS alternatives.

---

## 12 Pillars Integration Cost

| Pillar | Status | Hosting Cost | Effort (h) | ROI |
|--------|--------|--------------|------------|-----|
| Odoo | Partial | 0 (self-hosted) | 40 | High (inventory, accounting) |
| Cal.com | Partial | 0 | 20 | Medium (event bookings) |
| OpenWISP | Planned | 100K (RPi) | 30 | Low (WiFi data collection) |
| pretix | Planned | 0 | 25 | Medium (event ticketing) |
| TastyIgniter | Partial | 0 | 35 | High (online ordering migration) |
| Xibo/Anthias | Not started | 200K (RPi + screens) | 20 | Low (menu boards) |
| Mautic | Planned | 0 | 25 | Medium (email marketing) |
| Home Assistant | Partial | 100K (RPi) | 15 | Medium (energy savings 20%) |
| Frigate | Partial | 0 (existing RPi) | 20 | Low (security/analytics) |
| Payment Gateways | Done | Included in fees | 0 | N/A |
| Mixpost | Planned | 0 | 20 | Medium (social scheduling) |
| SMTP | Basic | 100K | 10 | High (transactional emails) |

**Total additional hardware/infra:** ~500K VND one-time (Raspberry Pis, displays).

---

## Unit Economics (Per Order)

| Metric | Value |
|--------|-------|
| Average Order Value (AOV) | 125,000 VND |
| COGS (30%) | -37,500 VND |
| Payment fee (2.5%) | -3,125 VND |
| Loyalty cashback (avg 4%) | -5,000 VND |
| **Gross margin per order** | **79,375 VND** (~63% margin) |

**Break-even:** At 100 orders/day = 7.9M VND gross margin/month ≈ covers staff + rent.

---

## Growth Strategy

### Phase 1: Stabilize (Now — Q2 2026)
- Achieve consistent 100 orders/day
- Refine loyalty program (tier thresholds, rewards)
- Complete 12 pillars integration (Odoo, Cal.com, etc.)
- Reach profitability

### Phase 2: Expand (Q3 2026 — Q1 2027)
- Increase marketing (social media, Mixpost)
- Add event space rental (Cal.com)
- Launch coworking memberships
- Target: 200 orders/day

### Phase 3: Scale (Q2 2027+)
- Evaluate second location (multi-tenant architecture)
- Consider franchise model
- Mobile app (React Native wrapper)
- Expand to other Mekong Delta cities

---

## Competitive Advantage

| Competitor | Weakness | Our Advantage |
|------------|----------|---------------|
| Chain coffee shops (Highlands, Phúc Long) | High prices, generic | Premium design, local pricing |
| Grab/Shopee Food | 20-30% commission | Zero commission, direct ordering |
| Other local cafes | No tech, manual processes | Automated everything (KDS, loyalty) |
| SaaS POS (iPOS, Sapo) | Monthly fees 1-3M VND | Self-hosted ~700K VND |

---

## Financial Projections

### Year 1 (2026)

| Month | Orders/day | Revenue (M VND) | Profit (M VND) |
|-------|------------|-----------------|----------------|
| Apr-Jun (launch) | 50 | 187.5 | -2 (investing) |
| Jul-Sep | 80 | 300 | +5 |
| Oct-Dec | 100 | 375 | +12 |

**Year 1 total:** ~862M VND revenue, ~15M VND profit (after all costs).

### Year 2 (2027)

- Target 150 orders/day
- Event space fully booked
- Coworking membership 50+ members
- Revenue: ~1.5B VND, profit: ~50M VND

---

## Funding & Investment

**Current:** Self-funded by founder (bootstrap).  
**Future:** May seek investment for:
- Second location expansion (500M - 1B VND)
- Mobile app development (200M VND)
- Marketing scale-up (100M VND)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Cloudflare Free Tier limits** | Service disruption if exceeded | Monitor usage, upgrade to $5 plan proactively |
| **Payment gateway downtime** | Lost sales | COD always available, have MoMo backup |
| **Staff theft** | Revenue loss | Admin audit logs, shift accountability |
| **Low customer retention** | Revenue drops | Loyalty program, churn prevention automations |
| **Competitor price war** | Margin compression | Differentiate via design & experience |
| **Regulatory changes** (e-invoicing) | Compliance cost | Odoo accounting integration ready |

---

## Key Metrics Summary

- **Target monthly revenue:** 37.5M VND (100 orders × 125K × 30 days)
- **Target gross margin:** 63%
- **Target net profit:** 12-15M VND/month after all costs
- **Break-even point:** ~60 orders/day
- **Payback period for tech investments:** 6 months

---

*Last updated: 2025-06-19 — Initial business model documentation*
