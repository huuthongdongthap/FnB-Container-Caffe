# AURA SPACE — Frontend Code Rebranding Plan

> **Executor:** CTO Worker (Claude Code CLI + Qwen 3.5:27B)  
> **Codebase:** `/Users/mac/mekong-cli/FnB-Container-Caffe/`  
> **Mục tiêu:** Rebrand toàn bộ frontend code từ "F&B Container Café" → "AURA SPACE" + sửa kiến trúc sai

---

## TỔNG QUAN

- **91 old brand refs** + **20 architecture refs sai** cần sửa
- **14 HTML** + **8 JS** + **5 config files** bị ảnh hưởng
- Không thay đổi logic, chỉ thay text + colors + metadata

---

## TASK 1: Global Text Replace (Tên + Brand)

**Scope:** Tất cả `.html`, `.js`, `.css`, `.json`, `.xml`, `.txt`, `.toml` (trừ `node_modules/`, `.min.js`)

```
Tìm & thay (case-sensitive, theo thứ tự):
"F&B CAFFE CONTAINER"    → "AURA SPACE"
"F&B Container Café"     → "AURA SPACE"  
"F&B Caffe Container"    → "AURA SPACE"
"F&B Container"          → "AURA SPACE"
"F&B Caffe"              → "AURA SPACE"
"F&B CONTAINER"          → "AURA SPACE"
"Container Café"         → "AURA SPACE"
"Container Caffe"        → "AURA SPACE"
"FnB Container"          → "AURA SPACE"
"fnb-caffe-container"    → "aura-space-sadec"
"fnbcontainer.vn"        → "auraspace.vn"
"FNB_DEBUG"              → "AURA_DEBUG"
"F&B Loyalty Club"       → "AURA LOYALTY"
"F&B LOYALTY CLUB"       → "AURA LOYALTY"
"cyberpunk"              → "industrial-luxury"
```

**Files ảnh hưởng chính (số refs):**
- `index.html` (13), `project-brief.html` (11), `loyalty.html` (8)
- `about-us.html` (5), `admin/dashboard.html` (4)
- `js/loyalty-ui.js` (5), `js/checkout.js` (2), `js/config.js` (1)
- `js/sw.js` (2), `js/kds-app.js` (1), `js/api-client.js` (1)
- `css/styles.css` (1), `manifest.json` (2), `package.json` (2)
- `wrangler.toml` (1), `sitemap.xml` (1), `robots.txt` (1), `_redirects` (1)

---

## TASK 2: Sửa Kiến Trúc Sai (Architecture)

**Scope:** Chỉ files có ref "3 tầng/400m²/Work Zone/Meeting Room"

### 2.1 `index.html`
```
Dòng ~9:  "cyberpunk" → "industrial-luxury"
Dòng ~18: "container 3 tầng" → "container industrial-luxury"
Dòng ~28: "container 3 tầng" → "container industrial-luxury" 
Dòng ~52: "cyberpunk" → "industrial-luxury"
Dòng ~313: "kiến trúc container 3 tầng" → "kiến trúc container 1 trệt + rooftop"
Dòng ~322: "10×40m" → "8.3×23m"
Dòng ~388-415: Xoá toàn bộ block "Work Zone" + "Meeting Room" cards
  Thêm 2 cards mới:
  - "Phòng Kính" — Kính cường lực 8.3×6m · Trên nóc 2 cont 20ft
  - "Sân Trống" — Ngoài trời 14.7m · Đỗ xe · Ngồi ngoài
```

### 2.2 `about-us.html`
```
Dòng ~9:  "3 tầng" → "1 trệt + rooftop"
Dòng ~412: "400m²" → "~183m²", "3 tầng từ container" → "container 40ft + 2×20ft"
```

### 2.3 `layout-2d-4k.html`
```
Xoá "Meeting Room" block. Sửa layout theo blueprint 8.3×23m.
```

### 2.4 `layout-3d.html`
```
Legend: xoá "Meeting Room (20ft)". Thêm "Phòng Kính (8.3×6m)"
```

### 2.5 `project-brief.html`
```
"10×40m (400m²)" → "8.3×23m (~183m²)"
"400m²" → "~183m²"
Xoá "Meeting Room" từ danh sách zones + revenue streams
Thay "Coding Zone" → "Glass Room"
```

---

## TASK 3: Sửa Colors & Manifest (PWA)

### 3.1 `manifest.json`
```json
{
  "name": "AURA SPACE",
  "short_name": "AURA SPACE",
  "description": "Container café industrial-luxury tại Sa Đéc, Đồng Tháp",
  "background_color": "#0A0A0A",
  "theme_color": "#0A0A0A"
}
```

### 3.2 `css/styles.css` — Sửa color variable
```
--coffee-accent: #C9A87C  →  --coffee-accent: #C9A962
```

### 3.3 Rebuild minified files
```bash
# Sau khi sửa xong tất cả .js và .css, rebuild:
cd FnB-Container-Caffe
npm run build
```

---

## TASK 4: Cập nhật SEO Metadata

### `sitemap.xml`
```
"F&B Container Café" → "AURA SPACE"
```

### `robots.txt`
```
"F&B Caffe Container" → "AURA SPACE"
```

### `_redirects`
```
"F&B Caffe Container" → "AURA SPACE"
```

---

## VERIFICATION

Sau khi hoàn thành, chạy verify:

```bash
cd /Users/mac/mekong-cli

# 1. Kiểm tra ZERO old brand refs còn sót
grep -rn "F&B\|Container Café\|Container Caffe\|FnB\|fnb-caffe\|cyberpunk" \
  FnB-Container-Caffe/*.html FnB-Container-Caffe/admin/*.html \
  FnB-Container-Caffe/js/*.js FnB-Container-Caffe/css/styles.css \
  FnB-Container-Caffe/manifest.json FnB-Container-Caffe/package.json \
  FnB-Container-Caffe/wrangler.toml FnB-Container-Caffe/sitemap.xml \
  FnB-Container-Caffe/robots.txt FnB-Container-Caffe/_redirects \
  | grep -v node_modules | grep -v ".min.js" | grep -v ".min.css"
# Expected: 0 results

# 2. Kiểm tra ZERO architecture sai
grep -rn "3 tầng\|3 Tầng\|400m²\|10×40\|Work Zone\|Meeting Room\|VIP Lounge" \
  FnB-Container-Caffe/*.html FnB-Container-Caffe/admin/*.html \
  | grep -v ".min."
# Expected: 0 results

# 3. Xác nhận brand gold color đã đúng
grep -n "C9A87C" FnB-Container-Caffe/css/styles.css
# Expected: 0 results (đã đổi thành C9A962)

# 4. Build check
cd FnB-Container-Caffe && npm run build
# Expected: no errors
```

---

## THỨ TỰ THỰC HIỆN

```
1. Task 1 (Global replace)   — sed/ripgrep batch, ~5 phút
2. Task 2 (Architecture)     — Manual edit 5 files, ~10 phút
3. Task 3 (Colors+Manifest)  — 3 files, ~2 phút
4. Task 4 (SEO)              — 3 files, ~1 phút
5. Verification              — grep + build, ~2 phút
6. Rebuild minified           — npm run build
```

> ⏱️ Tổng: ~20 phút cho CTO worker
