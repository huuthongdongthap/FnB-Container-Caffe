# Business Model Canvas — Aura Cafe Container

**Date:** 2026-06-30 | **Source:** Existing docs/08_BUSINESS_MODEL.md (validated)

---

## Value Propositions
- **"Where Flavor Meets Design"** — Premium F&B + industrial-luxury container architecture
- **Zero platform commission** — Direct ordering, no Grab/ShopeeFood fees (save 20-30%)
- **Self-sovereign tech** — 100% OSS, no vendor lock-in, data self-owned
- **Cost leadership** — ~700K VND/mo tech cost vs 3-10M for SaaS alternatives
- **Bazi-aligned experience** — Feng shui-driven design unique in VN cafe market

## Customer Segments
| Segment | Size Est. | Primary JTBD |
|---------|-----------|--------------|
| Walk-in locals | 60% | Quick quality coffee, comfortable space |
| Students/coworkers | 20% | WiFi, power, all-day seating |
| Event attendees | 10% | Workshop/meetup space + catering |
| Online orderers | 8% | Fast ordering, contactless payment |
| Tourists | 2% | Instagram-worthy design, local flavors |

**ICP:** 22-40 age, middle-income, digital-savvy, values design + experience over price.

## Channels
- **Direct:** Physical cafe (Sa Đéc), website (fnb-caffe-container.pages.dev)
- **Social:** Mixpost-scheduled content (Facebook, Instagram, Zalo)
- **Email:** Mautic campaigns (promotions, win-back, birthday)
- **Referral:** Loyalty program (30% commission on referrals)
- **Events:** Workshops, tastings (pretix ticketing)

## Revenue Streams
| Stream | % of Revenue | Model |
|--------|-------------|-------|
| F&B Sales | ~85% | Direct payment (COD, QR, VNPay, MoMo) |
| Event Space Rental | ~10% | 500K-2M VND/hr via Cal.com |
| Coworking Memberships | ~5% | 50K/day, 1.5M/mo, 4M/quarter |
| Ticketed Events | Tertiary | 200K-500K/person via pretix |

## Cost Structure
| Category | Monthly (VND) |
|----------|---------------|
| Cloudflare Workers ($5 plan) | 125,000 |
| Domain + SSL | 50,000 |
| SMTP (transactional) | 100,000 |
| Hardware (RPi, displays) | ~500K one-time |
| **Total Tech Fixed** | **~275,000** |
| Payment gateway fees (2.5%) | Variable |
| COGS (ingredients) | ~30% of revenue |
| Staff (4-6 people) | 32-72M VND |
| Marketing | 5-10% of revenue |

## Key Resources
- **Tech:** Cloudflare Workers + D1 + KV, 25 JS modules, 40+ API endpoints
- **Physical:** Container cafe, Raspberry Pi cluster, CCTV, IoT sensors
- **Human:** Founder (Nguyễn Hữu Còn), Mekong CLI dev team, 4-6 cafe staff
- **IP:** Bazi v5.1 design system, 12-pillar integration architecture
- **Data:** Customer behavior, order history, loyalty patterns

## Key Activities
1. Cafe operations (order taking, F&B preparation, service)
2. Technology maintenance (deployments, monitoring, bug fixes)
3. 12-pillar OSS integration (Odoo, Cal.com, Frigate, etc.)
4. Marketing & loyalty program management
5. Event hosting & community building

## Key Partnerships
- **Cloudflare** — Hosting (Pages, Workers, D1, KV)
- **Payment gateways** — PayOS, VNPay, MoMo, SePay
- **OSS communities** — Odoo, Cal.com, Home Assistant, Frigate
- **Local suppliers** — Coffee beans, food ingredients
- **Mekong CLI** — Development framework & tooling

## Customer Relationships
- **Self-service:** Website ordering, loyalty dashboard, reservations
- **Automated:** Email campaigns (Mautic), loyalty tiers, churn prevention
- **High-touch:** In-person cafe experience, events, VIP tier perks
- **Community:** Workshops, tastings, coworking culture

---

## Unit Economics (Per Order)
- AOV: 125,000 VND
- COGS (30%): -37,500 VND
- Payment fee (2.5%): -3,125 VND
- Loyalty cashback (avg 4%): -5,000 VND
- **Gross margin: 79,375 VND (63%)**

**Break-even:** ~60 orders/day covers all costs.
