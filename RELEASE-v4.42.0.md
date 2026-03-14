# Release Notes - v4.42.0

**Ngày phát hành:** 2026-03-14
**Loại:** Feature Release
**Commit:** e98a4fae7

---

## 🎉 Tính năng mới

### Kitchen Display System (KDS)
- Màn hình bếp 4 cột: Chờ xử lý, Đang chế biến, Sẵn sàng, Hoàn thành
- Real-time timer theo dõi thời gian mỗi order
- Tự động chuyển trạng thái order
- Thông báo âm thanh khi có order mới
- Settings modal với toggle âm thanh, auto-refresh
- Order detail modal xem chi tiết từng bàn

### Landing Page
- Hero section với background image, title, CTA buttons
- About section với câu chuyện thương hiệu
- Contact form với validation và toast notification
- Location section với Google Maps embed
- Footer với social links và copyright
- Responsive breakpoints: 375px, 768px, 1024px
- Dark mode với theme toggle

### Order System
- Menu modal với 3 categories: Coffee, Signature, Snacks
- Cart management với tăng/giảm số lượng
- Checkout page với delivery information form
- Payment methods: MoMo, VNPay, PayOS, COD
- Discount code validation
- Order success modal
- Cart persistence với localStorage

### Menu Page
- Menu display với filter buttons
- Gallery lightbox cho hình ảnh sản phẩm
- JSON-based menu data
- Price display theo format Việt Nam

### Admin Dashboard
- Stats cards: Revenue, Orders, Customers, Products
- Orders table với status badges
- Revenue chart
- Product list
- Sidebar navigation
- Search functionality
- Keyboard shortcuts

---

## 📁 Files đã thêm

```
kitchen-display.html          - KDS HTML
kds-app.js                    - KDS JavaScript
checkout.html                 - Checkout page
checkout.js                   - Checkout logic
checkout-styles.css           - Checkout styles
menu.html                     - Menu page
menu.js                       - Menu filtering
dashboard/index.html          - Admin dashboard
dashboard/dashboard.js        - Dashboard logic
dashboard/dashboard-styles.css - Dashboard styles
tests/order-system.test.js    - Order system tests
```

---

## 🔧 Cải tiến

- Contact form loading state với spinner animation
- Success toast notification thay thế alert()
- Mobile menu với hamburger toggle
- Smooth scroll navigation
- Scroll reveal animations
- Format currency theo locale vi-VN
- Toast notifications cho UX

---

## 🎨 Design System

### Màu sắc F&B warm tones
- `--coffee-espresso`: #1A0F0A
- `--coffee-dark`: #2D1F14
- `--coffee-medium`: #4A3423
- `--warm-amber`: #D4A574
- `--warm-gold`: #C9A962
- `--warm-copper`: #B88B6C
- `--cream-foam`: #F5EFE6
- `--milk-steam`: #E8E0D5

### Typography
- Font family: system-ui, -apple-system, sans-serif
- Clamp responsive font sizes
- WCAG AA contrast ratios

---

## ✅ Test Coverage

```
Test Suites: 4 passed, 4 total
Tests:       146 passed, 146 total
Snapshots:   0 total
Time:        ~1s
```

### Test Files
- `tests/landing-page.test.js` - Landing page structure & SEO
- `tests/dashboard.test.js` - Dashboard components & a11y
- `tests/order-system.test.js` - Order flow & cart management
- `tests/utils.test.js` - Utility functions & code quality

---

## 📊 Stats

- **HTML files:** 5 (index, menu, checkout, kitchen-display, dashboard)
- **CSS files:** 4 (styles, checkout-styles, dashboard-styles, menu styles)
- **JS files:** 4 (script, kds-app, checkout, menu)
- **Total lines:** ~5000+
- **Bundle size:** ~200KB (unminified)

---

## 🚀 Deploy Checklist

- [x] Tests pass
- [x] Code review
- [x] Git commit
- [x] Git tag v4.42.0
- [ ] Git push origin main
- [ ] CI/CD pipeline green
- [ ] Production deploy verification

---

## 📝 Commits

```
e98a4fae7 feat: Complete F&B Container website build
9556d5886 fix(responsive): Add 375px breakpoint styles
9f277a627 feat(theme): Update F&B color palette
37aaf15a6 feat(menu): Add menu page with filtering
9b6dfbf07 feat(dashboard): Complete admin dashboard UI
```

---

## 🔄 Next Steps

1. Deploy to production
2. Monitor analytics
3. Gather user feedback
4. Plan v4.43.0 features

---

**Co-Authored-By:** Claude Opus 4.6 <noreply@anthropic.com>
