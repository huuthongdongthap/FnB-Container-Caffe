# Phase 2: F&B Core Features

**Duration:** Week 3-4 | **Risk:** Medium | **Goal:** Implement missing F&B essentials

---

## 2.1 Table-Order Association

**Current:** Orders have `table_id` string field, no relational integrity.

**Target:** Table → Session → Orders hierarchy with real-time status.

### DB Schema

```sql
-- Table sessions (occupancy tracking)
CREATE TABLE table_sessions (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  party_size INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- active, pending_payment, completed
  metadata TEXT, -- JSON: customer info, special requests
  FOREIGN KEY (table_id) REFERENCES tables(id)
);

-- Link orders to sessions
ALTER TABLE orders ADD COLUMN session_id TEXT REFERENCES table_sessions(id);

-- Index for fast lookups
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_sessions_table ON table_sessions(table_id);
```

### API Endpoints

```
POST   /api/tables/:id/session      — Start new session
PATCH  /api/tables/:id/session      — Update session (party size, status)
DELETE /api/tables/:id/session      — End session
GET    /api/tables/:id/session      — Get active session with orders
GET    /api/tables/status           — All tables with current status
```

### Frontend Components

```tsx
// src/components/table/table-status-grid.tsx
interface TableStatus {
  id: string;
  number: number;
  status: 'available' | 'occupied' | 'pending_payment' | 'reserved';
  session?: {
    id: string;
    partySize: number;
    startedAt: string;
    orderCount: number;
    totalAmount: number;
  };
}

export function TableStatusGrid({ tables }: { tables: TableStatus[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {tables.map(table => (
        <TableCard key={table.id} table={table} />
      ))}
    </div>
  );
}
```

---

## 2.2 Cart Modifier/Add-on System

**Current:** CartItem has optional `modifiers?: string[]` but no UI or pricing logic.

**Target:** Full modifier system with pricing adjustments.

### Schema

```typescript
// src/hooks/stores/use-cart-store.ts
interface CartItemModifier {
  id: string;
  name: string;
  priceAdjustment: number; // +5000 for extra shot, -3000 for less sugar
}

interface CartItem {
  id: string;
  name: string;
  basePrice: number;
  quantity: number;
  modifiers: CartItemModifier[];
  addOns: CartItemModifier[];
  notes?: string;
  totalPrice: number; // basePrice + sum(modifiers) + sum(addOns)
}
```

### Modifier Categories

| Category | Options | Pricing |
|----------|---------|---------|
| Size | Small, Medium, Large | +0, +8000, +15000 |
| Sugar | 0%, 25%, 50%, 75%, 100% | +0 |
| Ice | No ice, Less, Regular, Extra | +0 |
| Milk | Regular, Almond, Oat, Soy | +0, +8000, +10000, +8000 |
| Add-ons | Extra shot, Whipped cream, Boba | +8000, +5000, +10000 |

### UI Component

```tsx
// src/components/menu/modifier-selector.tsx
export function ModifierSelector({ 
  item, 
  onAdd 
}: { 
  item: MenuItem; 
  onAdd: (item: CartItem) => void;
}) {
  const [selectedModifiers, setSelectedModifiers] = useState<CartItemModifier[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<CartItemModifier[]>([]);
  
  const totalPrice = item.price 
    + selectedModifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)
    + selectedAddOns.reduce((sum, a) => sum + a.priceAdjustment, 0);

  return (
    <div className="space-y-4">
      <ModifierGroup 
        title="Size"
        options={SIZES}
        selected={selectedModifiers}
        onChange={setSelectedModifiers}
      />
      <AddOnGroup 
        title="Thêm"
        options={ADDONS}
        selected={selectedAddOns}
        onChange={setSelectedAddOns}
      />
      <Button onClick={() => onAdd({ ...item, modifiers: selectedModifiers, addOns: selectedAddOns, totalPrice })}>
        Thêm vào giỏ — {formatPrice(totalPrice)}
      </Button>
    </div>
  );
}
```

---

## 2.3 Time-Based Pricing (Happy Hour)

**Current:** Happy hour logic is scattered across backend.

**Target:** Centralized pricing service that applies time-based rules.

### Implementation

```typescript
// src/lib/pricing-service.ts
interface PricingRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  conditions: {
    startTime: string; // "14:00"
    endTime: string;   // "16:00"
    daysOfWeek: number[]; // [1,2,3,4,5] = weekdays
    categories?: string[]; // apply only to these categories
  };
}

export function applyPricingRules(
  item: MenuItem,
  rules: PricingRule[],
  currentTime: Date = new Date()
): number {
  let price = item.price;
  
  for (const rule of rules) {
    if (isWithinRule(rule, currentTime)) {
      if (rule.type === 'percentage') {
        price -= price * (rule.value / 100);
      } else {
        price -= rule.value;
      }
    }
  }
  
  return Math.max(0, price); // never negative
}

function isWithinRule(rule: PricingRule, time: Date): boolean {
  const hour = time.getHours();
  const minute = time.getMinutes();
  const day = time.getDay();
  
  const [startH, startM] = rule.conditions.startTime.split(':').map(Number);
  const [endH, endM] = rule.conditions.endTime.split(':').map(Number);
  
  const timeMinutes = hour * 60 + minute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return (
    rule.conditions.daysOfWeek.includes(day) &&
    timeMinutes >= startMinutes &&
    timeMinutes <= endMinutes
  );
}
```

### Integration Points

- Menu page: show discounted prices
- Cart: recalculate on time change
- Checkout: lock in price at order creation
- Admin: manage pricing rules

---

## 2.4 Kitchen Station Routing

**Current:** KDS shows all orders, no station assignment.

**Target:** Items routed to stations by category.

### DB Schema

```sql
CREATE TABLE kitchen_stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- "Cà phê", "Đồ ăn", "Bar"
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1
);

-- Add station_id to menu items
ALTER TABLE menu_items ADD COLUMN station_id TEXT REFERENCES kitchen_stations(id);
```

### Station Configuration

| Station | Categories | Priority |
|---------|------------|----------|
| Coffee Station | coffee, frappuccino, tea | High (fast prep) |
| Food Station | food, snacks | Medium |
| Cold Drinks | smoothies, juice, yogurt, soda | Medium |
| Bar | signature, cocktails | Low (complex) |

### KDS per Station

```tsx
// src/components/kds/station-view.tsx
export function StationKDS({ stationId }: { stationId: string }) {
  const { orders } = useKDSOrders(stationId);
  
  return (
    <div className="space-y-4">
      <StationHeader stationId={stationId} orderCount={orders.length} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} stationId={stationId} />
        ))}
      </div>
    </div>
  );
}
```

---

## 2.5 Order Type Unification

**Current:** Separate code paths for dine-in, takeaway, delivery.

**Target:** Single order model with `order_type` field.

### Schema Update

```sql
ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
-- Values: 'dine_in', 'takeaway', 'delivery'

-- Delivery-specific fields
ALTER TABLE orders ADD COLUMN delivery_address TEXT;
ALTER TABLE orders ADD COLUMN delivery_fee INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN estimated_delivery_time DATETIME;

-- Takeaway-specific fields
ALTER TABLE orders ADD COLUMN pickup_time DATETIME;
```

### Type-Specific Behavior

```typescript
// src/lib/order-type-handler.ts
interface OrderTypeConfig {
  requireTable: boolean;
  requireAddress: boolean;
  requirePickupTime: boolean;
  defaultPaymentMethods: string[];
}

const ORDER_TYPE_CONFIGS: Record<string, OrderTypeConfig> = {
  dine_in: {
    requireTable: true,
    requireAddress: false,
    requirePickupTime: false,
    defaultPaymentMethods: ['cash', 'card', 'qr'],
  },
  takeaway: {
    requireTable: false,
    requireAddress: false,
    requirePickupTime: true,
    defaultPaymentMethods: ['cash', 'card', 'qr', 'momo'],
  },
  delivery: {
    requireTable: false,
    requireAddress: true,
    requirePickupTime: false,
    defaultPaymentMethods: ['cash', 'card', 'qr', 'momo', 'vnpay'],
  },
};
```

---

## 2.6 Tip Management

**Current:** No tip field anywhere.

**Target:** Full tip flow with UI, tracking, and reporting.

### DB Schema

```sql
ALTER TABLE orders ADD COLUMN tip_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN tip_method TEXT; -- 'cash', 'card', 'qr'
```

### UI Component

```tsx
// src/components/order/tip-selector.tsx
const TIP_PERCENTAGES = [0, 10, 15, 20, 25];

export function TipSelector({ 
  subtotal, 
  onTipChange 
}: { 
  subtotal: number; 
  onTipChange: (amount: number) => void;
}) {
  const [selectedPercent, setSelectedPercent] = useState(15);
  const [customTip, setCustomTip] = useState<number | null>(null);
  
  const tipAmount = customTip ?? Math.round(subtotal * selectedPercent / 100);
  
  useEffect(() => {
    onTipChange(tipAmount);
  }, [tipAmount]);
  
  return (
    <div className="space-y-3">
      <h3 className="font-medium">Tiền boa</h3>
      <div className="flex gap-2">
        {TIP_PERCENTAGES.map(percent => (
          <button
            key={percent}
            onClick={() => { setSelectedPercent(percent); setCustomTip(null); }}
            className={`px-4 py-2 rounded-lg ${selectedPercent === percent ? 'bg-primary text-white' : 'bg-gray-100'}`}
          >
            {percent === 0 ? 'Không' : `${percent}%`}
          </button>
        ))}
        <button
          onClick={() => setCustomTip(0)}
          className={`px-4 py-2 rounded-lg ${customTip !== null ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          Tùy chỉnh
        </button>
      </div>
      {customTip !== null && (
        <input
          type="number"
          value={customTip}
          onChange={(e) => setCustomTip(Number(e.target.value))}
          placeholder="Nhập số tiền"
          className="w-full px-4 py-2 border rounded-lg"
        />
      )}
      <p className="text-sm text-gray-500">
        Tiền boa: {formatPrice(tipAmount)}
      </p>
    </div>
  );
}
```

---

## Verification

After Phase 2:

1. All existing tests pass
2. New tests for:
   - Order state machine transitions
   - Modifier pricing calculations
   - Happy hour rule application
   - Station routing logic
3. Manual testing:
   - Create order with modifiers
   - Verify happy hour pricing at different times
   - Check KDS station filtering
   - Test tip selection and persistence

---

*Phase 2 created: 2026-08-20*
