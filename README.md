# AURA CAFE — Container Caffe & Space

Premium F&B management system for **AURA CAFE**, an industrial-luxury container cafe at 39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp.

**Production:** https://auraspace.cafe | **Admin:** https://fnb-caffe-container.pages.dev/admin/login

---

## 🏗 Architecture

| Layer | Tech | Deploy |
|-------|------|--------|
| **Frontend** | Vite + React 19 + TypeScript + Tailwind CSS | Cloudflare Pages |
| **Backend** | Hono + Cloudflare Workers + D1 (SQLite) | Cloudflare Workers |
| **State** | TanStack Query + Zustand | — |
| **Auth** | JWT (better-auth) | — |
| **Storage** | Cloudflare D1 + KV | — |
| **Payments** | PayOS, COD | — |
| **Notifications** | Web Push, Zalo ZNS, SMS (SpeedSMS), Email (Resend) | — |

## ✨ Features (30+)

### Customer-Facing
QR ordering · Digital menu · Checkout (PayOS/COD) · Order tracking · Push notifications · ZNS/SMS alerts · Account dashboard · Reviews · Subscription plans · Split bill · Live chat · PWA · SEO · Loyalty (4 tiers) · Referral program · Birthday rewards · Promotions · Table reservation · Events · TV Menu · Check-in rewards

### Admin Panel
Dashboard (stats, charts, activity) · Order management · Menu CRUD · Customers · Staff management · Shifts (clock-in/out) · KDS (kitchen display, sound alerts, prep timer) · POS · Reservations · Check-in approval · ERPNext sync (BYOK) · E-invoice · Promotions manager · Campaigns (birthday, winback, welcome) · Broadcast (ZNS/SMS/Email segments) · Analytics (top products, peak hours, CSV export) · Subscription manager · Invoice history · Birthday config · Chat inbox · Analytics config (GA4, FB Pixel) · QR generator

### Design System
Dark navy theme · Chrome/silver accents · Glassmorphism · Responsive · Stitch DESIGN.md spec

## 🚀 Quick Start

```bash
cd /Users/macbook/FnB-Container-Caffe
npm install
npm run dev          # http://localhost:3000
npm test             # 1063 tests
npm run build        # 0 TS errors
```

## 📦 Deploy

```bash
bash deploy-cloudflare.sh
```

## 🧪 Tests

```bash
npm test                          # 1063 unit tests
npx vitest run                    # Vitest
npx playwright test               # 129 E2E tests
npx playwright test --config=playwright.config.prod.ts  # E2E on production
```

## 🔗 Key URLs

| Resource | URL |
|----------|-----|
| Production | `https://auraspace.cafe` |
| Frontend | `https://fnb-caffe-container.pages.dev` |
| API | `https://aura-space-worker.agencyos-openclaw.workers.dev` |
| API Health | `GET /api/health` |
| Admin Login | `/admin/login` |
| Menu | `/menu` |
| QR Order | `/menu?table=B01` |

## 🎨 Stitch Designs

5 AI-generated designs available at `stitch-exports/`:
- Home landing, Menu page, Mobile app, Admin dashboard
- Stitch project IDs in `CEO-HANDOVER.md`

## 📋 Handover

See [`CEO-HANDOVER.md`](CEO-HANDOVER.md) — full feature list, workflows, instructions in Vietnamese.

---

*Built with Claude Code — July 2026*
