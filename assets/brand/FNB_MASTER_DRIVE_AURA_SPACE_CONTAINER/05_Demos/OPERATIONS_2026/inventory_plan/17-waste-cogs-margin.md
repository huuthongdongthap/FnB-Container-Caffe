# 🗑 TASK 17 — Waste tracking + COGS + Margin report

> **Repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch target:** `feat/inventory-waste-cogs`
> **Estimated:** 4-6h worker autonomous
> **Dependency:** Tasks 14 + 16 merged

---

## 🎯 Objective

1. UI/API cho staff ghi waste hàng ngày (sữa hết hạn, trái cây úng, pha hỏng...)
2. Tính COGS (Cost of Goods Sold) per menu_item từ recipes + giá vốn 30d gần nhất
3. Margin report: bán món nào lãi/lỗ
4. Daily/Weekly/Monthly waste report (% waste, top items, top reasons)

---

## 📋 Acceptance Criteria

1. ✅ `/admin/inventory/waste.html` — quick log waste (mobile, 2-tap)
2. ✅ POST `/api/inventory/waste` — log + auto-insert stock_movement
3. ✅ GET `/api/admin/inventory/margin-report` — margin per menu_item theo tuần/tháng
4. ✅ GET `/api/admin/inventory/waste-report` — analytics waste
5. ✅ PR mở: "feat(inventory): waste tracking + COGS + margin report"

---

## 🔌 API endpoints

### 1. POST `/api/inventory/waste`

**Auth:** Staff JWT

**Body:**
```json
{
  "items": [
    {
      "ingredient_id": "ING_SUA_VNM",
      "qty": 2,
      "reason": "expired",
      "notes": "Hết hạn 24/5, không bán được"
    },
    {
      "ingredient_id": "ING_DAU_TAY",
      "qty": 0.3,
      "reason": "damaged",
      "notes": "Úng do tủ lạnh hơi nóng"
    }
  ]
}
```

**Logic:**
```js
async function logWaste(db, payload, staffId) {
  const wasteIds = [];

  for (const item of payload.items) {
    const wasteId = `WASTE_${dayjs().format('YYYYMMDD')}_${nanoid(8)}`;
    const smId = `SM_WASTE_${wasteId}`;

    // Lấy giá vốn để tính estimated_cost
    const cost = await db.prepare(
      "SELECT avg_unit_cost_30d FROM v_ingredient_cost WHERE ingredient_id=?"
    ).bind(item.ingredient_id).first();
    const estimatedCost = (cost?.avg_unit_cost_30d || 0) * item.qty;

    await db.batch([
      db.prepare(`
        INSERT INTO waste_log (id, ingredient_id, qty, reason, estimated_cost, notes, staff_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(wasteId, item.ingredient_id, item.qty, item.reason, estimatedCost, item.notes, staffId),

      db.prepare(`
        INSERT INTO stock_movements (id, ingredient_id, type, qty_delta, unit_cost, reference_type, reference_id, notes, staff_id)
        VALUES (?, ?, 'waste', ?, ?, 'waste_log', ?, ?, ?)
      `).bind(smId, item.ingredient_id, -Math.abs(item.qty), cost?.avg_unit_cost_30d || 0, wasteId,
              `Waste: ${item.reason} - ${item.notes || ''}`, staffId)
    ]);

    wasteIds.push(wasteId);
  }

  return { waste_ids: wasteIds, total_estimated_cost: 0 /* calculated */ };
}
```

### 2. GET `/api/admin/inventory/margin-report`

**Query params:** `period` (`day`, `week`, `month`), `date_from`, `date_to`

**Response:**
```json
{
  "period": "month",
  "date_from": "2026-05-01",
  "date_to": "2026-05-31",
  "products": [
    {
      "product_id": "PROD_CF_SUA_DA",
      "product_name": "Cà phê sữa đá",
      "qty_sold": 234,
      "revenue": 5850000,
      "cogs": 1989000,
      "gross_profit": 3861000,
      "margin_pct": 66.0,
      "category": "★ Lãi cao"
    },
    {
      "product_id": "PROD_NUOC_DUA",
      "product_name": "Nước dừa tươi",
      "qty_sold": 45,
      "revenue": 1350000,
      "cogs": 990000,
      "gross_profit": 360000,
      "margin_pct": 26.7,
      "category": "⚠ Lãi thấp"
    }
  ],
  "summary": {
    "total_revenue": 38500000,
    "total_cogs": 14200000,
    "gross_margin_pct": 63.1,
    "high_margin_items": 12,
    "low_margin_items": 3
  }
}
```

**SQL chính:**
```sql
WITH product_sales AS (
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.price,
    SUM(oi.quantity) AS qty_sold,
    SUM(oi.quantity * p.price) AS revenue
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'completed'
    AND o.created_at BETWEEN ? AND ?
  GROUP BY p.id
),
product_cogs AS (
  SELECT
    r.product_id,
    SUM(ri.qty * COALESCE(vic.avg_unit_cost_30d, 0)) AS cost_per_unit
  FROM recipes r
  JOIN recipe_items ri ON ri.recipe_id = r.id
  LEFT JOIN v_ingredient_cost vic ON vic.ingredient_id = ri.ingredient_id
  WHERE r.is_active = 1
  GROUP BY r.product_id
)
SELECT
  ps.product_id,
  ps.product_name,
  ps.qty_sold,
  ps.revenue,
  ps.qty_sold * COALESCE(pc.cost_per_unit, 0) AS cogs,
  ps.revenue - ps.qty_sold * COALESCE(pc.cost_per_unit, 0) AS gross_profit,
  CASE WHEN ps.revenue > 0
    THEN (ps.revenue - ps.qty_sold * COALESCE(pc.cost_per_unit, 0)) * 100.0 / ps.revenue
    ELSE 0 END AS margin_pct
FROM product_sales ps
LEFT JOIN product_cogs pc ON pc.product_id = ps.product_id
ORDER BY gross_profit DESC;
```

### 3. GET `/api/admin/inventory/waste-report`

**Query:** `period`, `group_by` (`reason`, `ingredient`, `staff`)

**Response:**
```json
{
  "period": "month",
  "total_waste_cost": 1240000,
  "waste_pct_of_revenue": 3.2,
  "by_reason": [
    { "reason": "expired", "count": 12, "cost": 850000, "pct": 68.5 },
    { "reason": "damaged", "count": 8, "cost": 240000, "pct": 19.4 },
    { "reason": "spilled", "count": 5, "cost": 100000, "pct": 8.0 },
    { "reason": "overcooked", "count": 3, "cost": 50000, "pct": 4.0 }
  ],
  "by_ingredient": [
    { "ingredient": "Sữa tươi VNM", "qty": 8, "unit": "bịch", "cost": 280000 },
    { "ingredient": "Dâu tây", "qty": 1.2, "unit": "kg", "cost": 240000 }
  ],
  "trend": [
    { "date": "2026-05-01", "cost": 45000 },
    { "date": "2026-05-02", "cost": 30000 }
  ]
}
```

---

## 🎨 UI Pages

### Page A: `/admin/inventory/waste.html` — Quick log (mobile-first)

```
┌──────────────────────────────────────────────────┐
│ 🗑 GHI NHẬN HÀNG ĐỔ BỎ                            │
│                                                  │
│ Quick-pick (top 10 hay đổ):                     │
│ [Sữa tươi VNM] [Dâu tây] [Trà đào] [Sữa chua]   │
│                                                  │
│ Nguyên liệu: [Sữa tươi VNM ▼]                   │
│ Số lượng:    [_1__] [bịch]                       │
│ Lý do:                                           │
│   ◉ Hết hạn   ○ Hỏng/úng  ○ Đổ vỡ                │
│   ○ Pha hỏng  ○ Pha test  ○ Khác                 │
│                                                  │
│ Ghi chú: [_______________________]              │
│                                                  │
│ Ước tính cost: 36,000 đ                          │
│                                                  │
│ [✅ Lưu]                                         │
│                                                  │
│ ─────────────────────                            │
│ Hôm nay đã log: 3 lần (120,000 đ)               │
│ Tháng này: 28 lần (1,240,000 đ ≈ 3.2% revenue)  │
└──────────────────────────────────────────────────┘
```

### Page B: `/admin/inventory/margin-dashboard.html`

```
┌──────────────────────────────────────────────────┐
│ 📊 MARGIN DASHBOARD                              │
│ Period: [Tháng này ▼]  [📥 Export CSV]           │
│                                                  │
│ ┌──────────────────────────────────────────────┐│
│ │ 🟢 LÃI CAO (margin > 60%)                     ││
│ │ 1. Cà phê đen đá       82% (×234)             ││
│ │ 2. Cà phê sữa đá       66% (×201)             ││
│ │ 3. Trà chanh           71% (×156)             ││
│ │ 4. Americano           75% (×98)              ││
│ │ ... (12 items)                                ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ ┌──────────────────────────────────────────────┐│
│ │ 🟡 LÃI VỪA (40-60%)                            ││
│ │ 1. Sinh tố dâu         52% (×45)              ││
│ │ 2. Frap mocha          48% (×38)              ││
│ │ ... (8 items)                                 ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ ┌──────────────────────────────────────────────┐│
│ │ 🔴 LÃI THẤP (<40%) — CẢNH BÁO                  ││
│ │ 1. Nước dừa tươi       27% (×45)               ││
│ │    → Cost tăng do dừa lên 25k/trái             ││
│ │    [💡 Đề xuất tăng giá lên 35k]               ││
│ │ 2. Sinh tố mãng cầu    34% (×12)               ││
│ │ 3. Latte               38% (×67)               ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ ─────────────────────────────────────────────   │
│ 📈 TỔNG KẾT THÁNG                                │
│ Revenue:    38,500,000 đ                         │
│ COGS:       14,200,000 đ (36.9%)                 │
│ Waste:       1,240,000 đ (3.2%)                  │
│ Gross profit: 23,060,000 đ                       │
│ Margin:     59.9%                                │
└──────────────────────────────────────────────────┘
```

### Page C: `/admin/inventory/waste-report.html`

Similar layout với 3 chart:
- Pie chart: waste theo reason
- Bar chart: top 10 nguyên liệu waste nhất
- Line chart: waste trend 30 ngày

---

## 🧪 Test cases

```js
describe('Waste tracking', () => {
  it('inserts both waste_log and stock_movement on submit', async () => {
    await POST('/api/inventory/waste', {
      items: [{ ingredient_id: 'ING_SUA_VNM', qty: 2, reason: 'expired', notes: 'test' }]
    });

    const wasteCount = await db.prepare("SELECT COUNT(*) AS cnt FROM waste_log WHERE notes='test'").first();
    expect(wasteCount.cnt).toBe(1);

    const smCount = await db.prepare("SELECT COUNT(*) AS cnt FROM stock_movements WHERE type='waste' AND reference_type='waste_log'").first();
    expect(smCount.cnt).toBeGreaterThanOrEqual(1);
  });

  it('reduces current stock correctly', async () => {
    const before = await db.prepare("SELECT current_qty FROM v_current_stock WHERE ingredient_id='ING_SUA_VNM'").first();
    await POST('/api/inventory/waste', { items: [{ ingredient_id: 'ING_SUA_VNM', qty: 1, reason: 'expired' }] });
    const after = await db.prepare("SELECT current_qty FROM v_current_stock WHERE ingredient_id='ING_SUA_VNM'").first();
    expect(after.current_qty).toBe(before.current_qty - 1);
  });

  it('margin report correctly identifies low-margin items', async () => {
    // Setup orders + recipes
    const res = await GET('/api/admin/inventory/margin-report?period=month');
    expect(res.products.some(p => p.margin_pct < 40)).toBe(true);
  });
});
```

---

## 📊 Daily auto-report (cron)

Worker scheduled task lúc 23h hàng ngày:

```js
// worker/src/scheduled.js
export default {
  async scheduled(controller, env, ctx) {
    const today = dayjs().format('YYYY-MM-DD');

    // 1. Tính waste hôm nay
    const wasteToday = await env.AURA_DB.prepare(`
      SELECT SUM(estimated_cost) AS total_cost, COUNT(*) AS count
      FROM waste_log WHERE date(created_at) = ?
    `).bind(today).first();

    // 2. Tính revenue hôm nay
    const revenueToday = await env.AURA_DB.prepare(`
      SELECT SUM(total_amount) AS total FROM orders
      WHERE date(created_at) = ? AND status = 'completed'
    `).bind(today).first();

    const wastePct = revenueToday.total > 0
      ? (wasteToday.total_cost / revenueToday.total) * 100
      : 0;

    // 3. Send Zalo OA / email cho anh Còn nếu waste > 5%
    if (wastePct > 5) {
      await sendAlertToOwner({
        type: 'high_waste',
        message: `⚠️ Waste hôm nay ${wastePct.toFixed(1)}% — cao hơn ngưỡng 5%`,
        details: { ... }
      });
    }
  }
}
```

Lưu ý: Cần thêm `crons = ["0 16 * * *"]` (16h UTC = 23h VN) vào `wrangler.toml`.

---

## 🏁 Definition of Done

- [ ] Waste UI mobile, 2-tap để log
- [ ] Margin dashboard với 3 tier (high/mid/low margin)
- [ ] Waste analytics 3 charts
- [ ] Daily cron alert nếu waste > 5%
- [ ] PR mở: "feat(inventory): waste tracking + COGS + margin report"
