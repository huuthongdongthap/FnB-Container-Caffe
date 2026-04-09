# AURA SPACE — Architecture & Design System
> Tài liệu gốc cho Pencil.dev Desktop | Cập nhật: 2026-04-03 (v3)

---

## 1. Tổng Quan Dự Án

| Field | Value |
|-------|-------|
| **Tên** | AURA SPACE |
| **Version** | 2.1.0 |
| **Domain** | fnbcontainer.vn |
| **Mô tả** | Quán cà phê container cyberpunk 1 tầng trệt + rooftop tại Sa Đéc, Đồng Tháp |
| **Tech Stack** | Vanilla HTML/CSS/JS, PWA, Cloudflare Workers, Vite |
| **Design System** | Material Design 3 (Coffee Palette) + Cyberpunk Neon |
| **Fonts** | Space Grotesk (headings) + Inter (body) + JetBrains Mono (code) |
| **Repo** | `/Users/mac/mekong-cli/FnB-Container-Caffe` |
| **Địa chỉ** | 39 Nguyễn Tất Thành, Khóm 2, Phường Sa Đéc, TP. Sa Đéc, Đồng Tháp |
| **Lô đất** | 8,3m (mặt tiền) × 22m (chiều sâu) = ~182,6 m² |
| **Mốc** | Đối diện KS Thảo Trâm 2 |

---

## 2. Sitemap — Tất Cả Pages

```
index.html          ← Trang chủ (Hero, About, Concept, Spaces, Rooftop, Contact, Location)
menu.html           ← Menu đồ uống & đồ ăn (24 items, 4 categories)
checkout.html       ← Trang thanh toán đơn hàng
about-us.html       ← Giới thiệu chi tiết
contact.html        ← Liên hệ riêng
loyalty.html        ← Chương trình tích điểm khách hàng
table-reservation.html ← Đặt bàn online
track-order.html    ← Theo dõi đơn hàng
kds.html            ← Kitchen Display System (bếp)
kitchen-display.html ← Màn hình nhà bếp v2
layout-2d-4k.html   ← Bản vẽ 2D mặt bằng 4K
layout-3d.html      ← Render 3D không gian
success.html        ← Thanh toán thành công
failure.html        ← Thanh toán thất bại
project-brief.html  ← Brief dự án thi công
binh-phap-thi-cong.html ← Chiến lược thi công container
receipt-template.html ← Template hoá đơn in
admin/              ← Trang quản trị (dashboard)
dashboard/          ← Dashboard quản lý
```

---

## 3. Design Tokens — Color System

### 3.1 Light Mode (Default)

| Token | Hex | Vai Trò |
|-------|-----|---------|
| `--md-sys-color-primary` | `#6F4E37` | Coffee Brown — Nút chính, links |
| `--md-sys-color-on-primary` | `#FFFFFF` | Text trên primary |
| `--md-sys-color-primary-container` | `#E8D5C4` | Nền nhẹ cho cards, chips |
| `--md-sys-color-on-primary-container` | `#2B1A10` | Text trên container |
| `--md-sys-color-secondary` | `#A67B5B` | Warm Beige — Phụ trợ |
| `--md-sys-color-secondary-container` | `#F5E6D3` | Beige nhạt |
| `--md-sys-color-tertiary` | `#C9A87C` | Gold Accent |
| `--md-sys-color-error` | `#B3261E` | Error state |
| `--md-sys-color-background` | `#FFFBFE` | Nền trang |
| `--md-sys-color-surface` | `#FFFBFE` | Surface cards |
| `--md-sys-color-surface-variant` | `#E7E0EC` | Phân biệt surface |
| `--md-sys-color-surface-container` | `#F3F3F8` | Container level |
| `--md-sys-color-outline` | `#79747E` | Viền, text phụ |

### 3.2 Dark Mode

| Token | Hex | Vai Trò |
|-------|-----|---------|
| `--md-sys-color-primary` | `#DDBD9F` | Coffee sáng trên nền tối |
| `--md-sys-color-background` | `#1C1B1F` | Nền tối |
| `--md-sys-color-surface` | `#1C1B1F` | Surface tối |
| `--md-sys-color-surface-container` | `#2A292E` | Container tối |
| `--cyber-glow` | `rgba(221,189,159,0.4)` | Hiệu ứng phát sáng |
| `--cyber-gradient` | `#FFD700 → #FFA500 → #FF4500` | Gradient neon |

### 3.3 Legacy Coffee Colors

| Token | Hex |
|-------|-----|
| `--coffee-primary` | `#6F4E37` |
| `--coffee-secondary` | `#A67B5B` |
| `--coffee-accent` | `#C9A87C` |
| `--coffee-light` | `#F5E6D3` |
| `--coffee-dark` | `#3B2F2F` |

---

## 4. Typography Scale

| Role | Font | Size | Weight |
|------|------|------|--------|
| Display Large | Space Grotesk | 3.5rem | 400 |
| Display Medium | Space Grotesk | 2.813rem | 400 |
| Display Small | Space Grotesk | 2.25rem | 400 |
| Headline Large | Space Grotesk | 2rem | 400 |
| Headline Medium | Space Grotesk | 1.75rem | 500 |
| Headline Small | Space Grotesk | 1.5rem | 600 |
| Title Large | Space Grotesk | 1.375rem | 500 |
| Title Medium | Space Grotesk | 1.125rem | 600 |
| Title Small | Space Grotesk | 0.875rem | 600 |
| Body Large | Inter | 1rem | 400 |
| Body Medium | Inter | 0.875rem | 400 |
| Body Small | Inter | 0.75rem | 400 |
| Label Large | Inter | 0.875rem | 500 |
| Label Medium | Inter | 0.75rem | 600 |
| Label Small | Inter | 0.688rem | 600 |

---

## 5. Shape & Elevation

### Corner Radius (Shape Tokens)
| Token | Value |
|-------|-------|
| extra-small | 4px |
| small | 8px |
| medium | 12px |
| large | 16px |
| extra-large | 24px |
| full | 9999px |

### Elevation Levels
| Level | Shadow |
|-------|--------|
| 0 | none |
| 1 | `0 1px 2px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)` |
| 2 | `0 1px 2px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.12)` |
| 3 | `0 1px 3px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.12)` |
| 4 | `0 2px 4px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.12)` |
| 5 | `0 4px 8px rgba(0,0,0,0.08), 0 12px 24px rgba(0,0,0,0.12)` |

### Spacing
| Token | Value |
|-------|-------|
| xs | 0.5rem (8px) |
| sm | 1rem (16px) |
| md | 1.5rem (24px) |
| lg | 2rem (32px) |
| xl | 3rem (48px) |

---

## 6. Component Library

### 6.1 Navigation
- **M3 Top App Bar** — Fixed, glassmorphism `backdrop-filter: blur(16px)`
- **Nav Desktop** — Horizontal links, hover → `--md-sys-color-primary`
- **Mobile Menu Drawer** — Overlay slide-down
- **M3 FAB** — Extended floating action button (☕ Đặt Hàng)

### 6.2 Hero Section
- Full viewport height, gradient overlay on background image
- **Hero Badge** — M3 Elevated Card, pulse dot indicator
- **Hero Title** — `clamp(2.5rem, 8vw, 5rem)`, `font-weight: 700`
- **Gradient Text** — `linear-gradient(135deg, #FFD700, #FFA500)` clip
- **Hero Actions** — M3 Filled Button + M3 Tonal Button

### 6.3 Cards
- **M3 Filled Card** — Feature highlight cards, icon + content
- **M3 Elevated Card** — Badge/chip-like with `box-shadow`
- **Space Card** — Gradient visual + emoji + body text + tag
- **Menu Item Card** — Glassmorphism, image → info → price + add button
- **Glass Card** — `rgba(255,255,255,0.6)` + `backdrop-filter: blur(12px)`

### 6.4 Buttons
- **M3 Filled Button** — Primary CTA, `background: --md-sys-color-primary`
- **M3 Tonal Button** — Secondary CTA, `background: --md-sys-color-secondary-container`
- **M3 Icon Button** — Theme toggle, menu hamburger
- **M3 Chip** — Badges, tags, language switcher

### 6.5 Forms
- **Contact Form** — Name, Phone, Email, Subject (select), Message (textarea)
- **Form Row** — 2-column grid on desktop
- **Input Styles** — M3 outlined, `border-radius: var(--radius-sm)`

### 6.6 Order System
- **Order Modal** — Full-screen overlay, tab-based (Menu | Giỏ Hàng)
- **Category Tabs** — ☕ Coffee | 🍹 Signature | 🥐 Đồ ăn
- **Cart Summary** — Subtotal, delivery fee, total
- **Checkout Button** — Zalo redirect

### 6.7 Sections
- **About** — 2-column grid (content + image)
- **Concept** — Stats (3 tầng, 400m², 360° view)
- **Spaces** — 6 cards grid (Café, Terrace, Work, Meeting, Rooftop, Parking)
- **Rooftop** — Parallax image + highlight chips
- **Contact** — Form + info
- **Location** — Google Maps iframe + address + hours

### 6.8 Footer
- Brand icon + links + social icons
- Copyright line

---

## 7. CSS Files Map

| File | Purpose | Size |
|------|---------|------|
| `css/styles.css` | Main design system + all pages | 56KB |
| `css/ui-enhancements.css` | Glassmorphism, neon effects, animations | 23KB |
| `css/checkout-styles.css` | Checkout page specific | 21KB |
| `css/kds-m3.css` | Kitchen Display System | 16KB |
| `css/kds-styles.css` | KDS legacy | 17KB |
| `css/loyalty-m3.css` | Loyalty program | 14KB |
| `css/about-m3.css` | About page | 13KB |
| `css/track-order-styles.css` | Order tracking | 10KB |
| `css/loyalty-styles.css` | Loyalty legacy | 8KB |
| `css/payment-modal.css` | Payment modal | 7KB |
| `css/print-receipt.css` | Receipt printing | 6KB |
| `css/admin.css` | Admin panel | 6KB |

---

## 8. JS Modules Map

| File | Purpose | Size |
|------|---------|------|
| `js/script.js` | Main app logic, nav, hero, scroll reveal | 24KB |
| `js/checkout.js` | Checkout flow, payment integration | 32KB |
| `js/kds-app.js` | Kitchen Display System | 26KB |
| `js/loyalty-ui.js` | Loyalty UI components | 21KB |
| `js/ui-enhancements.js` | UI micro-animations, glassmorphism | 18KB |
| `js/menu.js` | Menu rendering, category filtering | 15KB |
| `js/auth.js` | Authentication module | 17KB |
| `js/payment-qr.js` | QR payment (VietQR) | 14KB |
| `js/i18n.js` | Internationalization (vi/en) | 12KB |
| `js/cart.js` | Shopping cart management | 11KB |
| `js/loyalty.js` | Loyalty logic | 12KB |
| `js/reviews.js` | Customer reviews | 10KB |
| `js/track-order.js` | Order tracking | 10KB |
| `js/api-client.js` | API client (Cloudflare Workers) | 9KB |
| `js/churn-prevention.js` | Customer retention | 10KB |
| `js/ui-animations.js` | Scroll reveal, entrance animations | 8KB |
| `js/utils.js` | Shared utilities | 7KB |
| `js/toast.js` | Toast notifications | 7KB |
| `js/websocket-client.js` | WebSocket real-time | 5KB |
| `js/main.js` | Entry point | 2KB |
| `js/config.js` | App configuration | 2KB |
| `js/theme.js` | Dark/light mode toggle | 1KB |

---

## 9. Menu Data Structure

**4 Categories, 24 Items:**

| Category | Count | Price Range |
|----------|-------|-------------|
| ☕ Coffee | 8 items | 35,000 – 60,000₫ |
| 🍹 Signature Drinks | 6 items | 40,000 – 65,000₫ |
| 🥐 Đồ Ăn Nhẹ | 7 items | 30,000 – 55,000₫ |
| 🎯 Combo | 4 items | 25,000 – 189,000₫ |

**Badges:** Best Seller, Popular, Vietnamese Classic, Specialty, Signature, Healthy, French Style, Best Value, Group Deal, Morning

---

## 10. Image Assets

| File | Content | Size |
|------|---------|------|
| `images/4k_true_front.png` | Mặt tiền container | 661KB |
| `images/4k_true_aerial.png` | View từ trên cao | 355KB |
| `images/4k_true_rooftop.png` | Rooftop view | 436KB |
| `images/4k_true_parking.png` | Bãi đậu xe | 408KB |
| `images/4k_true_side.png` | Góc bên hông | 283KB |
| `images/location-map.png` | Bản đồ vị trí | 529KB |
| `images/exterior.png` | Mặt tiền chính | 122KB |
| `images/interior.png` | Nội thất quán | 86KB |
| `images/night-4k.png` | Neon đêm (Hero BG) | 104KB |
| `images/sunset-4k.png` | Hoàng hôn | 122KB |
| `images/rooftop.png` | Rooftop deck | 113KB |
| `images/floorplan.png` | Mặt bằng | 49KB |

---

## 11. Kiến Trúc Container (Vật Lý)

**Kích thước lô đất:** 8,3m (mặt tiền) × 22m (chiều sâu) = ~182,6 m²  
**Địa chỉ:** 39 Nguyễn Tất Thành, Khóm 2, Phường Sa Đéc  
**Ranh giới:** Kẹp sát giữa 2 nhà dân (Trái: vách tôn/xưởng | Phải: tường gạch kiên cố ~3 tầng). Không hẻm hông.  
**Đối diện:** Khách sạn Thảo Trâm 2 (~6 tầng, bên kia đường Nguyễn Tất Thành).

### Mặt Bằng Trệt (MB TRET) — Chiều sâu 22m

```
   (Đối diện) 🏨 HOTEL THẢO TRÂM 2
  ═══════ ĐƯỜNG NGUYỄN TẤT THÀNH ═══════
  ◄──────────── 8,30m ────────────►
TƯỜNG    ┌──────────────────────────────────┐    TƯỜNG
NHÀ DÂN  │                                  │  NHÀ DÂN
(Tôn)    │        BÃI ĐẬU XE KHÁCH          │  (Gạch)
  ║      │                                  │      ║
  ║      ├──────────────────────┬───────────┤      ║
  ║      │                      │           │      ║
  ║      │                      │  CONT     │      ║
  ║      │    SÂN TRỐNG         │  40ft     │      ║
  ║      │    (Bàn ghế          │ 12,3m     │      ║
  ║      │     ngoài trời)      │           │      ║
  ║      │                      │ ★ KHÁCH   │      ║ 22m
  ║      │     ○ ○ bàn          │   NGỒI    │      ║
  ║      │     ○ ○ ghế          │   BÊN     │      ║
  ║      │                      │   TRONG   │      ║
  ║      │                      │           │      ║
  ║      │                      ├───────────┤      ║
  ║      │                      │ CẦU THANG │      ║
  ║      │                      │   2,4m    │      ║
  ║      ├──────────┐           ├───────────┤      ║
  ║      │ CONT 20ft│           │ CONT 20ft │      ║
  ║      │  (6,0m)  │           │ QUẦY BAR  │      ║
  ║      │          │           │  (6,0m)   │      ║
  ║      ├──────────┤           ├───────────┤      ║
  ║      │          │           │ WC + KHO  │      ║
  ║      │          │           │  (2,3m)   │      ║
         └──────────┴───────────┴───────────┘
                    CUỐI LÔ (phía sau)
```

### Mặt Bằng Gác (MB GAC / Rooftop) — Trên nóc Cont 40ft

```
  ◄──────────── 8,30m ────────────►
  ┌──────────────────────────────────┐
  │                      │           │
  │                      │  SÀN      │
  │    SÂN THƯỢNG        │  CEMBOARD │
  │    (Bàn ghế          │  (Rooftop │
  │     ngoài trời)      │   Deck)   │
  │                      │  12,3m    │
  │     ○ ○              │           │
  │     ○ ○              │           │
  │                      │           │
  │                      ├───────────┤
  │                      │ CẦU THANG │
  │                      │   2,4m    │
  ├────┐    VÁCH KÍNH    ├───────────┤
  │VÁCH│   CƯỜNG LỰC   │  6,0m     │
  │PANL│    ◄────────►   │           │
  │2,3m│                 │           │
  └────┴─────────────────┴───────────┘
```

### Phân Khu Chi Tiết

| Khu vực | Kích thước (mm) | Vị trí | Chức năng |
|---------|----------------|--------|----------|
| **Bãi Đậu Xe** | 8300 × ~3000 | Mặt tiền, vào cổng | Xe máy khách, tiếp cận trực tiếp từ vỉa hè |
| **Sân trống** | ~5800 × 14700 | Bên TRÁI (tôn), từ trước ra giữa lô | Bàn ghế ngoài trời, không gian mở |
| **Container 40ft** | 12300 × ~2440 | Sát tường PHẢI (gạch) | Khách ngồi bên trong, máy lạnh, working zone. **Rooftop nằm trên nóc cont này** |
| **Cầu thang** | 2400 | Giữa Cont 40ft và Cont 20ft (bên phải) | Lối lên Rooftop / Sàn Gác |
| **Cont 20ft — Quầy Bar** | 6000 × ~2440 | Tiếp nối bên PHẢI, sau cầu thang | Pha chế, espresso, POS, sink |
| **Cont 20ft — #2** | 6000 × ~2440 | Sát tường TRÁI, song song quầy bar | Khu vực phụ trợ / chỗ ngồi thêm |
| **WC + Nhà Kho** | 2300 × ~2200 | Góc cuối phải (nối tiếp quầy bar) | Vệ sinh khách, kho chứa vật tư |
| **Rooftop (Sàn Cemboard)** | 12300 × 8300 | Trên nóc Cont 40ft | Chill zone, ngắm hoàng hôn, viền đèn LED Neon hắt sáng về phía Hotel đối diện |

---

## 12. Design Patterns

### Glassmorphism
```css
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### Neon Text Glow (Dark Mode)
```css
text-shadow: 0 0 20px rgba(255, 179, 0, 0.5);
color: var(--neon-amber);
```

### Scroll Reveal Animation
```css
.scroll-reveal { opacity: 0; transform: translateY(20px); transition: all 0.6s ease; }
.scroll-reveal.reveal { opacity: 1; transform: translateY(0); }
```

### Hover Lift
```css
transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
&:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
```

---

## 13. Thông Tin Thi Công

| Hạng mục | Chi tiết |
|----------|----------|
| **Lô đất** | 8,3m × 22m = ~182,6 m² |
| **Địa chỉ** | 39 Nguyễn Tất Thành, Khóm 2, Phường Sa Đéc |
| **Mốc** | Đối diện KS Thảo Trâm 2 |
| **Containers** | 1× 40ft + 2× 20ft |
| **Thời gian** | ~15 tuần |
| **Ngân sách** | 580M VND |
| **Tỷ lệ bản vẽ** | 1:100 (50px = 1m trong SVG) |

---

## 14. Pencil.dev Connection

- **Workspace Path:** `/Users/mac/mekong-cli/FnB-Container-Caffe`
- **Design Files:** `fnb-ui.pen` (root) + `designs/fnb-design-system.pen`
- **MCP Server:** Connected via Claude Desktop + Gemini CLI config
- **Config:** `~/Library/Application Support/Pencil/config.json`
