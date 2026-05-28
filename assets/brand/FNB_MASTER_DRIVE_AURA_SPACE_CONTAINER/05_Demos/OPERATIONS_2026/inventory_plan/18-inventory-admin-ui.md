# 🖥 TASK 18 — Inventory Admin UI consolidation

> **Repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch target:** `feat/inventory-admin-ui`
> **Estimated:** 6-8h worker autonomous
> **Dependency:** Tasks 14, 15, 16, 17 all merged

---

## 🎯 Objective

Consolidate tất cả inventory UI thành 1 navigation thống nhất, optimized UX:

```
/admin/inventory/
├── index.html        — Dashboard (default)
├── stock.html        — Real-time stock + alerts
├── receiving.html    — Nhập hàng (Task 15)
├── recipes.html      — Recipes manager (Task 16)
├── waste.html        — Log waste (Task 17)
├── suppliers.html    — Suppliers + price history
├── reports.html      — All reports (margin, waste, COGS)
├── po-suggestions.html — PO gợi ý (Task 15)
└── kiem-ke.html      — Physical count (kiểm kê tay)
```

Plus integrate vào admin nav existing.

---

## 📋 Acceptance Criteria

1. ✅ 9 pages render đúng brand (#0A0A0A bg, #C9A200 gold, #1A1A1A cards)
2. ✅ Mobile-responsive (375px - 1920px)
3. ✅ Sidebar nav consistent với admin pages existing
4. ✅ Stock dashboard real-time (poll 30s hoặc websocket nếu CF Workers support)
5. ✅ Kiểm kê tay (physical count) tự sinh `stock_movements` type='count_diff'
6. ✅ Tất cả pages dark theme + Inter/Playfair fonts
7. ✅ PR mở: "feat(inventory): admin UI complete navigation"

---

## 🎨 Page details

### Page 1: `/admin/inventory/index.html` — Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ 🍵 AURA — INVENTORY                          👤 Anh Còn  🚪     │
├──────────────┬──────────────────────────────────────────────────┤
│ 📊 Dashboard │  📅 Hôm nay: 27/05/2026                           │
│ 📦 Stock     │                                                  │
│ 📥 Nhập hàng │  ┌──────────┬──────────┬──────────┬──────────┐  │
│ 🛒 PO gợi ý  │  │ Tổng     │ Low      │ Hết      │ Tồn giá  │  │
│ 🍵 Recipes   │  │ 41 ng.l. │ 6 mục    │ 2 mục    │ ~32tr    │  │
│ 🗑 Waste     │  └──────────┴──────────┴──────────┴──────────┘  │
│ 📋 Kiểm kê   │                                                  │
│ 🏢 Suppliers │  ┌─── 🔴 LOW STOCK (cần nhập sớm) ─────────────┐ │
│ 📈 Reports   │  │ ⚠ Café D2:        1.5kg / 2kg min            │ │
│              │  │ ⚠ Sữa tươi VNM:   3 bịch / 5 bịch            │ │
│              │  │ ❌ Dâu tây:        0 kg / 0.5kg                │ │
│              │  │ ❌ Sữa CAPU:       0 hộp / 2 hộp               │ │
│              │  │ ⚠ Đào ngâm:       1 lon / 2 lon                │ │
│              │  │ ⚠ Sapo:           0.5kg / 1kg                  │ │
│              │  │ [📋 Xem PO gợi ý] [🛒 Nhập ngay]               │ │
│              │  └────────────────────────────────────────────────┘ │
│              │                                                  │
│              │  ┌─── 💸 WASTE TODAY ────────────────────────────┐│
│              │  │ 3 lần đổ bỏ — 120,000đ                        ││
│              │  │ • Sữa VNM 1 bịch (hết hạn)                    ││
│              │  │ • Sữa CAPU 1 hộp (vỡ)                          ││
│              │  │ • Cf D4 0.05kg (pha hỏng)                     ││
│              │  │ Tháng này: 28 lần — 1.24tr (3.2% revenue)     ││
│              │  └────────────────────────────────────────────────┘│
│              │                                                  │
│              │  ┌─── 📈 MARGIN TODAY ──────────────────────────┐ │
│              │  │ Doanh thu hôm qua: 1,663,000đ                 │ │
│              │  │ COGS ước tính:      612,000đ (36.8%)          │ │
│              │  │ Gross profit:      1,051,000đ (63.2%)         │ │
│              │  │ Top món bán chạy: Cf sữa đá ×34, Trà đào ×18 │ │
│              │  └───────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────┘
```

### Page 2: `/admin/inventory/stock.html` — Real-time stock

```
┌───────────────────────────────────────────────────────────────┐
│ 📦 KHO HIỆN TẠI                            🔍 [______]  [⟳]    │
│                                                               │
│ Category: [Tất cả ▼]  Status: [Tất cả ▼]  Sort: [Tên ▲▼]      │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ STT │ SKU       │ Tên                  │ Tồn   │ Min  │  │ │
│ ├─────┼───────────┼──────────────────────┼───────┼──────┤  │
│ │  1  │ CF_D2     │ ☕ Café D2            │ 1.5kg │ 2 ⚠ │  │
│ │  2  │ CF_D4     │ ☕ Café D4            │ 4kg   │ 2 ✅ │  │
│ │  3  │ CF_PHIN   │ ☕ Café phin          │ 0.3kg │ 0.5⚠│  │
│ │  4  │ SUA_DAC   │ 🥛 Sữa đặc           │ 5 hộp │ 3 ✅ │  │
│ │  5  │ SUA_VNM   │ 🥛 Sữa tươi VNM      │ 3 bịch│ 5 ⚠ │  │
│ │ ... │ ...       │ ...                  │ ...   │ ... │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ Page 1/3                                  [« Trước] [Sau »]   │
└───────────────────────────────────────────────────────────────┘
```

Click row → modal detail với:
- Last 10 movements (nhập/xuất/waste)
- Suppliers + price history
- Avg consumption per day (last 30d)
- Days of stock remaining

### Page 3: `/admin/inventory/kiem-ke.html` — Physical count

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 KIỂM KÊ TAY                                              │
│                                                             │
│ Ngày kiểm kê: 27/05/2026   Người: Cường                    │
│ Loại: ◉ Cuối ca chiều  ○ Cuối tuần  ○ Cuối tháng           │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Nguyên liệu       │ Hệ thống │ Đếm thực │ Lệch  │ Lý do  ││
│ │ Café D2           │ 1.5      │ [1.4 ]   │ -0.1  │ ____   ││
│ │ Café D4           │ 4.0      │ [4.0 ]   │  0    │  -     ││
│ │ Sữa đặc           │ 5        │ [5  ]    │  0    │  -     ││
│ │ Sữa tươi VNM      │ 3        │ [2  ]    │ -1    │ ____   ││
│ │ ...                                                       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Tổng số mục chênh lệch: 3                                  │
│ Tổng cost chênh: ~75,000đ                                  │
│                                                             │
│ [💾 Lưu nháp]  [✅ Confirm + áp dụng]                       │
└─────────────────────────────────────────────────────────────┘
```

Khi confirm → mỗi mục chênh lệch sẽ tạo `stock_movement` type='count_diff' với qty_delta = (đếm thực - hệ thống), notes = ghi chú.

### Page 4: `/admin/inventory/suppliers.html`

```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 NHÀ CUNG CẤP                              [+ Thêm NCC]    │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ NCC Sa Đéc Trung Tâm                         ★ Pref   │   │
│ │ 📞 0277xxxxxxx   👤 Anh Tâm                            │   │
│ │ 💳 COD          📦 12 ingredients link                │   │
│ │ Tổng nhập tháng này: 8,500,000đ                       │   │
│ │ Last order: 26/05/2026                                │   │
│ │ [👁 Detail] [✏ Edit] [📋 Tạo PO]                       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Cà Phê Buôn Mê Thuột (đại lý)              ★ Pref     │   │
│ │ ...                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Click → Detail page với price history per ingredient (line chart).

### Page 5: `/admin/inventory/reports.html`

3 tabs: **Margin** | **Waste** | **Consumption**

- **Margin tab:** Embed `margin-dashboard.html` content
- **Waste tab:** 3 charts từ Task 17
- **Consumption tab:** Top consumed ingredients (per day/week/month) + projection

---

## 🎨 Style guide (consistent với existing admin)

```css
/* AURA brand colors */
:root {
  --bg-primary: #0A0A0A;
  --bg-card: #1A1A1A;
  --bg-card-hover: #252525;
  --text-primary: #FAFAFA;
  --text-secondary: #B0B0B0;
  --text-muted: #707070;
  --accent-gold: #C9A200;
  --accent-amber: #FFB300;
  --accent-electric: #FFD700;
  --status-ok: #4ADE80;
  --status-warn: #FBBF24;
  --status-danger: #EF4444;
  --border: #2A2A2A;
}

/* Typography */
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
}
h1, h2, h3 { font-family: 'Playfair Display', serif; }
.mono, .price { font-family: 'JetBrains Mono', monospace; }

/* Cards */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}

/* Status badges */
.status-ok { color: var(--status-ok); background: rgba(74,222,128,0.1); }
.status-warn { color: var(--status-warn); background: rgba(251,191,36,0.1); }
.status-danger { color: var(--status-danger); background: rgba(239,68,68,0.1); }
```

---

## 🔌 New endpoints cần thiết

### 1. POST `/api/inventory/count` — Kiểm kê tay

```json
{
  "count_type": "shift_end",
  "items": [
    { "ingredient_id": "ING_CF_D2", "system_qty": 1.5, "counted_qty": 1.4, "notes": "đo bằng cân" }
  ]
}
```

Logic: Insert N stock_movements với `type='count_diff'`, `qty_delta = counted - system`.

### 2. GET `/api/admin/inventory/dashboard` — Dashboard data aggregate

Trả về object cho page `index.html`:
```json
{
  "summary": { "total_ingredients": 41, "low_stock_count": 6, "out_of_stock_count": 2, "total_value": 32000000 },
  "low_stock": [...],
  "waste_today": { "count": 3, "cost": 120000 },
  "waste_month": { "count": 28, "cost": 1240000, "pct_revenue": 3.2 },
  "margin_yesterday": { "revenue": 1663000, "cogs": 612000, "gross_profit": 1051000, "margin_pct": 63.2 },
  "top_sold_yesterday": [{"product_id": "...", "name": "Cf sữa đá", "qty": 34}]
}
```

### 3. GET `/api/admin/inventory/consumption-report`

Top consumed ingredients trong period, với projection cho tháng sau dựa avg.

---

## 🧪 Test cases

```js
describe('Admin UI integration', () => {
  it('dashboard endpoint returns full aggregate', async () => {
    const res = await GET('/api/admin/inventory/dashboard');
    expect(res.summary).toBeDefined();
    expect(res.summary.total_ingredients).toBe(41);
  });

  it('physical count creates correct stock_movements', async () => {
    await POST('/api/inventory/count', {
      count_type: 'shift_end',
      items: [{ ingredient_id: 'ING_CF_D2', system_qty: 1.5, counted_qty: 1.4 }]
    });

    const sm = await db.prepare(
      "SELECT qty_delta FROM stock_movements WHERE type='count_diff' AND ingredient_id='ING_CF_D2' ORDER BY created_at DESC LIMIT 1"
    ).first();
    expect(sm.qty_delta).toBe(-0.1);
  });
});
```

---

## 📱 Mobile-first considerations

- Sidebar collapse vào hamburger menu < 768px
- Table → card list trên mobile
- Form input đủ to (44px min touch target)
- Modal full-screen trên mobile

---

## 🏁 Definition of Done

- [ ] 9 pages render đúng style
- [ ] Mobile responsive 375-1920px
- [ ] 3 new endpoints (count, dashboard, consumption-report) test pass
- [ ] Stock auto-refresh 30s
- [ ] PR mở: "feat(inventory): admin UI complete navigation"
