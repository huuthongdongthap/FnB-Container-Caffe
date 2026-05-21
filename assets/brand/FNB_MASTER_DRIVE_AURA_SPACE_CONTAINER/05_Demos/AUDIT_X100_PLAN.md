# 🔍 AUDIT X100 — UI Improvement Plan (Brand v5 BAZI)

**Target:** `https://fnb-caffe-container.pages.dev`
**Current state:** v5 BAZI palette deployed, but UI quality below target
**Goal:** X100 quality across hero + all sections

---

## 🔴 P0 — CRITICAL HERO FIXES (PR `fix/hero-v8-seamless`)

### Issue 1: Phân mảng PNG vs hero bg (visible square edge)

**Root cause:**
- `clip-path: inset(12% 0 0 0)` chỉ cắt top — bottom + 2 side edges vẫn lộ
- `mask-image: radial 88% × 88% at 50% 56%` outer 12% fade chưa aggressive
- PNG bg `#1A1A2E` lệch nhẹ với hero halo `#15152C/#1A1A30`

**Fix proposal:**

```css
.logo-img{
  /* AGGRESSIVE all-side mask — outer 30% fade smooth */
  mask-image:radial-gradient(ellipse 72% 72% at 50% 52%,
    black 40%,
    rgba(0,0,0,.85) 60%,
    rgba(0,0,0,.4) 80%,
    transparent 100%);
  -webkit-mask-image:radial-gradient(ellipse 72% 72% at 50% 52%,
    black 40%,
    rgba(0,0,0,.85) 60%,
    rgba(0,0,0,.4) 80%,
    transparent 100%);
  /* clip-path không cần nữa — mask handles top crop too */
  clip-path: none;
  /* Optional: lighten blend để pixel tối của PNG hòa vào hero */
  mix-blend-mode: normal;  /* keep normal, mask đủ */
}

/* Hero bg layer 1 — match PNG navy EXACTLY */
.hero{
  background:
    /* HALO match PNG bg navy */
    radial-gradient(ellipse 95% 85% at 50% 50%,
      #1A1A2E 0%,             /* exact PNG bg */
      #15152C 35%,
      rgba(21,21,44,.6) 60%,
      transparent 88%),
    /* Outer luminous rim */
    radial-gradient(ellipse 140% 120% at 50% 50%,
      var(--noir-bright) 0%,
      var(--noir-mid) 35%,
      var(--noir-deep) 70%,
      var(--noir-void) 100%);
}
```

### Issue 2: EST. 2018 nằm trên zone "đã clip" — text floating awkward

**Fix:** Move `est-override` xuống inside the visible PNG area, position at `top: 12%` (just after clipped zone)

```css
.est-override{
  top: 12%;  /* was 5% — move into visible PNG zone */
  /* ... rest unchanged */
}
```

### Issue 3: Drop animation timing — visible window quá ngắn

**Current:** drop visible 9-69% of 9s cycle = 5.4s visible, but only 0.5s peak impact moment
**Fix:** Add a subtle "pulse hint" pre-formation visible from 0-9% so user always sees something

---

## 🟡 P1 — UI POLISH (PR `feat/ui-audit-x100`)

### A. Navigation bar
- [ ] Active state highlight: chrome underline animation under "Trang Chủ"
- [ ] Logo nav: chrome border treatment
- [ ] Hover: smooth slide-up + chrome glow
- [ ] Mobile hamburger menu styled v5 BAZI

### B. Stats section (sau hero)
- [ ] Counter animation chrome (currently gold remnant?)
- [ ] Border-top chrome 2px gradient
- [ ] Number font: Cormorant Garamond italic 64px

### C. Featured Menu cards
- [ ] Card hover: chrome border glow + lift 4px
- [ ] Skeleton loader chrome instead of gray
- [ ] Image rounded corners 16px
- [ ] Price tag chrome metallic

### D. Loyalty section
- [ ] Tier cards: chrome borders
- [ ] Progress bar: chrome gradient
- [ ] CTA buttons: btn-primary chrome

### E. Footer
- [ ] Copyright text: chrome-mid color
- [ ] Social icons: chrome stroke + glow on hover
- [ ] Newsletter input: chrome border focus
- [ ] Divider: chrome thread (subtle 1px)

### F. Typography hierarchy
- [ ] H1 hero: Cormorant Garamond 96px italic
- [ ] H2 sections: Cormorant Garamond 56px
- [ ] H3 cards: Cormorant Garamond 28px
- [ ] Body: Space Grotesk 16px light
- [ ] Captions: Space Grotesk 12px chrome-mid

### G. Spacing system (8pt grid)
- [ ] Section padding: 120px top/bot (desktop), 64px (tablet), 40px (mobile)
- [ ] Container max-width: 1200px centered
- [ ] Grid gaps: 24px (desktop), 16px (tablet), 12px (mobile)

### H. Animations
- [ ] Scroll reveal: fade-up + chrome glow on enter (Intersection Observer)
- [ ] Hover transitions: 350ms cubic-bezier ease
- [ ] Page transitions: subtle slide

---

## 🟢 P2 — PERFORMANCE + ACCESSIBILITY (PR `perf/optimize-bundle`)

### Performance
- [ ] Lazy load images below the fold
- [ ] Preload hero logo PNG + critical fonts
- [ ] Minify CSS/JS bundles
- [ ] Cloudflare cache headers tuning
- [ ] Reduce hero CSS from 700 lines → 400 lines (consolidate keyframes)

### Accessibility (WCAG AA)
- [ ] Color contrast: chrome on navy ≥ 4.5:1 (check chrome-light #C9D6DF on noir-deep #0A1A2E)
- [ ] ARIA labels on all interactive elements
- [ ] Semantic HTML5 (nav, main, section, footer, article)
- [ ] Keyboard navigation: tab order, focus rings
- [ ] Screen reader: alt text on images, sr-only labels

### SEO
- [ ] Meta description per page
- [ ] OG tags consistent
- [ ] Schema.org markup (CafeOrCoffeeShop, MenuItem, Review)
- [ ] sitemap.xml fresh
- [ ] robots.txt audit

---

## 🔵 P3 — MOBILE RESPONSIVE (PR `feat/mobile-perfect`)

Breakpoints:
- 320px (iPhone SE)
- 375px (iPhone 12/13/14)
- 768px (iPad)
- 1024px (iPad Pro)
- 1440px (laptop)
- 1920px (desktop)

Test:
- [ ] Hero animation hoạt động trên mobile (drop visible, ripple visible)
- [ ] Pills + buttons stack vertically on mobile
- [ ] Navigation collapse to hamburger
- [ ] Touch targets ≥ 44×44px
- [ ] Font sizes scale with clamp()

---

## 🛠 EXECUTION ORDER

1. **Phase 1 — Hero fix (P0) — 1 file change, 5 min**
   - Update `css/hero-v8-bazi.css` với fixes Issue 1+2+3
   - Push branch `fix/hero-v8-seamless` + PR
   - Merge → Cloudflare deploy ~3 min

2. **Phase 2 — UI polish (P1) — multi-file, 30-45 min**
   - Audit + update homepage sections
   - Create/update CSS files for navbar, stats, menu cards, loyalty, footer
   - Push branch `feat/ui-audit-x100` + PR

3. **Phase 3 — Perf + a11y (P2) — varied**
   - Optimize bundles
   - Add ARIA + semantic HTML
   - Push branch `perf/optimize-bundle` + PR

4. **Phase 4 — Mobile (P3) — varied**
   - Test on real devices
   - Tweak responsive breakpoints
   - Push branch `feat/mobile-perfect` + PR

---

## 📊 ACCEPTANCE CHECKLIST X100

After all phases:
- [ ] Hero phân mảng → ZERO (logo blends seamlessly)
- [ ] Drop animation visible mỗi 9s cycle
- [ ] Ripple chrome expand visible
- [ ] All sections consistent v5 BAZI palette (no gold remnants)
- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse SEO ≥ 95
- [ ] Mobile responsive (iPhone SE → Desktop)
- [ ] Animations smooth 60fps
- [ ] Zero console errors

---

## 🎯 NEXT IMMEDIATE STEP

**Em đề xuất push Phase 1 (hero fix) NGAY** — fix phân mảng visible cho anh thấy.

Anh confirm em làm Phase 1 trước (5 phút), rồi tới Phase 2 sau khi anh duyệt?
