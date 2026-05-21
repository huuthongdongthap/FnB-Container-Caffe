# Brand v5 BAZI-ALIGNED · Plan thực thi

**Source of truth:**
- `report-nguyen-huu-con.html` — bát tự chi tiết
- `pencil-bazi-adjustment-prompts.md` — color rules đã đính chính

**Nhật chủ:** 壬 Thủy Dương (Anh Nguyễn Hữu Còn, 8/2/1982 21:00)
**Đại vận:** 丙午 Bính Ngọ (Hỏa vận, 2020-2029) → **tránh tuyệt đối Hỏa + Thổ**

---

## 1. Color Tokens (FINAL)

```css
/* 壬 THỦY — Nhật chủ (PRIMARY) */
--noir-void:        #050D1A;  /* Vực Thẳm */
--noir-deep:        #0A1A2E;  /* Đêm Biển — PRIMARY */
--noir-mid:         #1A2A4E;  /* Đại Dương */
--noir-steel:       #334155;  /* Hover surface */

/* 庚辛 KIM — Accent (Kim sinh Thủy ✓) */
--chrome-light:     #C9D6DF;  /* Bạc Kim — MAIN ACCENT */
--chrome-mid:       #6B9FB8;  /* Chrome */
--chrome-dark:      #3A6B80;  /* Steel blue */

/* 乙 MỘC — Bar zone (cân bằng nhân sự Hỏa) */
--moc-deep:         #1A2D1F;  /* Rừng Sâu */
--moc-primary:      #2D5A3D;  /* Forest */
--moc-light:        #4A7C59;  /* Jade */
--moc-pale:         #A8C5A0;  /* Sương Mai */

/* Text */
--text-primary:     #F5F5F5;
--text-body:        #C5C8CC;
--text-muted:       #8A8E96;

/* Semantic */
--success: #4CAF50;
--danger:  #DC2626;
--info:    #6B9FB8;  /* Chrome (Kim) */

/* 🚫 BANNED COLORS — không dùng */
/* #FFD700, #D4AF37, #B8860B  — Gold/Thổ → khắc Thủy */
/* #FF6B35, #FF1744           — Cam đỏ/Hỏa → hao Thủy */
/* #8B4513, #C9A200, #C9A962  — Nâu đất/Thổ */
```

## 2. Typography

```css
--font-display: 'Cormorant Garamond', serif;     /* Heading - thanh thoát */
--font-body:    'Space Grotesk', sans-serif;     /* Body - clean modern */
--font-mono:    'JetBrains Mono', monospace;     /* Tech/prices */
```

→ Loại Playfair Display, Cinzel, Manrope, Inter (không bám bát tự specs)

## 3. Spatial Zoning

| Zone | Element | Palette | Mục đích |
|---|---|---|---|
| Lounge (Cont 40ft + sân + rooftop) | 壬 Thủy | Navy + Chrome | Chủ đạo, không gian chính |
| Bar Counter (Cont 20ft) | 乙 Mộc | Forest + Jade | Hóa giải hướng Nam (Hỏa) + cân bằng nhân sự Hỏa (Anh Thư) |
| Mặt tiền TÂY | 庚 Kim | Inox + Chrome | Kim sinh Thủy ✓ |

**Hóa giải bar Nam:** Bể nước nhỏ (Thủy khắc Hỏa) + 4-5 chậu cây lớn (bù Mộc)

## 4. Menu 2 Series

**DEEP Series (Thủy · Anh Còn):**
- Dark Cold Brew — 55k
- Midnight Espresso — 45k
- Navy Tonic — 65k
- Packaging: Navy/Đen matte + viền bạc kim loại

**FLOW Series (Mộc · Bar):**
- Forest Matcha Latte — 65k
- Jade Cold Brew — 70k
- Bamboo Tonic — 60k
- Packaging: Forest green matte + viền chrome

## 5. Decoupling Minh Tú

Mộc Zone GIỮ với rationale mới (không phụ thuộc cá nhân):
- Cần để hóa giải hướng Nam (Hỏa) tự nhiên của bar
- Cần để cân bằng nhân sự Hỏa (Hồ Anh Thư đã đang dùng phương pháp Mộc thông quan)
- Tuyển pha chế mới: ưu tiên mệnh **Kim hoặc Mộc** (per pencil specs)

## 6. Logo Identity

- **GIỮ 100%** logo PNG hiện tại (anh đã quyết)
- DNA: water ripple + chữ A bạc → đúng Thủy + Kim
- Năm: EST. 2018

## 7. Files cần update

### Repo `FnB-Container-Caffe`:
- [ ] `css/brand-tokens.css` v4.0 → **v5.0 BAZI-CORRECT**
- [ ] `index.html` — replace gold hex → chrome hex
- [ ] `menu.html`, `checkout.html`, `success.html`, `failure.html`, `loyalty.html`, `track-order.html`, `kds.html`, `table-reservation.html`, `about-us.html`, `contact.html`, `brand-guideline.html` — replace gold hex
- [ ] `admin/*.html` — replace gold hex
- [ ] Google Fonts imports: Playfair → Cormorant Garamond + Space Grotesk
- [ ] Brand-guideline.html — update palette section + add Bát tự rationale + Do's/Don'ts page
- [ ] About-us.html — update narrative DNA Thủy
- [ ] CHANGELOG.md — log v5 BAZI-ALIGNED entry

### Demo file:
- [x] `hero-ripple-demo.html` — REWRITE v8 Chrome (em đang làm)

## 8. Hero Animation v8 BAZI

Chuyển toàn bộ gold → chrome:
- Drop liquid: gold gradient `#FFE970→#FFD700→#B8860B` → **chrome `#E8EEF3→#C9D6DF→#6B9FB8`**
- Logo glow: `rgba(255,215,0,.7)` → **`rgba(201,214,223,.6)`**
- Surface tension: gold thread → **chrome thread**
- Crown splash: cream-gold → **chrome-white**
- Specular sweep: gold sheen → **chrome sheen**
- Ripples: `#D4AF37/#B8860B` → **`#C9D6DF/#6B9FB8`**
- Particles: gold dust → **chrome dust**
- Light shaft: gold beam → **cool blue-chrome beam**
- Reflection: sepia gold → **cool blue undertone**

## 9. Strategy: 1 Big PR or Multiple Small?

**Em đề xuất 1 BIG PR `feat/brand-v5-bazi-aligned`** vì:
- Tất cả changes liên quan (palette, font, hex replace) — phải đi cùng nhau
- Tránh state mixed (gold + chrome cùng lúc = lộ tẹt)
- 1 PR review easier than 5 small ones

**PR scope:**
- 1 commit: brand-tokens.css v5
- 1 commit: hex replace toàn HTMLs
- 1 commit: Google Fonts imports
- 1 commit: brand-guideline.html update
- 1 commit: hero v8 chrome (apply vào index.html)

## 10. Khai trương đề xuất

Per Hoàng lịch trong report — 5 ngày tốt:
- ⭐ **22/4/2026** Thứ 4 (Bính Dần) — RECOMMENDED
- ⭐ 23/4/2026 Thứ 5 (Đinh Mão)
- ⭐ 25/4/2026 Thứ 7 (Kỷ Tỵ)
- ⭐ 26/4/2026 Chủ nhật (Canh Ngọ)
- ⭐ 29/4/2026 Thứ 4 (Quý Dậu)

---

## ✅ NEXT STEPS

1. Em rewrite `hero-ripple-demo.html` v8 BAZI Chrome
2. Anh xem demo
3. Confirm → em push PR `feat/brand-v5-bazi-aligned` toàn site

**Cần anh confirm 3 điều trước khi em làm:**
- ✅ Revert v4 Gold → v5 Chrome (Bạc/Kim) theo bát tự
- ✅ Giữ Mộc Zone với rationale mới (decouple khỏi Tú)
- ✅ Đổi font Playfair → Cormorant Garamond + Space Grotesk

Sau khi anh OK, em làm 1 mạch.
