# 🧪 TRÀ SỮA PILOT TEST PLAN — 4 ngày pre-launch (2-5/6)

> **Anh Còn chốt 30/5:** Phương án B trân châu + test trước phản ứng khi đưa thêm SKU + topping
> **Approach:** Data-driven decision — pha tay miễn phí 32 em, tracking phản hồi, decide T6 5/6 tối

---

## 🎯 MỤC TIÊU TEST

1. **Verify recipe**: Vị trà sữa trân châu AURA có competitive với Mixue/vỉa hè không?
2. **Test topping preference**: Em thích base hay deluxe hay whipping cream?
3. **Measure willingness to pay**: Em sẽ trả 18k? 20k? 23k? 25k?
4. **Forecast volume**: Bao nhiêu em sẽ order trà sữa trong tuần đầu mở chính thức?
5. **Identify champion SKU**: SKU nào KHÔNG NÊN bán (poor margin × low demand)?

---

## 📋 SETUP TEST

### Hardware/Software ready

- ✅ PR #39 merged → 3 SKU trong DB nhưng `is_available=0` (hidden)
- ✅ Migration apply remote
- ⏳ Cần đặt: trân châu đen luộc sẵn 3kg (90k), ống hút to 1000 cái (150k), đường nâu 5kg (50k)
- ⏳ Cần in: Tracking sheet A4 cho Khánh

### Người chịu trách nhiệm

- **Cường (Barista lead):** Pha 3 phương án + verify recipe
- **Khánh (Tracker):** Quan sát + ghi feedback từng em
- **Anh Còn (Decision maker):** Quyết T6 5/6 tối

---

## 🧪 RECIPE TEST PROTOCOL

### 3 SKU pilot (em đã thêm vào DB qua PR #39)

#### Recipe 1 — `PROD_TS_TC_BASE` — 20.000đ

**Ingredients (cho 1 ly 500ml):**
- 1 gói trà Lipton (ngâm đặc 5 phút với 150ml nước sôi 90°C)
- 30ml sữa đặc Ông Thọ
- 80g trân châu đen luộc sẵn (Cường mới luộc trong vòng 4h)
- 10g đường nâu (rưới lên trân châu khi cho vào ly)
- 200g đá viên
- 1 ly nhựa 500ml + nắp + ống hút TO (đường kính 10mm)

**Quy trình pha (90 giây):**
1. Pha trà Lipton đặc (ngâm 5 phút) — pre-batch 1L mỗi 2h
2. Cho 80g trân châu vào ly nhựa
3. Rưới 10g đường nâu lên trân châu (tan dần tạo vân)
4. Cho 30ml sữa đặc lên trên
5. Thêm 200g đá viên (đến 70% ly)
6. Đổ trà Lipton đặc lên cuối cùng
7. Đậy nắp + ống hút to
8. **KHÔNG khuấy** — để khách tự khuấy (effect đẹp ảnh khi quay video)

**Pass criteria:**
- Vị: ngọt nhẹ, không gắt (tốt cho em < 18)
- Trân châu: mềm vừa, không quá dai
- Visible layer: trân châu dưới đáy nhìn rõ qua ly nhựa trong

---

#### Recipe 2 — `PROD_TS_TC_DELUXE` — 23.000đ

**Bổ sung từ Recipe 1:**
- 130g trân châu (thay vì 80g) = thêm 50g
- 15g đường nâu (thay vì 10g) = thêm 5g
- Cost tăng: 50g × 30đ + 5g × 20đ = 1.6k → cost ~12k, margin 48%

**Đặc trưng:** Cho fan trân châu, ly đầy ắp topping → đẹp ảnh hơn.

---

#### Recipe 3 — `PROD_TS_TC_CREAM` — 25.000đ

**Bổ sung từ Recipe 1:**
- + 40g whipping cream Rich (đánh đặc) topping bề mặt
- + 2g bột cacao rắc lên cream
- Cost tăng: 40g cream + 2g cacao = ~3.5k → cost ~14k, margin 44%

**Đặc trưng:** Vibe Phúc Long/Highland, không quá ngọt, ảnh "đẳng cấp" hơn.

---

## 📅 TIMELINE 4 NGÀY PRE-LAUNCH

### T3 — 02/06 — Day 1 (8 em)

**Schedule:**
- 16:00-17:00 slot 1: 4 em
- 18:00-19:00 slot 2: 4 em

**Test variation:**
- Slot 1: 2 em uống Recipe 1 (base), 2 em uống Recipe 2 (deluxe)
- Slot 2: 2 em uống Recipe 1 (base), 2 em uống Recipe 3 (cream)

**Khánh tracking:**
- Vị (1-5 stars)
- Sẽ trả bao nhiêu? (anchor question 18k/20k/23k/25k)
- Topping favorite (base/deluxe/cream)?
- Sẽ order lại nếu là khách bình thường?

---

### T4 — 03/06 — Day 2 (8 em)

**Variation:**
- Slot 1: 2 em x Recipe 1, 2 em x Recipe 2
- Slot 2: 2 em x Recipe 1, 2 em x Recipe 3

**Đặc biệt:** Bổ sung group test — 1 em uống 2 ly liên tiếp (base + deluxe) để so sánh trực tiếp.

---

### T5 — 04/06 — Day 3 (8 em)

**Variation:**
- Tập trung Recipe 2 (deluxe) vì cần data sample lớn hơn (margin thấp nhất, cần verify demand)
- 4 em Recipe 1, 4 em Recipe 2

---

### T6 — 05/06 — Day 4 (8 em) ⭐ FINAL

**Variation:**
- Em chọn TUỲ THÍCH 1 trong 3 SKU (chứng minh real preference)
- Đây là data quan trọng nhất — chọn tự nguyện = real demand signal

**Sau slot cuối 19h, ANH CÒN QUYẾT:**
- Activate SKU nào (1, 2, 3)?
- Update menu in printed?
- Order thêm trân châu nếu volume cao?

---

## 📊 TRACKING SPREADSHEET TEMPLATE

### Sheet: `tra_sua_pilot_feedback.xlsx`

```
┌─────┬──────────┬─────┬───────────┬─────┬──────┬─────┬─────┬──────────────┐
│ STT │ Em (tên) │Lớp  │ Recipe    │ Vị  │Trân  │Sẽ   │Topping│ Comment      │
│     │          │     │ uống      │1-5  │châu  │trả  │favorite│              │
├─────┼──────────┼─────┼───────────┼─────┼──────┼─────┼─────┼──────────────┤
│ 1   │ Nguyễn A │11A1 │ Base      │ 4   │ 5    │20k  │Base │"Ngon, vừa"   │
│ 2   │ Trần B   │12A2 │ Deluxe    │ 5   │ 5    │23k  │Del  │"Đầy ắp thích"│
│ 3   │ Lê C     │11B1 │ Cream     │ 4   │ 4    │25k  │Cream│"Sang"        │
│ 4   │ Phạm D   │12A1 │ Base      │ 3   │ 3    │18k  │Base │"Ngọt quá"    │
│ ... │ ...      │     │           │     │      │     │     │              │
└─────┴──────────┴─────┴───────────┴─────┴──────┴─────┴─────┴──────────────┘

Tổng cuối ngày 5/6 (32 em):
- Recipe 1 (Base):    N em × avg willingness ___ đ
- Recipe 2 (Deluxe):  N em × avg willingness ___ đ
- Recipe 3 (Cream):   N em × avg willingness ___ đ
- Vị trung bình:       ___ /5
- Topping favorite count: Base ___, Deluxe ___, Cream ___
```

### Anchor questions chuẩn (Khánh hỏi mỗi em):

**Sau khi em uống xong:**

1. **Vị thế nào?** (1-5 sao):
   - 1 = không uống nổi
   - 5 = ngon hơn Mixue
2. **Trân châu OK không?** (1-5 sao):
   - 1 = cứng quá / sống quá
   - 5 = mềm mịn vừa
3. **Em sẽ trả bao nhiêu nếu phải mua?** (multiple choice):
   - 15k? 18k? 20k? 23k? 25k? Không mua?
4. **Em thấy ly nào trông ngon nhất?** (chỉ vào ảnh hoặc ly):
   - Base / Deluxe / Cream
5. **Nếu là khách thường, em sẽ order lại tuần sau không?**
   - Có / Không / Có thể

### Special tracking (Khánh quan sát):

- Em chụp ảnh ly không? (proxy cho "đẹp ảnh")
- Em post lên IG/TikTok ngay tại quán không?
- Em hỏi xin recipe / nguyên liệu không? (hot signal)
- Em rủ bạn quay lại tuần sau không?

---

## 🎯 DECISION FRAMEWORK (T6 5/6 tối)

### Activate matrix

| Tín hiệu | Recipe 1 (Base) | Recipe 2 (Deluxe) | Recipe 3 (Cream) |
|---|---|---|---|
| Avg vị ≥ 4/5 | Activate | Activate | Activate |
| Avg vị 3-3.9 | Activate base only | Activate nếu demand cao | Skip |
| Avg vị < 3 | DEACTIVATE | DEACTIVATE | DEACTIVATE |
| % chọn ≥ 30% | Activate priority | Activate priority | Activate priority |
| % chọn < 10% | Activate if margin OK | Skip | Skip |
| Avg willingness ≥ giá | Activate | Activate | Activate |
| Avg willingness < giá | Activate ở giá thấp hơn | Cân nhắc giảm giá | Skip |

### Decision tree

```
Q1: Vị Recipe 1 (Base) ≥ 3.5/5?
├── YES → Activate PROD_TS_TC_BASE
│   │
│   Q2: Recipe 2 (Deluxe) % chọn ≥ 25%?
│   ├── YES → Activate PROD_TS_TC_DELUXE
│   └── NO  → Skip Deluxe
│   
│   Q3: Recipe 3 (Cream) % chọn ≥ 20%?
│   ├── YES → Activate PROD_TS_TC_CREAM
│   └── NO  → Skip Cream
│
└── NO  → ⚠ Recipe cần điều chỉnh
    → Cường + anh adjust công thức base
    → Pilot lại 1 tuần sau khai trương
    → KHÔNG activate trong menu D-Day
```

### SQL commands theo decision

**Option A: Activate all 3 (best case):**
```sql
UPDATE products SET is_available=1, updated_at=datetime('now')
WHERE id LIKE 'PROD_TS_TC_%';
```

**Option B: Base only (conservative):**
```sql
UPDATE products SET is_available=1, updated_at=datetime('now')
WHERE id='PROD_TS_TC_BASE';
```

**Option C: Base + 1 topping (most likely):**
```sql
-- Nếu Deluxe ≥ 25%:
UPDATE products SET is_available=1, updated_at=datetime('now')
WHERE id IN ('PROD_TS_TC_BASE', 'PROD_TS_TC_DELUXE');

-- Hoặc nếu Cream ≥ 20%:
UPDATE products SET is_available=1, updated_at=datetime('now')
WHERE id IN ('PROD_TS_TC_BASE', 'PROD_TS_TC_CREAM');
```

**Option D: None (recipe fail):**
- Không activate
- Cường adjust recipe
- Pilot 7-13/6 (tuần sau khai trương)

---

## 💰 COST OF PILOT TEST (free cho em)

### Cường pha tay 32 ly trong 4 ngày

| Ngày | Số ly | Recipe mix | Cost ingredients |
|---|---|---|---|
| T3 2/6 | 8 | 4×R1 + 2×R2 + 2×R3 | 4×10.4k + 2×12k + 2×14k = 93.6k |
| T4 3/6 | 8 | 4×R1 + 2×R2 + 2×R3 | 93.6k |
| T5 4/6 | 8 | 4×R1 + 4×R2 + 0×R3 | 4×10.4k + 4×12k = 89.6k |
| T6 5/6 | 8 | Em chọn (avg) | ~95k |
| **Tổng** | **32 ly** | | **~372k** |

→ Cộng 90k trân châu mua thêm dùng cho 32 ly + dự trữ D-Day = ~460k total.

**ROI nếu activate sau test:**
- D-Day bán 50 ly trà sữa × 20k = 1tr revenue (margin 48% = 480k profit)
- Tuần đầu sau D-Day bán 100 ly × 20k = 2tr revenue (960k profit)
- → Hoàn vốn 460k pilot trong 1 tuần.

---

## 🛒 ACTION LIST CHO ANH (hôm nay 30/5)

### Procurement (gấp, đặt ngay)

- [ ] **Trân châu đen luộc sẵn 3kg** (~90k) — đặt T7 30/5 nhận T2 1/6
  - Source 1: Shop tạp hoá Sa Đéc (gọi Co.opmart, Bách Hoá Xanh)
  - Source 2: Chợ trà sữa Cần Thơ (delivery 1 ngày)
  - Source 3: Shopee/Lazada (search "trân châu đen luộc sẵn") — delivery 2-3 ngày
- [ ] **Ống hút TO đường kính 10mm** 1000 cái (~150k) — đặt cùng nguồn trân châu
- [ ] **Đường nâu** 5kg (~50k) — Co.opmart có sẵn
- [ ] **Whipping cream Rich** thêm 2 hộp (~120k) — cho Recipe 3
- [ ] **Bột cacao** thêm 100g (~80k) — topping Recipe 3

**Total procurement:** ~490k

### DB activation (sau pilot)

- [ ] T6 5/6 tối: Anh + em review tracking data → quyết
- [ ] Em chạy 1 SQL UPDATE để activate SKU(s)

### Menu update (sau decision)

- [ ] **Print menu mới** (giấy A5) thêm dòng trà sữa
- [ ] **Update website menu page** với SKU đã activate
- [ ] **Update Brief group Zalo "AURA Friends"** thông báo menu mới

---

## 🎁 INCENTIVE CHO EM TEST (xây dựng word-of-mouth)

### Reward chuẩn

Mỗi em pre-launch test nhận:
- ✅ 1 ly trà sữa pilot FREE
- ✅ 1 voucher 50k dùng dịp khai trương 6/6
- ✅ +30k vào ví khi đăng ký thành viên ngay tại slot
- ✅ Tên trong "AURA Friends Founding Club" — lifetime perk

### Bonus cho em chia sẻ post đẹp

- 5 em đăng IG/TikTok đẹp nhất → mỗi em +100k voucher (chấm sau D-Day)
- 1 em random đăng story tại slot → +50k voucher

---

## 📈 SUCCESS METRICS

| KPI | Target | Stretch |
|---|---|---|
| Em tham gia pilot | 25 | 32 (full slots) |
| Vị Recipe 1 (Base) avg | ≥ 3.5/5 | ≥ 4/5 |
| Vị Recipe 2 (Deluxe) avg | ≥ 3.5/5 | ≥ 4.2/5 |
| Vị Recipe 3 (Cream) avg | ≥ 3.5/5 | ≥ 4/5 |
| Willingness pay base ≥ 18k | ≥ 70% em | ≥ 90% |
| Willingness pay deluxe ≥ 22k | ≥ 50% em | ≥ 75% |
| Em đăng IG/TikTok | ≥ 60% | ≥ 90% |
| Hashtag #AURACafeSaDec posts | ≥ 20 | ≥ 32 |

---

## ⚠️ RISK + MITIGATION

### R1: Trân châu cứng / không ngon
- **Mit:** Cường + 1 volunteer YouTube tutorial luộc 1 batch trước (T2 1/6 buổi tối)
- **Backup:** Nếu fail luộc → mua trân châu luộc sẵn (đắt hơn 1.5x nhưng ổn định)

### R2: Em đến không đủ số 32 (chỉ 15-20)
- **Mit:** Data ít hơn nhưng vẫn quyết được nếu signal rõ
- **Backup:** Anh + Cường tự thử + 5 friends người lớn để bù sample size

### R3: Recipe quá ngọt / quá nhạt
- **Mit:** T2 1/6 buổi tối, Cường pha 3 phiên bản → anh + Khánh + Thư nếm → adjust
- Sau adjust nếu cần → pilot bắt đầu chính thức T3 2/6 với recipe v1.1

### R4: Trân châu luộc xong không bảo quản tốt (4-6h hỏng)
- **Mit:** Luộc 2 batch/ngày trong 4 ngày pilot:
  - Batch sáng 10h → dùng đến 14h
  - Batch chiều 14h → dùng đến 19h
- **Daily prep:** 500g trân châu luộc/ngày (đủ 8 ly + buffer)

### R5: Em phàn nàn ngọt quá (lý do sức khoẻ)
- **Mit:** Tùy chọn "ít đường" — đường nâu chỉ 5g thay vì 10-15g
- Hỏi em luôn: "Em muốn ít đường hay vừa?"

---

## 🎬 KỊCH BẢN BUỔI TEST (Khánh hướng dẫn)

### Khi em đến slot:

```
[15 giây đón]
Khánh: "Chào em! Em đã đến đúng giờ rồi nha. 
        Em ngồi đây nhé."

[Order]
Khánh: "Hôm nay em sẽ thử món trà sữa trân châu mới của anh.
        Có 3 lựa chọn: base 20k, deluxe 23k thêm trân châu,
        cream 25k có whipping cream.
        Tất cả miễn phí cho em hôm nay nha."

[Em chọn / Khánh assign]
Khánh: "Em uống món ___ trước nhé."

[Cường pha — 90s]

[Em uống — 5 phút]
Khánh quan sát: em chụp ảnh không? Em uống lia liệt hay ngắt quãng?

[Feedback]
Khánh: "Em thấy vị thế nào? Cho anh đánh giá từ 1 đến 5 nha.
        Trân châu mềm hay cứng?"

Khánh: "Em sẽ trả bao nhiêu nếu phải mua, 18k? 20k? 23k? 25k?"

Khánh: "Em thấy ly nào trông ngon nhất? (chỉ 3 ly mẫu)"

Khánh: "Em sẽ rủ bạn đến uống không?"

[Wrap up — 5 phút]
Khánh: "Cảm ơn em! Đây là voucher 50k của em dùng dịp khai trương.
        Em scan QR đăng ký thành viên +30k vào ví nha.
        6/6 này em đến đông nha, có mini contest 200k voucher đấy!"

[Tracking sheet]
Khánh ghi: tên + lớp + recipe + scores + willingness + topping fav + comment
```

---

## 🔚 KẾT LUẬN

Pilot test 4 ngày × 8 em = **32 data points** đủ statistical significance cho quyết định.

**Nguyên tắc:**
- ✅ Recipe 1 (Base) là MUST — phải pass criteria
- ✅ Recipe 2 (Deluxe) và 3 (Cream) là OPTIONAL — chỉ activate nếu data ủng hộ
- ✅ Khánh là người quan sát quan trọng nhất — em không nói dối Khánh

**Decision authority:**
- T6 5/6 19:30: Anh Còn + em meeting 30 phút review tracking sheet
- 20:00: Quyết activate (SQL UPDATE)
- 20:15: Update menu in giấy
- 20:30: Brief team về SKU mới sáng 6/6

📌 **Action số 1 hôm nay 30/5:** Anh đặt trân châu + ống hút to + đường nâu (~290k). Em + anh chuẩn bị Cường + Khánh sẵn sàng T2 1/6 luộc batch test.
