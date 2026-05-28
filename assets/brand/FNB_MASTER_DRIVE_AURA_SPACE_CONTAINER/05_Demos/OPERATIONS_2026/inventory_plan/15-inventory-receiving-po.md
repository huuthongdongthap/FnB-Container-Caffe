# 📥 TASK 15 — Receiving + Purchase Orders

> **Repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch target:** `feat/inventory-receiving-po`
> **Estimated:** 4-6h worker autonomous
> **Dependency:** Task 14 (schema v1) merged

---

## 🎯 Objective

Cho phép staff (Cường/Khánh) ghi nhận hàng nhập từ NCC qua UI mobile-friendly, tự động:
1. Update tồn kho qua `stock_movements` (type='receive')
2. Cập nhật giá NCC vào `ingredient_suppliers.unit_price`
3. Ghi vào `supplier_price_history` nếu giá thay đổi >2%
4. Sinh PO suggestion cho admin khi có nhiều item low-stock

---

## 📋 Acceptance Criteria

1. ✅ Page `/admin/inventory/receiving.html` — form nhập hàng (mobile-first)
2. ✅ POST `/api/inventory/receiving` — submit 1 receiving doc (multi-line)
3. ✅ Validation: số lượng > 0, đơn giá > 0, đơn giá phải reasonable (so với last 30d trung bình ±50%)
4. ✅ Auto-create `purchase_orders` record (status='received') để có audit trail
5. ✅ GET `/api/admin/inventory/po/suggestions` — đề xuất nhập hàng từ low-stock + preferred supplier
6. ✅ PR mở title: "feat(inventory): receiving form + PO suggestions"

---

## 🗄 Migration bổ sung — `20260527_02_purchase_orders.sql`

```sql
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,                    -- 'PO_YYYYMMDD_xxx'
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  order_date TEXT NOT NULL,
  received_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft'    -- 'draft', 'sent', 'received', 'cancelled', 'partial'
    CHECK(status IN ('draft', 'sent', 'received', 'cancelled', 'partial')),
  subtotal REAL DEFAULT 0,
  delivery_fee REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_po_supplier_date
  ON purchase_orders(supplier_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_orders(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  qty_ordered REAL NOT NULL,
  qty_received REAL DEFAULT 0,
  unit_price REAL NOT NULL,
  pack_unit TEXT NOT NULL,                -- 'kg', 'hộp', 'bịch' (đơn vị mua)
  pack_size REAL NOT NULL,                -- e.g. 1 bịch = 220g sữa
  line_total REAL NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
```

---

## 🔌 API endpoints

### 1. POST `/api/inventory/receiving` — Ghi nhận hàng nhập

**Auth:** Staff JWT (Cường/Khánh có quyền)

**Request body:**
```json
{
  "supplier_id": "SUP_SADEC_CENTER",
  "received_date": "2026-05-27",
  "delivery_fee": 0,
  "items": [
    {
      "ingredient_id": "ING_CF_D2",
      "qty_received": 2,
      "pack_unit": "kg",
      "pack_size": 1,
      "unit_price": 200000,
      "notes": "Hàng tốt, không vỡ"
    },
    {
      "ingredient_id": "ING_SUA_VNM",
      "qty_received": 10,
      "pack_unit": "bịch",
      "pack_size": 220,
      "unit_price": 36000,
      "notes": "Date 2026-06-03"
    }
  ],
  "notes": "Nhập sáng 27/5, anh Tâm giao"
}
```

**Logic xử lý:**
```js
async function processReceiving(db, payload, staffId) {
  const poId = `PO_${dayjs().format('YYYYMMDD')}_${nanoid(8)}`;

  // 1. Validation per item
  for (const item of payload.items) {
    // 1a. ingredient exists & active
    const ing = await db.prepare(
      "SELECT id, unit FROM ingredients WHERE id=? AND is_active=1"
    ).bind(item.ingredient_id).first();
    if (!ing) throw new Error(`Ingredient ${item.ingredient_id} không tồn tại`);

    // 1b. price sanity check (so với avg 30d ±50%)
    const avgCost = await db.prepare(
      "SELECT avg_unit_cost_30d FROM v_ingredient_cost WHERE ingredient_id=?"
    ).bind(item.ingredient_id).first();
    if (avgCost?.avg_unit_cost_30d) {
      const diff = Math.abs(item.unit_price - avgCost.avg_unit_cost_30d) / avgCost.avg_unit_cost_30d;
      if (diff > 0.5) {
        // Warning, but not block (price might genuinely change)
        item._price_warning = `Giá khác trung bình 30d ${(diff*100).toFixed(0)}%`;
      }
    }

    // 1c. quantity reasonable (chặn typo 7200 bịch)
    if (item.qty_received > 1000) {
      throw new Error(`Số lượng ${item.qty_received} ${item.pack_unit} quá lớn — xác nhận lại`);
    }
  }

  // 2. Create PO record (status='received')
  const subtotal = payload.items.reduce((sum, i) => sum + i.qty_received * i.unit_price, 0);
  const total = subtotal + (payload.delivery_fee || 0);

  await db.batch([
    db.prepare(`
      INSERT INTO purchase_orders
        (id, supplier_id, order_date, received_date, status, subtotal, delivery_fee, total, notes, created_by)
      VALUES (?, ?, ?, ?, 'received', ?, ?, ?, ?, ?)
    `).bind(poId, payload.supplier_id, payload.received_date, payload.received_date,
            subtotal, payload.delivery_fee || 0, total, payload.notes, staffId),

    ...payload.items.flatMap((item, idx) => {
      const lineTotal = item.qty_received * item.unit_price;
      const poItemId = `${poId}_ITEM_${idx + 1}`;
      const smId = `SM_${poItemId}`;
      // Convert sang base unit nếu cần
      const baseQty = item.qty_received * item.pack_size / getUnitDivisor(ing.unit, item.pack_unit);
      const baseUnitCost = item.unit_price / item.pack_size * getUnitDivisor(ing.unit, item.pack_unit);

      return [
        db.prepare(`
          INSERT INTO purchase_order_items
            (id, po_id, ingredient_id, qty_ordered, qty_received, unit_price, pack_unit, pack_size, line_total, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(poItemId, poId, item.ingredient_id, item.qty_received, item.qty_received,
                item.unit_price, item.pack_unit, item.pack_size, lineTotal, item.notes),

        db.prepare(`
          INSERT INTO stock_movements
            (id, ingredient_id, type, qty_delta, unit_cost, reference_type, reference_id, notes, staff_id)
          VALUES (?, ?, 'receive', ?, ?, 'purchase_order', ?, ?, ?)
        `).bind(smId, item.ingredient_id, baseQty, baseUnitCost, poId, item.notes, staffId)
      ];
    })
  ]);

  // 3. Update ingredient_suppliers + price history
  for (const item of payload.items) {
    await updateSupplierPrice(db, payload.supplier_id, item.ingredient_id, item.unit_price, item.pack_size, item.pack_unit, staffId);
  }

  return { po_id: poId, total, warnings: payload.items.filter(i => i._price_warning).map(i => i._price_warning) };
}

async function updateSupplierPrice(db, supplierId, ingredientId, newPrice, packSize, packUnit, userId) {
  const existing = await db.prepare(
    "SELECT id, unit_price FROM ingredient_suppliers WHERE supplier_id=? AND ingredient_id=? AND is_active=1"
  ).bind(supplierId, ingredientId).first();

  if (!existing) {
    // First time → create
    await db.prepare(`
      INSERT INTO ingredient_suppliers (id, ingredient_id, supplier_id, unit_price, unit_size, pack_unit, is_preferred)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).bind(`ISUP_${nanoid()}`, ingredientId, supplierId, newPrice, packSize, packUnit).run();
  } else {
    const priceDiff = Math.abs(newPrice - existing.unit_price) / existing.unit_price;
    if (priceDiff > 0.02) {
      // > 2% diff → log history + update
      await db.batch([
        db.prepare(`
          INSERT INTO supplier_price_history (id, ingredient_supplier_id, old_price, new_price, changed_by, reason)
          VALUES (?, ?, ?, ?, ?, 'receiving_update')
        `).bind(`PH_${nanoid()}`, existing.id, existing.unit_price, newPrice, userId),
        db.prepare(`
          UPDATE ingredient_suppliers SET unit_price=?, updated_at=datetime('now') WHERE id=?
        `).bind(newPrice, existing.id)
      ]);
    }
  }
}
```

### 2. GET `/api/admin/inventory/po/suggestions`

**Logic:** Lấy ingredients có `current_qty < min_stock_level`, group theo preferred supplier, gợi ý đơn nhập.

**Response:**
```json
{
  "suggestions_by_supplier": [
    {
      "supplier_id": "SUP_CF_BMT",
      "supplier_name": "Cà Phê BMT",
      "items": [
        {
          "ingredient_id": "ING_CF_D2",
          "name_vi": "Café D2",
          "current_qty": 1.5,
          "min_stock_level": 2,
          "suggested_order_qty": 5,
          "unit_price": 200000,
          "subtotal": 1000000
        }
      ],
      "estimated_total": 1000000
    }
  ],
  "total_estimated": 1500000
}
```

**SQL chính:**
```sql
SELECT
  s.id AS supplier_id,
  s.name AS supplier_name,
  i.id AS ingredient_id,
  i.name_vi,
  vs.current_qty,
  i.min_stock_level,
  -- suggested = (max_stock - current) hoặc max(min*2, 7-day avg consumption * 14)
  COALESCE(i.max_stock_level - vs.current_qty, i.min_stock_level * 2) AS suggested_order_qty,
  isup.unit_price,
  isup.pack_unit
FROM v_current_stock vs
JOIN ingredients i ON i.id = vs.ingredient_id
JOIN ingredient_suppliers isup ON isup.ingredient_id = i.id AND isup.is_preferred = 1 AND isup.is_active = 1
JOIN suppliers s ON s.id = isup.supplier_id
WHERE vs.current_qty < i.min_stock_level
ORDER BY s.id, i.name_vi;
```

### 3. GET `/api/admin/inventory/receiving/history`
Query: `date_from`, `date_to`, `supplier_id` → list POs với items

### 4. PUT `/api/admin/inventory/po/:po_id/cancel`
Soft cancel — `status='cancelled'`, reverse stock_movements.

---

## 🎨 UI Page — `admin/inventory/receiving.html`

### Wireframe (mobile-first 375px)

```
┌─────────────────────────────────────┐
│ 📥 GHI NHẬN HÀNG NHẬP                │
│                                     │
│ Ngày nhận: [27/05/2026 ▼]           │
│ NCC:       [NCC Sa Đéc Trung Tâm ▼] │
│                                     │
│ ┌─ Hàng nhập (1) ──────────────────┐│
│ │ Nguyên liệu: [Café D2 ▼]        ││
│ │ SL:    [_2___] Đơn vị: [kg ▼]   ││
│ │ Giá:   [200,000] đ/[kg]          ││
│ │ Ghi chú: [Hàng tốt_______]      ││
│ │ Thành tiền: 400,000 đ            ││
│ │ [🗑 Xóa]                          ││
│ └──────────────────────────────────┘│
│                                     │
│ [+ Thêm dòng]                       │
│                                     │
│ Phí giao: [0]                       │
│ ─────────────────────────────────   │
│ TỔNG: 400,000 đ                     │
│                                     │
│ Ghi chú đơn: [_________________]    │
│                                     │
│ [Lưu nháp] [✅ Lưu + cập nhật kho]   │
└─────────────────────────────────────┘
```

### Key JS behaviors:
- Auto-suggest ingredient từ low-stock list (call `/api/admin/inventory/po/suggestions` khi pick supplier)
- Validation client-side: qty > 0, price > 0, warning nếu price > 50% avg 30d
- Sau submit success → toast "Đã nhập kho ✅" + redirect history page
- Offline support: localStorage save draft

### Page `admin/inventory/po-suggestions.html`

```
┌─────────────────────────────────────┐
│ 🛒 GỢI Ý NHẬP HÀNG                   │
│                                     │
│ 🔴 8 nguyên liệu cần nhập gấp        │
│                                     │
│ ┌─ NCC: Cà Phê BMT (2 món) ────────┐│
│ │ ☑ Café D2:   1.5kg → +5kg (1tr)  ││
│ │ ☑ Café D4:   1kg   → +5kg (1tr)  ││
│ │ Tổng: 2tr | [📞 Gọi Anh Hoàng]   ││
│ │ [📋 Tạo PO này]                   ││
│ └──────────────────────────────────┘│
│ ┌─ NCC: Vinamilk Sa Đéc (3 món) ───┐│
│ │ ☑ Sữa tươi VNM: 3 → +10 (360k)   ││
│ │ ☑ Sữa chua: 5  → +20 (480k)      ││
│ │ ☑ Sữa CAPU: 0  → +5  (155k)      ││
│ │ Tổng: 995k | [📞 Gọi Chị Phương] ││
│ │ [📋 Tạo PO này]                   ││
│ └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 🧪 Test cases

```js
describe('Receiving', () => {
  it('rejects qty > 1000', async () => {
    const res = await POST('/api/inventory/receiving', {
      supplier_id: 'SUP_SADEC_CENTER',
      received_date: '2026-05-27',
      items: [{ ingredient_id: 'ING_SUA_VNM', qty_received: 7200, pack_unit: 'bịch', pack_size: 220, unit_price: 36000 }]
    });
    expect(res.status).toBe(400);
    expect(res.error).toContain('quá lớn');
  });

  it('warns on price > 50% avg but does not block', async () => {
    // Setup: history avg 200k for CF_D2
    // Submit at 350k
    const res = await POST('/api/inventory/receiving', { /* ... 350000 ... */ });
    expect(res.status).toBe(200);
    expect(res.data.warnings.length).toBeGreaterThan(0);
  });

  it('updates supplier_price_history when price diff > 2%', async () => {
    // baseline: SUP_VNM × SUA_VNM = 36000
    // submit at 37000 (~2.8% diff)
    await POST('/api/inventory/receiving', { /* ... 37000 ... */ });
    const history = await db.prepare(
      "SELECT * FROM supplier_price_history WHERE ingredient_supplier_id IN (SELECT id FROM ingredient_suppliers WHERE supplier_id=? AND ingredient_id=?)"
    ).bind('SUP_VNM_DIST', 'ING_SUA_VNM').all();
    expect(history.results.length).toBe(1);
  });

  it('PO suggestions returns low-stock items grouped by preferred supplier', async () => {
    // Setup: bring CF_D2 to 1.5kg (below min 2kg)
    const res = await GET('/api/admin/inventory/po/suggestions');
    expect(res.suggestions_by_supplier.some(s => s.items.some(i => i.ingredient_id === 'ING_CF_D2'))).toBe(true);
  });
});
```

---

## 🏁 Definition of Done

- [ ] Migration `20260527_02_purchase_orders.sql` apply ok
- [ ] 4 endpoints test pass
- [ ] 2 UI pages mobile-first, dark theme (brand colors)
- [ ] Validation rejects typo (qty > 1000)
- [ ] Price warning hiển thị nhưng không block
- [ ] PR mở: "feat(inventory): receiving form + PO suggestions"
