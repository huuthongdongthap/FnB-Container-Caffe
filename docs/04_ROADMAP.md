---
date: 2025-06-19
version: 1.0
status: stable
---

# PROJECT ROADMAP — AURA CAFE CONTAINER

## Current State: Production v2.1.0 (Stable)

**Status:** Production running at `https://fnb-caffe-container.pages.dev`  
**Last major release:** March 31, 2026  
**Deployment platform:** Cloudflare Pages + Workers + D1  
**Monthly hosting cost:** ~700,000 VND (Free Tier + Paid plan mix)

---

## Historical Milestones

### v1.0.0 — Initial Launch (March 10, 2026)

- ✅ Complete F&B Container website build
- ✅ Basic order system (HTML + JavaScript)
- ✅ Initial admin panel

---

### v2.0.0 — Cloudflare Migration & Revenue Engine (March 17, 2026)

**Major Features:**
- ✅ Full migration to Cloudflare Workers + D1 + KV
- ✅ Multi-payment: COD, MoMo, VNPay, PayOS
- ✅ PayOS production webhook integration
- ✅ Optimized checkout flow with QR codes
- ✅ Automatic order processing pipeline
- ✅ Delivery fee calculation by ward distance
- ✅ Free delivery threshold (300K)

**Additional Features:**
- ✅ Happy Hour System (14:00-16:00, 20% off drinks)
- ✅ Loyalty & Referral Program
  - Multi-tier: Bronze/Silver/Gold/Platinum
  - Referral commissions (30%)
  - Birthday rewards
  - Check-in points
- ✅ Churn Prevention (30-day inactive detection, win-back campaigns)
- ✅ PWA: offline mode, home screen, push notifications
- ✅ SEO: meta tags, Open Graph, sitemap, structured data

**Design:**
- ✅ Material Design 3 implementation
- ✅ Dark mode support
- ✅ Responsive design (mobile-first)

---

### v5.0.0 — Loyalty Expansion (March 14, 2026)

- ✅ Loyalty rewards system refinement
- ✅ SEO enhancements
- ✅ Admin dashboard with analytics
- ✅ Performance optimizations

---

### v2.1.0 — Production Polish (March 31, 2026)

**Maintenance & Quality:**
- ✅ Removed all console.log from production (keep console.error only)
- ✅ Fixed remaining TODOs in checkout and config
- ✅ Updated README with Quick Start and API endpoints
- ✅ Cleaned up legacy Python files
- ✅ Fixed test environment configuration
- ✅ Removed minified assets from git tracking
- ✅ Version sync across package.json, README, CHANGELOG

**Infrastructure:**
- ✅ CI/CD pipeline stabilization
- ✅ 576 unit tests (14 test suites)
- ✅ Test coverage ≥ 80%

---

## Current Capabilities (v2.1.0)

### Completed Systems

| System | Status | Notes |
|--------|--------|-------|
| **Order Management** | ✅ Production | POS, KDS, status workflow, admin order view |
| **Payment Processing** | ✅ Production | PayOS, COD, transaction tracking |
| **Loyalty Program** | ✅ Production | 4 tiers, points, cashback, referral, check-in |
| **Reservations** | ✅ Production | Table booking, capacity management |
| **Menu Management** | ✅ Production | Categories, products, pricing in VND |
| **Customer Management** | ✅ Production | Phone-based auth, profiles |
| **Admin Dashboard** | ✅ Production | Metrics, charts, top products |
| **KDS (Kitchen)** | ✅ Production | Real-time order display, status updates |
| **PWA** | ✅ Production | Offline mode, installable |
| **SEO** | ✅ Production | Meta tags, sitemap, structured data |

---

## Roadmap: Next Phases

### Phase 1: 12 Pillars Integration (Q3-Q4 2026)

**Goal:** Complete integration of all 12 open-source pillars to create a unified F&B ecosystem.

#### Pillar Integration Status

| Pillar | Current | Target | Effort | Owner |
|--------|---------|--------|--------|-------|
| **1. Odoo POS/ERP/CRM** | 🟡 Partial | ✅ Full | 40h | backend-dev |
| **2. Cal.com** | 🟡 Partial | ✅ Full | 20h | integration |
| **3. OpenWISP** | 🟡 Planned | ✅ Full | 30h | infra |
| **4. pretix** | 🟡 Planned | ✅ Full | 25h | integration |
| **5. TastyIgniter** | 🟡 Partial | ✅ Full | 35h | backend-dev |
| **6. Xibo/Anthias** | ❌ Not started | ✅ Full | 20h | frontend |
| **7. Mautic** | 🟡 Planned | ✅ Full | 25h | marketing |
| **8. Home Assistant** | 🟡 Partial | ✅ Full | 15h | infra |
| **9. Frigate** | 🟡 Partial | ✅ Full | 20h | infra |
| **10. Payment Gateways** | ✅ Done | ✅ Done | - | - |
| **11. Mixpost** | 🟡 Planned | ✅ Full | 20h | marketing |
| **12. SMTP** | ✅ Basic | ✅ Enhanced | 10h | ops |

**Total effort:** ~260 hours  
**Timeline:** Q3 2026 — Q4 2026 (6 months)  
**Dependencies:** Odoo accounting module for e-invoicing (mandatory June 2025)

---

### Phase 2: Mobile App (Q1 2027)

**Status:** Not started (out-of-scope for current phase)

**Considerations:**
- React Native or Flutter wrapper around existing web app
- Push notifications via Cloudflare Push
- Offline-first cart sync
- QR code scanning for loyalty check-in

**Decision point:** Evaluate demand before investing. Web PWA may suffice.

---

### Phase 3: Multi-Tenant & Franchise (Q2 2027)

**Status:** Concept phase

**Goals:**
- Support multiple cafe locations under one system
- Centralized admin with per-location data isolation
- Franchisee self-service onboarding
- Revenue sharing model

**Technical challenges:**
- Tenant isolation in D1 (tenant_id on all tables)
- Multi-tenant auth (JWT claims)
- Separate D1 databases per tenant vs shared with tenant_id

---

### Phase 4: AI & Automation (Q3 2027)

**Status:** Exploration

**Potential features:**
- AI menu recommendations (based on order history)
- Predictive inventory management
- Chatbot for customer support (Zalo integration)
- Dynamic pricing (happy hour auto-adjust)
- Demand forecasting (sales prediction)

---

## Dependencies & Blockers

### External Dependencies

| Dependency | Impact | Timeline |
|------------|--------|----------|
| **E-invoicing compliance** | Mandatory for all Vietnamese businesses from June 2025 | Must integrate Odoo Accounting or alternative by Q3 2026 |
| **Cloudflare pricing changes** | Could affect Free Tier viability | Monitor quarterly |
| **Payment gateway API changes** | PayOS/MoMo/SePay API version upgrades | Test before production push |

### Internal Dependencies

- **Backend team:** Must complete 12 pillars integration (260h effort)
- **Infrastructure:** Raspberry Pi setup for Home Assistant/Frigate/Xibo
- **Legal:** E-invoicing compliance review (accounting firm)

---

## Success Metrics by Phase

### Phase 1 Completion Criteria

- ✅ All 12 pillars integrated and tested
- ✅ Documentation updated (ADR, architecture)
- ✅ Integration tests passing for each pillar
- ✅ Cost model still ≤ 1M VND/month
- ✅ No regression in existing features

---

## Timeline Summary

```
2026 Q2:  Production stabilization, monitoring, bug fixes
2026 Q3:  Begin 12 pillars integration (Odoo, Cal.com, OpenWISP)
2026 Q4:  Complete 12 pillars integration (TastyIgniter, Xibo, Mautic)
2027 Q1:  Evaluate mobile app needs
2027 Q2:  Multi-tenant architecture design
2027 Q3:  AI/automation exploration
2027 Q4:  Review & planning for next year
```

---

## Risk Register Link

See `10_RISK_REGISTER.md` for detailed risk analysis including:
- Cloudflare Free Tier limits
- 12 pillars integration complexity
- E-invoicing compliance timeline
- Team capacity constraints

---

## Related Documents

- `01_GOAL.md` — Project objectives and success criteria
- `03_ARCHITECTURE.md` — System design and components
- `05_TASKS/` — Detailed task breakdowns by domain
- `06_ADR/` — Architecture decisions affecting roadmap
- `07_EVALUATION.md` — KPIs and monitoring
- `08_BUSINESS_MODEL.md` — Revenue and cost projections
- `09_BEHAVIOR_GRAPH.md` — User journey improvements
- `12_CHANGELOG.md` — Version history

---

*Last updated: 2025-06-19 — Initial roadmap creation*
