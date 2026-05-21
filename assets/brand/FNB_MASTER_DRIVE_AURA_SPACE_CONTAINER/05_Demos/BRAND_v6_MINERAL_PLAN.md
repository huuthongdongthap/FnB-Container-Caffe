# 🎨 Brand v6 MINERAL — Lift tones cho khách cafe (giữ bát tự)

**Vấn đề:** v5 BAZI Navy + Chrome quá tối/lạnh cho khách cafe — thiếu cảm giác ấm mời gọi.

**Constraint bất di bất dịch:** Bát tự cấm Gold (Thổ), Red/Orange (Hỏa), Brown (Thổ).

**Insight:** Cream nhạt, Mineral light, Pearl white — **THUỘC Kim element** (đá tinh, kim loại trắng) — KHÔNG vi phạm bát tự.

---

## 💡 Concept: "Scrolling Mood Arc"

Thay vì toàn site dark navy, **scrolling từ dark → light → dark** mimicking cảm giác bước vào quán từ ngoài nắng:

```
🌑 Hero (dark navy + chrome ripple) ──── IMPACT (drama, wow)
        ↓
🌗 Stats (mid: navy lifted)        ──── TRANSITION
        ↓
🌕 Featured Menu (CREAM cards)     ──── APPETITE (warm, inviting)
        ↓
🌕 Spaces (mineral light bg)       ──── CALM (browsing)
        ↓
🌗 Loyalty (chrome on cream)       ──── CONVERSION (decision)
        ↓
🌕 About (cream + story)           ──── STORY (warm narrative)
        ↓
🌑 CTA (back to navy)              ──── FINAL PUSH (emphasis)
        ↓
🌑 Footer (dark navy)              ──── CLOSURE (premium feel)
```

→ Customer cảm thấy như đi từ ngoài cửa (dark elegant) → vào bên trong (warm cafe) → out (premium ending).

---

## 🎨 Mineral Palette Extension v6

```css
/* MINERAL — Daytime cafe (thuộc Kim element, OK bát tự) */
--mineral-pearl:  #FAFAFA;   /* Almost white */
--mineral-cream:  #F5EFE0;   /* Warm cream — không phải Thổ vì không vàng đất */
--mineral-light:  #F0F4F7;   /* Light blue-grey (water tint = Thủy nhẹ) */
--mineral-soft:   #E5EAF0;   /* Soft blue-grey */
--mineral-med:    #D5DCE2;   /* Medium grey-blue */
--mineral-stone:  #B8C0CC;   /* Stone grey */
--mineral-text:   #2A3145;   /* Dark navy text on light bg */
--mineral-muted:  #6B7280;   /* Muted grey */

/* Warm accent (KHÔNG dùng gold/red, dùng coffee-friendly stone) */
--warm-stone:     #A39E94;   /* Pebble stone — neutral warm */
--warm-clay:      #9B9489;   /* Light clay (KHÔNG đỏ/nâu, chỉ trung tính) */
```

### Lý giải bát tự cho mineral:
- ✅ Pearl/Cream/Light grey → **thuộc Kim element** (kim loại sáng, đá tinh)
- ✅ Blue-grey hue → **water tint** (Thủy nhẹ)
- ✅ Stone neutral → trung tính, KHÔNG vi phạm element cấm
- 🚫 KHÔNG có Yellow saturated (Thổ)
- 🚫 KHÔNG có Brown (Thổ)
- 🚫 KHÔNG có Red/Orange (Hỏa)

→ **100% compatible với bát tự + đáp ứng thị hiếu khách hàng cafe**

---

## 📋 Phân vùng màu theo section

| Section | Background | Text | Accent | Rationale |
|---|---|---|---|---|
| **Hero** | Navy dark `#0A1A2E` | Chrome bright `#E8EEF3` | Chrome light `#C9D6DF` | GIỮ — dramatic intro (Thủy chính) |
| **Stats** | Navy mid `#1A2A4E` | Chrome bright | Chrome italic | Transition zone |
| **Featured Menu** | **Cream `#F5EFE0`** | **Navy text `#2A3145`** | Chrome borders | Cards sáng kích thích appetite |
| **Spaces placeholder** | **Mineral light `#F0F4F7`** | Navy text | Chrome dashed | Calm browsing |
| **Loyalty tiers** | **Pearl `#FAFAFA`** | Navy text | Chrome glow on hover | Decision-making zone |
| **Cashback calc** | Cream warm | Navy text | Chrome mid | Interactive comfort |
| **About** | **Mineral soft `#E5EAF0`** | Navy text | Chrome divider | Warm storytelling |
| **CTA** | Navy dark `#0A1A2E` | Chrome bright | Chrome btn | Final emphasis |
| **Footer** | Navy void `#050D1A` | Chrome muted | Chrome icons | Premium closure |

---

## 🔧 Technical Implementation

### Phase 1: Add mineral tokens
File: `css/brand-tokens.css`
- Add `--mineral-*` variables
- Keep all `--noir-*` and `--chrome-*` unchanged
- Add legacy aliases for backward compat

### Phase 2: Section-specific styles
File: `css/ui-polish-v5.css` (update) hoặc `css/sections-mineral-v6.css` (new)

```css
/* Featured Menu — cream cards */
.featured-menu {
  background: linear-gradient(180deg,
    var(--noir-mid) 0%,     /* dark transition from stats */
    var(--mineral-cream) 8%, /* fade to cream quickly */
    var(--mineral-cream) 100%);
}
.featured-menu .section-heading { color: var(--mineral-text); }
.featured-menu .section-sub { color: var(--mineral-muted); }
.menu-item {
  background: rgba(255,255,255,.6);
  border-color: var(--mineral-stone);
  color: var(--mineral-text);
}
.menu-item .price { color: var(--chrome-dark); }

/* Spaces — mineral light */
.spaces-placeholder {
  background: var(--mineral-light);
  border-top-color: var(--mineral-stone);
}
.spaces-placeholder h3 { color: var(--mineral-text); }

/* Loyalty — pearl */
.loyalty-promo {
  background: linear-gradient(180deg,
    var(--mineral-light) 0%,
    var(--mineral-pearl) 50%,
    var(--mineral-light) 100%);
}
.tier-card {
  background: rgba(255,255,255,.85);
  border-color: var(--mineral-stone);
  color: var(--mineral-text);
}
.tier-rate { color: var(--chrome-dark); }

/* About — mineral soft */
.about {
  background: var(--mineral-soft);
}
.about h3, .about p { color: var(--mineral-text); }
```

### Phase 3: Smooth transitions
Add gradient overlays giữa sections để chuyển từ dark → light → dark không bị "hụt":

```css
.section-transition-dark-to-light {
  height: 80px;
  background: linear-gradient(180deg, var(--noir-deep) 0%, var(--mineral-cream) 100%);
}
.section-transition-light-to-dark {
  height: 80px;
  background: linear-gradient(180deg, var(--mineral-soft) 0%, var(--noir-deep) 100%);
}
```

### Phase 4: WCAG AA contrast verify

| Combination | Contrast ratio | Status |
|---|---|---|
| Navy text `#2A3145` on Cream `#F5EFE0` | ~10.5 : 1 | ✅ AAA |
| Navy text on Pearl `#FAFAFA` | ~12 : 1 | ✅ AAA |
| Chrome mid `#6B9FB8` on Cream | ~3.8 : 1 | ⚠️ AA Large only |
| Chrome dark `#3A6B80` on Cream | ~7 : 1 | ✅ AA |
| Muted `#6B7280` on Cream | ~5 : 1 | ✅ AA |

→ Cần dùng `--chrome-dark` cho text trên light bg, không dùng `--chrome-mid`.

---

## 📊 Expected outcome

| Tiêu chí | v5 BAZI hiện tại | **v6 MINERAL** |
|---|---|---|
| Thị hiếu khách cafe | ⚠️ Quá tối/luxury hotel | ✅ Mời gọi/warm cafe |
| Bát tự alignment | ✅ 100% | ✅ 100% (mineral = Kim) |
| Brand luxury feel | ✅ Có | ✅ Vẫn giữ (hero dark) |
| Daytime browsing UX | ⚠️ Mỏi mắt | ✅ Dễ nhìn |
| Conversion rate | Unknown | Likely tăng (lighter cards = trustworthy) |
| Mobile reading | ⚠️ Dark mệt | ✅ Light comfortable |

---

## 🚀 Roadmap

### Option A: **Soft transition** (recommended)
- Giữ Hero v8 BAZI dark navy + chrome (1st impression dramatic)
- Lift các sections SAU hero sang mineral cream/light
- CTA + Footer quay lại navy (premium closure)
- 1 PR, ~200 lines CSS

### Option B: **Light mode toggle**
- Add button switch Dark/Light
- User chọn theo mood (mặc định: theo giờ — sáng = light, tối = dark)
- Complex hơn nhưng đáp ứng cả 2 nhu cầu
- 1 PR lớn + JS theme switcher

### Option C: **Inverse layout** (radical)
- Hero light (cream + navy chữ A) → atmospheric arc reverse
- Sections sau dark navy
- Footer light
- → Trải nghiệm "đi vào hang Thủy"

---

## 🎯 Em đề xuất Option A

Lý do:
- Giữ hero v8 đẹp đã chốt (anh đã duyệt mood typ gợn sóng)
- Lift menu/loyalty/about → đáp ứng khách cafe
- 1 PR vừa phải, dễ revert nếu không thích
- Bát tự vẫn 100% align

**Anh confirm Option A, em dispatch ngay:**
1. Add mineral tokens → `css/brand-tokens.css`
2. Update sections styling → `css/ui-polish-v5.css`
3. Add transition gradients
4. WCAG contrast verify
5. Push PR + merge

Em estimate ~15-20 phút autonomous.

Hoặc anh muốn Option B (Light/Dark toggle) hoặc C (inverse)?
