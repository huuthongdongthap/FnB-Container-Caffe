# Changelog

Tất cả các thay đổi đáng kể của dự án F&B Caffe Container được ghi lại tại đây.

## [v2.0.0] - 2026-03-17

### 🎉 Major Features

#### Cloudflare Migration
- Di chuyển toàn bộ infrastructure sang Cloudflare Pages
- Tích hợp Cloudflare Workers cho edge computing
- Cloudflare D1 database cho lưu trữ dữ liệu
- Cloudflare KV cho auth session storage
- Tối ưu performance với CDN toàn cầu

#### Revenue Engine
- Hệ thống thanh toán đa dạng: COD, MoMo, VNPay, PayOS
- Integration với PayOS production gateway
- Checkout flow tối ưu với QR code payment
- Tự động hóa quy trình xử lý đơn hàng
- Delivery fee calculation theo ward distance
- Free delivery threshold từ 500K → 300K

#### Happy Hour System
- Automatic happy hour detection (2:00 PM - 4:00 PM)
- 20% discount cho tất cả đồ uống
- Visual indicators trong menu
- Auto-apply discount khi checkout

#### Loyalty & Referral Program
- Referral code system cho khách hàng
- 30% commission cho referrer
- 15% discount cho người được giới thiệu
- Commission tracking dashboard
- Withdrawal request system
- Multi-tier loyalty program (Bronze, Silver, Gold, Platinum)

#### Churn Prevention
- 30-day inactive customer detection
- Targeted promo campaigns
- Win-back discount codes
- Customer engagement analytics

#### PWA Features
- Offline mode với service worker
- Add to home screen support
- Push notifications
- App-like experience trên mobile
- Manifest.json với icons

#### SEO Optimization
- Meta tags optimization
- Open Graph tags
- Twitter Card tags
- Structured data (JSON-LD)
- Sitemap generation
- Robots.txt configuration

### 🎨 Design System

#### Material Design 3
- Fully implemented M3 design tokens
- Color system với primary, secondary, tertiary palettes
- Typography scale chuẩn M3
- Component library đồng bộ
- Dark mode support
- Responsive design với breakpoints

### 🛠️ Technical Improvements

#### Testing
- 576 unit tests với Jest
- 14 test suites covering all major features
- Test coverage cho checkout, loyalty, menu, i18n
- Automated testing trong CI/CD

#### Performance
- CSS minification với clean-css
- JavaScript minification với terser
- Image optimization với WebP
- Lazy loading cho images
- Critical CSS inlining
- Code splitting

### 🔧 Fixed Issues

- PayOS clientId hardcoded → environment variable
- Delivery fee threshold từ 500K → 300K
- Font families cập nhật sang Space Grotesk/Inter
- Test failures do class name mismatches
- Mock fetch issues trong tests
- i18n translation keys

---

## [v5.0.0] - 2026-03-14

### 🎉 Features (Tính năng mới)
- **feat(loyalty)** - Thêm chương trình Loyalty Rewards cho khách hàng thân thiết (#2a9de0e69)
- **feat(seo)** - Thêm SEO metadata, PWA service worker support (#66b92ae0b)
- **feat(menu)** - Menu page với filtering, gallery lightbox và JSON data (#37aaf15a6)
- **feat(dashboard)** - Admin dashboard với Order Management, Analytics integration (#9b6dfbf07, #a2fe589c4)
- **feat(fnB-caffe-container)** - Order System, Dark Mode, Responsive và SEO/PWA (#204ea0a76)
- **feat(theme)** - Cập nhật F&B color palette với warm coffee tones + ☕ favicon (#9f277a627)

### 🐛 Bug Fixes
- **fix(responsive)** - Thêm breakpoint styles cho 375px trên menu, dashboard, KDS (#9556d5886)
- **fix(tests)** - Điều chỉnh console.log threshold cho dashboard API logging (#630a8ad24)

### 📦 Performance & Cleanup
- **chore(perf)** - Minify CSS/JS assets và clean console.log production code (#e83b56abf)
- **refactor** - Remove console.log statements từ dashboard.js (#3a733acf7)

### 📚 Documentation
- Admin dashboard verification report (#4d433b7c1)
- Project complete report (#79a8dc39e)
- Responsive fix report với breakpoint audit (#32834b668)
- Frontend UI build report cho admin dashboard (#99c9414f7)
- Release notes v4.42.0 (#88c713d5a)

---

## [v4.42.0] - 2026-03-13

### Features
- Release notes v4.42.0 và fix tests (#88c713d5a)

---

## [v1.0.0] - 2026-03-10

### 🚀 Initial Release
- F&B Caffe Container Initial Launch (#0df1b0c0f)
- Complete F&B Container website build (#e98a4fae7)

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v2.0.0 | 2026-03-17 | Cloudflare migration, Revenue Engine, Happy Hour, Loyalty Referral, Churn Prevention, PWA, SEO |
| v5.0.0 | 2026-03-14 | Loyalty program, PWA, SEO, Admin dashboard |
| v4.42.0 | 2026-03-13 | Cleanup và performance improvements |
| v1.0.0 | 2026-03-10 | Initial launch |

---

## Semantic Versioning

Dự án tuân theo [Semantic Versioning](https://semver.org/):
- **MAJOR** - Thay đổi không tương thích ngược
- **MINOR** - Tính năng mới, tương thích ngược
- **PATCH** - Bug fixes, tương thích ngược
