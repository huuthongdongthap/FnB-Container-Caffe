# Stitch Design Report — AURA CAFE
## 2026-07-03 | Status: PROMPTS READY (MCP AUTH BLOCKED)

---

## 1. Executive Summary

This report covers the Stitch design generation session for AURA CAFE. Two high-fidelity Stitch screens were spec'd and prompted for generation. **Stitch MCP is currently unavailable** due to an OAuth incompatibility (`Incompatible auth server: does not support dynamic client registration`). All design specs and ready-to-paste prompts are provided below so generation can proceed as soon as MCP auth is restored.

---

## 2. Design System Reference

The AURA CAFE design system is defined in `/Users/macbook/FnB-Container-Caffe/DESIGN.md`. Key tokens:

| Token | Value | Role |
|-------|-------|------|
| `--background` | `#0A1A2E` | Deep navy page background |
| `--surface` | `#0d1b2a` | Card surfaces |
| `--surface-container-lowest` | `#050D1A` | Footer, deepest containers |
| `--primary` | `#c6c6c7` | Chrome/silver — CTAs, borders, headings |
| `--secondary` | `#4a6fa5` | Muted blue accent |
| `--tertiary` | `#d4a574` | Warm bronze — sparing highlights |
| `--on-surface` | `#e8e8e8` | Primary body text |
| `--on-surface-variant` | `#a0a8b0` | Secondary/muted text |
| `--outline` | `#2a3f55` | Borders, dividers |
| `--glass-bg` | `rgba(255,255,255,0.03)` | Glassmorphism card background |
| `--glass-border` | `rgba(255,255,255,0.08)` | Glassmorphism card border |
| `--glass-hover-border` | `rgba(198,198,199,0.3)` | Hover state border glow |

**Fonts:** EB Garamond (headlines), Space Grotesk (body/labels)

**Signature component:** Glassmorphism card — `backdrop-filter: blur(12px)`, semi-transparent background, 12px radius, 1px fade border, hover scale + chrome glow.

---

## 3. Existing Stitch Designs

From CEO-HANDOVER.md Section 11.5 and stitch-exports inspection:

| Page | Stitch Export Path | Status |
|------|-------------------|--------|
| Home | `stitch-exports/home/design.html` | Has HTML export |
| Menu | `stitch-exports/menu/` | Empty (no HTML) |
| Mobile | `stitch-exports/mobile/design.html` | Has HTML export |
| Admin | `stitch-exports/admin/design.html` | Has HTML export |
| Landing | `stitch-exports/landing/` | **Screenshot only (screenshot.png), no HTML** |

**Stitch project IDs:** Not documented in CEO-HANDOVER.md or stitch-exports. MCP `list_projects` is blocked by auth issue.

---

## 4. Pages Needing Stitch Designs

Of the 30+ features documented in CEO-HANDOVER.md Section 3, the following have **no Stitch design**:

### Critical (customer-facing)
| Page | Priority | Description |
|------|----------|-------------|
| **Landing Page** | HIGH | Marketing landing with hero, menu preview, reviews. Screenshot exists, no HTML. |
| **Login Page** | HIGH | Customer + admin authentication |
| **QR Ordering Page** | HIGH | What customers see after scanning a table QR code |
| **Customer Account** | MEDIUM | Profile, order history, loyalty points, subscriptions |
| **Order Tracking** | MEDIUM | Real-time order status page |
| **Split Bill UI** | LOW | Bill splitting interface |

### Critical (operations)
| Page | Priority | Description |
|------|----------|-------------|
| **KDS (Kitchen Display)** | HIGH | Kanban order board with timers, sound alerts |
| **POS (Point of Sale)** | HIGH | Table grid + cart + payment interface |
| **Admin Dashboard** | MEDIUM | Stats widgets, charts, recent orders |
| **Orders Management** | MEDIUM | Order list with filters, status updates |
| **Customers Management** | LOW | Customer list, search, loyalty tier view |
| **Staff/Shifts** | LOW | Staff management, clock-in/out |
| **Reservations** | LOW | Booking management |
| **Promotions** | LOW | Discount code CRUD |
| **Campaigns/Broadcast** | LOW | Marketing campaign tools |
| **Analytics** | LOW | Charts, exports |
| **Chat Inbox** | LOW | Live chat admin interface |

---

## 5. New Screen 1: KDS (Kitchen Display System)

### 5.1 Design Spec
```json
{
  "theme": "DARK",
  "primaryColor": "#c6c6c7",
  "headlineFont": "EB_GARAMOND",
  "bodyFont": "SPACE_GROTESK",
  "labelFont": "SPACE_GROTESK",
  "colorVariant": "FIDELITY",
  "roundness": "ROUND_TWELVE",
  "spacingScale": 1,
  "backgroundDark": "#0A1A2E",
  "density": "COMPACT",
  "designMode": "HIGH_FIDELITY",
  "styleKeywords": ["Dark", "Industrial", "Focused", "High-contrast"],
  "deviceType": "DESKTOP"
}
```

### 5.2 Ready-to-Paste Stitch Prompt

```
Desktop High-Fidelity kitchen display system for AURA CAFE — an industrial-luxury container cafe. Dark, Industrial, Focused, High-contrast aesthetic. High-fidelity brand color matching palette. Dark mode. Background: Deep navy (#0A1A2E). Primary: Chrome silver (#c6c6c7). Headline font: EB Garamond. Body font: Space Grotesk. Label font: Space Grotesk. Roundness: 12px rounded corners. Compact spacing, data-dense layout. Glassmorphism cards with backdrop-filter blur 12px, semi-transparent backgrounds rgba(255,255,255,0.03), and thin borders rgba(255,255,255,0.08).

Full-width desktop layout optimized for a large kitchen monitor (1920x1080). Top header bar: AURA CAFE logo left, "KDS — Màn Hình Bếp" title center in EB Garamond 32px, live clock display right, sound toggle icon button (speaker on/off) with chrome accent. Main content: 3 equal-width kanban columns filling remaining viewport height — "Chờ Làm" (Pending) left, "Đang Làm" (Cooking) center, "Đã Xong" (Ready) right. Each column has a sticky header with column name in EB Garamond 24px, order count badge, and a subtle glassmorphism background. Column background slightly lighter than page: rgba(255,255,255,0.02). Bottom status bar: total active orders count left, "Cập nhật lần cuối: [timestamp]" right in Space Grotesk 12px.

Header bar: Chrome gradient divider line below. Sound toggle is a circular icon button with speaker icon, glowing green when active, muted grey when off. Live clock in Space Grotesk 18px monospaced digits.

Order cards: Glassmorphism style — rgba(255,255,255,0.03) background, backdrop-filter blur(12px), 1px border rgba(255,255,255,0.08), border-radius 12px. Each card has a 4px left color border: RED (#ff4444) for Pending, ORANGE (#ff8800) for Cooking, GREEN (#00cc66) for Ready. Card contents: Top row — table number badge (e.g., "BÀN 3") in chrome pill badge rgba(198,198,199,0.15), elapsed timer right ("00:45" or "03:12") in Space Grotesk 16px bold, color matches status. Divider line. Order items list: each item as "1x Cà phê sữa" with modifiers in parentheses in lighter text — e.g., "(ít đường, thêm đá)". Items in Space Grotesk 14px, #e8e8e8 color. Card footer: order time ("12:34") and total item count. Pending cards show a pulsing subtle glow animation. Cooking cards show the timer counting up in orange. Ready cards have a checkmark icon and solid green left border.

Empty state: When a column has no orders, show a centered message "Không có đơn nào" in muted text (#a0a8b0) with a subtle icon.
```

### 5.3 Why This Design

The KDS is the most operationally critical page without a Stitch design. Kitchen staff stare at this screen for hours — it must be:
- **High contrast** for readability at a distance
- **Color-coded** for instant status recognition (red/orange/green)
- **Low eye strain** with dark background
- **Dense layout** to show many orders simultaneously on one screen

---

## 6. New Screen 2: Landing Page (Improved)

The landing page has a screenshot in `stitch-exports/landing/screenshot.png` but **no HTML export**. This is a complete redesign with full design system adherence.

### 6.1 Design Spec
```json
{
  "theme": "DARK",
  "primaryColor": "#c6c6c7",
  "headlineFont": "EB_GARAMOND",
  "bodyFont": "SPACE_GROTESK",
  "labelFont": "SPACE_GROTESK",
  "colorVariant": "FIDELITY",
  "roundness": "ROUND_TWELVE",
  "spacingScale": 3,
  "backgroundDark": "#0A1A2E",
  "density": "SPACIOUS",
  "designMode": "HIGH_FIDELITY",
  "styleKeywords": ["Luxurious", "Nocturnal", "Sophisticated", "Industrial"],
  "deviceType": "DESKTOP"
}
```

### 6.2 Ready-to-Paste Stitch Prompt

```
Desktop High-Fidelity landing page for AURA CAFE — an industrial-luxury container cafe in Sa Dec, Dong Thap, Vietnam. Luxurious, Nocturnal, Sophisticated, Industrial aesthetic. High-fidelity brand color matching palette. Dark mode. Background: Deep navy (#0A1A2E). Primary: Chrome silver (#c6c6c7). Secondary accent: Warm bronze (#d4a574) used sparingly for highlights. Headline font: EB Garamond (elegant serif, tight letter-spacing -0.03em for dramatic headlines). Body font: Space Grotesk (geometric sans-serif). Label font: Space Grotesk. Roundness: 12px rounded corners. Spacious, breathing layout with 48px section spacing and generous whitespace. Glassmorphism throughout: backdrop-filter blur(12px), rgba(255,255,255,0.03) card backgrounds, rgba(255,255,255,0.08) card borders, hover scale(1.01) with chrome border glow rgba(198,198,199,0.3). Never use pure white backgrounds — always deep navy surfaces. Text: primary #e8e8e8, secondary #a0a8b0. Chrome gradient buttons: linear-gradient(135deg, #e8e8e8, #b0b0b0) on dark text.

Full-width desktop landing page (max-width 1200px content container). Sticky top navigation bar (80px height, backdrop-filter blur, rgba(10,26,46,0.85) background, bottom border rgba(255,255,255,0.06)). Full-viewport hero section (100vh) with radial gradient mesh background (center glow at rgba(198,198,199,0.05), fading to deep navy edges). Section 2: Featured Menu (3-column glassmorphism card grid). Section 3: About / Our Space (split layout — text left, container architecture image placeholder right). Section 4: Location & Hours (2-column grid — map placeholder left, hours right). Section 5: Customer Reviews (horizontal scroll carousel). Section 6: Newsletter CTA band (full-width gradient banner). Footer (4-column grid: brand, links, contact, social).

Top nav: "AURA CAFE" logo text left in EB Garamond 28px with chrome color, nav links center (Thực Đơn, Về Chúng Tôi, Đặt Bàn, Liên Hệ) in Space Grotesk 14px uppercase tracking 0.05em, primary "Đặt Món Ngay" CTA button right (chrome gradient, 48px height, 12px 32px padding, rounded-xl, hover scale 1.02 with box-shadow glow). Active nav link underlined with chrome underline-offset-4.

Hero section: Centered content vertically. "AURA CAFE" mega-headline in EB Garamond 72px/700 with -0.03em letter-spacing, chrome (#e8e8e8) color with subtle text-shadow glow. Subtitle below: "Không gian Container sang trọng giữa lòng Sa Đéc" in Space Grotesk 20px/400, color #a0a8b0. Two CTA buttons below with 20px gap: primary "Xem Thực Đơn" (chrome gradient filled) and outline "Đặt Bàn Ngay" (transparent with 1.5px chrome border rgba(198,198,199,0.4), hover border full chrome). Scroll-down indicator at bottom: animated chevron icon in chrome, "Khám phá thêm" label in Space Grotesk 12px.

Featured menu: Section heading "Thực Đơn Đặc Sắc" in EB Garamond 48px/600. Subtitle "Những món được yêu thích nhất tại AURA" in Space Grotesk 16px. 3-column grid (20px gap). Each card: glassmorphism style, 280px wide, thumbnail area (200px height with dark gradient overlay), item name "Cà phê sữa đá" in EB Garamond 24px, price "45.000đ" in Space Grotesk 18px/600 chrome color, 2-line Vietnamese description in Space Grotesk 14px #a0a8b0, "Thêm vào giỏ" ghost button at bottom. Cards hover: scale(1.02), border glow rgba(198,198,199,0.3).

About section: Heading "Về AURA CAFE" left. 2-column split: left paragraph about Sa Dec's first container cafe blending industrial steel with warm Vietnamese coffee culture, in Space Grotesk 16px/1.6 leading. Right side: large rounded-xl placeholder for container architecture photo with glassmorphism border overlay.

Location section: 2-column grid. Left: map placeholder (dark themed with chrome pin marker, 400px height). Right: "Giờ Mở Cửa" heading, days/hours list (Thứ 2 - Chủ Nhật: 6:00 - 22:00), address "123 Nguyễn Huệ, Phường 1, Sa Đéc, Đồng Tháp", phone number with icon.

Reviews carousel: Heading "Khách Hàng Nói Gì". Horizontal scroll of 3 visible review cards at a time. Each card: glassmorphism, avatar circle top-left, customer name "Nguyễn Thị Mai" in Space Grotesk 16px/600, star rating (5 gold stars), quote "Không gian đẹp, cà phê ngon, nhân viên thân thiện!" in Space Grotesk 14px italic, review date "2 ngày trước" in label-sm.

Newsletter CTA: Full-width section with subtle gradient background (navy to slightly lighter navy). "Nhận Ưu Đãi Độc Quyền" heading in EB Garamond 36px. Email input field (dark glassmorphism style, 48px height, chrome border on focus) + "Đăng Ký" primary button side by side.

Footer: 4-column grid on deep navy background (#050D1A). Column 1: AURA CAFE logo, short tagline. Column 2: "Liên Kết Nhanh" heading, links to Menu, About, Reservations, Contact. Column 3: "Liên Hệ" heading, address, phone, email. Column 4: "Theo Dõi" heading, social media icon row (Facebook, Instagram, TikTok, Zalo). Bottom bar: copyright "2026 AURA CAFE. All rights reserved." in Space Grotesk 12px #a0a8b0, centered.
```

---

## 7. Design System Application

To ensure both new screens match the existing AURA CAFE visual identity, apply the following design system via `mcp__stitch__create_design_system` once MCP is restored:

```json
{
  "displayName": "AURA CAFE — Industrial Luxury",
  "theme": {
    "colorMode": "DARK",
    "customColor": "#c6c6c7",
    "colorVariant": "FIDELITY",
    "headlineFont": "EB_GARAMOND",
    "bodyFont": "SPACE_GROTESK",
    "labelFont": "SPACE_GROTESK",
    "roundness": "ROUND_TWELVE",
    "designMd": "Dark navy (#0A1A2E) background. Chrome/silver (#c6c6c7) primary. Glassmorphism cards with backdrop-filter blur(12px), rgba(255,255,255,0.03) bg, rgba(255,255,255,0.08) border, 12px radius. EB Garamond headlines, Space Grotesk body. Never use pure white. Text: #e8e8e8 primary, #a0a8b0 secondary. Chrome gradient buttons: linear-gradient(135deg, #e8e8e8, #b0b0b0). Warm bronze (#d4a574) for highlights only. 8px spacing grid."
  }
}
```

---

## 8. MCP Status and Blockers

### Issue
All Stitch MCP tools return: `Incompatible auth server: does not support dynamic client registration`

### Tools affected
- `create_project`
- `list_projects`
- `list_screens`
- `generate_screen_from_text`
- `get_screen`
- `edit_screens`
- `generate_variants`
- `create_design_system`
- `apply_design_system`

### Resolution steps
1. Verify Stitch MCP server is running and reachable
2. Check OAuth configuration in `.claude/settings.json` or `.claude/.mcp.json`
3. Refer to setup guide: https://stitch.withgoogle.com/docs/mcp/guide/
4. If using a service account or API key auth, ensure credentials are valid and not expired
5. Try running `stitch-setup` skill to reinitialize the MCP connection

### Workaround
Both design specs and ready-to-paste prompts are included above (Sections 5.2 and 6.2). These can be pasted directly into https://stitch.withgoogle.com/ for manual generation while MCP is being fixed.

---

## 9. Next Steps (When MCP is Restored)

1. Create or identify the AURA CAFE Stitch project
2. Create the design system (Section 7 above)
3. Generate KDS screen using prompt in Section 5.2
4. Generate Landing Page using prompt in Section 6.2
5. Apply design system to new screens
6. Edit existing Home, Admin, Mobile screens for design system consistency
7. Convert to production HTML/CSS via `stitch-html-components` or `stitch-nextjs-components`
8. Export to `stitch-exports/kds/` and `stitch-exports/landing/`
9. Generate remaining priority pages: POS (Section 4 — Critical), Login, Customer Account

---

## 10. Priority Roadmap

| Order | Page | Type | Effort |
|-------|------|------|--------|
| 1 | KDS | NEW | 1 prompt |
| 2 | Landing Page | REDESIGN | 1 prompt |
| 3 | POS | NEW | 1 prompt |
| 4 | Admin Dashboard | NEW | 1 prompt |
| 5 | Login Page | NEW | 1 prompt |
| 6 | Customer Account | NEW | 1 prompt |
| 7 | QR Ordering Page | NEW | 1 prompt |
| 8 | Orders Management | NEW | 1 prompt |
| 9 | Remaining Admin pages (9+) | NEW | 3-5 prompts |

---

*Report generated 2026-07-03 | Tool: Claude Code + Stitch Kit v1.11.0*
*MCP status: UNAVAILABLE — prompts ready for manual generation*
