# Phase C: Forward-Looking Strategy — Chien Luoc Tuong Lai

**Date:** 2026-07-03
**Status:** Research / Hold
**Total Estimated Effort:** 180h+ (no production code until decision)
**Dependencies:** Phase A + B complete, 30+ days of metrics data collected

---

## Overview / Tong Quan

Phase C items are forward-looking initiatives that will shape AURA CAFE's growth trajectory beyond the current single-cafe system. These are **NOT for immediate implementation** — they require strategic decisions, market validation, and architectural planning. This document captures the landscape so the CEO can make informed decisions.

| Item | Effort (est) | Decision Needed | Recommended Timing |
|------|-------------|-----------------|-------------------|
| C1 Multi-tenant Architecture | 40h | HOLD | Q1 2027 or at 200 orders/day |
| C2 Mobile App (React Native) | 60h | HOLD | Post-multi-tenant |
| C3 AI Agent Features | 30h | START RESEARCH | After 30d of B1 metrics |
| C4 Franchise Expansion Tools | 50h | HOLD | Pre-sale of first franchise |

---

## C1: Multi-Tenant Architecture / Kien Truc Nhieu Khach Thue

**Effort est:** 40h | **Decision:** HOLD | **Triggers:** 200 orders/day OR franchise interest

### What It Is / Noi Dung

Transform AURA from a single-cafe system to a platform that can serve multiple cafes. Each cafe (tenant) gets isolated data with shared admin layer.

### Key Decisions Needed / Quyet Dinh Can Co

1. **Isolation model:**
   - Option A: D1 per tenant (best isolation, higher cost)
   - Option B: Shared D1 with tenant_id column (lower cost, more complex queries)
   - Option C: Hybrid — critical tables per tenant, shared reference tables

2. **Pricing model:**
   - Per-cafe monthly SaaS fee (500K-2M VND/mo?)
   - One-time setup fee (10-20M VND?)
   - Revenue share (1-3% of order value?)

3. **Feature gating:**
   - Which features go to which tier?
   - What's in the free plan vs paid?

### Technical Areas to Study

| Area | Questions to Answer |
|------|-------------------|
| D1 isolation | Can we create D1 databases programmatically? What's the limit? |
| Auth | Multi-tenant JWT: tenant_id in token claims? |
| Routing | Subdomain-based (cafe1.auraspace.cafe) or path-based (auraspace.cafe/cafe1)? |
| Domain | Custom domain per cafe? |
| Deploy | Single Worker serving multiple tenants, or Worker per tenant? |
| Monitoring | Per-tenant metrics and billing (requires B1 + B4 mature) |

### Pre-Requisites

- [ ] Phase B complete (especially B1 metrics + B4 audit logs)
- [ ] At least 30 days of production metrics to model per-cafe costs
- [ ] A second cafe interested in using the system
- [ ] Clear unit economics: cost per tenant vs revenue per tenant

---

## C2: Mobile App (React Native) / Ung Dung Di Dong

**Effort est:** 60h | **Decision:** HOLD | **Rationale:** PWA may suffice for current stage

### What It Is / Noi Dung

A React Native / Expo wrapper around the existing web app, providing native push notifications, faster navigation, camera access (QR scanning), and offline support beyond PWA.

### Why Hold / Tai Sao Gi Lai

1. **PWA already works well** — Installable on all platforms, push notifications working, offline mode
2. **Cost/benefit ratio** — 60h development + App Store/Play Store maintenance is significant for a single cafe
3. **Franchise trigger** — If multi-tenant succeeds, franchise cafes likely want a branded app
4. **Tech debt timing** — Better to build after multi-tenant architecture (C1) stabilizes the API layer

### If Decision to Proceed / Neu Quyet Dinh Tien Hanh

| Phase | Focus | Effort |
|-------|-------|--------|
| 1 | Expo project setup, shared types, API client | 10h |
| 2 | Screen scaffold: menu, ordering, checkout | 15h |
| 3 | Native push notifications (FCM/APNs) | 10h |
| 4 | QR scanner, camera, geolocation | 8h |
| 5 | Offline support + sync | 10h |
| 6 | App store submission, CI/CD | 7h |

---

## C3: AI Agent Features / Tinh Nang AI

**Effort est:** 30h research + prototyping | **Decision:** START RESEARCH (low-cost exploration)
**Trigger:** After 30 days of B1 metrics data collected

### What It Is / Noi Dung

Add AI-powered features that reduce manual operations and increase revenue:

1. **Demand Forecasting** — Predict daily order volume, ingredient needs, staff scheduling
2. **Dynamic Pricing** — Time + demand -> adjust happy hour / surge pricing automatically
3. **Smart Churn Prevention** — Beyond simple 30-day rule: ML-based inactive detection with personalized offers
4. **Menu Optimization** — Analyze sales data to suggest menu removals/price adjustments
5. **Content Generation** — Auto-suggest social media posts from sales data via Mixpost bridge

### Research Path / Lo Trinh Nghien Cuu

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Data availability audit — what fields does B1 collect? | Gap report |
| 2 | Model selection — local LLM (MLX) vs Cloudflare Workers AI vs external API | Recommendation |
| 3 | Prototype: demand forecast from 30-day order history | MVP script |
| 4 | Evaluation: accuracy vs no-model baseline, cost estimate | Decision document |

### Key Constraints / Rang Buoc

- **No customer data sent to external AI APIs** — must run locally or on Cloudflare Workers AI (privacy)
- **Must work offline** — cafe internet can be unreliable
- **Must be explainable** — cafe owner needs to understand WHY the AI predicts something
- **Budget:** Cloudflare Workers AI free tier or $5/mo plan only

---

## C4: Franchise Expansion Tools / Cong Cu Mo Rong Nhan Hieu

**Effort est:** 50h | **Decision:** HOLD until first franchise interest materializes

### What It Is / Noi Dung

Tools and infrastructure needed to replicate AURA CAFE for franchise locations:

1. **White-label system** — Each franchise gets branded version (logo, colors, domain)
2. **Central admin console** — Franchisor can view all locations' metrics
3. **Standardized setup** — One-click deploy for new franchise (infrastructure-as-code)
4. **Centralized loyalty** — Points earned at any location, redeemed at any location
5. **Supply chain integration** — Multi-location inventory management via Odoo

### Prerequisites / Dieu Kien Can

- [ ] C1 multi-tenant architecture complete (franchise = paid multi-tenant)
- [ ] C2 mobile app (optional but desirable)
- [ ] At least 3 months of single-cafe operations data to prove the model
- [ ] Clear legal structure: franchisor entity, franchise agreements, IP protection

---

## Summary: When to Revisit Each Item / Khi Nao Xem Lai

| Item | Trigger to Revisit | Max Effort Before Decision |
|------|--------------------|---------------------------|
| C1 Multi-Tenant | 200 orders/day OR another cafe asks to use the system | 10h architecture study |
| C2 Mobile App | Multi-tenant goes live OR franchise contract signed | 5h technical review |
| C3 AI Features | 30 days of B1 metrics collected | 30h research + prototype |
| C4 Franchise | First serious franchise inquiry received | 10h feasibility study |

---

## Recommendation / Khuyen Nghi

**Do C3 research next month.** AI demand forecasting is low-cost exploration (run on existing MLX hardware) with potentially high value — inventory optimization alone can reduce food waste 15-25%. The research path has clear stop/go gates and produces a decision document before any production code is written.

**Hold C1, C2, C4 until clear market signals.** Building platform features for 0 customers is premature. Focus on making AURA the best single-cafe system before scaling to many.
