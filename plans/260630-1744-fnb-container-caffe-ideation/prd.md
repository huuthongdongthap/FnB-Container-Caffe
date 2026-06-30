# Product Requirements Document — Aura Cafe Container

**Date:** 2026-06-30 | **Version:** v2.1.0 (Production) | **Next Target:** v3.0 (12-Pillar Integration)

---

## Vision

A self-sovereign F&B management ecosystem for container cafes in Vietnam's Mekong Delta — combining premium coffee culture with industrial-luxury design, powered by 100% open-source technology at 90% lower cost than commercial SaaS. Starting from Sa Đéc, scaling to multi-location franchise by 2027.

## Target Users

### Primary Personas
| Persona | Demographics | Psychographics | Trigger |
|---------|-------------|----------------|---------|
| **Cafe Owner (Nhật chủ)** | 35-50, male, Vietnamese, business owner | Values independence, cost control, feng shui | Needs to run cafe profitably without tech headaches |
| **Cafe Staff** | 18-30, local, basic tech literacy | Wants simple tools, fast workflow | Needs to take orders, check loyalty, update status quickly |
| **Regular Customer** | 22-40, middle-income, digital-savvy | Values design, convenience, rewards | Wants premium experience, easy ordering, loyalty perks |

### Secondary Personas
- **Remote Worker:** Needs reliable WiFi, power, quiet space, all-day seating
- **Event Organizer:** Needs space booking, ticketing, catering coordination
- **Developer (Mekong team):** Needs clean architecture, testability, clear docs

## Core Features (Current v2.1.0)

### ✅ Complete
| Feature | Components | Status |
|---------|-----------|--------|
| **Order Management** | POS, KDS, status workflow, admin view | Production |
| **Payment Processing** | PayOS, COD, VNPay, MoMo, transaction tracking | Production |
| **Loyalty Program** | 4 tiers (Bronze→Platinum), points, cashback, referral, check-in | Production |
| **Table Reservations** | Booking, capacity management | Production |
| **Menu Management** | Categories, products, VND pricing | Production |
| **Customer Management** | Phone-based auth, profiles | Production |
| **Admin Dashboard** | Metrics, charts, top products | Production |
| **KDS (Kitchen Display)** | Real-time order display, status updates | Production |
| **PWA** | Offline mode, installable | Production |
| **SEO** | Meta tags, sitemap, structured data | Production |

### 🟡 In Progress (12-Pillar Integration)
| Pillar | Purpose | Effort | Priority |
|--------|---------|--------|----------|
| Odoo POS/ERP/CRM | Full business suite (inventory, accounting, CRM) | 40h | HIGH |
| Cal.com | Room/event booking | 20h | MED |
| OpenWISP | WiFi captive portal + marketing | 30h | LOW |
| pretix | Event ticketing | 25h | MED |
| TastyIgniter | Online ordering migration | 35h | HIGH |
| Xibo/Anthias | Digital signage (menu boards) | 20h | LOW |
| Mautic | Email marketing automation | 25h | MED |
| Home Assistant | IoT (lighting, HVAC, energy) | 15h | MED |
| Frigate | AI CCTV + heatmap analytics | 20h | LOW |
| Mixpost | Social media scheduling | 20h | MED |
| SMTP Enhancement | Transactional email upgrade | 10h | HIGH |

## Success Metrics

### North Star Metric
**Daily Order Volume** — Core indicator of business health and customer adoption.

### Supporting KPIs
| KPI | Current Target | Measurement |
|-----|---------------|-------------|
| Order conversion rate | >5% (visitor → checkout) | Cloudflare Analytics |
| Average Order Value | 125,000 VND | DB: orders table |
| Loyalty retention | >40% repeat rate | DB: users with >1 order |
| System uptime | 99.9% | Uptime monitor |
| Test coverage | ≥80% | Jest/Vitest reports |

## Agentic Architecture

| Agent | Workflow | Automation % | Status |
|-------|----------|-------------|--------|
| **Customer Support Bot** | Zalo integration → FAQ → escalate to human | 60% | Planned |
| **Demand Forecaster** | Order history → predict daily demand → inventory alerts | 70% | Planned |
| **Dynamic Pricer** | Time + demand → adjust happy hour / surge pricing | 50% | Planned |
| **Social Scheduler** | Mixpost agent → auto-schedule posts → analytics | 80% | Planned |
| **Churn Preventer** | 30-day inactive → win-back email/coupon | 90% | Partial |
| **Inventory Optimizer** | Sales data → reorder suggestions → Odoo sync | 60% | Planned |

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Vanilla HTML/CSS/JS + Vite | No framework overhead, fast builds, simple deploy |
| **Backend** | Cloudflare Workers (Hono) | Serverless, edge-native, $5/mo |
| **Database** | D1 (SQLite) | Serverless SQL, free tier generous |
| **Cache** | KV Namespace | Rate limiting, sessions |
| **Testing** | Vitest + Playwright | Fast, modern, good DX |
| **CI/CD** | GitHub Actions → Cloudflare Pages | Auto-deploy on push |
| **Design** | Bazi v5.1 tokens (Navy/Chrome/Mộc) | Unique brand identity |

## Risks & Mitigations

| Risk | Severity | Mitigation | Contingency |
|------|----------|------------|-------------|
| Cloudflare Free Tier exceeded | Medium | Already on $5 Paid plan, monitor usage | Upgrade to $20 Business plan |
| Payment gateway downtime | High | COD always available, MoMo backup | Manual order processing |
| E-invoicing non-compliance | High | Odoo Accounting integration by Q3 2026 | Third-party e-invoice service |
| Staff theft / fraud | Medium | Admin audit logs, shift accountability | Spot audits, camera review |
| Single-location risk | Medium | Multi-tenant architecture planned 2027 | Insurance, backup location |
| Competitor price war | Low | Differentiate via design + loyalty | Premium positioning, not price competition |

---

## Unresolved Questions
- Mobile app (React Native wrapper) — build or defer? PWA may suffice.
- Multi-tenant architecture — D1 per tenant vs shared with tenant_id?
- AI/ML features — LLM integration cost vs benefit for small cafe?
