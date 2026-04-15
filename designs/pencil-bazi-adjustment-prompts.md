# AURA SPACE — Bát Tự Adjustment Prompts (Pencil Cosmo)

> 📎 GHIM: `brand-thi-cong-specs.md` + `ARCHITECTURE.md`
> Paste TỪNG block. Đợi xong trước khi paste tiếp.

---

## PROMPT 1A — Color Palette Thủy (Chủ quán Còn)

```
Tạo page "02B — Color Palette Bát Tự" (1440×1080, fill #0A0A0A).

Header căn giữa:
- "COLOR PALETTE · BÁT TỰ" Cormorant Garamond 48px fill #FAF8F5.
- "Kim sinh Thủy · Thủy sinh Mộc" Space Grotesk 16px fill #888.
- Divider 200×1px fill #334155.

Section "壬 THỦY — CHỦ QUÁN" Space Grotesk 13px fill #6B9FB8 uppercase.
5 swatches ngang (140×140px, radius 12, gap 16):
- #050D1A label "Vực Thẳm"
- #0A1A2E label "Đêm Biển" badge "PRIMARY"
- #1A2A4E label "Đại Dương"
- #C9D6DF label "Bạc Kim" badge "ACCENT · Kim" note "Kim sinh Thủy ✓"
- #6B9FB8 label "Chrome" note "Accent Secondary"

Warning box (800×40px fill #0A1A2E radius 8 border 1px #1A2A4E):
"⚠️ Loại bỏ #FFD700 (Vàng/Thổ khắc Thủy). Thay bằng #C9D6DF (Bạc/Kim sinh Thủy)." 12px fill #6B9FB8.
```

---

## PROMPT 1B — Color Palette Mộc (Pha chế Tú) + Màu Cấm

```
Trên cùng page "02B", thêm bên dưới:

Section "乙 MỘC — PHA CHẾ TÚ" Space Grotesk 13px fill #4A7C59 uppercase.
4 swatches ngang (140×140px, radius 12, gap 16):
- #1A2D1F label "Rừng Sâu"
- #2D5A3D label "Forest" badge "MOC PRIMARY"
- #4A7C59 label "Jade"
- #A8C5A0 label "Sương Mai" note "Thủy sinh Mộc ✓"

Section "🚫 NGHIÊM CẤM" 13px fill #DC2626.
3 swatches (120×100px, opacity 60%, X overlay đỏ):
- #FFD700 "Vàng — Thổ khắc Thủy"
- #8B4513 "Nâu Đất — Thổ khắc Thủy"
- #FF6B35 "Cam Đỏ — Hỏa, hạn chế"

Footer: "Kim → Thủy → Mộc | ❌ Thổ khắc Thủy" 11px fill #444 căn giữa.
```

---

## PROMPT 2A — Zone Thủy (Lounge Còn)

```
Tạo page "05B — Spatial Zoning Bát Tự" (1440×1080, fill #0A0A0A).

Header: "SPATIAL ZONING · BÁT TỰ" Cormorant Garamond 44px fill #FAF8F5.
Layout 2 cột, gap 40.

Cột trái — card 620×600px fill #050D1A radius 16 border 2px #1A2A4E:
- Badge "壬 THỦY ZONE" fill #0A1A2E border #6B9FB8, 11px fill #6B9FB8.
- "LOUNGE & SEATING" Cormorant Garamond 28px fill #FAF8F5.
- "Container 40ft + Sân trống + Rooftop" 12px fill #6B9FB8.

4 color chips (60×60px): #0A1A2E, #1A2A4E, #C9D6DF, #334155.

Specs (icon + text 13px fill #9CA3AF):
- 🧭 "Mặt tiền TÂY — Kim sinh Thủy ✅"
- 🪟 "Kính cường lực, Inox, Gương"
- 💡 "LED xanh navy, deep house ambient"
- 🪑 "Bàn ghế tối, da navy"
```

---

## PROMPT 2B — Zone Mộc (Bar Tú) + Hóa Giải

```
Trên page "05B", cột phải — card 620×600px fill #0A150D radius 16 border 2px #2D5A3D:

- Badge "乙 MỘC ZONE" fill #1A2D1F border #4A7C59, 11px fill #4A7C59.
- "BAR COUNTER" Cormorant Garamond 28px fill #FAF8F5.
- "Cont 20ft Quầy Bar, cuối lô bên PHẢI" 12px fill #4A7C59.

Warning box (560×40px fill #1C1400 radius 8 border #854D0E):
"⚠️ Bar hướng NAM = Hỏa → rút năng lượng Tú. Hóa giải bên dưới." 11px fill #FDE68A.

4 color chips: #1A2D1F, #2D5A3D, #4A7C59, #A8C5A0.

Specs:
- 🧭 "Bar NAM (Hỏa) — cần hóa giải"
- 💧 "Bể nước nhỏ tại quầy (Thủy khắc Hỏa)"
- 🌿 "4-5 chậu cây lớn bao quanh (bù Mộc)"
- 🖤 "Tone: matte black + forest green, KHÔNG đỏ/cam"

Bottom note full width: "Mặt tiền TÂY = Kim sinh Thủy ✅ | Bar NAM = Hỏa ⚠️ hóa giải bằng Thủy+Mộc" 11px fill #F59E0B.
```

---

## PROMPT 3A — Menu Deep Series (Thủy · Còn)

```
Tạo page "07 — Menu Brand Series" (1440×900, fill #0A0A0A).

Header: "SIGNATURE MENU SERIES" Cormorant Garamond 44px fill #FAF8F5.
"Hai dòng sản phẩm theo DNA Ngũ Hành" 15px fill #666.

Cột trái — card 620×560px fill #050D1A radius 20 border 1px #1A2A4E:
Top bar 620×4px gradient #0A1A2E → #6B9FB8.

- "DEEP" Cormorant Garamond 72px fill #C9D6DF letterSpacing 8.
- "SERIES" Space Grotesk 16px fill #6B9FB8.
- "Cà phê đậm · Cold Brew · Dark Roast" 13px fill #6B9FB8.

3 mini cards (170×80px fill #0A1229 radius 10):
- "Dark Cold Brew — 55k"
- "Midnight Espresso — 45k"
- "Navy Tonic — 65k"

Packaging mockup: rect 100×140px fill #0A1A2E radius 8 stroke #C9D6DF, text "DEEP" vertical 24px.
Footer: "定 Còn định hướng" 11px fill #334155.
```

---

## PROMPT 3B — Menu Flow Series (Mộc · Tú)

```
Trên page "07", cột phải — card 620×560px fill #0A150D radius 20 border 1px #2D5A3D:
Top bar 620×4px gradient #2D5A3D → #A8C5A0.

- "FLOW" Cormorant Garamond 72px fill #A8C5A0 letterSpacing 8.
- "SERIES" Space Grotesk 16px fill #4A7C59.
- "Specialty · Botanical · Fruit Tea · Seasonal" 13px fill #4A7C59.

3 mini cards (170×80px fill #0D1A10 radius 10):
- "Forest Matcha Latte — 65k"
- "Jade Cold Brew — 70k"
- "Bamboo Tonic — 60k"

Packaging mockup: rect 100×140px fill #2D5A3D radius 8 stroke #A8C5A0, text "FLOW" vertical 24px.
Footer: "創 Tú sáng tạo" 11px fill #2D5A3D.

Tagline căn giữa bên dưới 2 cột: "Nơi dòng chảy gặp thiên nhiên" Cormorant Garamond 36px fill #FAF8F5 italic.
```

---

## PROMPT 4 — Do's & Don'ts

```
Tạo page "08B — Do's & Don'ts Bát Tự" (1440×900, fill #0A0A0A).
Header: "DO'S & DON'TS · BÁT TỰ" Cormorant Garamond 44px fill #FAF8F5.

2 cột, gap 48:

Cột trái — header rect 560×36px fill #14532D radius 8, "✅ NÊN" 13px fill #A8C5A0.
6 items (13px fill #D1FAE5):
- ✅ Accent Bạc/Chrome #C9D6DF (Kim sinh Thủy)
- ✅ Khu bar: gỗ + cây xanh (Mộc cho Tú)
- ✅ Mặt tiền TÂY giữ nguyên (Kim sinh Thủy)
- ✅ Bar NAM: hóa giải bằng bể nước + cây
- ✅ Deep Series (Còn) + Flow Series (Tú)
- ✅ Tuyển nhân sự mệnh Kim hoặc Mộc

Cột phải — header rect 560×36px fill #7F1D1D radius 8, "🚫 CẤM" 13px fill #FCA5A5.
6 items (13px fill #FEE2E2):
- 🚫 Accent vàng #FFD700 (Thổ khắc Thủy)
- 🚫 Gạch đất nung, đá nâu đỏ (Thổ)
- 🚫 Cam đỏ làm chủ đạo (Hỏa)
- 🚫 Ghi "Mộc sinh Thủy" — SAI, đúng: Kim sinh Thủy
- 🚫 Đèn đỏ/nến tại khu bar Nam (thêm Hỏa)
- 🚫 Mở rộng gấp 2026-2027 (Còn đang Hỏa vận)

Box đính chính (fill #1C1400 border #854D0E radius 10):
"⚠️ ĐÍNH CHÍNH: Guideline cũ ghi sai 'Mộc sinh Thủy'. Đúng: Kim → Thủy → Mộc" 12px fill #FDE68A.
```

---

## PROMPT 5 — Design Tokens

```
Tạo page "09 — Design Tokens v2" (1440×900, fill #0A0A0A).
Header: "DESIGN TOKENS v2.0" Cormorant Garamond 40px fill #FAF8F5.
"Copy-paste vào CSS · Bát Tự Edition" 13px fill #666.

Code block (1100×500px fill #0D0D0D radius 16 border 1px #1A1A1A, font Fira Code 13px):

:root {
  /* 壬 THỦY — Primary */
  --brand-primary: #050D1A;
  --brand-primary-mid: #0A1A2E;
  --brand-primary-light: #1A2A4E;
  /* Kim sinh Thủy — Accent */
  --brand-accent: #C9D6DF;
  --brand-accent-mid: #6B9FB8;
  --brand-accent-dark: #3A6B80;
  /* 乙 MỘC — Bar Zone */
  --brand-moc: #2D5A3D;
  --brand-moc-light: #4A7C59;
  --brand-moc-pale: #A8C5A0;
  /* Typography */
  --font-heading: 'Cormorant Garamond', serif;
  --font-body: 'Space Grotesk', sans-serif;
}

Bên phải code: 3 preview rects xếp dọc:
- 160×60px fill #0A1A2E label "THỦY"
- 160×60px fill #2D5A3D label "MỘC"
- 160×40px fill #FFD700 opacity 30% label "DEPRECATED ✕" strikethrough fill #DC2626.

Footer: "壬 Thủy × 乙 Mộc · AURA SPACE · 2026" 11px fill #333.
```
