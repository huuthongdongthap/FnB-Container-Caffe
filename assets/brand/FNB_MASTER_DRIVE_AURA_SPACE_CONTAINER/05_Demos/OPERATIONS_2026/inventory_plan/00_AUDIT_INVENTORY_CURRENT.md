# 📦 AUDIT INVENTORY HIỆN TẠI — AURA CAFE

> **Ngày:** 27/05/2026 (T4) — D-10 trước khai trương 06/06
> **Input:** `BAO-CAO thang 05.2026 (21).xlsx` + codebase `FnB-Container-Caffe`
> **Mục đích:** Đánh giá hệ thống quản lý kho hiện tại → đề xuất kiến trúc full advanced module

---

## 1️⃣ HIỆN TRẠNG — Excel-based (tháng 5/2026)

### 1.1 File báo cáo cấu trúc

| Sheet | Chức năng | Dòng | Trạng thái |
|---|---|---|---|
| HƯỚNG DẪN | Manual sử dụng file | 32 | ✅ Có |
| DOANH THU | Daily revenue 2 ca (sáng/chiều) | 77 | ✅ Đang dùng |
| NGUYÊN LIỆU | Bảng nhập-xuất-tồn 41 items × 31 ngày | 50 × 100 | ⚠️ Format khó scale |
| NHẬP HÀNG | Sổ ghi nhập NCC (manual) | 263 | ⚠️ Không liên kết tồn |
| BCC | Chấm công 4 nhân viên (Khánh/Cường/Thư/Ngọc) | 57 | ✅ Đang dùng |
| TỔNG HỢP THÁNG | Aggregation 12 tháng | 22 | ⚠️ Có `#N/A`, `#VALUE!` |

### 1.2 Danh sách 41 nguyên liệu hiện có

**Cà phê + base (10):** Café D2, D4, PHIN, Sữa đặc, Sữa tươi Vinamilk, Trà đào Cozy, Đào ngâm, Sữa tươi CAPU, Sữa chua VNM, Rich

**Bột + topping (8):** Bột trà xanh, Bột Cacao, Lipton, Chocolate, Surup các loại, Mứt sinh tố các loại, Bột Frap, Oreo

**Đường + trái cây (7):** Đường cát, Chanh, Cam, Dâu tây, Sapo, Mãng cầu, Dừa tươi

**Nước + thuốc (8):** STING, PEPSI, COCA, REDBULL, 7 UP, Ô LONG, Nước suối, Thuốc mèo + 555

**Vật tư + rau má (8):** Đá viên, Ly nhựa, Ly giấy nóng, Nắp ly, Ống hút, Rau má, Bọc rác

→ Đủ rộng để map 1-1 vào bảng `ingredients` mới.

### 1.3 Insights từ data tháng 5/2026

**Doanh thu thực tế (13 ngày đầu tháng 5):**
- Trung bình ngày có khách: ~1.1tr - 1.4tr
- Số ly/ngày trung bình: 44-73 ly (chiều > sáng nhiều)
- Số đơn/ngày: 25-39 đơn
- Tổng 13 ngày: ~14.4tr doanh thu thực (cash dominant)

**Nhập hàng tháng 5:**
- 263 dòng nhập trong 1 tháng → ~8-10 lần nhập/ngày
- NCC trống cột "Nhà cung cấp" → **không track được ai bán gì giá nào**
- Đơn giá thay đổi liên tục (Mứt me 55k + 42k cùng ngày) → cần price history

**Chấm công:**
- 4 staff: Khánh (252h), Cường (254h), Thư (201.5h), Ngọc (5.5h - mới)
- ~3 staff full-time → cần SOP rõ ràng để Ngọc onboard nhanh

---

## 2️⃣ VẤN ĐỀ NGHIÊM TRỌNG (gaps)

### 🔴 P0 — Phải fix trước khi mở rộng

#### Bug 1: Data entry không có validation
**Ví dụ:** NHẬP HÀNG dòng 15 (3/5/2026): "SỮA TƯƠI BỊCH 7,200 × 36,000 = 259,200,000đ"
→ Rõ ràng là typo (chắc 2 bịch hoặc 7.2kg). Excel không chặn.
→ Module mới phải có: max quantity check, price reasonableness check.

#### Bug 2: Tồn kho không phản ánh thực tế
- Cột "Xuất" trong sheet NGUYÊN LIỆU là **manual** (staff phải nhập tay mỗi ngày)
- Không match với DOANH THU (bán bao nhiêu ly → trừ bao nhiêu cf/sữa?)
- → Reality: tồn cuối ngày luôn sai so với kho thật → **mất control margin**

#### Bug 3: Không có cost-per-cup
- Bán 1 ly cf sữa 25k → cost bao nhiêu? Không ai biết chính xác.
- Không có recipe → không biết món nào lãi/lỗ
- → Khai trương 6/6 với 50 voucher 30k + cashback 5-10% mà không biết margin từng món = **rủi ro tài chính**

#### Bug 4: Lãng phí (waste) không tracking
- Sữa tươi mở hộp hết hạn → đổ bỏ. Không ai ghi.
- Trái cây mềm/úng → bỏ. Không ai ghi.
- → Không biết % waste/tháng → không cải thiện được

### 🟡 P1 — Sẽ trở thành blocker sau 2-3 tháng

#### Gap 5: Single-supplier, no price history
- Excel không hỗ trợ "Mứt me NCC A 55k vs NCC B 42k"
- Khi giá tăng, không biết là giá tăng thật hay đổi NCC
- Không có buying power analysis

#### Gap 6: PO (Purchase Order) thủ công
- Tồn thấp → Cường đi mua trực tiếp → ghi tay → không có audit trail
- Không có "đề xuất nhập" tự động từ low-stock

#### Gap 7: Multi-location chưa scale được
- Hiện chỉ 1 chi nhánh Sa Đéc
- Tương lai mở thêm chi nhánh → Excel không cover được

---

## 3️⃣ CODEBASE HIỆN CÓ — Phần inventory đã build

### 3.1 Schema hiện tại trong D1 (qua audit code)

```bash
# Migrations đã apply:
# 20260101_init.sql         — products, orders, order_items, customers
# 20260518_03_loyalty_v2.sql — loyalty_tiers, cashback_*, bonus_campaigns
# 20260519_01_customers_signup_fields.sql — date_of_birth, zalo, source
```

**Bảng products đã có** (tương đương "menu_items"):
- `id`, `name`, `category`, `price`, `is_active`, `image_url`

**Đã có nhưng KHÔNG dùng cho inventory:**
- Không có `ingredients` table
- Không có `recipes` table
- Không có `stock_movements` table
- Không có `suppliers` table

→ Cần migrations mới (số thứ tự tiếp theo: `20260527_01_inventory_v1.sql`)

### 3.2 Routes hiện có

```
/api/orders/*          — Tạo order + xử lý loyalty cashback
/api/loyalty/*         — Member lookup, signup, tiers
/api/admin/loyalty/*   — Admin dashboard widgets
```

**Cần thêm:**
```
/api/inventory/ingredients          — CRUD nguyên liệu
/api/inventory/suppliers            — CRUD NCC
/api/inventory/recipes              — Recipe per product
/api/inventory/movements            — Nhập/xuất/waste
/api/inventory/purchase-orders      — PO management
/api/admin/inventory/*              — Reports + alerts
```

---

## 4️⃣ KIẾN TRÚC ĐỀ XUẤT — Inventory v1 Advanced

### 4.1 Modules — 5 tasks dispatched cho worker

| Task | Spec file | Estimate | Dependency |
|---|---|---|---|
| **14** | `14-inventory-schema-multi-supplier.md` | 4-6h | Standalone |
| **15** | `15-inventory-receiving-po.md` | 4-6h | After 14 |
| **16** | `16-recipe-auto-deduct.md` | 6-8h | After 14 |
| **17** | `17-waste-cogs-margin.md` | 4-6h | After 14, 16 |
| **18** | `18-inventory-admin-ui.md` | 6-8h | After 14-17 |

**Total estimated:** 24-34h worker time → spread 4-6 ngày calendar.

### 4.2 Diagram luồng dữ liệu

```
┌─────────────────────────────────────────────────────────────┐
│  STAFF (Cường/Khánh)                                        │
│  ├─ Mở quán → kiểm kê đầu ca (count tồn thực tế)            │
│  ├─ Nhận hàng từ NCC → POST /receiving                      │
│  └─ Đổ bỏ hỏng → POST /waste                                │
└─────────────────────────────────────────────────────────────┘
              ↓                ↓                ↓
┌─────────────────────────────────────────────────────────────┐
│  D1 stock_movements (audit log)                             │
│  type IN ('receive', 'sale_deduct', 'waste', 'adjust',     │
│           'count_diff')                                     │
└─────────────────────────────────────────────────────────────┘
              ↑
              │
┌─────────────────────────────────────────────────────────────┐
│  POS (Cashier)                                              │
│  ├─ Bán 1 ly Cf sữa đá                                      │
│  ├─ Trigger: trừ kho theo recipe                            │
│  │    cf D2: -18g, sữa đặc: -25ml, đá: -150g, ly nhựa: -1  │
│  └─ Tự động ghi vào stock_movements (type='sale_deduct')    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD (Anh Còn / kế toán)                        │
│  ├─ Stock real-time + alert low-stock                       │
│  ├─ Recipes manager + COGS auto-calc                        │
│  ├─ PO suggestions (low-stock → đặt NCC nào, giá nào)       │
│  ├─ Margin report per menu_item                             │
│  └─ Waste % monthly                                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Tech stack

- **Backend:** Cloudflare Workers + D1 (giữ stack hiện tại)
- **Auth:** JWT existing (admin/staff roles từ users table)
- **Frontend:** HTML/CSS/JS vanilla cho `/admin/inventory/*`, không cần React
- **Migration:** D1 SQLite — tuân thủ "no ALTER TABLE ADD COLUMN IF NOT EXISTS"

---

## 5️⃣ ROI EXPECTED

### Sau khi triển khai 5 tasks:

**Tiết kiệm thời gian (quantified):**
- Excel data entry: ~30 phút/ngày × 30 = **15h/tháng** (Khánh/Cường) → giảm 80% còn 3h
- Báo cáo cuối tháng: 4h thủ công → 5 phút auto
- Đi mua bổ sung: giảm 2 lần/tuần (nhờ PO suggestion) → tiết kiệm 4h/tuần

**Tiền:**
- Phát hiện waste 1-2% sớm → tiết kiệm **200-400k/tháng** chi phí nguyên liệu
- Negotiation NCC nhờ price history → giảm cost ~5% = **500-1tr/tháng**
- Không bán món lỗ (visibility margin) → tăng net profit ~10-15%

**Ước tính: ROI tháng 1 = ~1.5-2tr tiết kiệm vs 24-34h worker time (≈ free vì worker autonomous).**

---

## 6️⃣ MIGRATION PLAN từ Excel → System

### Phase 1 (D-10 → D-3, 27/5 - 3/6): Build & test trên local
- Worker dispatched 5 tasks
- Anh + em test trên dev environment

### Phase 2 (D-3 → D-1, 3/6 - 5/6): Data migration
- Em viết script `scripts/migrate-excel-to-d1.js`
- Import 41 ingredients từ Excel
- Import 263 lần nhập hàng tháng 5 vào `stock_movements` (type='receive')
- Import opening balance 27/5 từ "đầu kỳ" Excel

### Phase 3 (D-Day 6/6): Soft launch
- Sáng 6/6: kiểm kê tay 1 lần để set baseline
- Mở quán: dùng app song song với Excel 1 tuần để verify
- 13/6: Cut over hoàn toàn — chỉ dùng app

### Phase 4 (D+30, 6/7): Review
- Anh Còn + em review margin per menu
- Identify món lỗ → đề xuất price adjustment
- Tinh chỉnh recipes (nếu thực tế cost khác design)

---

## 7️⃣ RECOMMENDATION — Em đề xuất

✅ **Đồng ý dispatch 5 tasks 14-18** theo thứ tự trên.

⚠️ **Lưu ý:**
1. **Task 16 (recipe auto-deduct) là phần khó nhất** — cần test kỹ trước 6/6 để không làm gián đoạn POS
2. **Cần khoá data Excel tháng 5 cuối tháng** trước khi migrate — không sửa Excel sau 31/5
3. **Anh + Cường + Khánh phải tham gia define recipe** — em không thể đoán "1 ly cf sữa = bao nhiêu g cf" mà không hỏi người pha

📋 **Next step:** Anh đọc 5 task specs → confirm → em soạn dispatch commands.
