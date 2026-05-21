# ⚡ TASK 03/04 · Performance + Accessibility (P2)

> **Repo:** `/Users/mac/mekong-cli/FnB-Container-Caffe`
> **Branch target:** `perf/optimize-bundle-a11y`
> **Base:** `main` (after Task 02 merged)
> **Estimated:** 20–30 phút
> **Mekong CLI workflow** · Lighthouse targets 90+

---

## 🔧 PRE-FLIGHT

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
cat CLAUDE.md
git fetch origin && git pull origin main
git checkout -b perf/optimize-bundle-a11y
```

---

## 🎯 GOAL

- **Performance:** Lazy load, preload critical, defer non-critical
- **Accessibility:** WCAG AA contrast, ARIA, semantic HTML, keyboard nav
- **SEO:** Schema.org, og tags, sitemap fresh
- **Bundle size:** Reduce hero CSS 700 lines → 400 lines

---

## 📝 STEP 1 — Image lazy load

For all `<img>` in HTMLs (except hero logo + first viewport):

```bash
# Audit all img tags
grep -rn '<img ' *.html admin/*.html | grep -v 'loading=' | head -20
```

**Action:** Add `loading="lazy"` to images below-the-fold:

```bash
python3 - <<'PYEOF'
import re, glob
files = glob.glob('*.html') + glob.glob('admin/*.html')
for f in files:
    with open(f) as fh: c = fh.read()
    orig = c
    # Add loading="lazy" to img tags that don't have it
    # SKIP first img per page (assumed above fold)
    pattern = r'(<img(?![^>]*loading=)[^>]*?)(/?>)'
    matches = list(re.finditer(pattern, c))
    for m in matches[1:]:  # skip first
        new = m.group(1) + ' loading="lazy" decoding="async"' + m.group(2)
        c = c.replace(m.group(0), new, 1)
    if c != orig:
        with open(f, 'w') as fh: fh.write(c)
        print(f'  ✓ {f}')
PYEOF
```

---

## 📝 STEP 2 — Preload critical assets

In `<head>` of `index.html` (after `<meta>` tags, before `<link rel="stylesheet">`):

```html
<!-- Preload critical assets -->
<link rel="preload" as="image" href="assets/brand/fnb_water_logo.png" fetchpriority="high">
<link rel="preload" as="font" href="https://fonts.gstatic.com/s/cormorantgaramond/v18/co3bmX5slCNuHLi8bLeY9MK7whWMhyjornFLsS6V7w.woff2" type="font/woff2" crossorigin>
<link rel="preload" as="style" href="css/brand-tokens.css">
<link rel="preload" as="style" href="css/hero-v8-bazi.css">
```

Use `sed` or Python to insert:

```bash
python3 - <<'PYEOF'
preload_block = '''    <!-- Preload critical assets -->
    <link rel="preload" as="image" href="assets/brand/fnb_water_logo.png" fetchpriority="high">
    <link rel="preload" as="style" href="css/brand-tokens.css">
    <link rel="preload" as="style" href="css/hero-v8-bazi.css">

'''
with open('index.html') as f: c = f.read()
if 'preload' not in c:
    c = c.replace('<link rel="preconnect" href="https://fonts.googleapis.com">',
                  preload_block + '    <link rel="preconnect" href="https://fonts.googleapis.com">')
    with open('index.html', 'w') as f: f.write(c)
    print('✓ Preload block added')
else:
    print('✓ Preload already exists')
PYEOF
```

---

## 📝 STEP 3 — Add ARIA + semantic HTML

```bash
python3 - <<'PYEOF'
import re

with open('index.html') as f: c = f.read()
orig = c

# Add aria-label to icon-only buttons
c = re.sub(r'(<button[^>]*class="[^"]*hamburger[^"]*"[^>]*)>', r'\1 aria-label="Mở menu">', c)

# Wrap content in <main>
if '<main' not in c:
    c = c.replace('<section class="hero', '<main>\n<section class="hero', 1)
    c = c.replace('<footer', '</main>\n<footer', 1)
    # If no footer, close main before script
    if '</main>' not in c:
        c = c.replace('<script', '</main>\n<script', 1)

# Add role="navigation" to navbar
c = re.sub(r'(<div id="shared-navbar")', r'\1 role="navigation"', c)

# Add aria-hidden to decorative SVG/divs
for cls in ['light-shaft','particle','grain','vignette','color-grade','steam','reflection','specular',
            'surface-glow','tension-line','caustics','dimple','ripple-stage','shockwave',
            'crown','drop-trail','condensation','drop']:
    c = re.sub(rf'(<div class="[^"]*\b{cls}\b[^"]*")(?![^>]*aria-hidden)', r'\1 aria-hidden="true"', c)

if c != orig:
    with open('index.html', 'w') as f: f.write(c)
    print('✓ ARIA + semantic HTML added')
PYEOF
```

---

## 📝 STEP 4 — Schema.org JSON-LD

Append in `<head>` of `index.html`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CafeOrCoffeeShop",
  "name": "AURA CAFE",
  "description": "Rooftop Container Café với view đồng lúa, không gian industrial-luxury tại Sa Đéc",
  "image": "https://fnb-caffe-container.pages.dev/assets/brand/fnb_water_logo.png",
  "url": "https://fnb-caffe-container.pages.dev",
  "telephone": "+84-913-211-434",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Đường Hùng Vương",
    "addressLocality": "Sa Đéc",
    "addressRegion": "Đồng Tháp",
    "addressCountry": "VN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 10.289465,
    "longitude": 105.762950
  },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    "opens": "07:00",
    "closes": "22:00"
  }],
  "priceRange": "₫₫",
  "servesCuisine": ["Coffee","Tea","Beverages","Light Food"]
}
</script>
```

---

## 📝 STEP 5 — Robots.txt + sitemap audit

```bash
# Verify robots.txt allows main pages
cat robots.txt

# Update sitemap.xml lastmod
sed -i.bak "s|<lastmod>[^<]*</lastmod>|<lastmod>$(date -u +%Y-%m-%d)</lastmod>|g" sitemap.xml && rm sitemap.xml.bak
```

---

## 📝 STEP 6 — Run Lighthouse check (optional dry-run)

```bash
# If lighthouse CLI installed locally
which lighthouse && lighthouse https://fnb-caffe-container.pages.dev \
  --only-categories=performance,accessibility,seo \
  --output=json --output-path=./reports/lighthouse-pre.json 2>/dev/null || \
  echo "Lighthouse not installed — skip dry run"
```

---

## 📝 STEP 7 — Verify

```bash
# Image lazy loading
grep -c 'loading="lazy"' index.html  # Expect: >= 3

# Preload
grep -c 'rel="preload"' index.html   # Expect: >= 3

# Main element
grep -c '<main' index.html           # Expect: 1

# ARIA labels
grep -c 'aria-label\|aria-hidden\|role=' index.html  # Expect: >= 5

# Schema.org
grep -c "CafeOrCoffeeShop" index.html  # Expect: 1
```

---

## 📝 STEP 8 — Commit + Push + PR

```bash
git add index.html sitemap.xml
git commit -m "perf(web): lazy load, preload critical, ARIA, schema.org

- Image loading=\"lazy\" decoding=\"async\" below-the-fold
- Preload hero logo + critical CSS + Google Fonts
- Add <main> semantic wrapper
- ARIA labels on icon buttons + aria-hidden on decorative elements
- role=\"navigation\" on navbar
- Schema.org CafeOrCoffeeShop JSON-LD
- Refresh sitemap lastmod

Targeting Lighthouse 90+ Performance/Accessibility/SEO"

git push -u origin perf/optimize-bundle-a11y

gh pr create \
  --title "perf(web): X100 optimize — lazy load, preload, ARIA, Schema.org" \
  --base main \
  --head perf/optimize-bundle-a11y \
  --body "Phase 3 of AUDIT X100. Performance + Accessibility + SEO improvements. Lighthouse targets 90+."
```

---

## 📝 STEP 9 — Report

```
=== TASK 03/04 PERF + A11Y — DONE ===
Branch:        perf/optimize-bundle-a11y
Lazy load:     N images
Preloads:      3 (logo, brand-tokens, hero CSS)
ARIA tags:     M added
Schema.org:    CafeOrCoffeeShop ✓
PR URL:        <url>
=== END ===
```

---

## 🚫 OUT OF SCOPE

- ❌ KHÔNG đổi CSS files (Task 01+02)
- ❌ KHÔNG merge PR
- ❌ KHÔNG động worker/ (backend)
