# 🏷 TASK 06 — Rename "AURA SPACE" → "AURA CAFE" toàn web

> **Target repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch:** `feat/rename-aura-cafe`
> **Estimated:** 5-7 phút worker autonomous
> **Priority:** P0 (blocker cho v6 brand)

---

## 🎯 Context

Anh Còn quyết định rename brand chính thức:
- **Cũ:** AURA SPACE (tên tạm trong dev)
- **Mới:** AURA CAFE (brand chính thức public)

Lý do: "Viva Star Coffee" là tên cafe nhượng quyền (đã hết hợp đồng, chỉ giữ source cafe). Brand mới chính thức của anh Còn là **AURA CAFE** — Container Rooftop Café tại Sa Đéc, Đồng Tháp.

---

## 📋 Task Steps

### Step 1: Load context
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
cat CLAUDE.md  # Behavior protocol
git status
git checkout main && git pull origin main
git checkout -b feat/rename-aura-cafe
```

### Step 2: Find ALL occurrences
```bash
# Generate full list để verify scope
grep -rn "AURA SPACE\|Aura Space\|aura space\|AURA_SPACE\|aura-space" \
  --include="*.html" --include="*.css" --include="*.js" --include="*.json" --include="*.md" \
  --include="*.toml" --include="*.yaml" --include="*.yml" \
  . | grep -v node_modules | grep -v ".git/" > /tmp/aura-occurrences.txt
cat /tmp/aura-occurrences.txt
```

### Step 3: Replace mappings

| Original | Replacement | Lý do |
|---|---|---|
| `AURA SPACE` | `AURA CAFE` | Brand name display |
| `Aura Space` | `Aura Cafe` | Title case |
| `aura space` | `aura cafe` | Lowercase prose |
| `AURA_SPACE` | `AURA_CAFE` | Constants/env var (chỉ nếu có) |
| `aura-space` | `aura-cafe` | Slugs/class names (CHỈ trong css class hoặc URL slug) |

**KHÔNG đổi:**
- Repo name (`FnB-Container-Caffe` giữ nguyên)
- Project name trên Cloudflare (`fnb-caffe-container` giữ nguyên)
- File paths đã có sẵn
- Domain (`fnb-caffe-container.pages.dev` giữ nguyên — đó là URL technical)

### Step 4: Update files (sed batch)

```bash
# HTML files
find . -name "*.html" -not -path "./node_modules/*" -not -path "./.git/*" -exec \
  sed -i.bak \
    -e 's/AURA SPACE/AURA CAFE/g' \
    -e 's/Aura Space/Aura Cafe/g' \
    -e 's/aura space/aura cafe/g' \
    {} \;

# CSS files (chỉ comments + content strings, KHÔNG đổi class .aura-space-xxx nếu có)
find . -name "*.css" -not -path "./node_modules/*" -not -path "./.git/*" -exec \
  sed -i.bak \
    -e 's/AURA SPACE/AURA CAFE/g' \
    -e 's/Aura Space/Aura Cafe/g' \
    {} \;

# JS files
find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" -exec \
  sed -i.bak \
    -e 's/AURA SPACE/AURA CAFE/g' \
    -e 's/Aura Space/Aura Cafe/g' \
    {} \;

# JSON files (manifest, package.json description)
find . -name "*.json" -not -path "./node_modules/*" -not -path "./.git/*" -exec \
  sed -i.bak \
    -e 's/AURA SPACE/AURA CAFE/g' \
    -e 's/Aura Space/Aura Cafe/g' \
    {} \;

# Markdown
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" -exec \
  sed -i.bak \
    -e 's/AURA SPACE/AURA CAFE/g' \
    -e 's/Aura Space/Aura Cafe/g' \
    {} \;

# Clean .bak files
find . -name "*.bak" -delete
```

### Step 5: Manual review critical files
Mở 3 file quan trọng nhất + verify display rendering correct:

1. `index.html`:
   - `<title>` tag
   - `<meta name="description">`
   - `<meta property="og:title">`, `og:site_name`
   - `<meta name="twitter:title">`
   - `<h1>` hero
   - `<footer>` brand text
   - Schema.org JSON-LD: `"name": "AURA CAFE"`, `"alternateName"` nếu có

2. `dashboard.html` / `pos.html` (admin pages):
   - Header brand text
   - Footer

3. `manifest.json` / `package.json`:
   - `name`, `short_name`, `description`

### Step 6: Verify build & visual
```bash
# Quick local serve
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 2

# Curl + check no stale "AURA SPACE" trong response
curl -s http://localhost:8000/index.html | grep -i "aura space" && echo "❌ STILL HAS AURA SPACE" || echo "✅ Clean"
curl -s http://localhost:8000/index.html | grep -i "aura cafe" | head -5

kill $SERVER_PID
```

### Step 7: Commit + PR

```bash
git add -A
git status

# Commit message
git commit -m "$(cat <<'EOF'
feat(brand): rename AURA SPACE → AURA CAFE toàn web

Why:
- "Viva Star Coffee" là tên cafe nhượng quyền cũ (đã hết hợp đồng)
- Brand mới chính thức của anh Còn: AURA CAFE
- Container Rooftop Café tại Sa Đéc, Đồng Tháp

Scope:
- index.html: title, meta tags, og:tags, hero, footer, Schema.org
- dashboard.html, pos.html: admin header/footer
- manifest.json, package.json: name + description
- *.md docs: brand references
- *.css: comments + content strings
- *.js: log messages + UI strings

Không đổi:
- Repo name: FnB-Container-Caffe
- Cloudflare project: fnb-caffe-container
- Domain: fnb-caffe-container.pages.dev
- CSS class selectors (giữ technical compat)
EOF
)"

git push -u origin feat/rename-aura-cafe

gh pr create --base main --head feat/rename-aura-cafe \
  --title "feat(brand): rename AURA SPACE → AURA CAFE toàn web" \
  --body "$(cat <<'EOF'
## Summary
Rename brand chính thức từ AURA SPACE → AURA CAFE.

## Why
- Brand cũ (Viva Star nhượng quyền) đã hết
- Brand mới của anh Còn: **AURA CAFE** — Container Rooftop Café Sa Đéc

## Scope
- ✅ index.html (title, meta, og, hero, footer, Schema.org)
- ✅ Admin pages (dashboard, pos)
- ✅ Config files (manifest, package)
- ✅ Documentation (.md)
- ✅ CSS comments + content strings
- ✅ JS strings

## Not changed
- Repo name, Cloudflare project, domain (technical compat)
- CSS class selectors (no functional change)

## Test plan
- [ ] grep "AURA SPACE" → 0 results
- [ ] grep "AURA CAFE" → expected ~30+ results
- [ ] Open index.html → all text shows AURA CAFE
- [ ] Schema.org JSON-LD valid
- [ ] Cloudflare auto-deploy success
EOF
)"
```

### Step 8: Wait for review

Anh review PR trên GitHub → merge → Cloudflare auto-deploy → hard refresh `https://fnb-caffe-container.pages.dev` → verify text changed.

---

## ✅ Acceptance criteria

- [ ] `grep -r "AURA SPACE" .` → 0 results (trừ git history)
- [ ] All public-facing text: AURA CAFE
- [ ] Schema.org `"name": "AURA CAFE"`
- [ ] og:title, twitter:title updated
- [ ] No broken layout (text length không thay đổi đáng kể: 10 chars → 9 chars)
- [ ] PR merged + Cloudflare deployed

---

## 🆘 Edge cases

**Nếu có CSS class `.aura-space-*` nào:** GIỮ NGUYÊN (technical compat). Chỉ đổi content text trong HTML attributes như `aria-label`, `title`, `alt`.

**Nếu logo SVG có text "AURA SPACE":** Đổi text element nhưng giữ design intact.

**Nếu trong worker code có constants `AURA_SPACE`:** Đổi sang `AURA_CAFE` + update tất cả import/usage.
