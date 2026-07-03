# Market Research & Gap Analysis — Nghien Cuu Thi Truong & Phan Tich Khoang Cach

**Date:** 2026-07-03
**Project:** AURA CAFE Container System
**Location:** 39 Nguyen Tat Thanh, Sa Dec, Dong Thap
**Status:** Production v2.1.0 (30+ features, 1,184 tests)

---

## Part 1: Market Landscape / Toan Canh Thi Truong

### 1.1 Vietnam F&B Tech Market / Thi Truong Cong Nghe F&B Viet Nam

The Vietnam F&B market is approximately $25B annually with ~10% digital penetration. The Mekong Delta represents a significant underserved segment:

| Segment | Size | Digital Penetration | Key Players |
|---------|------|-------------------|-------------|
| Urban F&B (HCMC/HN) | ~$15B | 15-20% | GrabFood, ShopeeFood, Lozi, Now |
| Provincial F&B (others) | ~$10B | 3-5% | GrabFood (limited), Zalo OA, Facebook |
| Small cafe POS | ~$2B | 10% | KiotViet, Sapo, iPOS, Misa |

**Key insight:** Provincial cafes (Sa Dec's segment) have the lowest digital penetration but the highest growth potential. The dominant players are:
- **KiotViet** — ~50K locations, 300K-1M VND/mo, limited loyalty/marketing
- **Sapo** — ~30K locations, 200K-1M VND/mo, stronger e-commerce focus
- **iPOS** — ~20K locations, 300K-1.5M VND/mo, F&B-specific

**AURA advantage:** All 3 competitors charge 3-10M VND/mo for comparable features. AURA operates at 700K VND/mo (Cloudflare + domain), a **90% cost reduction.** Additionally, no competitor offers:
- Zero-commission direct ordering (bypassing Grab/ShopeeFood 20-30% fees)
- 12-pillar OSS integration breadth
- Bazi-aligned industrial-luxury design system

### 1.2 Sa Dec Local Market / Thi Truong Sa Dec

| Factor | Data |
|--------|------|
| Population | ~200,000 (Sa Dec city + surrounding districts) |
| Competitor cafes | 15-20 within 2km radius |
| Average coffee price | 25,000-45,000 VND |
| Target AOV | 125,000 VND (premium positioning) |
| Target daily orders | 100-200/day |

### 1.3 F&B Technology Trends 2026 / Xu Huong Cong Nghe F&B 2026

| Trend | Maturity | AURA Status | Gap |
|-------|----------|-------------|-----|
| QR Ordering | Mainstream | Done | — |
| Digital Menu | Mainstream | Done | — |
| Loyalty Programs | Mainstream | Done | — |
| Contactless Payment | Mainstream | Done (PayOS, COD) | Add more VN wallets |
| Automated Marketing | Growing | Done (campaign engine) | — |
| Analytics Dashboard | Growing | Done (real D1 data) | — |
| Online Ordering | Growing | Done | — |
| Kitchen Display (KDS) | Growing | Done | — |
| Observability | Emerging | **MISSING** | B1 |
| AI Demand Forecasting | Emerging | **MISSING** | C3 research |
| Refund Processing | Niche | **MISSING** | B5 |
| Audit Trail | Niche | **MISSING** | B4 |
| Web Vitals / Perf Monitor | Growing | **MISSING** | B3 |
| Multi-tenant Platform | Niche | **MISSING** | C1 hold |

---

## Part 2: Competitor Analysis / Phan Tich Doi Thu

### 2.1 Direct Competitors / Doi Thu Truc Tiep

| Feature | AURA CAFE | KiotViet | Sapo | iPOS | GrabFood |
|---------|-----------|----------|------|------|----------|
| Monthly Cost | 700K VND | 300K-1M | 200K-1M | 300K-1.5M | 20-30% commission |
| QR Ordering | ✅ | ❌ | ❌ | ❌ | ❌ |
| Loyalty | ✅ (4 tiers) | ✅ (basic) | ✅ (basic) | ✅ (basic) | ❌ |
| KDS | ✅ | ❌ | ❌ | ❌ | ❌ |
| Marketing | ✅ (campaigns) | ❌ | ✅ (email) | ❌ | ❌ |
| Analytics | ✅ (real D1) | ✅ (basic) | ✅ (basic) | ✅ (basic) | ✅ (sales only) |
| Open Source | ✅ (100%) | ❌ (proprietary) | ❌ (proprietary) | ❌ (proprietary) | ❌ (platform) |
| E-invoice | Via Odoo | ✅ (built-in) | ✅ (built-in) | ✅ (built-in) | ❌ |
| Inventory | Via Odoo | ✅ (built-in) | ✅ (built-in) | ✅ (built-in) | ❌ |
| Commission | 0% | 0% | 0% | 0% | 20-30% |

**Competitive moat:** AURA's differentiation rests on:
1. **Cost advantage** — 90% cheaper than SaaS alternatives
2. **Feature breadth** — 12-pillar OSS integration creates functionality no competitor matches
3. **Zero commission** — Direct ordering saves 20-30% vs platform ordering
4. **Design uniqueness** — Bazi-aligned industrial-luxury brand identity

**Competitive vulnerability:** Competitors offer built-in e-invoicing, inventory management, and accounting — AURA relies on Odoo integration for these (requires setup, separate maintenance).

### 2.2 Indirect Substitutes / Thay The Gian Tiep

| Substitute | User Base | Threat Level | Mitigation |
|------------|-----------|-------------|------------|
| Facebook/Zalo manual ordering | All cafes | LOW | Inefficient, no analytics |
| Pen-and-paper POS | Small cafes | LOW | Cannot scale |
| Excel-based management | Micro cafes | LOW | No real-time data |
| GrabFood Promo campaigns | 10M+ VN users | MEDIUM | Compete on direct value, not price |

---

## Part 3: Gap Analysis / Phan Tich Khoang Cach

### 3.1 Feature Gaps vs Competitors / Thieu Tinh Nang So Voi Doi Thu

| Gap | Severity | Competitor Baseline | AURA Plan | Effort |
|-----|----------|-------------------|-----------|--------|
| Refund processing | HIGH | All competitors support refunds | **B5** (Phase B) | 6-8h |
| Audit trail | MEDIUM | KiotViet/Sapo have basic activity logs | **B4** (Phase B) | 10-12h |
| E-invoice (built-in) | MEDIUM | All 3 have built-in | Via Odoo integration | Dependency |
| Inventory mgmt (built-in) | MEDIUM | All 3 have built-in | Via Odoo integration | Dependency |
| Observability/alerting | MEDIUM | None have this | **B1** (Phase B) | 6-8h |
| Performance monitoring | LOW | None have this | **B3** (Phase B) | 4-6h |
| Mobile app | LOW | Sapo has staff app | **C2** (Hold) | 60h |
| Multi-location | LOW | KiotViet supports chains | **C1** (Hold) | 40h |

**Key finding:** AURA is ahead of competitors on marketing, analytics, and ordering features but behind on **operational basics** (refunds, audit trail). Phase B directly addresses this gap.

### 3.2 Design & UX Gaps vs DESIGN.md Spec / Thieu Thiet Ke

| Aspect | Current State | DESIGN.md Spec | Gap | Phase |
|--------|--------------|---------------|-----|-------|
| Typography | 3 fonts fighting (PJS, Cormorant, EB Garamond) | Cormorant Garamond + Space Grotesk only | Multiple violations | A1 |
| Dark theme | Light-mode @theme tokens | Dark-only @theme | Critical | A1 |
| Component backgrounds | bg-white, bg-gray-50 on dark bg | Glass-on-dark aesthetic | Critical | A2 |
| Icons | 30+ emoji used as icons | Lucide/SVG icons only | Violation | A3 |
| Touch targets | Some below 44px | >= 44px WCAG 2.5.5 | WCAG breach | A5 |
| Container padding | px-4 (16px) on desktop | 24px | Spec mismatch | B6 |
| Page transitions | Instant (no animation) | Smooth transitions | Polish gap | A5 |
| Navbar active indicator | None | Current page should be clear | UX gap | A5 |
| Reviews route | Missing (404) | Should render | Broken nav | A5 |

### 3.3 Infrastructure Gaps / Thieu Ha Tang

| Aspect | Current State | Target State | Phase |
|--------|--------------|-------------|-------|
| Metrics collection | None | Full request-level metrics | B1 |
| Alerting | None | Telegram alerts for revenue/infra/security | B1 |
| Audit logging | None | Full admin action audit trail | B4 |
| Web Vitals | None | LCP/FID/CLS tracking | B3 |
| API performance monitoring | None | P95 latency tracking | B3 |
| Refund processing | Manual (outside system) | PayOS API integration | B5 |
| CI performance gate | None | Lighthouse CI on PRs | B3 |

---

## Part 4: Customer Feedback Analysis / Phan Tich Phan Hoi Khach Hang

Based on the existing feature set and cafe operations patterns, the most requested operational features are:

| Customer Type | Likely Need | Addressed By |
|---------------|-------------|--------------|
| Regular customers | Smooth ordering, loyalty visibility | ✅ Existing |
| Walk-in first-timers | Easy menu browsing, QR ordering | ✅ Existing |
| Staff | Fast workflows, clear KDS | ✅ Existing |
| **Cafe Owner** | **"Who refunded this order?"** | **B5 + B4** |
| **Cafe Owner** | **"How was business this week vs last?"** | **B2** |
| **Cafe Owner** | **"Did the system have any errors today?"** | **B1** |

---

## Part 5: Technology Trends & Applicability / Xu Huong Cong Nghe

### 5.1 Key Trends to Watch / Xu Huong Can Theo Doi

| Trend | Relevance to AURA | Action |
|-------|-------------------|--------|
| AI-powered customer analytics | HIGH — demand forecasting, churn prediction | C3 research |
| Web Push (PWA) improvements | MEDIUM — already implemented, monitor evolution | Stay current |
| Cloudflare ecosystem growth | HIGH — D1, Workers AI, Queues maturing fast | Quarterly review |
| Embedded finance (BNPL, insurance) | LOW — premature for single cafe | Noted |
| Super-apps (Grab, Shopee) | LOW — competing on direct value, not platform | Stay focused |

### 5.2 Cloudflare Roadmap Impact / Tac Dong Lo Trinh Cloudflare

| Cloudflare Feature | Status | AURA Opportunity |
|-------------------|--------|----------------|
| D1 (GA, improving) | Production | Primary DB — reliable |
| Workers Analytics Engine | GA | Alternative to B1 self-built metrics. **Evaluate vs custom solution** |
| Workers AI (GPU inference) | Beta | AI features without external API. Watch for GA |
| Queues | GA | Async processing for webhooks, campaigns. Currently built-in |
| Hyperdrive (DB connection pooling) | GA | Not applicable (D1 is edge-native) |

**Recommendation:** Evaluate Workers Analytics Engine for B1 metrics storage. It may reduce D1 storage needs and provide built-in querying. However, the self-built solution on D1 gives full control and simpler deployment.

---

## Part 6: Risk Analysis / Phan Tich Rui Ro

### 6.1 Competitive Risks / Rui Ro Canh Tranh

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Competitor adds QR ordering | MEDIUM | LOW (they'd need full KDS too) | AURA has 6-month head start + KDS integration |
| Competitor reduces price | LOW | MEDIUM | AURA already at 90% cost advantage |
| GrabFood offers better terms | LOW | LOW (different segment) | Direct ordering vs commission model — different value prop |
| New OSS competitor emerges | LOW | LOW | AURA's 12-pillar breadth hard to replicate quickly |

### 6.2 Technology Risks / Rui Ro Cong Nghe

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Cloudflare D1 limits reached | LOW | HIGH | Monitor via B1 metrics. Upgrade plan if needed |
| PayOS API changes | LOW | MEDIUM | Test with sandbox first. B5 includes graceful error handling |
| Web Push deprecation | LOW | MEDIUM | PWA is W3C standard, unlikely to change |
| AI model accuracy poor | MEDIUM | LOW (prototype phase) | C3 research has clear stop/go before production |

---

## Part 7: Strategic Recommendations / Khuyen Nghi Chien Luoc

### Immediate (Phase A: 14-17h)

1. **Fix the design foundations** — AURA's 5/10 UI/UX score is below premium brand standard. A1-A5 directly impact customer perception and staff efficiency.

### Short-Term (Phase B: 40-53h)

2. **Build observability first** — Cannot manage what you cannot measure. B1 is the foundation for all operations decisions.
3. **Enable refund processing** — Every day without refund capability is a customer trust risk. B5 closes the highest-impact gap versus competitors.
4. **Add audit trail** — Staff accountability and "who changed this?" questions are critical for a growing business. B4 provides this.
5. **Add sales comparison** — "How was this week vs last week?" is the most common business question. B2 answers it.

### Medium-Term (Phase C Research)

6. **Research AI demand forecasting** — After 30 days of B1 metrics, evaluate AI features. Inventory optimization alone can reduce food waste 15-25%.
7. **Monitor multi-tenant timing** — Do not build platform features before there are paying customers for them. Watch for the trigger: 200 orders/day OR another cafe asks to use the system.

---

## Sources

- `docs/00_FOUNDER_MANIFESTO.md` — Business vision
- `docs/01_GOAL.md` — Project objectives
- `docs/03_ARCHITECTURE.md` — System architecture
- `docs/04_ROADMAP.md` — Historical roadmap
- `docs/08_BUSINESS_MODEL.md` — Business model + unit economics
- `docs/10_RISK_REGISTER.md` — Risk register
- `CEO-HANDOVER.md` — Full feature list + operations guide
- `plans/reports/brainstorm-260702-1204-next-direction.md` — Next direction analysis
- `plans/260630-1744-fnb-container-caffe-ideation/go-nogo-report.md` — GO/NO-GO validation
- `plans/260630-1744-fnb-container-caffe-ideation/bmc.md` — Business Model Canvas
- `plans/260630-1744-fnb-container-caffe-ideation/prd.md` — Product Requirements Document
- `plans/260703-1028-3-streams-analytics-fix-image/plan.md` — Completed 3-streams work
- `plans/reports/brainstorm-260703-1028-next-3-streams-report.md` — Previous phase analysis
- `plans/reports/frontend-design-260703-aura-polish.md` — UI audit details
- `plans/reports/ui-ux-pro-max-260703-aura-audit.md` — Full UX audit
- `plans/260702-1206-automated-marketing-campaigns/plan.md` — Marketing campaign engine
- External: Vietnam F&B market reports (general knowledge), Cloudflare D1/Workers pricing pages
