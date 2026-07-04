# Product Requirements Document — AURA CAFE Digital Platform

## Vision
Trở thành quán cafe container industrial-luxury hàng đầu Đồng Tháp, với hệ thống số tự động hóa toàn diện — từ gọi món, thanh toán, loyalty đến vận hành.

## Target Users
- **ICP**: Dân văn phòng, giới trẻ, gia đình tại Sa Đéc và Đồng Tháp
- **Demographics**: 18-45, thu nhập trung bình-khá, có nhu cầu không gian đẹp
- **Psychographics**: Thích trải nghiệm mới, chụp ảnh, quan tâm thiết kế
- **Triggers**: Bạn bè rủ, thấy trên social media, đi ngang qua

## Core Features (Current — 30+)
1. **QR Ordering** — Gọi món bằng QR, không cần app
2. **Digital Menu** — Thực đơn online với hình ảnh + mô tả
3. **Checkout** — PayOS + COD
4. **KDS** — Kitchen Display System cho bar
5. **POS** — Point of Sale cho thu ngân
6. **Loyalty** — Tích điểm + tier (Basic/Premium/Enterprise/Master)
7. **Referral** — Giới thiệu bạn, nhận thưởng
8. **Admin Dashboard** — Quản lý đơn hàng, doanh thu, nhân viên
9. **Events** — Sự kiện, noctural sessions
10. **Subscriptions** — Gói đăng ký định kỳ

## Missing Features (Cần thiết kế Stitch)
- **28 pages** trong TO-DO (10 customer + 18 admin)

## Success Metrics
- **North Star**: Monthly active orders (target: 3000/tháng)
- **KPIs**: 
  - QR order rate >60%
  - Customer retention >40%
  - Average ticket size >45k

## Tech Stack
- **Frontend**: Vite + React 19 + TypeScript + Tailwind v4
- **Backend**: Hono + Cloudflare Workers + D1
- **Design System**: Stitch AI + --st-* tokens (dark navy + bronze)
- **Payment**: PayOS + COD
- **Deploy**: Cloudflare Pages + Workers

## Roadmap (Next 90 Days)
| Phase | Target |
|-------|--------|
| P1: Generate 28 missing Stitch designs | Week 1-2 |
| P2: Convert to React components | Week 3-4 |
| P3: QA + Deploy production | Week 5-6 |
| P4: Marketing launch | Week 7-12 |
