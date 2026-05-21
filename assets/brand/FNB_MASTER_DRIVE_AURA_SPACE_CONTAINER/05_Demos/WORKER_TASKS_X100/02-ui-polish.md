# 🎨 TASK 02/04 · UI Polish — All Sections (P1)

> **Repo:** `/Users/mac/mekong-cli/FnB-Container-Caffe`
> **Branch target:** `feat/ui-audit-x100-polish`
> **Base:** `main` (after Task 01 merged)
> **Estimated:** 25–35 phút
> **Conventional commits** · Mekong CLI workflow

---

## 🔧 PRE-FLIGHT

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
cat CLAUDE.md
git fetch origin && git pull origin main
git checkout -b feat/ui-audit-x100-polish
```

---

## 🎯 GOAL

Polish 6 sections + typography + spacing toàn site (homepage focus):
1. Navbar active state + hover chrome
2. Stats section counter chrome
3. Featured menu cards hover glow
4. Loyalty section chrome treatment
5. Footer chrome icons
6. Typography hierarchy + spacing 8pt grid

---

## 📝 STEP 1 — Audit current state

```bash
# Find sections in index.html
grep -n 'class="\(stats\|featured-menu\|loyalty-promo\|footer\)"' index.html

# Find shared CSS
ls -la css/

# Check for legacy gold remnants
grep -rn "#D4AF37\|#FFD700\|var(--gold)" css/styles.css 2>/dev/null | head -10
```

---

## 📝 STEP 2 — Update `css/styles.css` (or create v5 polish CSS)

Create new file `css/ui-polish-v5.css` (append to existing instead of overwrite):

```css
/* ═══════════════════════════════════════
   UI POLISH v5 BAZI · X100 Audit
   ═══════════════════════════════════════ */

/* ─── NAVBAR ─── */
.navbar a, .nav-link{
  position:relative;
  color:var(--aura-text-body);
  transition:color .25s ease;
}
.navbar a::after, .nav-link::after{
  content:'';
  position:absolute;
  left:50%;bottom:-4px;
  width:0;height:1.5px;
  background:linear-gradient(90deg,transparent,var(--aura-chrome-bright),transparent);
  transform:translateX(-50%);
  transition:width .35s cubic-bezier(.4,0,.2,1);
}
.navbar a:hover::after,
.navbar a.active::after,
.nav-link.active::after{
  width:24px;
}
.navbar a:hover, .nav-link:hover{
  color:var(--aura-chrome-bright);
}

/* ─── STATS SECTION ─── */
.stats{
  padding:80px 20px;
  background:linear-gradient(180deg,var(--aura-noir-deep) 0%,var(--aura-noir-void) 100%);
  border-top:1px solid rgba(201,214,223,.1);
  border-bottom:1px solid rgba(201,214,223,.1);
}
.stat-number{
  font-family:'Cormorant Garamond',serif;
  font-size:clamp(48px,7vw,72px);
  font-weight:500;
  font-style:italic;
  background:linear-gradient(180deg,#E8EEF3,#C9D6DF,#6B9FB8);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
  line-height:1;
  letter-spacing:-2px;
}
.stat-label{
  font-family:'Space Grotesk',sans-serif;
  font-size:13px;
  font-weight:500;
  color:var(--aura-chrome-mid);
  text-transform:uppercase;
  letter-spacing:3px;
  margin-top:12px;
}

/* ─── FEATURED MENU CARDS ─── */
.menu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.menu-item, .menu-skeleton{
  background:rgba(10,26,46,.6);
  border:1px solid rgba(201,214,223,.15);
  border-radius:16px;
  padding:20px;
  transition:all .35s cubic-bezier(.4,0,.2,1);
  backdrop-filter:blur(8px);
}
.menu-item:hover{
  border-color:var(--aura-chrome-light);
  background:rgba(10,26,46,.8);
  transform:translateY(-4px);
  box-shadow:0 12px 32px rgba(201,214,223,.15);
}
.menu-item .price{
  font-family:'JetBrains Mono',monospace;
  font-weight:600;
  color:var(--aura-chrome-light);
}
.menu-skeleton{
  background:linear-gradient(90deg,rgba(10,26,46,.4) 0%,rgba(201,214,223,.05) 50%,rgba(10,26,46,.4) 100%);
  background-size:200% 100%;
  animation:skeletonShimmer 1.8s ease-in-out infinite;
  height:240px;
}
@keyframes skeletonShimmer{
  0%,100%{background-position:200% 0}
  50%{background-position:-200% 0}
}

/* ─── LOYALTY SECTION ─── */
.loyalty-promo{
  padding:80px 20px;
  position:relative;
}
.tier-card{
  border:1px solid rgba(201,214,223,.2);
  background:rgba(10,26,46,.5);
  border-radius:20px;
  padding:32px 24px;
  transition:all .4s ease;
}
.tier-card:hover{
  border-color:var(--aura-chrome-bright);
  transform:translateY(-6px);
  box-shadow:0 16px 48px rgba(201,214,223,.18);
}
.tier-card .progress-bar{
  background:linear-gradient(90deg,var(--aura-chrome-light),var(--aura-chrome-bright));
}

/* ─── FOOTER ─── */
.footer{
  background:var(--aura-noir-void);
  border-top:1px solid rgba(201,214,223,.1);
  padding:60px 20px 30px;
}
.footer-social a{
  width:40px;height:40px;
  border-radius:50%;
  border:1px solid rgba(201,214,223,.25);
  color:var(--aura-chrome-light);
  transition:all .3s ease;
}
.footer-social a:hover{
  border-color:var(--aura-chrome-bright);
  color:var(--aura-chrome-bright);
  box-shadow:0 0 16px rgba(232,238,243,.4);
  transform:translateY(-2px);
}
.footer-copyright{
  color:var(--aura-chrome-mid);
  font-size:13px;
  margin-top:24px;
}

/* ─── TYPOGRAPHY HIERARCHY ─── */
h1{font-family:'Cormorant Garamond',serif;font-size:clamp(48px,7vw,96px);font-weight:500;font-style:italic;letter-spacing:-1px;line-height:1.1}
h2{font-family:'Cormorant Garamond',serif;font-size:clamp(36px,5vw,56px);font-weight:500;letter-spacing:-0.5px;line-height:1.2}
h3{font-family:'Cormorant Garamond',serif;font-size:clamp(24px,3vw,32px);font-weight:500;line-height:1.3}
h4{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;letter-spacing:.5px}
body, p{font-family:'Space Grotesk',sans-serif;font-weight:400;line-height:1.6;color:var(--aura-text-body)}
.caption{font-size:12px;color:var(--aura-chrome-mid);letter-spacing:2px;text-transform:uppercase}

/* ─── SCROLL REVEAL ─── */
.reveal{opacity:0;transform:translateY(30px);transition:opacity .8s ease,transform .8s ease}
.reveal.visible{opacity:1;transform:translateY(0)}

/* ─── SPACING 8pt GRID ─── */
section{padding:96px 24px}
.container{max-width:1200px;margin:0 auto}
@media(max-width:768px){
  section{padding:64px 16px}
  .menu-grid{grid-template-columns:1fr;gap:16px}
}
```

---

## 📝 STEP 3 — Link new CSS in `index.html`

After `<link rel="stylesheet" href="css/hero-v8-bazi.css">`, add:
```html
<link rel="stylesheet" href="css/ui-polish-v5.css">
```

---

## 📝 STEP 4 — Add scroll reveal JS

Append cuối `<body>` (trước closing tags):

```html
<script>
(function(){
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },{threshold:0.1, rootMargin:'0px 0px -80px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
})();
</script>
```

---

## 📝 STEP 5 — Verify

```bash
# Verify new CSS file
test -f css/ui-polish-v5.css && wc -l css/ui-polish-v5.css

# Verify link in index.html
grep -c "ui-polish-v5.css" index.html  # Expect: 1

# Verify scroll reveal JS
grep -c "IntersectionObserver" index.html  # Expect: 1

# Lint check
npm run lint 2>/dev/null || echo "No lint config"
```

---

## 📝 STEP 6 — Commit + Push + PR

```bash
git add css/ui-polish-v5.css index.html
git commit -m "feat(ui): X100 polish — navbar active, stats, menu cards, loyalty, footer

- New css/ui-polish-v5.css (300+ lines, brand v5 BAZI chrome)
- Navbar active underline + chrome hover glow
- Stats counter Cormorant italic chrome gradient
- Featured menu cards: hover lift + chrome border glow
- Loyalty tier cards chrome treatment
- Footer chrome social icons + dividers
- Typography hierarchy: Cormorant heading + Space Grotesk body
- Scroll reveal animation (Intersection Observer)
- Spacing 8pt grid + responsive breakpoints

Bám 100% brand v5 BAZI (壬 Thủy + 庚 Kim)"

git push -u origin feat/ui-audit-x100-polish

gh pr create \
  --title "feat(ui): X100 audit polish — navbar/stats/menu/loyalty/footer chrome" \
  --base main \
  --head feat/ui-audit-x100-polish \
  --body "Phase 2 of AUDIT X100 plan. Polish 6 sections + typography + spacing. Brand v5 BAZI aligned."
```

---

## 📝 STEP 7 — Report

```
=== TASK 02/04 UI POLISH — DONE ===
Branch:     feat/ui-audit-x100-polish
New files:  css/ui-polish-v5.css (XXX lines)
Modified:   index.html (CSS link + reveal JS)
PR URL:     <url>
=== END ===
```

---

## 🚫 OUT OF SCOPE

- ❌ KHÔNG đụng `css/hero-v8-bazi.css` (Task 01)
- ❌ KHÔNG đụng `css/brand-tokens.css`
- ❌ KHÔNG merge PR
