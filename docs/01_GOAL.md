---
date: 2025-06-19
version: 1.0
status: stable
---

# PROJECT GOAL — AURA CAFE CONTAINER SYSTEM

## Project Objectives

### Functional Objectives
1. **Build a complete F&B container cafe management system** covering:
   - Menu display & ordering
   - Table reservations & KDS kitchen display
   - Customer loyalty (tiers, points, rewards, referrals)
   - Payment processing (VNPay, MoMo, SePay)
   - Admin dashboard & reporting
   - Checkout & order tracking

2. **Integrate 12 open-source pillars** for full-stack business operations:
   - Odoo (POS/ERP/CRM)
   - Cal.com (coworking & event booking)
   - OpenWISP (WiFi captive portal)
   - pretix (event ticketing)
   - TastyIgniter (online ordering)
   - Home Assistant (IoT automation)
   - Frigate (AI CCTV & heatmaps)
   - Mautic (email marketing)
   - Xibo/Anthias (digital signage)
   - Payment gateways (VNPay/MoMo/SePay)
   - Mixpost (social media scheduling)
   - Email infrastructure (SMTP)

3. **Achieve production-ready status** with:
   - Automated testing (≥80% coverage)
   - CI/CD pipeline (GitHub Actions)
   - Security hardening (audit logging, rate limiting)
   - Vietnamese localization (VND currency, Vietnamese UI)

### Non-Functional Objectives
1. **Cost Optimization:** Maintain SaaS software cost ≤ 700.000 VND/month (≈90% savings vs proprietary stack)
2. **Performance:** API response time p95 < 200ms, uptime 99.9%
3. **Scalability:** Support 500+ customers/day on Cloudflare Free Tier (100k Workers requests/day)
4. **Maintainability:** Clear documentation, modular code, easy onboarding for new developers
5. **Bazi Compliance:** All UI/UX follows Bát tự design system (v5.1) — Navy/Chrome/Mộc only

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Technical** |
| Test coverage | ≥80% | Jest/Playwright reports |
| API latency (p95) | <200ms | Cloudflare Analytics |
| Uptime | 99.9% | Uptime monitor |
| Security incidents | 0 | Audit logs review |
| **Business** |
| Daily orders | 50+ | Orders table count |
| Loyalty members | 500+ | Users with tier ≠ null |
| Reservation fill rate | >60% | Reservations vs capacity |
| Payment success rate | >95% | Payments with status=Completed |
| **Operational** |
| Deployment frequency | 1-2/week | GitHub Actions logs |
| Lead time (commit→prod) | <2h | CI/CD pipeline |
| MTTR (bugs) | <4h | Incident response logs |
| Documentation completeness | 100% | 12-docs checklist |

---

## Scope Boundaries

### In-Scope (Core System)
- ✅ Static HTML frontend (11 customer pages + admin)
- ✅ Cloudflare Worker backend (Hono, ~40 API endpoints)
- ✅ D1 SQLite database (11 tables)
- ✅ Loyalty program (tiers, points, rewards, checkin, referral)
- ✅ Payment integration (VNPay, MoMo, SePay via PayOS webhook)
- ✅ KDS (Kitchen Display System)
- ✅ Table reservations
- ✅ Admin dashboard (order management, stats, reports)
- ✅ Audit logging & rate limiting
- ✅ Vietnamese language (primary)

### In-Scope (Planned / Partial)
- 🟡 Odoo POS integration (sync orders, customers) — **partial**
- 🟡 Home Assistant IoT controls (HVAC, lighting) — **partial**
- 🟡 Frigate CCTV heatmap analytics — **partial**
- 🟡 TastyIgniter online ordering migration — **planned**
- 🟡 OpenWISP WiFi captive portal — **planned**
- 🟡 Cal.com room booking — **planned**
- 🟡 pretix event ticketing — **planned**

### Out-of-Scope
- ❌ Mobile native apps (iOS/Android) — web-only PWA
- ❌ Multi-tenant SaaS — single location only
- ❌ Advanced analytics/ML — basic stats only
- ❌ Internationalization beyond Vietnamese/English
- ❌ Third-party delivery platform integrations (Grab, ShopeeFood)

---

## Stakeholders

| Role | Responsibility | Contact |
|------|----------------|---------|
| **Owner / Nhật chủ** | Business decisions, budget, vision | Nguyễn Hữu Còn |
| **CTO / Architect** | Technical leadership, architecture reviews | Mekong CLI |
| **Developers** | Implementation, bug fixes, features | Mekong team |
| **Ops / Staff** | Day-to-day operations, KDS usage | Cafe staff |
| **Customers** | End-users ordering & loyalty | Public |

---

## Constraints

### Technical Constraints
1. **Cloudflare Free Tier limits:** 100k Workers requests/day, 5GB D1, 1GB KV reads/day. Must stay within or upgrade to $5/mo plan.
2. **SQLite/D1 limitations:** No foreign key constraints (enforced at app layer), no stored procedures.
3. **Static hosting:** All HTML/JS/CSS must be pre-built (Vite), no server-side rendering.
4. **Vanilla JS:** No React/Vue (by design for simplicity).

### Business Constraints
1. **Budget:** Monthly SaaS cost ≤ 700k VND (≈$25)
2. **Location:** Single cafe in Sa Đéc, Đồng Tháp
3. **Timeline:** v2.1.0 production as of 2026-05-30; future iterations planned
4. **Compliance:** Vietnamese e-invoicing requirements (pending Odoo integration)

### Design Constraints
1. **Bazi v5.1:** Only Navy/Chrome/Mộc colors allowed in production pages.
2. **Brand identity:** Aura Cafe — industrial-luxury container aesthetic.
3. **Typography:** Cormorant Garamond (headings), Space Grotesk (body), JetBrains Mono (tech).

---

## Key Performance Indicators (KPIs)

See `07_EVALUATION.md` for detailed KPI framework and evaluation methodology.

**Top-level health indicators:**
- Order conversion rate (visitor → checkout)
- Average order value (AOV)
- Customer retention (loyalty member repeat rate)
- System availability (uptime)
- Test coverage trend

---

**Related documents:**
- `00_FOUNDER_MANIFESTO.md` — Vision & values (parent)
- `03_ARCHITECTURE.md` — System design
- `04_ROADMAP.md` — Timeline & milestones
- `07_EVALUATION.md` — KPI measurement framework

---

*Last updated: 2025-06-19 — Initial documentation conversion*
