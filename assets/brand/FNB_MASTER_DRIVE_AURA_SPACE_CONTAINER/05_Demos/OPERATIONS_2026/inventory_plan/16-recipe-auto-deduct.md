# 🍵 TASK 16 — Recipe + Auto-deduct kho khi bán

> **Repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch target:** `feat/inventory-recipe-deduct`
> **Estimated:** 6-8h worker autonomous (task khó nhất trong 5 tasks)
> **Dependency:** Task 14 merged (cần `recipes`, `recipe_items`, `stock_movements` đã có)

---

## 🎯 Objective

Khi POS bán 1 ly cf sữa đá → tự động trừ kho theo recipe:
- 18g Cf D2
- 25ml Sữa đặc
- 150g Đá viên
- 1 ly nhựa + 1 nắp + 1 ống hút

**Yêu cầu:**
1. Recipe phải editable qua admin UI
2. POS không block nếu thiếu nguyên liệu (vẫn cho phép bán, nhưng warn + log)
3. Idempotency: 1 order_item chỉ trừ 1 lần (đã có UNIQUE INDEX từ task 14)
4. Có "yield" (1 batch = N portions) cho topping bột pha sẵn

---

## 📋 Acceptance Criteria

1. ✅ Seed 25 recipes mẫu cho các món signature (em đề xuất full list bên dưới)
2. ✅ `/admin/inventory/recipes.html` — CRUD recipes
3. ✅ Hook vào `processOrderLoyalty()` hiện tại để trigger deduct
4. ✅ Endpoint `POST /api/inventory/recipes/preview` — preview cost trước khi bán
5. ✅ Background fail-safe: nếu deduct fail → log warning, không revert order (POS không bị treo)
6. ✅ PR mở: "feat(inventory): recipe auto-deduct from POS"

---

## 🍵 Recipe library (25 món mẫu — em đề xuất, anh + Cường confirm)

### Group A: Cà phê truyền thống (5 món)

| Menu item | Ingredients (per 1 ly) |
|---|---|
| Cà phê đen đá | 20g CF D2, 150g đá, 1 ly nhựa, 1 ống hút |
| Cà phê sữa đá | 18g CF D2, 25ml sữa đặc, 150g đá, 1 ly nhựa, 1 ống hút |
| Cà phê sữa nóng | 18g CF D2, 25ml sữa đặc, 1 ly giấy nóng, 1 nắp |
| Bạc xỉu | 12g CF D2, 50ml sữa đặc, 100ml sữa tươi, 150g đá, 1 ly nhựa |
| Cà phê phin truyền thống | 25g CF Phin, 1 ly sứ (in-house, không trừ kho) |

### Group B: Latte / Cappuccino / Americano (5 món)

| Menu item | Ingredients |
|---|---|
| Americano | 18g CF D4, 200ml nước nóng (không trừ kho), 1 ly giấy nóng + nắp |
| Latte | 18g CF D4, 200ml sữa tươi, 1 ly giấy nóng + nắp |
| Cappuccino | 18g CF D4, 150ml sữa tươi, 1 ly giấy nóng + nắp |
| Mocha | 18g CF D4, 150ml sữa tươi, 15ml chocolate syrup, 1 ly giấy nóng + nắp |
| Caramel latte | 18g CF D4, 200ml sữa tươi, 15ml syrup caramel, 1 ly giấy nóng + nắp |

### Group C: Trà (4 món)

| Menu item | Ingredients |
|---|---|
| Trà đào Cozy | 1 gói trà đào, 100g đào ngâm, 150g đá, 15g đường, 1 ly nhựa + nắp + ống hút |
| Trà chanh | 1 gói Lipton, 1/2 trái chanh, 150g đá, 20g đường, 1 ly nhựa |
| Trà sữa truyền thống | 2 gói Lipton, 50ml sữa đặc, 150g đá, 15g đường, 1 ly nhựa + nắp + ống hút |
| Trà ô long | 1 chai trà ô long, 1 ly nhựa (chuyển đá riêng) |

### Group D: Sinh tố + đá xay (5 món)

| Menu item | Ingredients |
|---|---|
| Sinh tố dâu | 80g dâu tây, 50ml sữa đặc, 30ml sữa tươi, 200g đá xay, 1 ly nhựa + nắp + ống hút |
| Sinh tố sapo | 1 trái sapo, 50ml sữa đặc, 200g đá xay, 1 ly nhựa + nắp + ống hút |
| Sinh tố mãng cầu | 100g mãng cầu, 50ml sữa đặc, 200g đá xay, 1 ly nhựa |
| Frappuccino Mocha | 30g bột frap, 18g CF D4, 150ml sữa tươi, 15ml chocolate, 250g đá xay, 1 ly nhựa + nắp + ống hút |
| Matcha đá xay | 5g bột trà xanh, 100ml sữa tươi, 50ml sữa đặc, 250g đá xay, 1 ly nhựa |

### Group E: Nước ép + đặc biệt (3 món)

| Menu item | Ingredients |
|---|---|
| Nước cam | 200g cam, 15g đường, 100g đá, 1 ly nhựa + ống hút |
| Nước dừa tươi | 1 trái dừa tươi, 1 ly nhựa + ống hút |
| Rau má đậu xanh | 100g rau má, 30g đậu phộng (giả sử có), 50ml sữa đặc, 150g đá, 1 ly nhựa |

### Group F: Đồ uống chai (3 món — không có recipe, trừ trực tiếp 1 chai)

| Menu item | Ingredients |
|---|---|
| Sting | 1 lon Sting |
| Coca | 1 lon Coca |
| Redbull | 1 lon Redbull |

→ **25 recipes total**, đủ phủ menu hiện tại của AURA CAFE.

---

## 🔌 API endpoints

### 1. POST `/api/admin/inventory/recipes` — Create recipe

**Body:**
```json
{
  "product_id": "PROD_CF_SUA_DA",
  "yield_qty": 1,
  "prep_time_seconds": 90,
  "items": [
    { "ingredient_id": "ING_CF_D2", "qty": 18 },
    { "ingredient_id": "ING_SUA_DAC", "qty": 25 },
    { "ingredient_id": "ING_DA_VIEN", "qty": 0.15 },
    { "ingredient_id": "ING_LY_NHUA", "qty": 1 },
    { "ingredient_id": "ING_ONG_HUT", "qty": 1 }
  ]
}
```

**Note quy ước qty:**
- ingredient unit là `kg` → qty dùng gram, divisor = 1000
- ingredient unit là `L` → qty dùng ml, divisor = 1000
- ingredient unit là `piece` → qty là số nguyên (or float nếu pack)

→ Recipe lưu **đơn vị nhỏ nhất** trong recipe_items.qty, khi trừ kho sẽ convert.

### 2. PUT `/api/admin/inventory/recipes/:id` — Update (tạo version mới)

Logic: Soft deprecate version cũ (`is_active=0`), tạo version mới (`version=N+1`).

### 3. GET `/api/admin/inventory/recipes` — List + filter

### 4. POST `/api/inventory/recipes/preview` — Tính cost preview cho menu_item

```json
{ "product_id": "PROD_CF_SUA_DA", "qty": 2 }
```

Response:
```json
{
  "product_id": "PROD_CF_SUA_DA",
  "recipe_version": 1,
  "total_cost": 8500,
  "breakdown": [
    { "ingredient": "Café D2", "qty": 36, "unit": "g", "cost_per_unit": 200, "subtotal": 7200 },
    { "ingredient": "Sữa đặc", "qty": 50, "unit": "ml", "cost_per_unit": 16, "subtotal": 800 }
  ],
  "can_fulfill": true,
  "missing_ingredients": []
}
```

---

## 🧩 Core function — `deductInventoryForOrder(db, orderId)`

```js
/**
 * Trừ kho cho 1 order vừa hoàn tất
 * Gọi từ processOrderLoyalty() hiện có (sau khi payment xong)
 *
 * @param {D1Database} db
 * @param {string} orderId
 * @returns {Promise<{deducted: number, warnings: Array, errors: Array}>}
 */
async function deductInventoryForOrder(db, orderId) {
  const result = { deducted: 0, warnings: [], errors: [] };

  // 1. Lấy order items
  const orderItems = await db.prepare(`
    SELECT oi.id AS order_item_id, oi.product_id, oi.quantity, p.name AS product_name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).bind(orderId).all();

  for (const oi of orderItems.results) {
    // 2. Lấy active recipe
    const recipe = await db.prepare(`
      SELECT id, version, yield_qty FROM recipes
      WHERE product_id = ? AND is_active = 1
      LIMIT 1
    `).bind(oi.product_id).first();

    if (!recipe) {
      result.warnings.push(`No recipe for ${oi.product_name} (${oi.product_id})`);
      continue;
    }

    // 3. Lấy recipe items
    const items = await db.prepare(`
      SELECT ri.ingredient_id, ri.qty, i.name_vi, i.unit
      FROM recipe_items ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.recipe_id = ?
    `).bind(recipe.id).all();

    // 4. Calculate total deductions (theo unit base)
    for (const ri of items.results) {
      const baseUnitQty = convertToBaseUnit(ri.qty, ri.unit) * oi.quantity / recipe.yield_qty;

      // 5. Insert stock movement (idempotent qua UNIQUE INDEX)
      try {
        await db.prepare(`
          INSERT INTO stock_movements
            (id, ingredient_id, type, qty_delta, reference_type, reference_id, notes)
          VALUES (?, ?, 'sale_deduct', ?, 'order_item', ?, ?)
        `).bind(
          `SM_SALE_${oi.order_item_id}_${ri.ingredient_id}`,
          ri.ingredient_id,
          -baseUnitQty,           // negative cho xuất
          oi.order_item_id,
          `Order ${orderId}, ${oi.quantity}× ${oi.product_name}`
        ).run();

        result.deducted++;
      } catch (e) {
        if (e.message.includes('UNIQUE constraint')) {
          // Đã trừ trước đó — idempotent, skip
          continue;
        }
        result.errors.push(`${ri.name_vi}: ${e.message}`);
      }
    }
  }

  // 6. Async: trigger low-stock check (don't await — fire & forget)
  triggerLowStockCheck(db).catch(err => console.error('Low stock check failed:', err));

  return result;
}

function convertToBaseUnit(qty, ingredientUnit) {
  // Recipe lưu qty theo đơn vị nhỏ (g, ml)
  // Stock lưu theo đơn vị lớn (kg, L) hoặc piece
  switch (ingredientUnit) {
    case 'kg': return qty / 1000;   // recipe.qty in grams → kg
    case 'L':  return qty / 1000;   // recipe.qty in ml → L
    case 'g':  return qty;          // recipe.qty in grams → g (no convert)
    case 'ml': return qty;
    case 'piece':
    case 'pack':
    case 'bottle':
      return qty;                   // ints/floats, no convert
    default:
      return qty;
  }
}
```

### Integration với processOrderLoyalty hiện tại

File: `worker/src/routes/orders.js` (hoặc nơi process order)

```js
// Sau khi order paid + loyalty processed
if (order.status === 'completed') {
  // [EXISTING] Loyalty cashback
  await processOrderLoyalty(db, order.id);

  // [NEW] Inventory deduct
  const invResult = await deductInventoryForOrder(db, order.id);
  if (invResult.warnings.length > 0) {
    console.warn(`Order ${order.id} inventory warnings:`, invResult.warnings);
  }
  if (invResult.errors.length > 0) {
    console.error(`Order ${order.id} inventory errors:`, invResult.errors);
    // Send admin alert via separate channel (don't fail the order!)
  }
}
```

---

## 🎨 UI Page — `admin/inventory/recipes.html`

```
┌──────────────────────────────────────────────────┐
│ 🍵 QUẢN LÝ RECIPES                                │
│                                                  │
│ [+ Thêm recipe]    Search: [_________]   [25/25] │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ ☕ Cà phê sữa đá          v1   ✅ Active     │  │
│ │ Cost: 8,500đ | Margin: 16,500đ (66%)       │  │
│ │ Prep: 90s                                   │  │
│ │ [👁 View] [✏ Edit] [📊 Margin] [🗑 Disable]  │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ 🌿 Matcha đá xay         v2   ✅ Active     │  │
│ │ Cost: 14,200đ | Margin: 20,800đ (59%)      │  │
│ │ [👁 View] [✏ Edit]                          │  │
│ └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Modal edit recipe:

```
┌──────────────────────────────────────────────────┐
│ ✏ EDIT: Cà phê sữa đá                            │
│                                                  │
│ Yield: [1] portion(s)  Prep: [90] seconds       │
│                                                  │
│ Ingredients:                                     │
│ ┌──────────────────────────────────────────────┐│
│ │ Café D2          [18  ] g   = 3,600đ          ││
│ │ Sữa đặc          [25  ] ml  = 875đ            ││
│ │ Đá viên          [150 ] g   = 75đ             ││
│ │ Ly nhựa          [1   ] cái = 800đ            ││
│ │ Ống hút          [1   ] cái = 50đ             ││
│ │ [+ Thêm nguyên liệu]                          ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ 💰 TOTAL COST: 5,400đ                            │
│ 💵 SELLING PRICE: 25,000đ                        │
│ 📊 MARGIN: 19,600đ (78%)                         │
│                                                  │
│ [Cancel] [Save as v2]                            │
└──────────────────────────────────────────────────┘
```

---

## 🧪 Test cases

```js
describe('Recipe auto-deduct', () => {
  it('deducts correct qty when order completed', async () => {
    // Seed recipe: Cf sữa đá = 18g cf, 25ml sữa đặc
    // Place order: 2× cf sữa đá
    await createTestOrder({ items: [{ product_id: 'PROD_CF_SUA_DA', quantity: 2 }] });

    // Trigger processOrderLoyalty (which calls deductInventoryForOrder)
    await processOrder(db, orderId);

    const cfMovement = await db.prepare(
      "SELECT qty_delta FROM stock_movements WHERE reference_id LIKE ? AND ingredient_id = ?"
    ).bind(`%${orderItemId}%`, 'ING_CF_D2').first();

    expect(cfMovement.qty_delta).toBe(-0.036); // 36g = 0.036kg (2 ly × 18g)
  });

  it('idempotent — re-processing same order does not deduct twice', async () => {
    await processOrder(db, orderId);
    await processOrder(db, orderId); // call again

    const movements = await db.prepare(
      "SELECT COUNT(*) AS cnt FROM stock_movements WHERE reference_id LIKE ? AND type='sale_deduct'"
    ).bind(`%${orderItemId}%`).first();

    expect(movements.cnt).toBe(5); // 5 ingredients × 1 trừ (không bị 10 do call 2 lần)
  });

  it('logs warning when no recipe exists for product', async () => {
    await createTestOrder({ items: [{ product_id: 'PROD_NO_RECIPE', quantity: 1 }] });
    const result = await deductInventoryForOrder(db, orderId);
    expect(result.warnings.length).toBe(1);
  });

  it('does not fail order if stock insufficient (warns only)', async () => {
    // Drain CF_D2 to 0
    // Place order requiring CF_D2 → deduct succeeds (allows negative stock)
    // Admin sees alert later
    const result = await deductInventoryForOrder(db, orderId);
    expect(result.errors.length).toBe(0); // not error, just negative stock
    const stock = await db.prepare("SELECT current_qty FROM v_current_stock WHERE ingredient_id='ING_CF_D2'").first();
    expect(stock.current_qty).toBeLessThan(0);
  });
});
```

---

## ⚠️ Design decisions cần justify

### Decision 1: KHÔNG block khi hết hàng
**Lý do:** POS không thể bị block — staff Khánh đang phục vụ khách, nếu thiếu sữa cf → vẫn cho bán, admin nhận alert "stock = -0.5 kg" để bổ sung.

### Decision 2: Recipe versioning thay vì update tại chỗ
**Lý do:** Historical orders cần preserve recipe cũ để tính COGS chính xác cho báo cáo trước đó.

### Decision 3: Idempotency qua UNIQUE INDEX
**Lý do:** Worker hoặc cron retry → không double-deduct. UNIQUE INDEX trên `(reference_id, ingredient_id) WHERE type='sale_deduct'` đã có từ task 14.

### Decision 4: Async low-stock check (fire & forget)
**Lý do:** Không làm chậm response order. Check async → email/Zalo notify admin sau.

---

## 🏁 Definition of Done

- [ ] 25 recipes seeded (em sẽ verify list cùng anh Còn trước)
- [ ] CRUD recipes endpoint test pass
- [ ] `deductInventoryForOrder()` integrated vào order processing
- [ ] Idempotent (re-run safe)
- [ ] UI `/admin/inventory/recipes.html` work
- [ ] PR mở: "feat(inventory): recipe auto-deduct from POS"

---

## 📌 Note quan trọng cho worker

Trước khi seed 25 recipes, worker phải:
1. Đọc `products` table hiện tại để biết product_id thực tế
2. Map tên menu trong recipe library ở trên với product_id thật
3. Nếu product chưa tồn tại → tạo skip (log warning, không tự create product mới)
4. Anh Còn sẽ confirm + chỉnh recipe sau khi worker tạo xong v1
