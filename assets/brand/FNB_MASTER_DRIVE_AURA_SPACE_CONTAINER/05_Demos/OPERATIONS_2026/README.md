# 🏗 OPERATIONS_2026 — Inventory Module + Staff SOPs

> **Tạo bởi:** Em (Claude) cho anh Còn — AURA CAFE Sa Đéc
> **Ngày:** 27/05/2026 (T4) — D-10 trước khai trương 06/06
> **Mục đích:** 2 module bổ sung hệ thống AURA CAFE — Quản lý kho + Vận hành staff

---

## 📂 Cấu trúc

```
OPERATIONS_2026/
├── README.md                              ← (file này)
│
├── inventory_plan/                        ← Module Quản lý Kho Advanced
│   ├── 00_AUDIT_INVENTORY_CURRENT.md      ← Audit Excel + gaps + đề xuất kiến trúc
│   ├── 14-inventory-schema-multi-supplier.md  ← Task 14: DB schema + 41 ingredients
│   ├── 15-inventory-receiving-po.md       ← Task 15: Nhập hàng + PO suggestions
│   ├── 16-recipe-auto-deduct.md           ← Task 16: Recipe + auto-trừ kho từ POS
│   ├── 17-waste-cogs-margin.md            ← Task 17: Waste + COGS + margin report
│   ├── 18-inventory-admin-ui.md           ← Task 18: Admin UI consolidate
│   └── DISPATCH_INVENTORY_COMMANDS.md     ← Commands dispatch worker
│
└── sop_staff/                             ← SOP Vận hành cho Staff
    ├── 01_OPENING_CHECKLIST.md            ← Mở quán 6h-7h
    ├── 02_CLOSING_CHECKLIST.md            ← Đóng quán 21h30-22h30
    ├── 03_BARISTA_RECIPES_SOP.md          ← Quy trình pha 25 món signature
    ├── 04_CASHIER_POS_SOP.md              ← Cashier + POS + loyalty
    ├── 05_CLEANING_SCHEDULE.md            ← Lịch vệ sinh daily/weekly/monthly
    ├── 06_SAFETY_INCIDENT_HANDLING.md     ← Xử lý sự cố (cháy, điện, ngộ độc...)
    └── 07_RECEIVING_INVENTORY_SOP.md      ← Nhận hàng NCC + FIFO + kiểm kê
```

---

## 🎯 MODULE 1 — INVENTORY ADVANCED

### Mục tiêu

Xây hệ thống quản lý kho **đa NCC, recipe-based auto-deduct, COGS, waste tracking** — thay thế Excel thủ công đang dùng.

### 5 Tasks dispatch worker

| Task | Spec | Estimate | Dispatch khi nào? |
|---|---|---|---|
| **14** | Schema v1 + 41 ingredients seed | 4-6h | **Trước 6/6** (anh Còn approve) |
| **15** | Receiving + PO suggestions | 4-6h | Sau khai trương ổn (8/6) |
| **16** | Recipe auto-deduct ⭐ task khó | 6-8h | Sau Task 15 (10/6) |
| **17** | Waste + COGS + margin | 4-6h | Sau Task 16 (12/6) |
| **18** | Admin UI consolidate | 6-8h | Sau Task 17 (13/6) |

**Total estimate:** 24-34h worker → spread 6 ngày calendar (8-13/6).

### ROI dự kiến

- **Tiết kiệm thời gian:** 15h/tháng data entry → 3h
- **Tiết kiệm waste:** 200-400k/tháng
- **Negotiation NCC:** 500-1tr/tháng nhờ price history
- **Visibility margin:** không bán món lỗ → tăng net profit 10-15%

→ **ROI tháng 1 ≈ 1.5-2tr** vs 0đ tiền (worker autonomous).

### Đọc thứ tự

1. Đầu tiên: `00_AUDIT_INVENTORY_CURRENT.md` — hiểu lý do tại sao cần module này
2. Sau: 5 task specs theo thứ tự (14 → 18)
3. Cuối: `DISPATCH_INVENTORY_COMMANDS.md` — cách dispatch

---

## 🎯 MODULE 2 — STAFF SOPs

### Mục tiêu

Đảm bảo 4 staff (Cường / Khánh / Thư / Ngọc) làm việc **đồng đều**, không phụ thuộc 1 người, scale được khi tuyển thêm.

### 7 SOPs

| # | SOP | Đối tượng chính | Tần suất |
|---|---|---|---|
| 01 | Opening Checklist | Ca sáng (Cường/Khánh) | Mỗi sáng 6h |
| 02 | Closing Checklist | Ca tối (Khánh/Thư) | Mỗi tối 22h |
| 03 | Barista Recipes | Pha chế (Cường, Khánh) | Mỗi ly pha |
| 04 | Cashier + POS | Thu ngân (Khánh, Ngọc) | Mỗi đơn hàng |
| 05 | Cleaning Schedule | Tất cả | Daily/Weekly/Monthly |
| 06 | Safety + Incident | Tất cả | Khi xảy ra sự cố |
| 07 | Receiving + Inventory | Cường (chính) | Mỗi lần NCC giao |

### Cách triển khai

#### Bước 1 (28-29/5): Anh Còn review + chỉnh sửa
- Đọc kỹ 7 SOPs
- Sửa theo thực tế quán (vd: số điện thoại NCC thực, số bàn, vị trí cụ thể)
- Em sẽ giúp anh chỉnh sau khi anh feedback

#### Bước 2 (30/5): Họp team + train (2 tiếng)
- Gọi tất cả 4 staff đến quán
- Đọc cùng nhau từng SOP
- Trả lời câu hỏi
- Mỗi staff ký xác nhận đã đọc + hiểu

#### Bước 3 (31/5 - 5/6): In + dán
- Em sẽ tạo version 1-trang A4 print-ready cho mỗi SOP
- Anh in tại tiệm photo → laminate → dán đúng vị trí

#### Bước 4 (6/6 - 30/6): Áp dụng + observe
- Anh Còn quan sát staff có theo SOP không
- Cuối tuần feedback + điều chỉnh

#### Bước 5 (7/7 trở đi): Iterative improvement
- Mỗi quý update SOP 1 lần
- Thêm những case mới gặp

---

## 📅 TIMELINE TỔNG

```
T4 27/5: ← Anh đang đọc plan này
T5 28/5: Anh review + feedback
T6 29/5: Em chỉnh sửa theo feedback
T7 30/5: Họp staff + train SOPs (2h sáng)
CN 31/5: Excel cutoff — không sửa nữa
T2  1/6: Em viết script migrate Excel → D1
T3  2/6: Dispatch Task 14 inventory schema
T4  3/6: Worker hoàn thành Task 14
T5  4/6: Anh + em verify migration + setup baseline
T6  5/6: Setup khai trương cuối cùng (decor, in standee)
T7  6/6: 🎉 KHAI TRƯƠNG
CN  7/6: Day-2 monitor
T2  8/6: Day-3 (cuối campaign x2) — dispatch Task 15
T3  9/6: Task 15 merge
T4 10/6: Dispatch Task 16 (Recipe)
T5 11/6: Task 16 merge (cẩn thận test)
T6 12/6: Dispatch Task 17 (Waste/COGS)
T7 13/6: Dispatch Task 18 (UI consolidate)
CN 14/6: Tất cả deployed — anh review margin report
T3 16/6: Cường + Khánh + anh test full luồng SOPs
```

---

## ✅ CHECKLIST APPROVAL TỪ ANH CÒN

Em cần anh check duyệt:

### Module 1 — Inventory:
- [ ] Schema v1 OK (Task 14)
- [ ] Receiving flow OK (Task 15)
- [ ] **25 recipes OK** (Task 16) — anh + Cường cần test pha thực tế 1 buổi
- [ ] Waste + COGS report OK (Task 17)
- [ ] Admin UI OK (Task 18)
- [ ] Anh đồng ý timing dispatch sau khai trương

### Module 2 — SOPs:
- [ ] Opening 6h SOP OK
- [ ] Closing 22h SOP OK
- [ ] Barista recipes — anh + Cường confirm 25 món
- [ ] Cashier POS flow OK
- [ ] Cleaning schedule (số NCC hoá chất, tần suất)
- [ ] Safety + incident — anh điền số ĐT thực
- [ ] Receiving + FIFO OK

### Logistics:
- [ ] Tủ thuốc sơ cứu — anh mua bổ sung theo list (~500k)
- [ ] Bình cứu hoả CO2 + bột — anh check còn áp (nếu không có, mua mới ~800k)
- [ ] Diễn tập sự cố — sắp lịch buổi đầu tiên (15/6?)
- [ ] In + laminate SOPs (em sẽ tạo file print-ready) — chi phí ~200k

---

## 📌 PRIORITIES — Anh tập trung gì TRƯỚC?

### 🔴 Critical (trước 6/6):
1. **SOP 01, 02, 06** (Opening / Closing / Safety) — staff đọc + ký xác nhận
2. **Task 14** (Inventory schema) — cần có baseline trước khi launch
3. **Tủ thuốc + bình cứu hoả** — an toàn pháp lý

### 🟡 Important (1-2 tuần sau launch):
4. **SOP 03, 04, 05, 07** — fine-tune theo thực tế khai trương
5. **Tasks 15, 16, 17, 18** — module inventory advanced

### 🟢 Nice-to-have (1 tháng sau):
6. Diễn tập sự cố quý đầu
7. Đánh giá NCC quý đầu
8. Margin review tháng đầu

---

## 🤝 LIÊN HỆ KHI CẦN

- **Hỏi về spec inventory:** Mở chat với em, em sẽ explain task spec cụ thể
- **Hỏi về SOP cụ thể:** Mở SOP file → đọc + hỏi em phần chưa rõ
- **Sự cố trong dispatch:** Báo em qua Cowork — em sẽ dispatch qua GitHub MCP fallback

---

## 🎉 KẾT LUẬN

Sau khi triển khai đầy đủ 2 module:

**Inventory:**
- ✅ 41 ingredients tracked real-time
- ✅ Multi-supplier với price history
- ✅ Recipe-based COGS per menu
- ✅ Waste tracking + monthly report
- ✅ PO suggestions từ low-stock
- ✅ Admin dashboard 8 widgets

**Staff:**
- ✅ Onboarding mới chỉ 4 tuần (vs ad-hoc trước đây)
- ✅ Mỗi việc có người chịu trách nhiệm
- ✅ Sự cố xử lý theo flow chuẩn (cứu người trước)
- ✅ Vệ sinh tự kiểm tra qua bảng (anh Còn không phải nhắc)
- ✅ Margin từng món visible → bán món lãi cao hơn

→ **AURA CAFE sẵn sàng scale chi nhánh 2-3 trong 12 tháng tới**.

---

🙏 Em chúc anh + team launch thành công 06/06 và vận hành 6 tháng đầu suôn sẻ!
