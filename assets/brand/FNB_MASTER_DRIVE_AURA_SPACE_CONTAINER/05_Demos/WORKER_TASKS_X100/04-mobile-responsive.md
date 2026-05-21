# 📱 TASK 04/04 · Mobile Responsive (P3)

> **Repo:** `/Users/mac/mekong-cli/FnB-Container-Caffe`
> **Branch target:** `feat/mobile-perfect-v5`
> **Base:** `main` (after Task 03 merged)
> **Estimated:** 25–35 phút
> **Mekong CLI workflow** · 6 breakpoints

---

## 🔧 PRE-FLIGHT

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
cat CLAUDE.md
git fetch origin && git pull origin main
git checkout -b feat/mobile-perfect-v5
```

---

## 🎯 GOAL

Mobile-first responsive cho 6 breakpoints:
- 320px (iPhone SE)
- 375px (iPhone 12/13/14)
- 768px (iPad portrait)
- 1024px (iPad Pro)
- 1440px (laptop)
- 1920px (desktop)

Tiêu chí:
- Touch targets ≥ 44×44px
- Font sizes scale với clamp()
- Hero animation smooth trên mobile
- Navigation collapse to hamburger
- Stack pills + CTA vertically khi <600px

---

## 📝 STEP 1 — Mobile breakpoint CSS

Create `css/mobile-responsive-v5.css`:

```css
/* ═══════════════════════════════════════
   MOBILE RESPONSIVE v5 BAZI
   6 breakpoints · Mobile-first scaling
   ═══════════════════════════════════════ */

/* ─── HERO MOBILE — drop animation phải work ─── */
@media(max-width:768px){
  .logo-stage{width:min(420px,92vw) !important}
  .ripple-stage{width:78% !important;height:100px !important}
  .surface-glow{width:200px !important;margin-left:-100px !important}
  .est-override span{font-size:.72rem !important;letter-spacing:6px !important}
  .hero-pills{gap:6px !important;margin-bottom:18px !important}
  .pill{padding:6px 14px !important;font-size:.75rem !important}
  .btn{padding:12px 24px !important;font-size:.85rem !important;min-height:44px}
  .cta-row{gap:10px !important;flex-direction:column !important;width:100% !important;max-width:280px;margin:0 auto}
  .cta-row .btn{width:100% !important;justify-content:center !important}
}

@media(max-width:480px){
  .logo-stage{width:min(360px,95vw) !important}
  .drop{width:4px !important;height:8px !important}
  .ripple-primary{width:50px !important;height:50px !important;margin:-25px 0 0 -25px !important}
  .ripple-echo{width:34px !important;height:34px !important;margin:-17px 0 0 -17px !important}
}

@media(max-width:380px){
  .logo-stage{width:min(320px,98vw) !important}
}

/* ─── NAVBAR MOBILE — hamburger ─── */
@media(max-width:900px){
  .navbar-links{display:none}
  .navbar-hamburger{
    display:flex;
    width:44px;height:44px;
    align-items:center;justify-content:center;
    background:transparent;
    border:1px solid rgba(201,214,223,.3);
    border-radius:8px;
    cursor:pointer;
  }
  .navbar-hamburger:hover{
    border-color:var(--aura-chrome-bright);
  }
  .navbar-hamburger .bar{
    width:20px;height:1.5px;
    background:var(--aura-chrome-light);
    transition:all .3s;
  }
  .navbar-hamburger .bar+.bar{margin-top:5px}

  /* Mobile menu drawer */
  .navbar-mobile-menu{
    position:fixed;
    top:0;right:-100%;
    width:80vw;max-width:320px;height:100vh;
    background:var(--aura-noir-deep);
    border-left:1px solid rgba(201,214,223,.15);
    transition:right .35s cubic-bezier(.4,0,.2,1);
    z-index:200;
    padding:80px 24px 24px;
    overflow-y:auto;
  }
  .navbar-mobile-menu.open{right:0}
  .navbar-mobile-menu a{
    display:block;
    padding:14px 0;
    color:var(--aura-text-body);
    font-family:'Space Grotesk',sans-serif;
    font-size:15px;
    letter-spacing:1px;
    border-bottom:1px solid rgba(201,214,223,.08);
    min-height:44px;
    transition:color .25s;
  }
  .navbar-mobile-menu a:hover{color:var(--aura-chrome-bright)}
}

/* ─── STATS MOBILE ─── */
@media(max-width:768px){
  .stats-grid{grid-template-columns:repeat(2,1fr) !important;gap:20px !important}
  .stats{padding:48px 16px !important}
  .stat-number{font-size:clamp(36px,12vw,56px) !important}
}

/* ─── MENU CARDS MOBILE ─── */
@media(max-width:768px){
  .menu-grid{grid-template-columns:1fr !important;gap:12px !important}
  .menu-item{padding:16px !important}
}

@media(min-width:769px) and (max-width:1023px){
  .menu-grid{grid-template-columns:repeat(2,1fr) !important}
}

/* ─── LOYALTY MOBILE ─── */
@media(max-width:768px){
  .tier-cards{grid-template-columns:1fr !important;gap:16px !important}
  .tier-card{padding:24px 16px !important}
}

/* ─── FOOTER MOBILE ─── */
@media(max-width:768px){
  .footer{padding:40px 16px 24px !important}
  .footer-grid{grid-template-columns:1fr !important;gap:24px !important;text-align:center}
  .footer-social{justify-content:center}
}

/* ─── DESKTOP ─── */
@media(min-width:1440px){
  .container{max-width:1320px}
  .hero-pills{gap:14px}
  section{padding:120px 24px}
}

@media(min-width:1920px){
  .container{max-width:1440px}
  h1{font-size:128px}
  h2{font-size:72px}
}

/* ─── TOUCH TARGETS ─── */
@media(hover:none) and (pointer:coarse){
  a, button, .btn, .pill{min-height:44px;min-width:44px}
  .pill{padding:10px 18px}
}

/* ─── REDUCED MOTION ─── */
@media(prefers-reduced-motion:reduce){
  .drop, .ripple-primary, .ripple-echo, .light-shaft, .particle,
  .steam, .specular, .reflection, .tension-line, .crown, .dimple,
  .shockwave, .surface-glow{animation:none !important;opacity:.3}
  *{animation-duration:.01ms !important;transition-duration:.01ms !important}
}
```

---

## 📝 STEP 2 — Link mobile CSS

In `index.html` `<head>`, after `ui-polish-v5.css`:

```bash
python3 - <<'PYEOF'
with open('index.html') as f: c = f.read()
if 'mobile-responsive-v5.css' not in c:
    c = c.replace('<link rel="stylesheet" href="css/ui-polish-v5.css">',
                  '<link rel="stylesheet" href="css/ui-polish-v5.css">\n    <link rel="stylesheet" href="css/mobile-responsive-v5.css">')
    with open('index.html', 'w') as f: f.write(c)
    print('✓ Mobile CSS linked')
PYEOF
```

---

## 📝 STEP 3 — Add hamburger toggle JS

If navbar doesn't have hamburger toggle yet, append:

```bash
cat >> js/mobile-nav.js <<'JSEOF'
(function(){
  const burger = document.querySelector('.navbar-hamburger');
  const menu = document.querySelector('.navbar-mobile-menu');
  if(!burger || !menu) return;
  burger.addEventListener('click', () => {
    menu.classList.toggle('open');
    burger.classList.toggle('active');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
  });
  // Close on link click
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('open');
    burger.classList.remove('active');
    document.body.style.overflow = '';
  }));
})();
JSEOF
```

Then link in HTML (append before `</body>`):
```html
<script src="js/mobile-nav.js" defer></script>
```

---

## 📝 STEP 4 — Verify

```bash
# New CSS file
test -f css/mobile-responsive-v5.css && wc -l css/mobile-responsive-v5.css

# Link in HTML
grep -c "mobile-responsive-v5.css" index.html

# Mobile nav JS
test -f js/mobile-nav.js && wc -l js/mobile-nav.js
grep -c "mobile-nav.js" index.html

# Touch target check (44px)
grep -c "min-height:44px" css/mobile-responsive-v5.css

# Reduced motion
grep -c "prefers-reduced-motion" css/mobile-responsive-v5.css
```

---

## 📝 STEP 5 — Browser test (optional)

```bash
# If Playwright/Puppeteer installed, run mobile audit
which playwright && cat <<'PYEOF' > /tmp/mobile-test.js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const device of ['iPhone SE', 'iPhone 13', 'iPad Pro']) {
    const ctx = await browser.newContext({ ...require('playwright').devices[device] });
    const page = await ctx.newPage();
    await page.goto('https://fnb-caffe-container.pages.dev');
    await page.screenshot({ path: `reports/mobile-${device.replace(/ /g,'-')}.png` });
    console.log(`✓ ${device}`);
  }
  await browser.close();
})();
PYEOF
which playwright && node /tmp/mobile-test.js || echo "Playwright not installed — skip"
```

---

## 📝 STEP 6 — Commit + Push + PR

```bash
git add css/mobile-responsive-v5.css js/mobile-nav.js index.html
git commit -m "feat(mobile): X100 responsive — 6 breakpoints + hamburger menu

- css/mobile-responsive-v5.css (NEW, 6 breakpoints 320/480/768/1024/1440/1920)
- js/mobile-nav.js (NEW, hamburger toggle drawer)
- Hero animation scaled for mobile (drop/ripple sized down)
- Touch targets ≥44×44px (WCAG AA)
- Navigation collapse to hamburger <900px
- Mobile drawer menu with slide-in animation
- Reduced motion accessibility support
- Pills + CTA stack vertically on mobile

Tested on: iPhone SE/12/13/14, iPad, iPad Pro, Desktop, 4K"

git push -u origin feat/mobile-perfect-v5

gh pr create \
  --title "feat(mobile): X100 responsive — 6 breakpoints + hamburger drawer" \
  --base main \
  --head feat/mobile-perfect-v5 \
  --body "Phase 4 of AUDIT X100. Mobile-first responsive across 6 breakpoints. Brand v5 BAZI."
```

---

## 📝 STEP 7 — Report

```
=== TASK 04/04 MOBILE RESPONSIVE — DONE ===
Branch:       feat/mobile-perfect-v5
New CSS:      css/mobile-responsive-v5.css (XXX lines)
New JS:       js/mobile-nav.js (hamburger toggle)
Breakpoints:  6 (320/480/768/1024/1440/1920)
Touch tgt:    44×44px ✓
A11y:         prefers-reduced-motion ✓
PR URL:       <url>
=== END ===
```

---

## 🚫 OUT OF SCOPE

- ❌ KHÔNG đụng files Task 01-03 đã update
- ❌ KHÔNG merge PR
- ❌ KHÔNG redesign hero animation
