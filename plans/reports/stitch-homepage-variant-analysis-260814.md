# Stitch Homepage Variant Analysis — AURA CAFE

**Project:** `7605682676390924803` | **Date:** 2026-08-14 | **Screens:** 8 desktop variants (2560px)

---

## Executive Summary

8 homepage desktop variants exist in Stitch for AURA CAFE. They fall into **3 design families** based on structure and content approach. Recommendation: merge best elements into **1 production variant**.

---

## Variant Inventory

| # | Name | Screen ID | Structure | Key Distinguisher |
|---|------|-----------|-----------|-------------------|
| 01 | Không gian thực tế | `0175d66b...` | Hero → 5 zones → 4 drinks → CTA | Real space photos, zone cards with individual images |
| 02 | Kiến trúc chuẩn 1:1 | `11d6fd75...` | Hero → 5 zones → 4 drinks → CTA | Same as 01 but different photo arrangements in zone grid |
| 03 | Cập nhật Menu Nối Bật | `bc4bcc4a...` | Hero → 5 zones → 4 drinks → CTA | ⚠️ "VIVA STAR COFFEE" visible in hero (neighboring business artifact) |
| 04 | Heritage & Focus | `45da2727...` | Hero → 5 zones → 4 drinks → CTA | More refined drink photography, same 5-zone structure |
| 05 | Ảnh thực tế | `9ada51df...` | Hero → 5 zones → 4 drinks → CTA | Clean layout, real photos, balanced zone card sizes |
| 06 | Default | `d518e2de...` | Hero → 5 zones → 4 drinks → CTA | ⚠️ "VIVA STAR COFFEE" in hero + nav, generic zone cards |
| 07 | Branding Refined | `f6b607cd...` | **Different structure** — Hero → 4 feature cards → 3 drinks → Black Card CTA | Clean branding, no 5-zone grid, "AURA Black Card" section |
| 08 | Logo Animation Effect | `7da9055b...` | **Same as 07** — Hero → 4 feature cards → 3 drinks → Black Card CTA | ⚠️ "VIVA STAR COFFEE" artifact in hero, same structure as 07 |

---

## Design Families

### Family A: "5 Zones" (Variants 01-06)
**Structure:** Hero banner → "5 Không Gian Trải Nghiệm" grid → "Món Được Yêu Thích Nhất" drinks → "Ưng Là Có Liền" CTA

**Hero tagline:** "KHÔNG GIAN CÀ PHÊ INDUSTRIAL LUXURY ĐỘC BẢN"

**Sections:**
1. Hero with atmospheric container café photo
2. 5 zone cards (Tầng Thượng, Khu Trong Nhà, Sân Trước, Sân Vườn, Khu Vực Mở)
3. 4 featured drinks with photos + prices
4. CTA banner

**Variations within family:**
- Photo quality/realism varies (01, 04, 05 use better real photos)
- 03 and 06 have **VIVA STAR COFFEE artifact** — neighboring business sign visible in hero → must be avoided
- Zone card sizing and photo cropping differ slightly

### Family B: "4 Features + Black Card" (Variants 07-08)
**Structure:** Hero → "Signature Coffee" / "Loyalty Rewards" / "Industrial Design" / "Rooftop View" feature cards → "Curated Selection" drinks → "AURA Black Card" CTA

**Hero tagline:** "AURA CAFE — Rooftop Container Café"

**Key differences from Family A:**
- Uses **AURA logo** in nav (not just text)
- **"Rooftop Container Café"** subtitle — more concise positioning
- **4 feature pillars** instead of 5 zone grid — more abstract/branding-focused
- **"AURA Black Card"** section replaces generic CTA — premium positioning
- Drinks section called **"Curated Selection"** — different tone
- **"FULL MENU"** link in drinks section
- Footer shows address: **ĐƯỜNG NGUYỄN TẤT THÀNH, TP. SA ĐÉC, TỈNH ĐỒNG THÁP**

**Variant 08 has VIVA STAR COFFEE artifact** in hero, same as 03/06.

---

## Quality Assessment

| Criteria | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 |
|----------|----|----|----|----|----|----|----|----|
| Photo quality | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| Brand consistency | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| VIVA artifact | ✅ Clean | ✅ Clean | ❌ **YES** | ✅ Clean | ✅ Clean | ❌ **YES** | ✅ Clean | ❌ **YES** |
| Layout balance | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Premium feel | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Content completeness | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |

**Eliminated:** 03, 06, 08 (VIVA STAR COFFEE artifact — cannot use in production)

---

## Recommendation: Merge Best Elements

### Winner Base: **Variant 07 (Branding Refined)**

**Why:**
1. **Strongest brand identity** — AURA logo in nav, "Rooftop Container Café" positioning, Black Card CTA
2. **Cleanest layout** — 4 feature pillars communicate value faster than 5 zone cards
3. **No photo artifacts** — clean hero image
4. **Premium positioning** — "Curated Selection" + "Black Card" = luxury feel matching "Industrial Noir" theme
5. **Best visual hierarchy** — clear sections with distinct purposes

### From Family A (01/04/05) to merge into Variant 07:
1. **5 zone cards as secondary section** — add below the 4 feature pillars (family B lacks the spatial/zone storytelling)
2. **Real café photos from 04 or 05** — use the best quality real-space photos for zone cards
3. **4 featured drinks with prices** — family A shows prices more prominently (important for F&B conversion)

### From the existing codebase (StitchContainerNew2):
1. **Mobile-first responsive layout** — already implemented, ensure variant 07 structure maps to it
2. **Glassmorphism cards** — keep the existing `backdrop-blur-xl` pattern
3. **Color tokens** — maintain `#041428` bg, `#C9D6DF` chrome-silver, `#E8C547` gold accents

---

## Action Items

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Mark variants 03, 06, 08 as hidden in Stitch (VIVA artifact) | 5 min |
| P1 | Create final production variant merging 07 + 01/04/05 | 30 min via Stitch |
| P1 | Update StitchContainerNew2.tsx to match final structure | 2-4h |
| P1 | Rename "AURA Black Card" → "AURA Loyalty" in variant 07 | 5 min |
| P2 | Download HTML from variant 07 for code reference | 10 min |
| P2 | Generate mobile variants from final desktop | 15 min via Stitch |
| P3 | Mark redundant variants (01, 02, 04, 05) as hidden after final confirmed | 5 min |

---

## Decision Log (User-Confirmed 2026-08-14)

| Decision | Choice |
|----------|--------|
| Hero text | "AURA CAFE — Rooftop Container Café" (from Variant 07) |
| Layout | **Both** — 4 feature pillars (07) + 5 zone cards (01/04/05) |
| Loyalty CTA | Rename "AURA Black Card" → **"AURA Loyalty"** / "Tích điểm" |
| VIVA variants (03/06/08) | **Keep, mark hidden** in Stitch project |

## Final Recommended Structure

```
1. NAVBAR          — AURA logo + menu items + phone CTA
2. HERO            — "AURA CAFE — Rooftop Container Café" + atmospheric photo
3. 4 FEATURE PILLARS (from 07):
   ├── Specialty Coffee
   ├── Loyalty Rewards
   ├── Industrial Design
   └── Rooftop View
4. 5 ZONE CARDS (from 01/04/05):
   ├── Tầng Thượng
   ├── Khu Trong Nhà
   ├── Sân Trước
   ├── Sân Vườn
   └── Khu Vực Mở
5. CURATED SELECTION (from 07) — with prices (from Family A):
   ├── Cold Open pour Over — 55K
   ├── Golden Matcha — 65K
   └── Orange Americano — 50K
6. AURA LOYALTY CTA (renamed from "Black Card" → loyalty program positioning)
7. FOOTER          — Address, social links
```

---

## Unresolved Questions
None — all decisions confirmed by user.
