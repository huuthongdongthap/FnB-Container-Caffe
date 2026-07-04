# Risk Assessment — AURA CAFE

**Date:** 2026-07-05
**Stage:** PMF -> Early Scale
**BizPlan Step:** 15

## Overview

Top 5 risks identified across operational, market, financial, technology, and regulatory dimensions. Each risk includes likelihood (Low/Medium/High), impact (Low/Medium/High), and a concrete mitigation plan.

---

## R1: Operational — Kitchen Bottleneck at Peak Hours

**Risk:** QR orders surge during lunch/dinner rush (11:30-13:00, 18:00-20:00) but the bar/kitchen cannot keep up, causing 20+ min wait times, order cancellations, and negative reviews.

| Dimension | Rating |
|-----------|--------|
| Likelihood | High |
| Impact | High |
| Risk Level | **Critical** |

**Mitigation Plan:**
- KDS (Kitchen Display System) prioritizes orders by prep time — drinks under 3 min go first, food orders queue separately
- Pre-set time-slot ordering: customers can pre-order 15 min ahead via QR
- Batch prep during off-peak (syrups, toppings, ice pre-portioned)
- Staff roster scales: 1 barista per 15 orders/hour threshold, add 1 more when threshold breached
- Menu design limits: no more than 3 "slow" items (manual brew, blended) on menu at any time
- Monitor KDS lag in real-time, auto-flag when queue exceeds 10 pending orders

---

## R2: Market — Demand Fizzles After Initial Hype

**Risk:** AURA CAFE attracts a strong opening crowd driven by novelty (container concept + 5 zones), but repeat rate drops below 20% after month 2 because the target demographic in Sa Dec (population ~100k) is too small to sustain daily traffic.

| Dimension | Rating |
|-----------|--------|
| Likelihood | Medium |
| Impact | High |
| Risk Level | **High** |

**Mitigation Plan:**
- Loyalty program (tiered: Basic/Premium/Enterprise/Master) with tangible rewards: every 5th drink free, birthday bonus, exclusive zone access
- Weekly events schedule: acoustic night (Tue), workshop (Thu), DJ night (Sat) — drives repeat visits
- Referral program: referrer + friend both get 25k credit
- Subscription model: 299k/month for 10 drinks (lock in heavy users)
- Expand adjacent revenue: event space rental for birthdays/workshops, catering for offices
- Target overflow from Can Tho (40 min drive) via Google Ads + social media campaigns in wider Dong Thap

---

## R3: Financial — Cash Flow Gap Before Break-Even

**Risk:** Upfront capex (container renovation, furniture, kitchen equipment, Stitch design-to-code) consumes 600-800M VND, while daily revenue ramps slowly. Month 2-3 cash reserve dips below operating runway, forcing distress cuts to staff or ingredient quality.

| Dimension | Rating |
|-----------|--------|
| Likelihood | Medium |
| Impact | High |
| Risk Level | **High** |

**Mitigation Plan:**
- Phased capex: launch with 3 zones (Jade Counter, Sky Deck, Aura Lounge), defer Noir Cabin + VIP Steel Nest to month 4
- Pre-sale loyalty cards: 500k for 6 drinks (prepaid) -- collects cash before opening
- Supplier credit terms: negotiate 30-day net with ingredient suppliers (milk, syrup, beans)
- Variable cost discipline: ingredient cost must stay under 35% of revenue; adjust portion sizes if coffee bean price spikes
- Break-even target: 850 cups/day. Track daily; if below 600 cups/day by end of month 2, trigger cost review
- Cloud infrastructure stays at $0 (Cloudflare Workers + Pages); no recurring SaaS overhead
- Maintain 2-month operating reserve (200M VND) before any expansion capex

---

## R4: Technology — QR Ordering / Digital System Outage During Peak

**Risk:** The digital stack (Hono + Cloudflare Workers + D1 + QR ordering) goes down during peak hours due to uncaught bug, D1 connection pool exhaustion, or CF maintenance window. Customers cannot order, staff revert to pen-and-paper, chaos ensues.

| Dimension | Rating |
|-----------|--------|
| Likelihood | Medium |
| Impact | High |
| Risk Level | **High** |

**Mitigation Plan:**
- Offline fallback: staff iPads (or paper POS backup) with cached menu + manual order entry, synced when connection restores
- Graceful degradation: if D1 is unavailable, fall back to in-memory order buffer (Worker + KV) and batch-write when D1 recovers
- Load test before launch: simulate 200 concurrent QR orders (Cloudflare Workers handle this well, but D1 connection limit of ~10 concurrent writes per namespace is the bottleneck)
- Monitor: D1 query latency alarm at >500ms, Worker error rate alarm at >1%
- Deploy window: schedule CF changes for 02:00-05:00 AM only; never during operating hours (07:00-22:00)
- PayOS must have redundant fallback: if PayOS API is down, allow COD as immediate switch

---

## R5: Regulatory — Food Safety / Licensing Delays

**Risk:** Sa Dec regulatory body delays food safety certificate (VSATTP) or fire safety approval for container structure (non-standard building material). Opening pushed 2-4 months, burning rent + staff salary with zero revenue.

| Dimension | Rating |
|-----------|--------|
| Likelihood | Low |
| Impact | Very High |
| Risk Level | **High** |

**Mitigation Plan:**
- Pre-clear with district authorities (UBND TP Sa Dec, Phuong 2) before signing long-term lease: confirm that container structure is permissible for F&B
- Hire a local legal consultant (5-10M VND) who specializes in Sa Dec F&B licensing -- they know the exact document checklist and which officials to engage
- Fire safety: install fire extinguishers (1 per 50m2), emergency exit signage, smoke detectors in each container zone -- meet basic TCVN 3890:2009 standards
- Food safety: kitchen layout must pass VSATTP inspection (separate raw/wash/cook zones, proper drainage, stainless steel surfaces)
- Run license application in parallel with renovation (not sequential) -- submit docs on day 1 of construction
- Buffer 3 weeks in launch timeline specifically for unexpected regulatory delays

---

## Risk Matrix Summary

| ID | Risk | Likelihood | Impact | Level | Priority Action |
|----|------|-----------|--------|-------|-----------------|
| R1 | Kitchen bottleneck at peak | High | High | Critical | KDS + batch prep + staff scaling threshold |
| R2 | Post-hype demand fizzle | Medium | High | High | Loyalty + weekly events + subscription lock-in |
| R3 | Cash flow gap pre-breakeven | Medium | High | High | Phased capex + pre-sale cards + 35% ingredient cap |
| R4 | Digital system outage at peak | Medium | High | High | Offline fallback + D1 load test + redundant PayOS |
| R5 | Food safety/licensing delays | Low | Very High | High | Pre-clear with authorities + local legal + parallel apps |

---

## Contingency Reserve

- **Recommended reserve:** 150M VND (beyond operating capital)
- **Purpose:** Covers 1 month of rent + salary during license delay, or emergency equipment replacement
- **Triggers for drawdown:**
  - License not issued by scheduled open date
  - Major kitchen equipment failure (espresso machine, fridge)
  - Revenue < 50% of target for 3 consecutive weeks

---

## Monitoring Cadence

| Risk | Review Frequency | Owner |
|------|-----------------|-------|
| R1 Kitchen bottleneck | Daily (first 2 weeks), then weekly | Operations Manager |
| R2 Demand fizzle | Monthly cohort analysis | Marketing Lead |
| R3 Cash flow | Weekly P&L review | Finance / Founder |
| R4 System outage | Real-time (automated alerts) + weekly load review | Tech Lead |
| R5 Licensing delays | Weekly until certificate issued | Founder |

---

## Escalation Triggers (Critical)

Risk score reaches **Critical** when:
- Revenue < 40% of target for 2 consecutive weeks -> R2 trigger -> review pricing, menu, marketing strategy
- Cash reserve drops below 1 month runway -> R3 trigger -> freeze all non-essential spend, defer expansion
- System outage during peak hours > 30 min -> R4 trigger -> declare "offline mode" for the day, post-peak root-cause

---

*This is a living document. Revisit monthly during first quarter of operations, then quarterly.*
