---
type: product-requirements-document
date: 2026-07-05
project: AURA CAFE
stage: Zero→PSF
---

# PRD — AURA CAFE Container Space

## Vision / Tầm nhìn

AURA CAFE là không gian cà phê container công nghiệp-luxury đầu tiên ở Đồng Tháp,
kết hợp ordering digital 9/10 với 5 zonal spaces độc đáo.
Mang đến "Khoảng Không Của Bạn / Your Space" cho Gen Z, dân văn phòng và du khách.

## Target Users / ICP

| Persona | Age | Income | Frequency | Budget | Channel |
|---------|-----|--------|-----------|--------|---------|
| **Thanh** (Giới trẻ) | 18-35 | 3-8M/tháng | 1-2x/tuần | 45K-55K | TikTok, IG |
| **Chị Hiền** (Văn phòng) | 25-40 | 10-20M/tháng | 2-3x/tuần | 49K coworking | Google Maps, FB |
| **Anh Vũ** (Du khách) | 22-50 | 15-30M/tháng | Weekend | 79K sunset | Google Maps, travel blogs |
| **Doanh nghiệp** | 30-55 | — | Monthly/quarterly | 500K-2M/event | Direct, FB Events |

## Core Features — MVP (YAGNI)

### Phase A: Physical + Ops (BLOCKER — trước mở cửa)
- [ ] Container 5-zone buildout + nội thất
- [ ] PCCC approval + GPKD + VSATTP + Tax registration
- [ ] Staff hiring (Head Barista + 3 Baristas + 2 Service + 1 PT Cleaner)
- [ ] Menu POS: 25-55K đồ uống, 30-80K food

### Phase B: Digital Launch (Week 1-2 after grand opening)
- [x] QR ordering → KDS → POS (LIVE)
- [x] PayOS payment integration (READY)
- [x] Zalo ZNS notifications (LIVE)
- [x] Loyalty 4-tier + member cards (LIVE)
- [x] Grand Opening campaign (50K bonus, 2x multiplier) (READY)

### Phase C: Growth (Month 2-4)
- [ ] 28 Stitch screens → React component conversion
- [ ] 18 admin pages completion
- [ ] MoMo + VNPay payment activation
- [ ] Analytics dashboard (revenue, orders, retention)
- [ ] ERPNext full sync (inventory + POS + accounting)
- [ ] Marketing automation first campaign (Mautic)
- [ ] Custom domain auraspace.cafe → CF Pages
- [ ] Real-time inventory management

### Phase D: Scale (Month 4+)
- [ ] Events programming (Weekend Art Market, Cafe Talks)
- [ ] Staff scheduling bot
- [ ] AI menu recommendations (OpenClaw)
- [ ] PWA full offline mode
- [ ] Multi-branch architecture (Y2)

## Success Metrics / KPI

| Metric | Target | Measurement |
|--------|--------|-------------|
| **North Star: Monthly Orders** | 3,000 orders/month | D1 aggregation |
| **Revenue** | 228M VND/month | Finance dashboard |
| **D30 Repeat Rate** | >55% | Loyalty analytics |
| **QR Adoption Rate** | >70% | Order channel split |
| **Loyalty Active Rate** | >60% | Engagement tracking |
| **Google Reviews** | 50+ at 4.3+ | Maps API |
| **TikTok Mentions** | 500+/month | Social listening |
| **Gross Margin** | >60% | P&L per order |
| **Staff Retention** | >85% | HR tracking |

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + Vite 8 + TypeScript | Self-hosted, zero framework tax |
| Styling | Tailwind CSS v4 + Bazi v5.1 tokens | Bazi-aligned, zero cost |
| Backend | Hono v4 on Cloudflare Workers | Pay-per-request, auto-scaling |
| Database | Cloudflare D1 (SQLite) | Zero cost at scale |
| Cache | Cloudflare KV | Rate limits, sessions |
| State | Zustand + TanStack Query v5 | Lightweight, no paywall |
| i18n | i18next + react-i18next | VN/EN bilingual |
| 3D | Three.js | Space visualization |
| SEO | react-helmet-async | SPA SEO |
| PWA | Service Worker | Offline ordering |
| AI | OpenClaw (OpenCode) | Customer support, content |
| Payments | PayOS + COD + VNPay + MoMo | VN market coverage |
| Marketing | Mautic + Mixpost + Zalo ZNS + SpeedSMS + SendGrid | Full automation |
| ERP | ERPNext | POS, inventory, accounting |
| Testing | Vitest (1,063) + Playwright (129) | Quality gates |

## Agentic Architecture

| Agent | Trigger | Action | Output | SLA |
|-------|---------|--------|--------|-----|
| Order Router | QR scan → cart | Validate → order → KDS | Display + notification | <3s |
| KDS Dispatcher | New order | Route by category | Kitchen display + print | <2s |
| Payment Settler | PayOS webhook | Verify → mark paid → loyalty | SMS/ZNS confirmation | <5s |
| Loyalty Engine | Order complete | Points → tier → reward | Badge + bonus | <1s |
| Winback Trigger | Daily cron | 30-day inactive | Zalo/SMS offer | Batch |
| Birthday Trigger | Daily cron | Today birthdays | Happy hour offer | Batch |
| Inventory Watcher | Order complete | Deduct → reorder check | ERPNext PO | Daily |
| Campaign Launcher | Manual/scheduled | Activate promo | Banner + notifications | <1m |

## Risks & Mitigations

| # | Risk | L | I | Mitigation |
|---|------|---|---|------------|
| R1 | Kitchen bottleneck peak | H | H | Pre-launch drill, PT hire |
| R2 | Demand fizzle | M | H | Loyalty presale 500K × 300 = 150M cash pre-open |
| R3 | Cash flow gap | M | H | 150M reserve, phased zones |
| R4 | Digital outage | M | H | CF SLA 99.9%, rollback plan |
| R5 | Licensing delays | L | VH | Apply M-4 in parallel |

## Unresolved Questions

1. Container vendor in Đồng Tháp — frame vs turnkey?
2. Staff housing availability near 39 Nguyễn Tất Thành?
3. Zalo OA approval timeline — có kịp trước launch?
4. 916 CSS tokens migration: manual vs bulk script?
5. aura-deploy CLI: npm publish or local-only?
