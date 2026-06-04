# 🔍 DEEP CHECK AUDIT — Kế hoạch khai trương 6/6/2026

> **Ngày audit:** T7 30/05/2026 (D-7)
> **Người audit:** Em (Claude)
> **Files audit:** README + 4 file plan (Master / Loyalty / Budget / Daily / Marketing)
> **Mục đích:** Phát hiện gap, risk, inconsistency → đề xuất action 7 ngày cuối

---

## 📊 EXECUTIVE SUMMARY — Tình trạng tổng thể

| Lĩnh vực | Status | Ghi chú nhanh |
|---|---|---|
| **🎫 Loyalty + Tech** | 🟢 ON TRACK | 5 PR loyalty đã merge (#25-29), production deployed. Hơn plan 10% |
| **📦 Inventory** | 🟡 PARTIAL | Plan Task 14-18 đã có (em vừa làm hôm nay). **Chỉ Task 14 nên dispatch trước 6/6** |
| **📢 Marketing** | 🔴 BEHIND | Plan có 11 marketing tasks tuần 1+2 — em không có visibility đã làm chưa |
| **💰 Budget** | 🟡 RISKY | Day-1 offer overspend ngầm — tính kỹ ~8tr nhưng budget chỉ 4.5tr |
| **🌧 Weather risk** | 🔴 UNDERSIZED | 6/6 mùa mưa cao điểm — risk mitigation hiện tại chưa đủ |
| **👥 Staffing** | 🔴 UNCLEAR | Plan cần 12-14 người, hiện chỉ 4 (BCC tháng 5). 7 ngày tuyển thêm 8 — quá khó |
| **🏛 Pháp lý + an toàn** | 🔴 MISSING | Plan KHÔNG đề cập giấy phép tiếng ồn, insurance, parking, ATM, wifi backup |
| **🎭 Run of show** | 🟡 MISALIGNED | Phase 1 timing 7-11h hơi sớm. Lễ cắt băng 18:30 conflict giờ ăn tối |
| **📅 Daily checklist** | 🟡 STALE | Progress vẫn "0/81" — không phản ánh thực tế |

**Tổng kết:** **3 vùng đỏ + 4 vùng vàng + 2 vùng xanh**. Plan chưa thể launch ngon nghẻ nếu không xử lý 9 vấn đề critical/high dưới đây.

---

## ✅ NHỮNG GÌ ĐÃ TỐT (giữ nguyên)

### 1. Tech stack loyalty đã ready
- Schema v2 (4 tier 3/5/7/10%) deployed ✅
- Campaign GRAND_OPENING_6_6_2026 active ✅
- Signup page `/dang-ky-thanh-vien` live ✅
- 3 QR codes generated (standee/leaflet/receipt) ✅
- Admin loyalty dashboard 8 widgets ready ✅
- Membership card template + script generate PDF ready ✅
- **POS + cashback flow** verified

### 2. Cấu trúc 2-phase hybrid sáng/chiều
- Phase 1 (Family/VIP) + Phase 2 (Public) là **đúng** strategy
- Tránh được peak overload 1 lần
- Tách rõ tệp khách giúp content shooting Phase 1 sạch

### 3. Loyalty rules + bonus campaign rõ ràng
- Tier rates 3/5/7/10% phù hợp Sa Đéc
- Cap 50k/tx tránh abuse
- Signup bonus +50k cho first 100 phù hợp với code đã deploy

### 4. KOL strategy 5 micro thay vì 1 macro
- Risk diversification tốt
- Barter food+drink rẻ hơn cash payment
- Tone "không yêu cầu script" — KOL thoải mái, content authentic

### 5. Cashflow spread 19 ngày
- Không dồn pay 1 lúc
- Buffer rest day CN giảm burn-out

---

## 🔴 CRITICAL ISSUES (phải xử lý trong tuần này)

### C1. ⚠️ MƯA — Risk mitigation thiếu nghiêm trọng

**Hiện tại:** Risk table chỉ ghi "tent + indoor focus, livestream"

**Vấn đề thực:**
- 6/6 nằm giữa mùa mưa cao điểm ĐBSCL (tháng 5-10)
- Xác suất mưa chiều/tối Sa Đéc tháng 6: **~70-80%**
- Container **ROOFTOP** = không gian mở → mưa = mất 50-70% chỗ ngồi
- Phase 2 16-22h (chiều tối) trùng giờ mưa rào điển hình
- Nếu mưa lớn + 150-200 khách dồn vô indoor → chật, vệ sinh khó

**Đề xuất xử lý (TUẦN NÀY):**
- [ ] **Thuê 2 tent gấp 6×6m** (~500k-1tr) — đặt 31/5 để có 5/6 lắp
- [ ] **Plan B layout indoor-only** vẽ sẵn: bàn ghế xếp sao, đường đi
- [ ] **Audio acoustic backup**: indoor sound khác outdoor → test trước 5/6
- [ ] **Áo mưa giấy 100 cái** (200k) tặng khách nếu mưa khi về
- [ ] **Bạt nhựa che decor LED** — phòng bị hỏng do nước
- [ ] **Quyết định cancel**: chỉ cancel nếu bão > level 6. Mưa rào VẪN MỞ.

---

### C2. 💰 OFFER DAY-1 OVERSPEND ngầm

**Tính kỹ lại offers day-1 dựa trên 200 khách dự kiến:**

| # | Offer | Cost actual | Plan đã ghi |
|---|---|---|---|
| 1 | Welcome drink free (100 ly × 15k) | **1.5tr** | 1.5tr ✅ |
| 3 | Signup bonus +50k × first 100 sign-ups | **5.0tr** | "cap 40 = 2tr" ❌ Mâu thuẫn |
| 4 | Discount 20% × ~10tr revenue | **2.0tr** | 2.0tr ✅ |
| 5 | Voucher 30k issued × 50 = future liability | **1.5tr** | "future" — không tính day 1 |
| 6 | Cashback x2 (~2 lần normal) | **~600k** | Chưa tính |
| 7 | Refer +50k × 30 pairs giả định | **1.5tr** | Chưa tính day 1 |
| | **TOTAL DAY-1 cost** | **~13tr** | 4.5tr 🔴 |

**Mâu thuẫn cụ thể:**
- Master plan tab "OFFERS DAY-1" line 124-126: "100 × 50k = 5tr → cap thực tế first 40 = 2tr"
- Nhưng code đã deploy: `signup_bonus_cap = 100` (PR #25 migration)
- → Nếu 100 người đăng ký thật → quán bay 5tr signup bonus

**Đề xuất xử lý:**
- [ ] **Quyết định ngay (T7 30/5 hoặc CN 31/5)**: giảm `signup_bonus_cap` xuống 50 (= 2.5tr cap)?
- [ ] HOẶC chấp nhận spend 5tr signup bonus + tăng budget total lên 18-20tr
- [ ] HOẶC giảm signup_bonus_vnd từ 50k → 30k (vẫn 100 người, chỉ 3tr)
- [ ] HOẶC bỏ discount 20% (giữ welcome drink + cashback x2 = đủ hấp dẫn)

**Em recommend:** Giảm signup_bonus_vnd về 30k + bỏ discount 20% → tổng cost ~7-8tr, trong tầm 4.5tr offers budget khi cộng buffer.

---

### C3. 👥 STAFFING — Số liệu mâu thuẫn

**Plan:**
- "Bình thường ~6 người" — nhưng BCC tháng 5 cho thấy chỉ 4 (Khánh/Cường/Thư/Ngọc)
- "Ngày 6/6 cần 12-14 người"
- "Cần thuê thêm 6-8 người tạm"

**Reality check 30/5 (còn 7 ngày):**
- Sa Đéc không sẵn nguồn part-time pha chế / phục vụ trained
- Tuyển trong 7 ngày = chỉ recruiter friends&family
- Friend volunteer cần áo đồng phục — đặt may chưa kịp
- Bảo vệ 1 người cho 200 khách = không đủ (chuẩn 1 bảo vệ/100 khách)

**Đề xuất:**
- [ ] **30/5 hôm nay**: Anh + Cường list 8 friends & family có thể giúp ngày 6/6
- [ ] **31/5**: Confirm 6+ người tới, hẹn buổi train 04/6
- [ ] **1-3/6**: May/mua 8 áo đồng phục đơn giản (áo phông đen + tạp dề có logo)
- [ ] **2/6**: Thuê 2 bảo vệ (không phải 1) — gọi công ty bảo vệ Sa Đéc/Cao Lãnh
- [ ] **4/6**: Buổi train 2h cho volunteers — họ làm:
  - Hướng dẫn khách
  - Phụ rửa ly
  - Photo opportunity facilitator
  - Trông xe
- [ ] **Realistic numbers:** 4 staff + 2 bảo vệ + 6 volunteer = 12 người (tạm đủ)

---

### C4. 🏛 PHÁP LÝ + AN TOÀN — Hoàn toàn thiếu trong plan

**Plan KHÔNG đề cập:**

| Vấn đề | Risk | Action |
|---|---|---|
| Giấy phép tiếng ồn cho live music | Nếu hàng xóm khiếu nại → cảnh sát đến → cắt nhạc | Hỏi phường Sa Đéc — thông báo trước cho hàng xóm |
| Giấy phép tổ chức sự kiện công cộng | Có thể phải đăng ký với phường | Check với UBND phường |
| Insurance liability | Khách trượt ngã / điện giật → trách nhiệm | Mua bảo hiểm trách nhiệm dân sự event (~500k 1 ngày) |
| Giấy phép phòng cháy chữa cháy | Container rooftop + LED + đèn = check PCCC | Kiểm tra bình cứu hoả + lối thoát hiểm |
| ATM nearby | Khách hết tiền mặt | List 3 ATM gần nhất để chỉ cho khách |
| Wifi backup | Nếu nhà mạng đứt → POS không hoạt động | 4G dongle backup hoặc hotspot 3 điện thoại |
| Parking | 200 khách × ~50% xe máy = 100 xe | Thuê bãi đỗ tạm hoặc bố trí staff trông |

**Action ngay (T7 30/5 - T2 1/6):**
- [ ] Anh Còn đi UBND phường: confirm có cần giấy phép sự kiện không
- [ ] Mua bảo hiểm trách nhiệm dân sự event (gọi Bảo Việt / Bảo Minh)
- [ ] Test bình cứu hoả còn áp (3 cái)
- [ ] List 3 ATM/POS cá nhân gần quán
- [ ] Mua 4G dongle + sim data 50GB backup (~300k)
- [ ] Thuê bãi đỗ tạm 100m² (~500k 1 ngày)

---

## 🟡 HIGH PRIORITY ISSUES

### H1. 🎭 RUN OF SHOW timing không tối ưu

**Vấn đề Phase 1:**
- 06:00 mở quán + 07:00 đón khách VIP = quá sớm cho cafe Sa Đéc
- 11:00 close → 16:00 mở Phase 2 = **5 tiếng dead time** (staff vẫn phải có mặt)
- Chi phí staff trong 5h gap = ~1tr lãng phí

**Vấn đề Phase 2:**
- 18:30 cắt băng = đa số khách đang ăn tối ngoài, chưa đến
- 17:30 + 19:00 nhạc — set 1 quá sớm (chưa đông), set 2 OK

**Đề xuất tối ưu:**

**PHASE 1 sửa:**
```
07:30 - 11:00 (VIP & family — 3.5h)
07:30 mở cửa, đón khách
08:00 welcome drink
08:30 anh Còn kể câu chuyện AURA (5 phút)
09:00 KOL arrive, content shooting
10:00 photo opportunities
10:30 last drink
11:00 close Phase 1
11:30 lunch break + reset
```

**PHASE 2 sửa (17:00 thay vì 16:00):**
```
16:30 staff setup final
17:00 MỞ CỬA PUBLIC (sớm hơn 1h vs plan, vẫn quá đủ peak chiều tối)
17:00-18:00 welcome drink free cho 100 đầu
17:30 LỄ CẮT BĂNG (lúc bắt đầu đông) + pháo giấy
18:00 acoustic set 1 (~30p) — backgrounded mức nhẹ
19:00 peak hour — phục vụ tối đa
19:30 acoustic set 2 (energy cao hơn)
21:30 acoustic acoustic mềm cuối
22:00 đóng tiệc
```

**Lợi ích:**
- Lễ cắt băng 17:30 = lúc khách bắt đầu đông, không bị mất cảm giác lễ
- Set nhạc đầu mức nhẹ để không át nhau với việc bán

---

### H2. 📢 MARKETING TIMELINE đã trễ — visibility kém

**Plan các post quá khứ:**
- T6 22/5: Post #1 Coming Soon — **đã đăng chưa?**
- T2 25/5: Post #2 Sneak peek — **đã đăng chưa?**
- T3 26/5: Zalo Broadcast #1 — **đã gửi chưa?**
- T5 28/5: KOL #1 visit + shooting — **xong chưa?**
- T6 29/5: Post #3 Reel — **đã đăng chưa?**
- T7 30/5 (hôm nay): KOL #2 + #3 visit — **đang làm?**
- CN 31/5: KOL #1 post go live — **KOL ready chưa?**

→ Em **KHÔNG có visibility** vào Facebook page anh / Zalo broadcast.

**Risk nếu chưa làm:**
- 7 ngày còn lại không đủ build awareness
- FB Boost 1/6 sẽ "cold start" — không có baseline organic
- KOL chưa visit → 31/5-3/6 nhồi 5 KOL trong 4 ngày = chất lượng giảm

**Action ngay:**
- [ ] **Hôm nay (30/5)**: Anh confirm với em qua chat — list các marketing task đã/chưa làm
- [ ] Nếu đã trễ: em gợi ý plan rút gọn 7 ngày:
  - T7 30/5: Post #1 + #2 combined (kể chuyện + sneak peek)
  - CN 31/5: Zalo broadcast nội dung gấp đôi
  - T2 1/6: FB Boost ON + Post #3 (reel) cùng ngày
  - T3 2/6: Leaflet phát + KOL #1 visit + post
  - T4 3/6: Post #4 (loyalty showcase)
  - T5 4/6: KOL #2 + #3 visit + post
  - T6 5/6: Post #5 "Tomorrow" + Zalo broadcast #2
  - T7 6/6: D-Day posts

---

### H3. 📅 DAILY CHECKLIST chưa update — không phản ánh thực tế

**Progress bảng dòng 348-356:**
```
Tuần 1 (18-24/5): 0 / 28 — 0%
Tuần 2 (25-31/5): 0 / 18 — 0%
...
TOTAL: 0 / 81 — 0%
```

**Thực tế đã làm (từ summary chat trước):**
- ✅ Task 08 Schema v2 (PR #25) merged
- ✅ Task 09 Bug fixes loyalty.js (PR #26) merged
- ✅ Task 10 Signup page (PR #27) merged
- ✅ Task 11 POS wallet + card (PR #28) merged
- ✅ Task 12 Admin dashboard (PR #29) merged
- ✅ Migration #03 + #04 applied remote
- ✅ Issue #16 outdated closed

→ Thực tế **tech side ~50-60% xong** vs checklist nói 0%.

**Action ngay:**
- [ ] Em update file `03_DAILY_CHECKLIST.md` với checklist mới phản ánh thực trạng (sẽ làm sau khi anh feedback audit này)
- [ ] Convert tracking sang **artifact live** (cowork artifact) để anh check real-time

---

### H4. 📦 INVENTORY MODULE chưa được hợp nhất vào launch plan

**Em vừa hoàn thành plan inventory hôm nay (`05_Demos/OPERATIONS_2026/`):**
- Audit Excel + 5 task specs (Task 14-18)
- Dispatch commands ready

**Đề xuất tích hợp:**
- **Task 14 (Inventory schema) NÊN dispatch trước 6/6** — để có data baseline ngày khai trương
- Task 15-18 dispatch SAU launch (8/6 trở đi)
- Lý do: nếu Task 14 chậm trễ → vẫn không ảnh hưởng launch (chỉ ảnh hưởng kho)

**Action:**
- [ ] T2 1/6 - T3 2/6: Dispatch Task 14 → worker xong 3/6
- [ ] T4 3/6 - T5 4/6: Em verify migration applied
- [ ] Cự đối: nếu trễ → defer toàn bộ inventory sau 8/6

---

## 🟢 MEDIUM ISSUES (xử lý nếu có thời gian)

### M1. SMS gateway trong loyalty plan — đã outdated

File `01_LOYALTY_CASHBACK_PROGRAM.md`:
- Dòng 224-235: SMS templates với "Speedsms/Esms VN"
- Dòng 272: "SMS gateway integrated"

**Realtime:** Anh đã chọn **Hybrid (thẻ giấy + POS, không SMS)** — Speedsms bị reject. Zalo OA sau 25/6.

**Action:** Em update loyalty plan strip section SMS, thay bằng "Notification: Thẻ giấy + POS Display + Zalo OA (Phase 2)".

---

### M2. README ngày + link chưa sync với reality

`README.md` còn nói:
- "Hôm nay 18/5 anh cần làm (còn 19 ngày)" → SAI, hôm nay 30/5 còn 7 ngày
- "Em dispatch Task 08 chiều nay" → đã dispatch + merge từ lâu rồi
- "task list 16-8/6" → master plan thật 18-6/6

**Action:** Em refactor README với section "Tình trạng D-7 (30/5)" + cập nhật link.

---

### M3. Repeat customer KPI quá lạc quan

**Plan:** "Month-1 retention: 30%+"

**Realistic data từ ngành F&B Việt Nam:**
- Tháng 1 retention mới mở: **15-22%**
- Tháng 3-6 (khi loyalty mature): 30-40%
- Cafe Sa Đéc tỉnh lẻ: phụ thuộc lớn vào churn từ Viva Star

**Action:** Update KPI tháng 1 target = 20% (realistic), tháng 3 target = 30% (stretch).

---

### M4. KOL pool 5 micro — backup yếu nếu 2-3 hủy

**Plan:** 5 KOL micro barter
**Risk plan:** "5 KOL micro thay vì 1 macro" — OK nhưng:
- Nếu 2-3 hủy → còn 2-3 KOL, vẫn loss reach lớn
- Sa Đéc + Đồng Tháp KOL pool nhỏ, không có nhiều micro

**Đề xuất:**
- Mở rộng pool ra Cần Thơ (cách Sa Đéc 30km — KOL Cần Thơ vẫn cover Đồng Tháp)
- Thêm 3 nano-KOL (1k-5k followers) làm backup
- Tổng pool 8 — even nếu 3 hủy còn 5 vẫn đủ

---

### M5. Photographer/videographer duy nhất 1 người

**Plan:** "Photographer freelance 4h Phase 2, videographer optional" — chỉ 1 phận
**Risk:** Photographer ốm / không đến → mất hết content

**Đề xuất:**
- Photographer #1 (chính) cho Phase 1 + Phase 2
- **Photographer #2 backup** (~300k) — sinh viên/junior — Phase 2 only
- Hoặc Phase 1 anh + vợ chụp iPhone, Phase 2 mới thuê pro

---

## 🟢 MEDIUM-LOW ISSUES (notes only)

- **Welcome drink "cafe đen/sữa basic, COGS 15k/ly"** — đã verify COGS đúng? Cf D2 18g × 200k/kg = 3.6k + sữa đặc 25ml + ly 800đ = thực tế ~5k. **15k là quá đắt** — có thể giảm còn 10k/ly = saving 500k.
- **Standee "Khai trương" 2 cái** — đã in chưa? In gấp T7-CN không lý tưởng (xưởng nghỉ).
- **Backdrop photo zone 3x2m vinyl** — to, cần sườn để treo. Anh có sườn chưa?
- **Live music ca sĩ acoustic 2 sets** — đã contract + deposit chưa?
- **Audio system loa kéo** — đã mượn/thuê chưa? Test sound chưa?

---

## 🎯 ĐỀ XUẤT — Plan 7 ngày cuối (D-7 đến D-Day)

### T7 — 30/05 (HÔM NAY) — Audit + Critical decisions

**Anh Còn:**
- [ ] **Đọc audit này** (30 phút)
- [ ] **Quyết định C2** signup bonus cap (50k×100 = 5tr, hay 30k×100 = 3tr?)
- [ ] **Quyết định C1** thuê tent 2 cái (~1tr)
- [ ] **List 6+ friends&family volunteer ngày 6/6**
- [ ] **Đi UBND phường** check giấy phép sự kiện + tiếng ồn
- [ ] **Confirm cho em**: marketing tasks tuần 1+2 đã làm chưa

**Em standby:**
- [ ] Sau khi anh confirm marketing status → em re-plan 7 ngày cuối
- [ ] Sau khi anh decision signup cap → em adjust DB nếu cần (UPDATE bonus_campaigns)

---

### CN — 31/05 (D-6)

**Anh Còn:**
- [ ] **08:00** Confirm volunteer list (6-8 người)
- [ ] **10:00** Mua bảo hiểm liability event (Bảo Việt / Bảo Minh)
- [ ] **13:00** Liên hệ 2 cty bảo vệ Sa Đéc/Cao Lãnh — quote
- [ ] **15:00** Đặt 2 tent gấp 6x6m (giao 5/6)
- [ ] **17:00** Marketing post (combined #1 + #2 nếu chưa làm)
- [ ] **20:00** Zalo broadcast vòng 1

**Em:**
- [ ] Update `03_DAILY_CHECKLIST.md` reflect actual progress
- [ ] Convert checklist sang artifact live (anh check real-time)
- [ ] Adjust DB nếu anh decide giảm signup_bonus_vnd

---

### T2 — 01/06 (D-5) — **FB Boost ON**

**Anh Còn:**
- [ ] **08:00** Boost ON budget 200k/ngày
- [ ] **10:00** Confirm photographer + videographer (deposit nếu chưa)
- [ ] **13:00** KOL outreach final cho 5 KOL nếu chưa lock
- [ ] **15:00** Briefing volunteer batch 1 (3 người)

**Em:**
- [ ] Dispatch Task 14 inventory schema cho worker
- [ ] Setup monitor dashboard cho ngày 6/6 (uptime, signups, revenue real-time)

---

### T3 — 02/06 (D-4)

**Anh Còn:**
- [ ] **08:00** Phát leaflet 500 tờ bán kính 2km (2 sinh viên × 100k)
- [ ] **10:00** Confirm bãi đỗ xe (gần quán, sức chứa 100 xe máy)
- [ ] **14:00** KOL #1 + #2 visit + shooting
- [ ] **17:00** Mua 4G dongle backup wifi (FPT / Viettel)
- [ ] **19:00** Marketing post #3 (reel "behind the scene")

**Em:**
- [ ] Verify Task 14 PR + apply migration nếu xong
- [ ] Sync inventory baseline với Excel cuối tháng 5

---

### T4 — 03/06 (D-3)

**Anh Còn:**
- [ ] **08:00** Kiểm tra bình cứu hoả 3 cái — còn áp?
- [ ] **10:00** KOL #3 + #4 visit + shooting
- [ ] **14:00** Test loa kéo + mic + sound check rehearsal
- [ ] **17:00** Post #4 Facebook "Member spotlight"

**Em:**
- [ ] Verify Cloudflare Pages production stable
- [ ] Stress test signup form 100 đăng ký giả lập

---

### T5 — 04/06 (D-2)

**Anh Còn:**
- [ ] **08:00** **TRAIN ALL STAFF + VOLUNTEERS** (3 tiếng, 8-11h)
  - Loyalty signup flow
  - POS payment flow
  - Welcome drink pha batch lớn
  - Tour quán câu chuyện
  - Safety + fire drill
- [ ] **14:00** Final POS stress test (mock 50 giao dịch)
- [ ] **16:00** Confirm hoa tươi, bóng bay, LED giao đúng giờ 5/6
- [ ] **19:00** KOL #5 visit + post

**Em:**
- [ ] Final smoke test full tech: web + signup + cashback + POS + dashboard
- [ ] Backup DB production 1 lần nữa
- [ ] Setup alert real-time cho ngày 6/6

---

### T6 — 05/06 (D-1) — **🛠 SETUP DAY**

**Anh Còn — Setup day full:**
- [ ] **08:00** Nhận hoa tươi, decor, bóng bay
- [ ] **09:00** Treo LED dây 50m, bóng bay
- [ ] **10:30** Lắp 2 tent (in case mưa)
- [ ] **11:00** Setup standee, backdrop, photo zone
- [ ] **12:00** Lunch break
- [ ] **13:00** Test sound rehearsal với ca sĩ (full set)
- [ ] **15:00** **FINAL BRIEFING** với toàn bộ 12 staff/volunteer (2h)
  - Vị trí từng người Phase 1 + Phase 2
  - Safety drill (cháy / điện / khách rối)
  - POS backup nếu lỗi
- [ ] **17:00** Final inventory check (đủ nguyên liệu 2× normal day?)
- [ ] **18:00** Marketing post #5 "Tomorrow" + Zalo broadcast vòng 2
- [ ] **19:00** Đóng cửa sớm, dọn dẹp toàn diện
- [ ] **20:00** Em sync anh status final, both đi ngủ sớm
- [ ] **22:00** Sleep 8 tiếng minimum

**Em:**
- [ ] FB Boost last day push 300k
- [ ] Monitor dashboard ready
- [ ] Standby remote phone on cả đêm

---

### T7 — 06/06 (D-DAY) 🎉

**Anh Còn:**
- [ ] **05:30** Wake up + breakfast nhẹ
- [ ] **06:00** Arrive quán + briefing nhanh tất cả staff (15 phút)
- [ ] **06:30** Photographer arrive, b-roll
- [ ] **07:30** **DOORS OPEN PHASE 1** (sửa từ 7:00 → 7:30 theo H1)
- [ ] **11:00** Phase 1 close
- [ ] **11:30 - 16:00** Lunch + rest cho staff (5h dead time vẫn còn — không tránh được trừ khi merge 2 phase)
- [ ] **16:30** Final decor check, LED on
- [ ] **17:00** **DOORS OPEN PHASE 2** (sửa từ 16:00 → 17:00)
- [ ] **17:30** **LỄ CẮT BĂNG** (sửa từ 18:30 → 17:30 theo H1)
- [ ] **18:00** Acoustic set 1
- [ ] **19:30** Acoustic set 2
- [ ] **22:00** Đóng tiệc
- [ ] **23:00** Anh + staff về nhà nghỉ

**Em standby remote:**
- [ ] Monitor dashboard mỗi 30 phút
- [ ] FB live update mỗi 2h
- [ ] Sẵn sàng debug nếu POS/cashback có vấn đề
- [ ] Post-event summary đêm 6/6 → gửi anh

---

## 📊 SO SÁNH PLAN vs THỰC TẾ

| Lĩnh vực | Plan ghi | Thực tế D-7 | Gap |
|---|---|---|---|
| Tech loyalty | "Dispatch task 08 chiều 18/5" | ✅ DONE 5 PRs merged | Hơn plan 100% |
| KOL outreach | "List 10 KOL 18/5, contact tuần này" | ❓ Anh confirm? | Unknown |
| Decor order | "Đặt 19-25/5 đa số" | ❓ | Unknown |
| Leaflet | "In 500 tờ 25/5, phát 2/6" | ❓ | Unknown |
| Volunteers | "Hỏi friends&family tuần 1-2" | 🔴 Em không thấy | Likely undone |
| Insurance | KHÔNG đề cập | 🔴 Missing | Critical gap |
| Tent backup mưa | KHÔNG đề cập | 🔴 Missing | Critical gap |
| Bảo vệ | "1 người" | 🔴 Cần 2 | Hiển thị thiếu |
| Parking | KHÔNG đề cập | 🔴 Missing | Critical gap |

---

## 🎯 RECOMMENDATION FINAL — Anh quyết 5 câu hỏi sau

Em cần anh confirm 5 quyết định lớn để fine-tune kế hoạch:

1. **Marketing status?** Đã đăng FB posts + Zalo broadcast + KOL outreach chưa? (Em không có visibility)
2. **Signup bonus cap?** Giữ 50k×100 (=5tr) hay giảm xuống 30k×100 (=3tr)?
3. **Discount 20% day-1?** Giữ hay bỏ? (Em recommend BỎ vì đã có quá nhiều offer)
4. **Volunteers?** Anh có đủ 6+ friends&family commit ngày 6/6 chưa?
5. **Sửa run-of-show?** Đồng ý timing 7:30-11h + 17h-22h như H1 đề xuất không?

Anh trả lời 5 câu trên qua chat → em sẽ:
- Update `00_MASTER_PLAN.md` với timing mới
- Update `01_LOYALTY_CASHBACK_PROGRAM.md` strip SMS section
- Update `03_DAILY_CHECKLIST.md` với 7 ngày cuối
- Tạo artifact live cho anh check daily progress
- Update DB campaign nếu anh decide giảm bonus

---

## 🔚 KẾT LUẬN

Plan **CƠ BẢN VỮNG** (tech ready, loyalty rules clear, 2-phase logic đúng) nhưng **THIẾU CRITICAL** trong 4 mảng:

1. 🔴 **Mưa risk** không có Plan B cụ thể
2. 🔴 **Offer day-1 cost** ngầm vượt budget 2-3 lần
3. 🔴 **Pháp lý + an toàn** hoàn toàn thiếu
4. 🔴 **Staffing realistic check** — 12-14 người trong Sa Đéc khó tuyển 7 ngày

→ **Nếu xử lý 4 điểm trên trong T7-CN tuần này**, kế hoạch khai trương sẽ vững vàng.
→ **Nếu KHÔNG xử lý**, ngày 6/6 vẫn có thể tổ chức nhưng risk: mưa rào → khách phàn nàn, budget overspend 2x, hoặc thiếu staff peak → service slow → review xấu Google Map.

Em sẵn sàng support anh tất cả 7 ngày tới. Mở chat khi anh cần.

---

📌 **Action số 1 — chỉ 1 thứ phải làm hôm nay:**
**Anh đọc audit này → answer 5 câu hỏi cuối → em re-plan 7 ngày.**
