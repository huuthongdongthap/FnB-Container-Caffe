# GO/NO-GO Validation — Aura Cafe Container

**Date:** 2026-06-30
**Stage:** PMF → Early Scale (paying customers, production system, expanding)
**Project:** FnB Container Caffe (Aura Cafe) — Sa Đéc, Đồng Tháp

---

## Validation Scores

| # | Dimension | Score (1-5) | Rationale |
|---|-----------|-------------|-----------|
| 1 | **Market Size** | 4 | Sa Đéc ~200K population + Mekong Delta tourism. TAM: F&B market VN ~$25B. SAM: Dong Thap cafe market ~$50M. SOM: 100-200 orders/day. Realistic given location. |
| 2 | **Problem Clarity** | 5 | Clear pain points validated: (a) cafes lose 20-30% to Grab/Shopee commissions, (b) no integrated loyalty+POS for small cafes, (c) SaaS costs 3-10x more. Direct ordering + self-hosted stack solves all three. |
| 3 | **Differentiation** | 4 | Strong moat via: (a) 12-pillar OSS integration (no competitor has this breadth), (b) Bazi-aligned premium design (unique brand), (c) zero platform commission model. Weakness: single-location, replicable tech stack. |
| 4 | **Unit Economics** | 4 | AOV 125K VND, 63% gross margin. Break-even ~60 orders/day. Path to LTV > 3x CAC via loyalty retention. Tech cost ~700K VND/mo vs 3-10M for SaaS alternatives. |
| 5 | **Execution Feasibility** | 5 | Already in production v2.1.0. 576 tests passing. Cloudflare-deployed. 11 HTML pages + 40 API endpoints + 11 DB tables. Team has proven execution capability. |
| 6 | **Agentic Fit** | 4 | AI agents can automate: (a) customer support chatbot (Zalo integration), (b) demand forecasting, (c) dynamic pricing, (d) inventory prediction, (e) social media scheduling (Mixpost). 30-40% ops cost reduction potential. |

**Total Score: 26/30**

---

## Verdict: ✅ **GO** (Score ≥ 20)

**Confidence:** HIGH. System is already production-validated with real customers.

### Key Strengths
- Production-proven technology stack (Cloudflare Workers + D1)
- 90% SaaS cost savings vs competitors (700K vs 3-10M VND/mo)
- Unique Bazi-aligned brand identity (Navy/Chrome/Mộc)
- 12-pillar OSS integration creates deep competitive moat
- Zero platform commission model (direct ordering)

### Risk Mitigation Priorities
1. **Cloudflare Free Tier limits** → Already on Paid plan ($5/mo). Monitor usage.
2. **Single-location dependency** → Phase 3 multi-tenant architecture planned for 2027.
3. **E-invoicing compliance** → Odoo accounting integration Q3 2026 target.

---

## Unresolved Questions
- Current actual daily order volume? (target 100, need confirmation)
- Loyalty member count? (target 500, need current figures)
- Odoo full integration timeline — 40h estimated, is this resourced?
