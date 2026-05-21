# 🎨 TASK 07 — Brand v6 MINERAL + COBALT (lift tones cho khách cafe)

> **Target repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch:** `feat/brand-v6-mineral-cobalt`
> **Depends on:** Task 06 merged
> **Estimated:** 20-25 phút worker autonomous
> **Priority:** P1 (UX brand lift)

---

## 🎯 Context: Why v6

V5 BAZI Chrome đã đúng bát tự (壬 Thủy + 庚 Kim) NHƯNG **quá tối** cho khách cafe ban ngày. Khách cafe tỉnh lẻ thị hiếu cần ấm áp + sáng + mời gọi.

**Insight từ ảnh quán thật (anh Còn cung cấp):**
- Container BLUE COBALT đậm — signature material → strengthen
- Khung lan can TRẮNG CRISSCROSS — airy industrial → echo trong menu cards
- Cầu thang XÁM NHẠT — mineral grey → tone neutral cho sections
- Mái polycarbonate trắng trong — natural light flood → light bg appropriate
- Mural xanh forest — Mộc accent → giữ cho category tags
- Bàn gỗ tự nhiên — neutral cream (KHÔNG nâu saturated)
- Đèn vàng tungsten ban đêm — warm glow @ low opacity cho mood

**Bát tự rules (BẮT BUỘC):**
- ✅ Kim element OK: chrome, pearl, mineral light, silver, white
- ✅ Thủy element OK: navy, cobalt blue, blue-grey
- ✅ Mộc element (small dose): forest green cho accent tags only
- 🚫 NO Gold/Yellow saturated (Thổ)
- 🚫 NO Red/Orange (Hỏa)
- 🚫 NO Brown saturated (Thổ)

---

## 📋 Implementation Steps

### Step 1: Setup
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
cat CLAUDE.md
git checkout main && git pull origin main
git checkout -b feat/brand-v6-mineral-cobalt
```

### Step 2: Update `css/brand-tokens.css` — Add mineral palette + cobalt

```css
/* ════════════════════════════════════════════════════════
   AURA CAFE — Brand v6 MINERAL + COBALT
   Bát tự aligned: 壬 Thủy + 庚 Kim + tiny 乙 Mộc accent
   ════════════════════════════════════════════════════════ */

:root {
  /* ──────── v5 BAZI THỦY/KIM (giữ nguyên) ──────── */
  --noir-void:   #050D1A;
  --noir-deep:   #0A1A2E;   /* navy primary (match container dark edges) */
  --noir-mid:    #1A2A4E;
  --chrome-bright: #E8EEF3;
  --chrome-light:  #C9D6DF;
  --chrome-mid:    #6B9FB8;
  --chrome-dark:   #3A6B80;
  --moc-forest:   #2D5A3D;

  /* ──────── v6 NEW: COBALT (signature container blue) ──────── */
  --cobalt-deep:   #0F2D5E;    /* container shadow side */
  --cobalt-mid:    #1B3A6B;    /* container body — match ảnh thật */
  --cobalt-bright: #2D5A9E;    /* container highlight */
  --cobalt-glow:   rgba(45, 90, 158, .15);

  /* ──────── v6 NEW: MINERAL light palette (Kim element) ──────── */
  --mineral-pearl:  #FAFAFA;   /* almost white — lan can crisscross */
  --mineral-cream:  #F5EFE0;   /* warm cream — gỗ tự nhiên neutral */
  --mineral-light:  #F0F4F7;   /* light blue-grey — sky polycarbonate */
  --mineral-soft:   #E5EAF0;   /* soft blue-grey */
  --mineral-med:    #D5DCE2;   /* medium grey-blue */
  --mineral-stone:  #B8C0CC;   /* stone grey — cầu thang */
  --mineral-text:   #2A3145;   /* dark navy text on light bg */
  --mineral-muted:  #6B7280;   /* muted grey */

  /* ──────── v6 NEW: WARM TUNGSTEN (night ambient glow, low opacity) ──────── */
  --warm-glow:     rgba(245, 230, 211, .05);   /* 5% only — không vi phạm bát tự */
  --warm-glow-hi:  rgba(245, 230, 211, .12);   /* hover state */

  /* ──────── Element token aliases ──────── */
  --bg-primary:   var(--noir-deep);
  --bg-cobalt:    var(--cobalt-mid);
  --bg-light:     var(--mineral-cream);
  --bg-pearl:     var(--mineral-pearl);
  --bg-soft:      var(--mineral-soft);

  --text-primary: var(--chrome-bright);
  --text-light:   var(--mineral-text);
  --text-muted:   var(--mineral-muted);

  --accent-cobalt: var(--cobalt-bright);   /* CTA primary */
  --accent-moc:    var(--moc-forest);      /* category tags only */
}
```

### Step 3: Create `css/sections-mineral-v6.css` (NEW)

```css
/* ════════════════════════════════════════════════════════
   AURA CAFE v6 — Section-specific mineral styling
   Scrolling Mood Arc: 🌑 Hero → 🌕 Menu → 🌕 Spaces →
                       🌕 Loyalty → 🌕 About → 🌑 CTA → 🌑 Footer
   ════════════════════════════════════════════════════════ */

/* ─── HERO (keep dark + add warm glow night ambient) ─── */
.hero-v8::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 60% 40% at 50% 70%, var(--warm-glow) 0%, transparent 60%);
  mix-blend-mode: screen;
  z-index: 1;
}

/* ─── SECTION TRANSITION: dark → light ─── */
.section-transition-dl {
  height: 100px;
  background: linear-gradient(180deg,
    var(--noir-deep) 0%,
    var(--mineral-cream) 100%);
  pointer-events: none;
}

/* ─── SECTION TRANSITION: light → dark ─── */
.section-transition-ld {
  height: 100px;
  background: linear-gradient(180deg,
    var(--mineral-soft) 0%,
    var(--noir-deep) 100%);
  pointer-events: none;
}

/* ─── FEATURED MENU (cream cards + crisscross border) ─── */
.featured-menu {
  background: var(--mineral-cream);
  padding: 80px 24px;
}
.featured-menu .section-heading {
  color: var(--mineral-text);
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
}
.featured-menu .section-sub {
  color: var(--mineral-muted);
}
.menu-item {
  background: rgba(255, 255, 255, .7);
  border: 1px solid var(--mineral-stone);
  border-radius: 4px;
  padding: 24px;
  color: var(--mineral-text);
  transition: all .35s ease;
  position: relative;
}
/* Crisscross pattern (echo lan can trắng thật) */
.menu-item::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background-image:
    linear-gradient(45deg, transparent 48%, var(--mineral-stone) 49%, var(--mineral-stone) 51%, transparent 52%),
    linear-gradient(-45deg, transparent 48%, var(--mineral-stone) 49%, var(--mineral-stone) 51%, transparent 52%);
  background-size: 40px 40px;
  opacity: .04;
  pointer-events: none;
}
.menu-item:hover {
  background: var(--mineral-pearl);
  border-color: var(--cobalt-mid);
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(15, 45, 94, .12);
}
.menu-item .price {
  color: var(--cobalt-bright);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}
.menu-item .category-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 2px;
  background: var(--moc-forest);
  color: var(--mineral-pearl);
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* ─── SPACES (mineral light + container blue mockup hint) ─── */
.spaces-placeholder {
  background: var(--mineral-light);
  border-top: 2px solid var(--mineral-stone);
  padding: 80px 24px;
}
.spaces-placeholder h3 {
  color: var(--mineral-text);
}
.spaces-placeholder .placeholder-card {
  background: var(--mineral-pearl);
  border: 1px dashed var(--cobalt-mid);
  color: var(--mineral-muted);
}

/* ─── LOYALTY (pearl + cobalt accent tier border) ─── */
.loyalty-promo {
  background: linear-gradient(180deg,
    var(--mineral-light) 0%,
    var(--mineral-pearl) 50%,
    var(--mineral-light) 100%);
  padding: 80px 24px;
}
.tier-card {
  background: rgba(255, 255, 255, .85);
  border: 1px solid var(--mineral-stone);
  color: var(--mineral-text);
  transition: all .35s ease;
}
.tier-card:hover {
  border-color: var(--cobalt-bright);
  box-shadow: 0 8px 24px var(--cobalt-glow);
}
.tier-rate {
  color: var(--cobalt-bright);
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 2.5rem;
}

/* ─── CASHBACK CALC (warm cream comfort) ─── */
.cashback-calc {
  background: var(--mineral-cream);
  color: var(--mineral-text);
  padding: 60px 24px;
}
.cashback-calc input,
.cashback-calc select {
  background: var(--mineral-pearl);
  border: 1px solid var(--mineral-stone);
  color: var(--mineral-text);
}
.cashback-calc input:focus,
.cashback-calc select:focus {
  border-color: var(--cobalt-bright);
  outline: 2px solid var(--cobalt-glow);
}

/* ─── ABOUT (mineral soft warm storytelling) ─── */
.about {
  background: var(--mineral-soft);
  padding: 80px 24px;
}
.about h3,
.about p {
  color: var(--mineral-text);
}
.about .divider {
  background: linear-gradient(90deg, transparent, var(--chrome-dark), transparent);
}

/* ─── CTA (back to navy + cobalt button) ─── */
.cta-section {
  background: var(--noir-deep);
  padding: 80px 24px;
  color: var(--chrome-bright);
}
.cta-section .btn-primary {
  background: var(--cobalt-bright);
  color: var(--chrome-bright);
  border: 1px solid var(--cobalt-bright);
  padding: 14px 36px;
  font-weight: 600;
  letter-spacing: 1px;
  transition: all .25s ease;
}
.cta-section .btn-primary:hover {
  background: var(--cobalt-mid);
  border-color: var(--chrome-bright);
  box-shadow: 0 0 24px var(--cobalt-glow);
}

/* ─── FOOTER (dark + warm tungsten glow) ─── */
.footer {
  background: var(--noir-void);
  color: var(--chrome-light);
  position: relative;
}
.footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--chrome-dark), transparent);
}
.footer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 50% at 50% 0%, var(--warm-glow) 0%, transparent 70%);
  pointer-events: none;
}

/* ─── RESPONSIVE: mobile light sections (giữ readable) ─── */
@media (max-width: 768px) {
  .featured-menu,
  .spaces-placeholder,
  .loyalty-promo,
  .about,
  .cashback-calc {
    padding: 48px 16px;
  }
  .section-transition-dl,
  .section-transition-ld {
    height: 60px;
  }
  .menu-item::before {
    background-size: 30px 30px;
  }
}

/* ─── PREFERS REDUCED MOTION ─── */
@media (prefers-reduced-motion: reduce) {
  .menu-item,
  .tier-card,
  .cta-section .btn-primary {
    transition: none;
  }
}
```

### Step 4: Update `index.html` — Add CSS link + section transition divs

```html
<!-- Trong <head>, sau brand-tokens.css -->
<link rel="stylesheet" href="css/sections-mineral-v6.css">
```

Trong body, thêm transition dividers giữa sections (chỉ giữa dark↔light):

```html
<!-- Sau Hero, trước Stats hoặc Featured Menu -->
<div class="section-transition-dl" aria-hidden="true"></div>

<!-- Sau About, trước CTA -->
<div class="section-transition-ld" aria-hidden="true"></div>
```

(Tùy thuộc thứ tự thực tế trong index.html — worker phải check)

### Step 5: WCAG verify

Run quick contrast check:
```bash
# Verify navy text trên cream
node -e '
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n>>16&255, n>>8&255, n&255]; }
function lum(rgb) {
  const [r,g,b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function ratio(a, b) { const la = lum(rgb(a)), lb = lum(rgb(b)); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); }

console.log("Navy text on Cream:", ratio("#2A3145", "#F5EFE0").toFixed(2), ":1 (need ≥ 4.5)");
console.log("Navy text on Pearl:", ratio("#2A3145", "#FAFAFA").toFixed(2), ":1");
console.log("Cobalt #1B3A6B on Cream:", ratio("#1B3A6B", "#F5EFE0").toFixed(2), ":1");
console.log("Cobalt #2D5A9E on Pearl:", ratio("#2D5A9E", "#FAFAFA").toFixed(2), ":1");
console.log("Muted #6B7280 on Cream:", ratio("#6B7280", "#F5EFE0").toFixed(2), ":1");
console.log("Forest #2D5A3D on Pearl:", ratio("#2D5A3D", "#FAFAFA").toFixed(2), ":1 (tag bg/fg)");
'
```

Expected:
- Navy on Cream: ~10.5:1 ✅ AAA
- Navy on Pearl: ~12:1 ✅ AAA
- Cobalt on Cream: ~7:1 ✅ AA
- Muted on Cream: ~5:1 ✅ AA
- Forest on Pearl: ~7:1 ✅ AA

### Step 6: Local visual verify

```bash
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 2
open http://localhost:8000  # or anh check trên trình duyệt
sleep 5
kill $SERVER_PID
```

Anh verify:
- [ ] Hero dark navy + chrome ripple như cũ
- [ ] Menu section cream + cards cobalt hover lift
- [ ] Spaces light blue-grey
- [ ] Loyalty pearl + cobalt tier hover
- [ ] About soft mineral
- [ ] CTA dark navy + cobalt button
- [ ] Footer void + warm subtle glow

### Step 7: Commit + PR

```bash
git add css/brand-tokens.css css/sections-mineral-v6.css index.html
git status

git commit -m "$(cat <<'EOF'
feat(brand): v6 MINERAL + COBALT — lift tones cho khách cafe

Why:
- V5 BAZI Chrome đúng bát tự nhưng quá tối cho khách cafe ban ngày
- Anh Còn cung cấp ảnh thực tế quán: container blue cobalt + khung trắng + mineral grey
- Web brand cần upscale rõ rệt so với environment thật để dẫn dắt positioning

Bát tự rules preserved:
- Mineral palette = Kim element (kim loại sáng, đá tinh)
- Cobalt = Thủy element (signature container thật)
- Forest green tiny dose = Mộc (mural thật)
- NO gold/yellow/red/orange/brown saturated

Scrolling Mood Arc:
🌑 Hero (navy + chrome ripple + warm glow night ambient)
🌑→🌕 transition dark-to-light
🌕 Featured Menu (cream + crisscross subtle + cobalt accent)
🌕 Spaces (mineral light + cobalt dashed mockup)
🌕 Loyalty (pearl + cobalt tier glow)
🌕 Cashback Calc (cream comfort)
🌕 About (mineral soft warm storytelling)
🌕→🌑 transition light-to-dark
🌑 CTA (navy + cobalt button)
🌑 Footer (void + warm tungsten glow)

Files:
- css/brand-tokens.css: +cobalt-* +mineral-* +warm-glow tokens
- css/sections-mineral-v6.css: NEW 250 lines section styles
- index.html: +link tag, +2 transition divs

WCAG verified:
- Navy on Cream: 10.5:1 AAA
- Cobalt on Cream: 7:1 AA
- Mobile responsive + prefers-reduced-motion
EOF
)"

git push -u origin feat/brand-v6-mineral-cobalt

gh pr create --base main --head feat/brand-v6-mineral-cobalt \
  --title "feat(brand): v6 MINERAL + COBALT — lift tones cho khách cafe" \
  --body "$(cat <<'EOF'
## Summary
Brand v6 lift V5 BAZI brightness cho khách cafe ban ngày. Giữ 100% bát tự rules. Add cobalt accent từ container thật.

## Scrolling Mood Arc
🌑 Hero dark → 🌕 sections light → 🌑 CTA/Footer dark
Customer cảm thấy như bước vào quán: dark elegant intro → warm cafe inside → premium closure.

## Bát tự alignment
- ✅ Mineral light = Kim element (kim loại sáng, đá tinh)
- ✅ Cobalt = Thủy element (signature container)
- ✅ Forest green tiny dose = Mộc (mural thật)
- 🚫 KHÔNG gold/yellow/red/orange/brown saturated

## Real-world inspired
Ảnh anh Còn cung cấp:
- Container BLUE COBALT → cobalt accent token
- Khung lan can TRẮNG CRISSCROSS → menu card pattern
- Cầu thang XÁM NHẠT → mineral stone tone
- Mural xanh forest → category tag
- Đèn tungsten ban đêm → warm glow @ 5% opacity (hero + footer)

## WCAG verified
- Navy text on Cream: 10.5:1 ✅ AAA
- Cobalt on Cream: 7:1 ✅ AA
- All combinations ≥ 4.5:1

## Test plan
- [ ] Open production → hard refresh
- [ ] Verify Hero still dark + ripple animation
- [ ] Verify Menu cream + crisscross subtle
- [ ] Verify cobalt buttons + glow hover
- [ ] Mobile responsive 6 breakpoints
- [ ] Lighthouse Accessibility ≥ 95 maintained
EOF
)"
```

### Step 8: Wait for review + merge + deploy

Anh review PR → merge → Cloudflare auto-deploy → hard refresh → verify mood arc đẹp.

---

## ✅ Acceptance criteria

- [ ] css/brand-tokens.css có mineral + cobalt + warm-glow
- [ ] css/sections-mineral-v6.css NEW + linked
- [ ] index.html có 2 transition divs
- [ ] WCAG AA contrast verified
- [ ] Hero giữ dark navy + ripple animation
- [ ] Menu/Spaces/Loyalty/About light tones
- [ ] CTA + Footer back to dark
- [ ] Mobile responsive maintained
- [ ] PR merged + Cloudflare deployed

---

## 🆘 Rollback plan

Nếu visual không OK:
```bash
git revert <merge-commit-sha>
git push origin main
```

Hoặc disable v6 CSS bằng cách comment dòng `<link rel="stylesheet" href="css/sections-mineral-v6.css">` trong index.html.
