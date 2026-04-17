# Task 11.3 — DEEP FIX: Loyalty Page CSS (Root Cause Analysis)

## ⚠️ CONTEXT: Đã fix 3 lần nhưng vẫn lỗi
Nguyên nhân các lần fix trước thất bại: CSS files **LOAD THÀNH CÔNG** (3 files, 48KB) nhưng render ra **giao diện trắng, không có style** vì **CSS variable mismatch**.

## ROOT CAUSE ANALYSIS

### Vấn đề cốt lõi: Light Theme M3 vs Dark Cyber-Glass

Trang Loyalty dùng 3 CSS files:
1. `styles.css` (35KB) — Global styles, định nghĩa `:root` với **M3 Light Theme**:
   ```css
   :root {
     --md-sys-color-primary: #6f4e37;      /* Coffee Brown */
     --md-sys-color-background: #fffbfe;   /* TRẮNG! */
     --md-sys-color-surface: #fffbfe;      /* TRẮNG! */
   }
   body { background-color: var(--md-sys-color-background); }  /* → White */
   ```

2. `loyalty-styles.css` (9KB) — Dùng vars Dark theme KHÔNG được định nghĩa:
   ```css
   .loyalty-hero { background: var(--glass-background); }  /* ← UNDEFINED! */
   .glass-card { backdrop-filter: blur(var(--glass-blur)); }  /* ← UNDEFINED! */
   ```

3. `loyalty-m3.css` (9KB) — Overrides lại M3 vars thành Light:
   ```css
   :root {
     --md-sys-color-surface: #fffbfe;  /* White lại! */
   }
   ```

### So sánh với trang Index (HOẠT ĐỘNG ĐÚNG)
Trang `index.html` dùng **riêng** `css/index.css` chứa block `:root` đầy đủ dark theme:
```css
:root {
  --bg-dark: #0A0A0A;
  --glass-background: rgba(255,255,255,0.05);
  --glass-blur: 20px;
  --text-primary: #f5f5f5;
  --warm-amber: #C9A962;
}
body { background: var(--bg-dark); color: var(--text-primary); }
```
→ Loyalty **KHÔNG CÓ** file CSS nào định nghĩa các vars dark theme này.

## FIX PLAN

### Bước 1: Xác định CSS vars bị thiếu
```bash
# Liệt kê tất cả CSS vars được DÙNG trong loyalty-styles.css nhưng KHÔNG ĐƯỢC ĐỊNH NGHĨA
grep -oE 'var\(--[a-z_-]+\)' css/loyalty-styles.css | sort -u
```

### Bước 2: Thêm Dark Theme vars vào loyalty-styles.css
Thêm block `:root` vào **đầu** file `css/loyalty-styles.css` với đầy đủ Cyber-Glass dark tokens:
```css
/* ═══ Cyber-Glass Dark Theme Tokens ═══ */
:root {
  --bg-dark: #0A0A0A;
  --bg-surface: #1A1A1A;
  --glass-background: rgba(255, 255, 255, 0.05);
  --glass-blur: 20px;
  --glass-border: rgba(255, 255, 255, 0.08);
  --text-primary: #f5f5f5;
  --text-secondary: rgba(245, 245, 245, 0.7);
  --text-dim: rgba(245, 245, 245, 0.4);
  --warm-amber: #C9A962;
  --warm-gold: #D4AF37;
  --warm-coral: #E07A5F;
  --warm-terracotta: #C67A4B;
  --sage: #87A96B;
  --cyber-glow: rgba(201, 169, 98, 0.3);
}
```

### Bước 3: Override body background
Trong `css/loyalty-styles.css`, thêm:
```css
body {
  background-color: #0A0A0A !important;
  color: #f5f5f5 !important;
}
```
Lý do: `styles.css` set `body { background: var(--md-sys-color-background) }` = white. Cần override.

### Bước 4: Kiểm tra TẤT CẢ trang khác cùng pattern
```bash
# Tìm trang nào KHÔNG import index.css (thiếu dark vars)
for f in *.html; do
  if ! grep -q 'index.css\|index-' "$f" 2>/dev/null; then
    echo "⚠️ $f — Không có dark theme CSS"
  fi
done
```
Các trang có thể cũng bị: `checkout.html`, `about-us.html`, `contact.html`, `reservation.html`

### Bước 5: Build + Deploy
```bash
npm run build
cd worker && npx wrangler deploy && cd ..
npx wrangler pages deploy dist --project-name=fnb-caffe-container
```

## Verify Checklist
- [ ] `/loyalty` — Background #0A0A0A (dark), text #f5f5f5 (light), glass cards hiện đúng
- [ ] `/loyalty` — Tier cards có border, hover effect, gradient
- [ ] `/` — Trang chủ vẫn OK (không bị ảnh hưởng)
- [ ] `/menu` — Menu vẫn OK
- [ ] `/dashboard/admin` — Admin SPA tabs hoạt động
