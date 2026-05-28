# 🗄 TASK 14 — Inventory schema v1 + multi-supplier

> **Repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch target:** `feat/inventory-schema-v1`
> **Migration file:** `db/migrations/20260527_01_inventory_v1.sql`
> **Estimated:** 4-6h worker autonomous
> **Dependency:** Standalone (run first)

---

## 🎯 Objective

Thiết lập DB schema cho module Inventory advanced, bao gồm:
- Master data: `ingredients`, `suppliers`, `ingredient_suppliers` (many-to-many với price history)
- Transactional: `stock_movements` (single source of truth cho mọi thay đổi tồn kho)
- Master data: `recipes`, `recipe_items` (cho task 16)
- Audit: `waste_log` (cho task 17)
- Helper views: `v_current_stock`, `v_ingredient_cost`

Bổ sung 7 endpoints CRUD cho admin quản lý master data + 1 endpoint public cho POS query stock.

---

## 📋 Acceptance Criteria

1. ✅ Migration apply thành công trên `--local` và `--remote`
2. ✅ Seed 41 ingredients từ Excel hiện tại (Café D2, D4, ..., Bọc rác)
3. ✅ Seed 5 suppliers mẫu (NCC Sa Đéc Trung tâm, Coop Đồng Tháp, Bách Hóa Cần Thơ, NCC Cà phê Buôn Mê, Vinamilk Distributor)
4. ✅ 7 endpoints test pass với jwt admin
5. ✅ `v_current_stock` view trả đúng tồn kho (tổng `stock_movements.qty_delta` per ingredient)
6. ✅ Idempotency: re-run migration không tạo duplicate rows (dùng `INSERT OR IGNORE`)
7. ✅ PR mở với title: "feat(inventory): schema v1 + multi-supplier + 41 ingredients seed"

---

## 🗄 Migration SQL — `20260527_01_inventory_v1.sql`

### Section 1: ingredients (nguyên liệu)

```sql
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,                    -- 'ING_xxx' (sortable)
  sku TEXT UNIQUE NOT NULL,               -- 'CF_D2', 'SUA_VNM', ...
  name_vi TEXT NOT NULL,                  -- 'Café D2'
  category TEXT NOT NULL,                 -- 'coffee', 'milk', 'topping', 'fruit', 'beverage', 'supply', 'other'
  unit TEXT NOT NULL,                     -- 'kg', 'g', 'ml', 'L', 'piece', 'pack', 'bottle'
  unit_to_gram REAL,                      -- để convert nếu recipe dùng đơn vị khác
  min_stock_level REAL DEFAULT 0,         -- ngưỡng low-stock alert
  max_stock_level REAL,                   -- ngưỡng over-stock (optional)
  shelf_life_days INTEGER,                -- NULL = không hạn (đá viên), 7 = sữa tươi, 365 = đường
  storage TEXT,                           -- 'dry', 'chiller', 'freezer', 'room_temp'
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON ingredients(is_active);
```

### Section 2: suppliers (nhà cung cấp)

```sql
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,                    -- 'SUP_xxx'
  name TEXT NOT NULL,                     -- 'NCC Sa Đéc Trung Tâm'
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  payment_terms TEXT,                     -- 'COD', 'Net 7', 'Net 15', 'Net 30'
  preferred INTEGER DEFAULT 0,            -- 1 = NCC ưu tiên
  rating REAL,                            -- 1-5 stars (manual rate)
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suppliers_preferred ON suppliers(preferred, is_active);
```

### Section 3: ingredient_suppliers (M:N) + price history

```sql
CREATE TABLE IF NOT EXISTS ingredient_suppliers (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  unit_price REAL NOT NULL,               -- giá hiện tại
  unit_size REAL NOT NULL,                -- size pack (e.g. 1 hộp = 380g sữa đặc)
  pack_unit TEXT NOT NULL,                -- 'hộp', 'bịch', 'kg' (đơn vị mua)
  lead_time_days INTEGER DEFAULT 0,       -- thời gian giao hàng
  is_preferred INTEGER DEFAULT 0,         -- preferred supplier cho ingredient này
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ing_sup_unique
  ON ingredient_suppliers(ingredient_id, supplier_id) WHERE is_active=1;

-- Price history (separate table — giá trị tự động ghi khi giá thay đổi)
CREATE TABLE IF NOT EXISTS supplier_price_history (
  id TEXT PRIMARY KEY,
  ingredient_supplier_id TEXT NOT NULL REFERENCES ingredient_suppliers(id),
  old_price REAL NOT NULL,
  new_price REAL NOT NULL,
  changed_at TEXT DEFAULT (datetime('now')),
  changed_by TEXT,                        -- user_id
  reason TEXT
);
```

### Section 4: stock_movements (single source of truth)

```sql
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  type TEXT NOT NULL CHECK(type IN (
    'receive',         -- nhập từ NCC
    'sale_deduct',     -- POS bán → trừ kho theo recipe
    'waste',           -- đổ bỏ
    'count_diff',      -- chênh lệch khi kiểm kê (+/-)
    'adjust',          -- điều chỉnh thủ công (sửa lỗi nhập)
    'transfer_in',     -- chuyển từ chi nhánh khác (future)
    'transfer_out',
    'opening_balance'  -- số dư đầu (one-time per ingredient)
  )),
  qty_delta REAL NOT NULL,                -- + nhập, - xuất (đã chuyển về unit chuẩn)
  unit_cost REAL,                         -- giá vốn tại thời điểm (cho COGS)
  reference_type TEXT,                    -- 'purchase_order', 'order', 'waste_log', 'manual'
  reference_id TEXT,                      -- ID liên kết
  notes TEXT,
  staff_id TEXT,                          -- user_id (ai thực hiện)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_mov_ing_date
  ON stock_movements(ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_mov_ref
  ON stock_movements(reference_type, reference_id);

-- Idempotency cho sale_deduct (1 order_item chỉ trừ 1 lần)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_mov_sale_dedupe
  ON stock_movements(reference_id, ingredient_id)
  WHERE type='sale_deduct';
```

### Section 5: recipes (cho task 16, define schema trước)

```sql
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  version INTEGER DEFAULT 1,
  yield_qty INTEGER DEFAULT 1,            -- 1 recipe = N portions
  prep_time_seconds INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_product_active
  ON recipes(product_id) WHERE is_active=1;

CREATE TABLE IF NOT EXISTS recipe_items (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,                      -- số lượng dùng (theo unit của ingredient)
  is_optional INTEGER DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);
```

### Section 6: waste_log (cho task 17)

```sql
CREATE TABLE IF NOT EXISTS waste_log (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN (
    'expired',           -- hết hạn
    'damaged',           -- hỏng
    'spilled',           -- đổ
    'overcooked',        -- pha hỏng
    'theft',             -- mất
    'sample',            -- pha test
    'other'
  )),
  estimated_cost REAL,
  notes TEXT,
  staff_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waste_log_ing_date
  ON waste_log(ingredient_id, created_at DESC);
```

### Section 7: views

```sql
-- View: tồn kho hiện tại
CREATE VIEW IF NOT EXISTS v_current_stock AS
SELECT
  i.id AS ingredient_id,
  i.sku,
  i.name_vi,
  i.unit,
  i.min_stock_level,
  COALESCE(SUM(sm.qty_delta), 0) AS current_qty,
  CASE
    WHEN COALESCE(SUM(sm.qty_delta), 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(SUM(sm.qty_delta), 0) < i.min_stock_level THEN 'low_stock'
    ELSE 'ok'
  END AS status
FROM ingredients i
LEFT JOIN stock_movements sm ON sm.ingredient_id = i.id
WHERE i.is_active = 1
GROUP BY i.id;

-- View: giá vốn trung bình (weighted average từ receive movements 30 ngày gần nhất)
CREATE VIEW IF NOT EXISTS v_ingredient_cost AS
SELECT
  i.id AS ingredient_id,
  i.sku,
  CASE
    WHEN SUM(CASE WHEN sm.type='receive' AND sm.created_at >= date('now', '-30 days')
                  THEN sm.qty_delta ELSE 0 END) > 0
    THEN SUM(CASE WHEN sm.type='receive' AND sm.created_at >= date('now', '-30 days')
                  THEN sm.qty_delta * sm.unit_cost ELSE 0 END)
       / SUM(CASE WHEN sm.type='receive' AND sm.created_at >= date('now', '-30 days')
                  THEN sm.qty_delta ELSE 0 END)
    ELSE NULL
  END AS avg_unit_cost_30d
FROM ingredients i
LEFT JOIN stock_movements sm ON sm.ingredient_id = i.id
WHERE i.is_active = 1
GROUP BY i.id;
```

### Section 8: seed 41 ingredients (từ Excel)

```sql
INSERT OR IGNORE INTO ingredients (id, sku, name_vi, category, unit, min_stock_level, shelf_life_days, storage) VALUES
('ING_CF_D2', 'CF_D2', 'Café D2', 'coffee', 'kg', 2, 90, 'dry'),
('ING_CF_D4', 'CF_D4', 'Café D4', 'coffee', 'kg', 2, 90, 'dry'),
('ING_CF_PHIN', 'CF_PHIN', 'Café phin truyền thống', 'coffee', 'kg', 0.5, 90, 'dry'),
('ING_SUA_DAC', 'SUA_DAC', 'Sữa đặc Ông Thọ', 'milk', 'piece', 3, 180, 'dry'),
('ING_SUA_VNM', 'SUA_VNM', 'Sữa tươi Vinamilk', 'milk', 'piece', 5, 7, 'chiller'),
('ING_TRA_COZY', 'TRA_COZY', 'Trà đào Cozy', 'tea', 'pack', 20, 365, 'dry'),
('ING_DAO_NGAM', 'DAO_NGAM', 'Đào ngâm', 'fruit', 'piece', 2, 365, 'dry'),
('ING_SUA_CAPU', 'SUA_CAPU', 'Sữa tươi CAPU', 'milk', 'piece', 2, 14, 'chiller'),
('ING_SUA_CHUA', 'SUA_CHUA', 'Sữa chua Vinamilk', 'milk', 'piece', 10, 21, 'chiller'),
('ING_RICH', 'RICH', 'Whipping cream Rich', 'milk', 'piece', 2, 30, 'chiller'),
('ING_BOT_TRA_XANH', 'BOT_TRA_XANH', 'Bột trà xanh matcha', 'powder', 'kg', 0.5, 180, 'dry'),
('ING_BOT_CACAO', 'BOT_CACAO', 'Bột cacao nguyên chất', 'powder', 'g', 500, 180, 'dry'),
('ING_LIPTON', 'LIPTON', 'Trà Lipton', 'tea', 'pack', 30, 365, 'dry'),
('ING_CHOCOLATE', 'CHOCOLATE', 'Chocolate syrup', 'syrup', 'bottle', 2, 180, 'dry'),
('ING_SYRUP', 'SYRUP', 'Syrup các loại (hương vị)', 'syrup', 'bottle', 3, 365, 'dry'),
('ING_MUT_SINH_TO', 'MUT_SINH_TO', 'Mứt sinh tố các loại', 'syrup', 'bottle', 3, 180, 'dry'),
('ING_BOT_FRAP', 'BOT_FRAP', 'Bột frappuccino', 'powder', 'kg', 1, 180, 'dry'),
('ING_OREO', 'OREO', 'Bánh Oreo', 'topping', 'pack', 2, 180, 'dry'),
('ING_DUONG', 'DUONG', 'Đường cát trắng', 'sugar', 'kg', 2, 365, 'dry'),
('ING_CHANH', 'CHANH', 'Chanh tươi', 'fruit', 'kg', 1, 14, 'chiller'),
('ING_CAM', 'CAM', 'Cam tươi', 'fruit', 'kg', 2, 14, 'chiller'),
('ING_DAU_TAY', 'DAU_TAY', 'Dâu tây tươi', 'fruit', 'kg', 0.5, 5, 'chiller'),
('ING_SAPO', 'SAPO', 'Sapoche', 'fruit', 'kg', 1, 7, 'chiller'),
('ING_MANG_CAU', 'MANG_CAU', 'Mãng cầu', 'fruit', 'kg', 1, 7, 'chiller'),
('ING_DUA_TUOI', 'DUA_TUOI', 'Dừa tươi', 'fruit', 'piece', 3, 7, 'chiller'),
('ING_STING', 'STING', 'Sting (lốc 24)', 'beverage', 'piece', 12, 365, 'dry'),
('ING_PEPSI', 'PEPSI', 'Pepsi (lốc 24)', 'beverage', 'piece', 12, 365, 'dry'),
('ING_COCA', 'COCA', 'Coca-Cola (lốc 24)', 'beverage', 'piece', 12, 365, 'dry'),
('ING_REDBULL', 'REDBULL', 'Redbull (lốc 10)', 'beverage', 'piece', 10, 365, 'dry'),
('ING_7UP', 'BEV_7UP', '7Up (lốc 24)', 'beverage', 'piece', 12, 365, 'dry'),
('ING_O_LONG', 'O_LONG', 'Trà Ô Long đóng chai', 'beverage', 'bottle', 12, 180, 'dry'),
('ING_NUOC_SUOI', 'NUOC_SUOI', 'Nước suối Aquafina', 'beverage', 'bottle', 24, 365, 'dry'),
('ING_THUOC_MEO', 'THUOC_MEO', 'Thuốc mèo', 'cigarette', 'piece', 20, 365, 'dry'),
('ING_THUOC_555', 'THUOC_555', 'Thuốc 555', 'cigarette', 'pack', 5, 365, 'dry'),
('ING_DA_VIEN', 'DA_VIEN', 'Đá viên (bao 5kg)', 'ice', 'piece', 2, NULL, 'freezer'),
('ING_LY_NHUA', 'LY_NHUA', 'Ly nhựa 500ml + nắp', 'supply', 'piece', 200, NULL, 'dry'),
('ING_LY_GIAY_NONG', 'LY_GIAY_NONG', 'Ly giấy nóng 350ml', 'supply', 'piece', 100, NULL, 'dry'),
('ING_NAP_LY', 'NAP_LY', 'Nắp ly (rời)', 'supply', 'piece', 200, NULL, 'dry'),
('ING_ONG_HUT', 'ONG_HUT', 'Ống hút giấy', 'supply', 'piece', 500, NULL, 'dry'),
('ING_RAU_MA', 'RAU_MA', 'Rau má tươi', 'fruit', 'kg', 1, 3, 'chiller'),
('ING_BOC_RAC', 'BOC_RAC', 'Bọc rác lớn 50L', 'supply', 'piece', 20, NULL, 'dry');
```

### Section 9: seed 5 suppliers mẫu

```sql
INSERT OR IGNORE INTO suppliers (id, name, phone, address, contact_person, payment_terms, preferred) VALUES
('SUP_SADEC_CENTER', 'NCC Sa Đéc Trung Tâm', '0277xxxxxxx', 'Chợ Sa Đéc, Đồng Tháp', 'Anh Tâm', 'COD', 1),
('SUP_COOP_DT', 'Co.opmart Đồng Tháp', '0277yyyyyyy', '123 Hùng Vương, Cao Lãnh', 'Chị Lan', 'Net 7', 0),
('SUP_BACH_HOA_CT', 'Bách Hóa Xanh Cần Thơ', '0292zzzzzzz', '456 Nguyễn Văn Linh, Ninh Kiều', NULL, 'COD', 0),
('SUP_CF_BMT', 'Cà Phê Buôn Mê Thuột (đại lý)', '0262wwwwwww', 'Đại lý SĐ', 'Anh Hoàng', 'Net 15', 1),
('SUP_VNM_DIST', 'Nhà phân phối Vinamilk Sa Đéc', '0277vvvvvvv', 'Sa Đéc', 'Chị Phương', 'Net 7', 1);
```

### Section 10: opening_balance từ Excel hiện tại

```sql
-- Insert opening balance từ Excel "Đầu kỳ" sheet NGUYÊN LIỆU
-- (chỉ chạy 1 lần — ngày 31/5/2026 cut-over)
INSERT OR IGNORE INTO stock_movements (id, ingredient_id, type, qty_delta, notes, created_at) VALUES
('SM_OPEN_CF_D2', 'ING_CF_D2', 'opening_balance', 6, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_CF_D4', 'ING_CF_D4', 'opening_balance', 6, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_CF_PHIN', 'ING_CF_PHIN', 'opening_balance', 0.5, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_SUA_DAC', 'ING_SUA_DAC', 'opening_balance', 2, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_SUA_VNM', 'ING_SUA_VNM', 'opening_balance', 7, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_TRA_COZY', 'ING_TRA_COZY', 'opening_balance', 50, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_DAO_NGAM', 'ING_DAO_NGAM', 'opening_balance', 2, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_SUA_CAPU', 'ING_SUA_CAPU', 'opening_balance', 1, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_SUA_CHUA', 'ING_SUA_CHUA', 'opening_balance', 16, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_RICH', 'ING_RICH', 'opening_balance', 1, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_LIPTON', 'ING_LIPTON', 'opening_balance', 100, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_DUONG', 'ING_DUONG', 'opening_balance', 4, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_CHANH', 'ING_CHANH', 'opening_balance', 2, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_CAM', 'ING_CAM', 'opening_balance', 5, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_SAPO', 'ING_SAPO', 'opening_balance', 2, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_MANG_CAU', 'ING_MANG_CAU', 'opening_balance', 1.4, 'Excel cuối tháng 5', '2026-05-31 23:59:59'),
('SM_OPEN_DUA_TUOI', 'ING_DUA_TUOI', 'opening_balance', 5, 'Excel cuối tháng 5', '2026-05-31 23:59:59');
-- (các nguyên liệu không có "đầu kỳ" trong Excel → bỏ qua, sẽ insert sau khi kiểm kê tay)
```

---

## 🔌 API endpoints (7 + 1)

### Admin (require JWT admin role)

#### 1. `GET /api/admin/inventory/ingredients`
Query params: `category`, `is_active`, `low_stock_only` (boolean)

Response:
```json
{
  "data": [
    {
      "id": "ING_CF_D2",
      "sku": "CF_D2",
      "name_vi": "Café D2",
      "category": "coffee",
      "unit": "kg",
      "current_qty": 6.0,
      "min_stock_level": 2,
      "status": "ok",
      "preferred_supplier": { "id": "SUP_CF_BMT", "name": "Cà Phê BMT", "unit_price": 200000, "pack_unit": "kg" }
    }
  ],
  "total": 41
}
```

#### 2. `POST /api/admin/inventory/ingredients` — Create new ingredient
Body: `{ sku, name_vi, category, unit, min_stock_level, shelf_life_days, storage, notes }`

#### 3. `PUT /api/admin/inventory/ingredients/:id` — Update

#### 4. `DELETE /api/admin/inventory/ingredients/:id` — Soft delete (`is_active=0`)

#### 5-8. Tương tự cho `/suppliers/*`

### Public (require staff JWT)

#### 9. `GET /api/inventory/stock/:ingredient_id` — Quick lookup từ POS
Response: `{ ingredient_id, name_vi, current_qty, status, last_movement_at }`

---

## 🧪 Test cases (worker tự viết)

### File: `worker/tests/inventory-schema.test.js`

```js
import { describe, it, expect } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('Inventory schema v1', () => {
  it('view v_current_stock returns 41 active ingredients', async () => {
    const result = await env.AURA_DB.prepare(
      'SELECT COUNT(*) AS cnt FROM v_current_stock'
    ).first();
    expect(result.cnt).toBe(41);
  });

  it('opening_balance correctly applied (Café D2 = 6kg)', async () => {
    const result = await env.AURA_DB.prepare(
      'SELECT current_qty FROM v_current_stock WHERE ingredient_id = ?'
    ).bind('ING_CF_D2').first();
    expect(result.current_qty).toBe(6);
  });

  it('low_stock_only filter returns ingredients below min', async () => {
    // Setup: create a movement that drops CF_PHIN below 0.5
    await env.AURA_DB.prepare(
      "INSERT INTO stock_movements (id, ingredient_id, type, qty_delta) VALUES ('TEST_1', 'ING_CF_PHIN', 'sale_deduct', -0.3)"
    ).run();

    const res = await fetch(BASE_URL + '/api/admin/inventory/ingredients?low_stock_only=true', { headers });
    const data = await res.json();
    expect(data.data.some(d => d.id === 'ING_CF_PHIN')).toBe(true);
  });

  it('idempotency: re-running migration does not duplicate rows', async () => {
    // Apply migration twice
    // Expect: ingredients count remains 41
  });
});
```

---

## 📝 Migration application notes

⚠️ **D1 limitations:**
- KHÔNG dùng `ALTER TABLE ADD COLUMN IF NOT EXISTS` (D1 không support)
- KHÔNG dùng triggers (D1 không support sufficiently)
- Dùng `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` cho idempotency

⚠️ **Order of operations:**
1. Apply `--local` trước
2. Verify tests pass
3. Apply `--remote` (production)
4. Smoke test `GET /api/admin/inventory/ingredients`

---

## ⏭ Dependency cho task sau

Task 15 (Receiving) sẽ:
- POST endpoint nhận hàng → insert vào `stock_movements` (type='receive')
- Update `ingredient_suppliers.unit_price` nếu giá khác → ghi `supplier_price_history`

Task 16 (Recipe deduct) sẽ:
- Đọc `recipes` + `recipe_items` để biết tỷ lệ trừ
- Insert vào `stock_movements` (type='sale_deduct') với `reference_id=order_item.id`
- Idempotency guard tự động qua UNIQUE INDEX `idx_stock_mov_sale_dedupe`

---

## 🏁 Definition of Done

- [ ] Migration `20260527_01_inventory_v1.sql` apply ok local + remote
- [ ] 41 ingredients seeded
- [ ] 5 suppliers seeded
- [ ] 17 opening_balance movements seeded từ Excel
- [ ] 7 endpoints admin + 1 endpoint public test pass
- [ ] PR mở: "feat(inventory): schema v1 + multi-supplier + 41 ingredients seed"
- [ ] CI green
