---
date: 2025-06-19
version: 1.0
status: stable
---

# GLOSSARY — AURA CAFE CONTAINER

## A

**ADRs** — Architecture Decision Records. Documents explaining major technical decisions. See `06_ADR/`.

**AOV** — Average Order Value. Average spend per customer transaction. Current: 125,000 VND.

**API** — Application Programming Interface. Backend endpoints (`/api/*`) that frontend calls.

**Auth (Authentication)** — Process of verifying user identity (login). Uses JWT tokens.

**Authorization** — Process of checking user permissions (role-based access control).

**AURA** — Project codename for F&B Container Caffe system.

---

## B

**Bazi (Bát Trạch)** — Vietnamese Feng Shui design system based on five elements:
- **Thủy (Water)** — Primary color: Deep Navy `#0A1A2E`
- **Kim (Metal)** — Secondary: Chrome Silver `#C9D6DF`
- **Mộc (Wood)** — Tertiary: Forest Green `#1A2D1F`
- **Hỏa (Fire)** — Banned (reds, oranges)
- **Thổ (Earth)** — Banned (browns, yellows)

**Bootstrap** — Initial setup of admin account with owner privileges.

---

## C

**CAC** — Customer Acquisition Cost. Money spent to acquire one new customer.

**Cafe Container** — Modular cafe design using shipping containers. Our system is designed for this venue type.

**Check-in** — Loyalty feature where customers scan QR code upon visiting to earn points.

**Cloudflare** — Hosting/CDN provider. Services used: Pages, Workers, D1, KV.

**CORS** — Cross-Origin Resource Sharing. Headers allowing browser to call API from different origin.

**CRUD** — Create, Read, Update, Delete. Basic database operations.

**CTR** — Click-Through Rate. Metric for marketing effectiveness.

---

## D

**D1** — Cloudflare's SQLite-compatible database service.

**Dark Mode** — UI theme with dark background, light text. Auto-switches at 18:00 local time.

---

## E

**E-invoicing** — Electronic invoicing mandatory in Vietnam from 2025. ERPNext Accounting integration in progress.

**ETL** — Extract, Transform, Load. Data pipeline pattern (not used directly, conceptually similar to sync jobs).

---

## F

**Free Tier** — Cloudflare's no-cost tier: 100k Workers requests/day, 5GB D1, 1k KV ops/day.

---

## G

**GDPR** — General Data Protection Regulation (EU). Not directly applicable but informs data retention policies.

**Ghost user** — User account created but never completed signup or made first order.

---

## H

**Hono** — Web framework for Cloudflare Workers. Used for routing and middleware.

**HTTPOnly cookie** — Cookie not accessible via JavaScript (more secure for tokens).

**HVAC** — Heating, Ventilation, Air Conditioning. Controlled via Home Assistant integration.

---

## J

**JWT** — JSON Web Token. Stateless authentication token signed with secret. Contains `userId`, `role`, `exp`.

---

## K

**KDS** — Kitchen Display System. Real-time order display for kitchen staff. Page: `kds.html`.

**KV** — Cloudflare's key-value store. Used for rate limiting counters and session cache.

---

## L

**LCP** — Largest Contentful Paint. Web Vitals metric (target <2.5s). Current: ~1.8s.

**LTV** — Lifetime Value. Total revenue expected from customer over lifetime. Current target: 500K VND.

**Loyalty tiers:**
- **Bronze** — 0-500K cumulative spend, 3% cashback
- **Silver** — 500K-2M, 5% cashback
- **Gold** — 2M-5M, 7% cashback
- **Platinum** — 5M+, 10% cashback, permanent

---

## M

**MD3** — Material Design 3. Design system used with Bazi color overrides.

**Mekong CLI** — Development framework with agents, skills, commands. Used for all development tasks.

**Migration** — Database schema change file in `db/migrations/`. Versioned SQL scripts.

**MIT License** — Permissive open-source license (used for TastyIgniter, Mixpost).

---

## O

**OSS** — Open Source Software. Project uses 12 OSS pillars to avoid SaaS costs.

**Odoo** — All-in-one business software (ERP, POS, CRM, Accounting). Migrated to ERPNext (2026-06-30). Legacy files preserved.

**ERPNext** — Open-source ERP (Python/Frappe), 100% free GPL v3, all modules included. Replaced Odoo as the ERP backbone (Phase 01-05).

---

## P

**PayOS** — Vietnamese payment gateway. Primary QR code payment method.

**PWA** — Progressive Web App. Supports offline mode, add-to-home-screen, push notifications.

**POS** — Point of Sale. System for processing in-person transactions (`admin/pos.html`).

**PR** — Pull Request. Code review mechanism on GitHub.

---

## R

**Referral** — Loyalty program where customers earn cashback for referring friends (50K each).

**Rate Limiting** — Protection against abuse. Limits: auth 20/5min, orders 5/10min per IP.

**ROI** — Return on Investment. Measure of profitability.

---

## S

**SLA** — Service Level Agreement. Target: 99.9% uptime, <200ms API response.

**SQLite** — Lightweight relational database. D1 provides hosted version.

**SSR** — Server-Side Rendering. Not used (static HTML).

**Status codes:**
- `200 OK` — Success
- `400 Bad Request` — Client error
- `401 Unauthorized` — No/invalid auth
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `429 Too Many Requests` — Rate limited
- `500 Internal Server Error` — Server error
- `502 Bad Gateway` — Upstream error (PayOS)

---

## T

**Tier** — Loyalty membership level (Bronze/Silver/Gold/Platinum).

**Transaction ID** — Unique identifier for payment (from PayOS). Used for reconciliation.

---

## V

**Vite** — Build tool that bundles CSS/JS and processes HTML. Used for production `dist/` build.

**VND** — Vietnamese Đồng. Currency (1 USD ≈ 25,000 VND).

**Voucher** — Discount code (e.g., AURA20, AURA10). Applied before cashback.

---

## W

**Waterfall Chart** — Business model chart showing revenue → COGS → gross margin.

**Webhook** — HTTP callback from external service (PayOS) to our API.

**Workers** — Cloudflare's serverless compute platform. Runs backend code at edge.

**Worktree** — Git feature for isolated development branches. Used in CI and parallel work.

---

## External Services

| Acronym | Full Name | Purpose |
|---------|-----------|---------|
| **Cal.com** | Calendar scheduling | Event/room booking |
| **ERPNext** | ERP (Frappe) | Replaced Odoo: accounting, POS, CRM, inventory |
| **Frigate** | AI video analysis | CCTV heatmap |
| **Home Assistant** | Home automation | HVAC, lighting control |
| **Mautic** | Marketing automation | Email campaigns |
| **Mixpost** | Social media manager | Facebook/TikTok scheduling |
| **OpenWISP** | Wireless ISP software | Captive portal WiFi |
| **pretix** | Event ticketing | Workshop ticket sales |
| **TastyIgniter** | Online ordering | Restaurant ordering platform |
| **Xibo/Anthias** | Digital signage | Menu boards on TVs |

---

*Last updated: 2026-06-30 — Added ERPNext, deprecated Odoo (migrated to ERPNext)*
