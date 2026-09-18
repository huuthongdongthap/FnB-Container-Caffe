# Pha 04: Industrial Luxury Design System (AURA)

## Mục tiêu
- Đồng bộ toàn bộ token M3 với AURA Industrial Luxury palette
- Cập nhật Typography scale, Density, Component rules cho 3 shell
- Chuẩn hóa tiếng Việt F&B cho mọi label, button, error message

---

## 1. Color Token Mapping (CSS Custom Properties)

```css
/* src/index.css hoặc src/styles/aura-tokens.css */
:root {
  /* ── AURA Industrial Luxury Palette ── */
  --aura-navy-900: #0A1128;      /* Primary surface / AppBar */
  --aura-navy-800: #111A3A;      /* Elevated surface */
  --aura-navy-700: #1A2548;      /* Card surface */
  --aura-chrome-400: #6B9FB8;    /* Primary brand / Interactive */
  --aura-chrome-300: #8AB4D1;    /* Primary hover */
  --aura-chrome-500: #4A8BB0;    /* Primary pressed */
  --aura-bronze-400: #D4AF37;    /* Accent / CTA highlight */
  --aura-bronze-300: #E8C872;    /* Accent hover */
  --aura-bronze-500: #B8962E;    /* Accent pressed */
  --aura-noir-void: #050814;     /* OpsShell background */
  --aura-pearl-100: #F5F5F0;     /* AdminShell surface */

  /* ── M3 System Token Overrides ── */
  --md-sys-color-primary: var(--aura-chrome-400);
  --md-sys-color-on-primary: var(--aura-navy-900);
  --md-sys-color-primary-container: var(--aura-navy-800);
  --md-sys-color-on-primary-container: var(--aura-chrome-300);

  --md-sys-color-secondary: var(--aura-bronze-400);
  --md-sys-color-on-secondary: var(--aura-navy-900);
  --md-sys-color-secondary-container: var(--aura-navy-700);
  --md-sys-color-on-secondary-container: var(--aura-bronze-300);

  --md-sys-color-tertiary: var(--aura-chrome-300);
  --md-sys-color-on-tertiary: var(--aura-navy-900);

  --md-sys-color-surface: var(--aura-navy-800);
  --md-sys-color-on-surface: var(--aura-pearl-100);
  --md-sys-color-surface-variant: var(--aura-navy-700);
  --md-sys-color-on-surface-variant: var(--aura-chrome-300);

  --md-sys-color-background: var(--aura-navy-900);
  --md-sys-color-on-background: var(--aura-pearl-100);

  --md-sys-color-error: #EF5350;
  --md-sys-color-on-error: #FFFFFF;
  --md-sys-color-error-container: #7F1D1D;
  --md-sys-color-on-error-container: #FECACA;

  --md-sys-color-outline: var(--aura-chrome-400);
  --md-sys-color-outline-variant: var(--aura-navy-700);

  --md-sys-color-inverse-surface: var(--aura-pearl-100);
  --md-sys-color-inverse-on-surface: var(--aura-navy-900);
  --md-sys-color-inverse-primary: var(--aura-chrome-500);

  --md-sys-color-shadow: #000000;
  --md-sys-color-scrim: #000000;

  /* ── Elevation Shadows (Glass/Industrial) ── */
  --md-sys-elevation-level0: none;
  --md-sys-elevation-level1: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.15);
  --md-sys-elevation-level2: 0 2px 4px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15);
  --md-sys-elevation-level3: 0 4px 8px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15);

  /* ── Shape Tokens ── */
  --md-sys-shape-corner-none: 0px;
  --md-sys-shape-corner-extra-small: 4px;
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-extra-large: 24px;
  --md-sys-shape-corner-full: 9999px;

  /* ── Motion ── */
  --md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-decelerated: cubic-bezier(0, 0, 0.2, 1);
  --md-sys-motion-easing-accelerated: cubic-bezier(0.4, 0, 1, 1);
  --md-sys-motion-duration-short1: 50ms;
  --md-sys-motion-duration-short2: 100ms;
  --md-sys-motion-duration-short3: 150ms;
  --md-sys-motion-duration-short4: 200ms;
  --md-sys-motion-duration-medium1: 250ms;
  --md-sys-motion-duration-medium2: 300ms;
  --md-sys-motion-duration-medium3: 350ms;
  --md-sys-motion-duration-medium4: 400ms;
  --md-sys-motion-duration-long1: 450ms;
  --md-sys-motion-duration-long2: 500ms;
  --md-sys-motion-duration-long3: 550ms;
  --md-sys-motion-duration-long4: 600ms;
}

/* ── OpsShell Dark Override ── */
[data-shell="ops"] {
  --md-sys-color-background: var(--aura-noir-void);
  --md-sys-color-surface: var(--aura-noir-void);
  --md-sys-color-on-surface: var(--aura-chrome-300);
  --md-sys-color-on-surface-variant: var(--aura-chrome-400);
  --md-sys-color-primary: var(--aura-chrome-300);
  --md-sys-color-on-primary: var(--aura-noir-void);
}

/* ── AdminShell Light Override ── */
[data-shell="admin"] {
  --md-sys-color-background: var(--aura-pearl-100);
  --md-sys-color-surface: #FFFFFF;
  --md-sys-color-on-surface: var(--aura-navy-900);
  --md-sys-color-on-surface-variant: var(--aura-navy-700);
  --md-sys-color-primary: var(--aura-chrome-500);
  --md-sys-color-on-primary: #FFFFFF;
}
```

---

## 2. Typography Scale (Vietnamese-First)

```css
/* src/styles/typography.css */
:root {
  /* Font families */
  --md-sys-typescale-display-large-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-display-large-font-size: 57px;
  --md-sys-typescale-display-large-line-height: 64px;
  --md-sys-typescale-display-large-font-weight: 400;
  --md-sys-typescale-display-large-letter-spacing: -0.25px;

  --md-sys-typescale-headline-large-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-headline-large-font-size: 32px;
  --md-sys-typescale-headline-large-line-height: 40px;
  --md-sys-typescale-headline-large-font-weight: 600;
  --md-sys-typescale-headline-large-letter-spacing: 0px;

  --md-sys-typescale-headline-medium-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-headline-medium-font-size: 28px;
  --md-sys-typescale-headline-medium-line-height: 36px;
  --md-sys-typescale-headline-medium-font-weight: 600;
  --md-sys-typescale-headline-medium-letter-spacing: 0px;

  --md-sys-typescale-headline-small-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-headline-small-font-size: 24px;
  --md-sys-typescale-headline-small-line-height: 32px;
  --md-sys-typescale-headline-small-font-weight: 600;
  --md-sys-typescale-headline-small-letter-spacing: 0px;

  --md-sys-typescale-title-large-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-title-large-font-size: 22px;
  --md-sys-typescale-title-large-line-height: 28px;
  --md-sys-typescale-title-large-font-weight: 600;
  --md-sys-typescale-title-large-letter-spacing: 0px;

  --md-sys-typescale-title-medium-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-title-medium-font-size: 16px;
  --md-sys-typescale-title-medium-line-height: 24px;
  --md-sys-typescale-title-medium-font-weight: 500;
  --md-sys-typescale-title-medium-letter-spacing: 0.15px;

  --md-sys-typescale-title-small-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-title-small-font-size: 14px;
  --md-sys-typescale-title-small-line-height: 20px;
  --md-sys-typescale-title-small-font-weight: 500;
  --md-sys-typescale-title-small-letter-spacing: 0.1px;

  --md-sys-typescale-body-large-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-body-large-font-size: 16px;
  --md-sys-typescale-body-large-line-height: 24px;
  --md-sys-typescale-body-large-font-weight: 400;
  --md-sys-typescale-body-large-letter-spacing: 0.5px;

  --md-sys-typescale-body-medium-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-body-medium-font-size: 14px;
  --md-sys-typescale-body-medium-line-height: 20px;
  --md-sys-typescale-body-medium-font-weight: 400;
  --md-sys-typescale-body-medium-letter-spacing: 0.25px;

  --md-sys-typescale-body-small-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-body-small-font-size: 12px;
  --md-sys-typescale-body-small-line-height: 16px;
  --md-sys-typescale-body-small-font-weight: 400;
  --md-sys-typescale-body-small-letter-spacing: 0.4px;

  --md-sys-typescale-label-large-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-label-large-font-size: 14px;
  --md-sys-typescale-label-large-line-height: 20px;
  --md-sys-typescale-label-large-font-weight: 500;
  --md-sys-typescale-label-large-letter-spacing: 0.1px;

  --md-sys-typescale-label-medium-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-label-medium-font-size: 12px;
  --md-sys-typescale-label-medium-line-height: 16px;
  --md-sys-typescale-label-medium-font-weight: 500;
  --md-sys-typescale-label-medium-letter-spacing: 0.5px;

  --md-sys-typescale-label-small-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;
  --md-sys-typescale-label-small-font-size: 11px;
  --md-sys-typescale-label-small-line-height: 16px;
  --md-sys-typescale-label-small-font-weight: 500;
  --md-sys-typescale-label-small-letter-spacing: 0.5px;
}

/* Utility classes */
.m3-display-large { font: var(--md-sys-typescale-display-large-font-weight) var(--md-sys-typescale-display-large-font-size)/var(--md-sys-typescale-display-large-line-height) var(--md-sys-typescale-display-large-font-family); letter-spacing: var(--md-sys-typescale-display-large-letter-spacing); }
.m3-headline-large { font: var(--md-sys-typescale-headline-large-font-weight) var(--md-sys-typescale-headline-large-font-size)/var(--md-sys-typescale-headline-large-line-height) var(--md-sys-typescale-headline-large-font-family); letter-spacing: var(--md-sys-typescale-headline-large-letter-spacing); }
.m3-headline-medium { font: var(--md-sys-typescale-headline-medium-font-weight) var(--md-sys-typescale-headline-medium-font-size)/var(--md-sys-typescale-headline-medium-line-height) var(--md-sys-typescale-headline-medium-font-family); letter-spacing: var(--md-sys-typescale-headline-medium-letter-spacing); }
.m3-headline-small { font: var(--md-sys-typescale-headline-small-font-weight) var(--md-sys-typescale-headline-small-font-size)/var(--md-sys-typescale-headline-small-line-height) var(--md-sys-typescale-headline-small-font-family); letter-spacing: var(--md-sys-typescale-headline-small-letter-spacing); }
.m3-title-large { font: var(--md-sys-typescale-title-large-font-weight) var(--md-sys-typescale-title-large-font-size)/var(--md-sys-typescale-title-large-line-height) var(--md-sys-typescale-title-large-font-family); letter-spacing: var(--md-sys-typescale-title-large-letter-spacing); }
.m3-title-medium { font: var(--md-sys-typescale-title-medium-font-weight) var(--md-sys-typescale-title-medium-font-size)/var(--md-sys-typescale-title-medium-line-height) var(--md-sys-typescale-title-medium-font-family); letter-spacing: var(--md-sys-typescale-title-medium-letter-spacing); }
.m3-title-small { font: var(--md-sys-typescale-title-small-font-weight) var(--md-sys-typescale-title-small-font-size)/var(--md-sys-typescale-title-small-line-height) var(--md-sys-typescale-title-small-font-family); letter-spacing: var(--md-sys-typescale-title-small-letter-spacing); }
.m3-body-large { font: var(--md-sys-typescale-body-large-font-weight) var(--md-sys-typescale-body-large-font-size)/var(--md-sys-typescale-body-large-line-height) var(--md-sys-typescale-body-large-font-family); letter-spacing: var(--md-sys-typescale-body-large-letter-spacing); }
.m3-body-medium { font: var(--md-sys-typescale-body-medium-font-weight) var(--md-sys-typescale-body-medium-font-size)/var(--md-sys-typescale-body-medium-line-height) var(--md-sys-typescale-body-medium-font-family); letter-spacing: var(--md-sys-typescale-body-medium-letter-spacing); }
.m3-body-small { font: var(--md-sys-typescale-body-small-font-weight) var(--md-sys-typescale-body-small-font-size)/var(--md-sys-typescale-body-small-line-height) var(--md-sys-typescale-body-small-font-family); letter-spacing: var(--md-sys-typescale-body-small-letter-spacing); }
.m3-label-large { font: var(--md-sys-typescale-label-large-font-weight) var(--md-sys-typescale-label-large-font-size)/var(--md-sys-typescale-label-large-line-height) var(--md-sys-typescale-label-large-font-family); letter-spacing: var(--md-sys-typescale-label-large-letter-spacing); }
.m3-label-medium { font: var(--md-sys-typescale-label-medium-font-weight) var(--md-sys-typescale-label-medium-font-size)/var(--md-sys-typescale-label-medium-line-height) var(--md-sys-typescale-label-medium-font-family); letter-spacing: var(--md-sys-typescale-label-medium-letter-spacing); }
.m3-label-small { font: var(--md-sys-typescale-label-small-font-weight) var(--md-sys-typescale-label-small-font-size)/var(--md-sys-typescale-label-small-line-height) var(--md-sys-typescale-label-small-font-family); letter-spacing: var(--md-sys-typescale-label-small-letter-spacing); }
```

---

## 3. Density & Spacing (8px Grid)

```css
/* src/styles/density.css */
:root {
  /* Base unit: 8px */
  --md-sys-spacing-1: 4px;   /* 0.5u */
  --md-sys-spacing-2: 8px;   /* 1u   */
  --md-sys-spacing-3: 12px;  /* 1.5u */
  --md-sys-spacing-4: 16px;  /* 2u   */
  --md-sys-spacing-5: 20px;  /* 2.5u */
  --md-sys-spacing-6: 24px;  /* 3u   */
  --md-sys-spacing-8: 32px;  /* 4u   */
  --md-sys-spacing-10: 40px; /* 5u   */
  --md-sys-spacing-12: 48px; /* 6u   */
  --md-sys-spacing-16: 64px; /* 8u   */

  /* Component-specific density */
  --md-sys-button-height: 40px;        /* 5u */
  --md-sys-button-height-dense: 32px;  /* 4u */
  --md-sys-input-height: 48px;         /* 6u */
  --md-sys-input-height-dense: 40px;   /* 5u */
  --md-sys-list-item-height: 56px;     /* 7u */
  --md-sys-list-item-height-dense: 48px; /* 6u */
  --md-sys-card-padding: 16px;         /* 2u */
  --md-sys-card-padding-dense: 12px;   /* 1.5u */
}

/* Density variants per shell */
[data-shell="customer"] { --md-sys-density: standard; }
[data-shell="ops"] { --md-sys-density: comfortable; }  /* Larger touch targets */
[data-shell="admin"] { --md-sys-density: compact; }     /* Dense data tables */
```

---

## 4. Component Rules (M3 Strict)

### 4.1 Button Variants
```tsx
// src/components/md3/MD3Button.tsx — mapping chuẩn
<MD3Button variant="filled">      // Primary CTA: Chrome bg, Navy text
<MD3Button variant="tonal">       // Secondary: Navy bg, Chrome text
<MD3Button variant="outlined">    // Outline: Chrome border, Chrome text
<MD3Button variant="text">        // Ghost: Chrome text, transparent bg
<MD3Button variant="elevated">    // Elevated: Chrome bg, Navy text + shadow
```

### 4.2 Card Variants
```tsx
<MD3Card variant="elevated">     // Default: Navy-700 surface, level1 shadow
<MD3Card variant="filled">       // Filled: Navy-800 surface, no shadow
<MD3Card variant="outlined">     // Outlined: Navy-700 surface, Chrome border
```

### 4.3 Text Field
```tsx
<MD3TextField variant="outlined"> // Standard: Chrome border, Navy bg
<MD3TextField variant="filled">   // Filled: Navy-800 bg, Chrome underline
```

---

## 5. Vietnamese-First Terminology Map

| English (Legacy) | Vietnamese (AURA Standard) | Context |
|------------------|----------------------------|---------|
| Home | Trang chủ | Bottom Nav Tab 1 |
| Menu | Thực đơn | Bottom Nav Tab 2 |
| Reservation | Đặt bàn | Bottom Nav Tab 3 |
| Promotions | Ưu đãi | Bottom Nav Tab 4 |
| Account | Cá nhân | Bottom Nav Tab 5 |
| Checkout | Thanh toán | Functional page |
| Order | Đặt món | Table ordering |
| Cart | Giỏ hàng | CartBottomBar |
| Loyalty | Thành viên | Account sub-page |
| Referral | Giới thiệu | Account sub-page |
| Order History | Lịch sử đặt | Account sub-page |
| Check-in | Check-in | Table check-in |
| Track Order | Tra cứu đơn | Order tracking |
| Kitchen | Bếp | Ops KDS |
| TV Menu | Menu TV | Ops TV display |
| POS | Bán hàng | Table POS |
| Dashboard | Tổng quan | Admin |
| Reports | Báo cáo | Admin |
| Settings | Cài đặt | Admin |

---

## 6. Shell-Specific Adaptations

### CustomerShell (Standard Density)
- Full M3 tokens as defined above
- Bottom Nav 5 tabs, TopAppBar on scroll
- CartBottomBar floating (bottom-20 when Nav visible)

### OpsShell (Comfortable Density - KDS/TV/POS)
```css
[data-shell="ops"] {
  --md-sys-button-height: 56px;        /* 7u - glove friendly */
  --md-sys-input-height: 56px;
  --md-sys-list-item-height: 72px;     /* 9u - readable at distance */
  --md-sys-card-padding: 24px;         /* 3u */
  --md-sys-typescale-body-large-font-size: 18px;
  --md-sys-typescale-body-large-line-height: 28px;
}
```
- Không TopAppBar, Không BottomNav
- High contrast: Chrome text on Noir void
- Large touch targets cho môi trường bếp

### AdminShell (Compact Density)
```css
[data-shell="admin"] {
  --md-sys-button-height: 36px;        /* 4.5u */
  --md-sys-input-height: 40px;         /* 5u */
  --md-sys-list-item-height: 44px;     /* 5.5u */
  --md-sys-card-padding: 12px;         /* 1.5u */
  --md-sys-typescale-body-medium-font-size: 13px;
  --md-sys-typescale-body-medium-line-height: 18px;
}
```
- Sidebar collapsible, Breadcrumbs
- Dense tables: hover row highlight, sortable columns
- CSV export buttons (Bronze accent)

---

## 7. Migration Checklist

- [ ] Tạo `src/styles/aura-tokens.css` với full token mapping
- [ ] Tạo `src/styles/typography.css` với Vietnamese-first scale
- [ ] Tạo `src/styles/density.css` với 3 density variants
- [ ] Import 3 file CSS vào `src/main.tsx` (trước App)
- [ ] Cập nhật `MD3Button`, `MD3Card`, `MD3TextField` dùng token M3
- [ ] Thay thế mọi hardcoded color/typography trong components
- [ ] Thêm `data-shell` attribute vào root element của 3 shell
- [ ] Cập nhật i18n/locale files với Vietnamese terminology map
- [ ] Chạy `npx vitest run` — 3,379 tests pass
- [ ] Kiểm tra visual: Customer (Navy/Chrome), Ops (Noir/Chrome), Admin (Pearl/Navy)

---

## Tiêu chí hoàn thành
1. Toàn bộ UI dùng token M3 (không còn hardcoded hex/rgb)
2. 3 shell hiển thị đúng density + color theme
3. Tiếng Việt chuẩn F&B trên mọi label/button/error
4. Typography scale responsive, hỗ trợ tiếng Việt (dấu, chữ dài)
5. Test suite pass, không visual regression