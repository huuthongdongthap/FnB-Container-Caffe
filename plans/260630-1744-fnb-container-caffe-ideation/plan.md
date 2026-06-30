# Ideation Plan — Aura Cafe Container (FnB Container Caffe)

**Plan ID:** 260630-1744-fnb-container-caffe-ideation
**Date:** 2026-06-30
**Stage:** PMF → Early Scale
**Verdict:** ✅ **GO** (26/30)
**Project:** `/Users/macbook/FnB-Container-Caffe/`

---

## Executive Summary

Aura Cafe Container is a **production-validated** F&B management system for a container cafe in Sa Đéc, Đồng Tháp, Vietnam. Built on 100% open-source technology (Cloudflare Workers + D1 + 12 OSS pillars), it achieves ~90% SaaS cost savings (700K vs 3-10M VND/mo) while delivering premium customer experience with Bazi-aligned industrial-luxury design.

**Status:** v2.1.0 Production | 576 tests | 40+ API endpoints | 11 pages + admin

## Pipeline Results

| Artifact | Status | Path |
|----------|--------|------|
| GO/NO-GO Report | ✅ Complete | [go-nogo-report.md](go-nogo-report.md) |
| Business Model Canvas | ✅ Complete | [bmc.md](bmc.md) |
| Product Requirements Document | ✅ Complete | [prd.md](prd.md) |

## Key Findings

### Strengths
1. **Production-proven** — Real customers, real orders, real payments
2. **Cost advantage** — 90% cheaper than SaaS alternatives
3. **Unique brand** — Bazi v5.1 design system (Navy/Chrome/Mộc)
4. **Deep moat** — 12-pillar OSS integration creates switching cost
5. **Zero commission** — Direct ordering bypasses Grab/ShopeeFood 20-30% fees

### Priorities (Next 6 Months)
1. **Complete 12-pillar integration** (~220h effort across Q3-Q4 2026)
2. **Odoo full suite** (inventory, accounting, e-invoicing) — compliance critical
3. **Scale orders** from current to 100+/day target
4. **Agentic automation** — churn prevention, social scheduling, demand forecasting
5. **Multi-tenant prep** — architecture design for franchise expansion

### Risk Watch
- E-invoicing compliance deadline (mandatory for VN businesses)
- Cloudflare dependency (mitigated: $5 Paid plan, upgrade path clear)
- Single-location concentration (mitigated: Phase 3 multi-tenant, 2027)

## Next Steps: Bootstrap Handoff

```
/ck:bootstrap "/Users/macbook/FnB-Container-Caffe" --auto --parallel
```

**Bootstrap focus areas:**
1. 12-pillar integration execution (Odoo, Cal.com, TastyIgniter priority)
2. Agentic automation implementation (churn prevention, social scheduling)
3. Multi-tenant architecture design
4. Test coverage maintenance (≥80%)

---

## Related Documents (Existing)
- `docs/00_FOUNDER_MANIFESTO.md` — Vision & values
- `docs/01_GOAL.md` — Project objectives
- `docs/03_ARCHITECTURE.md` — System design
- `docs/04_ROADMAP.md` — Timeline & milestones
- `docs/08_BUSINESS_MODEL.md` — Full business model
- `docs/10_RISK_REGISTER.md` — Risk analysis
