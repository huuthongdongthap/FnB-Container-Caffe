# Phase 3: Staff Operations

**Duration:** Week 5-6 | **Risk:** Medium | **Goal:** Complete staff-facing features

---

## 3.1 Enhanced POS (Point of Sale)

**Current:** `StitchPOSNew` exists but lacks essential staff workflows.

**Target:** Full-featured POS with quick actions, table switching, hold/recall.

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Quick-add grid | One-tap to add popular items | High |
| Table switching | Change table for current order | High |
| Hold/Recall | Pause order, recall later | High |
| Split payment | Pay partially with different methods | Medium |
| Discount quick-apply | Apply common discounts (10%, 20%, staff) | Medium |
| Receipt preview | Before printing | Low |

### UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  POS HEADER: Table #5 | Staff: Nguyen | Time: 14:32    │
├───────────────────────────────────┬─────────────────────┤
│  CATEGORY TABS                    │  ORDER SUMMARY      │
│  [Coffee] [Food] [Drinks] [Snacks] │                     │
├───────────────────────────────────┤  • Latte x1   45,000│
│  PRODUCT GRID                     │  • Croissant x2 90K │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│  ──────────────────│
│  │Latte│ │Capuc│ │Match│ │Espr ││  Subtotal:  135,000 │
│  │45K  │ │50K  │ │55K  │ │35K  ││  Tax (8%):  10,800 │
│  └─────┘ └─────┘ └─────┘ └─────┘│  Total:    145,800  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│                     │
│  │Americ│ │Mocha│ │Frapp│ │Iced ││  [Hold] [Discount]  │
│  │40K   │ │55K  │ │60K  │ │45K  ││  [Split] [Payment]  │
│  └─────┘ └─────┘ └─────┘ └─────┘│                     │
├───────────────────────────────────┴─────────────────────┤
│  QUICK ACTIONS: [Repeat Last] [Void] [Open Drawer]     │
└─────────────────────────────────────────────────────────┘
```

### Implementation

```tsx
// src/components/pos/pos-layout.tsx
export function POSLayout() {
  const [currentTable, setCurrentTable] = useState<string | null>(null);
  const [heldOrders, setHeldOrders] = useState<CartItem[][]>([]);
  const { items, addItem, removeItem, updateQuantity } = useCartStore();
  
  return (
    <div className="h-screen flex flex-col">
      <POSHeader 
        table={currentTable} 
        onTableChange={setCurrentTable}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <CategoryTabs onSelect={filterProducts} />
          <ProductGrid 
            products={filteredProducts} 
            onAdd={addItem}
          />
        </div>
        <OrderSummary 
          items={items}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          onHold={() => holdOrder(items)}
          onPayment={openPayment}
        />
      </div>
      <QuickActions
        onRepeatLast={repeatLastOrder}
        onVoid={voidOrder}
        onOpenDrawer={openCashDrawer}
      />
    </div>
  );
}
```

---

## 3.2 Split Bill UI Flow

**Current:** Backend `splitOrders` exists, no frontend.

**Target:** Visual split-bill interface.

### Flow

```
1. View order items
2. Select items to split (drag or checkbox)
3. Assign to Person A / Person B / New Person
4. Each person pays their portion
5. Generate separate receipts
```

### UI Component

```tsx
// src/components/order/split-bill.tsx
interface Person {
  id: string;
  name: string;
  items: CartItem[];
  subtotal: number;
}

export function SplitBill({ order, onComplete }: Props) {
  const [people, setPeople] = useState<Person[]>([
    { id: '1', name: 'Person 1', items: [], subtotal: 0 },
    { id: '2', name: 'Person 2', items: [], subtotal: 0 },
  ]);
  
  const assignItem = (item: CartItem, personId: string) => {
    setPeople(prev => prev.map(p => {
      if (p.id === personId) {
        return { ...p, items: [...p.items, item], subtotal: p.subtotal + item.price };
      }
      return { ...p, items: p.items.filter(i => i.id !== item.id) };
    }));
  };
  
  return (
    <div className="space-y-4">
      <h2>Chia bill</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {people.map(person => (
          <PersonCard 
            key={person.id} 
            person={person}
            onAssign={assignItem}
          />
        ))}
      </div>
      <Button onClick={() => onComplete(people)}>
        Tạo {people.length} thanh toán riêng
      </Button>
    </div>
  );
}
```

---

## 3.3 Real-time Floor Plan

**Current:** Table status in text list format.

**Target:** Visual floor plan with real-time updates.

### Features

| Feature | Description |
|---------|-------------|
| Visual layout | Tables positioned on floor plan |
| Status colors | Green (available), Red (occupied), Yellow (pending) |
| Live updates | WebSocket push for status changes |
| Auto-release | Tables auto-free after 2 hours |
| Click-to-action | Click table to view/start session |

### Implementation

```tsx
// src/components/table/floor-plan.tsx
export function FloorPlan({ tables, onTableClick }: Props) {
  const { subscribe } = useRealtimeTables();
  
  useEffect(() => {
    const unsub = subscribe((update) => {
      // Update table status in real-time
    });
    return unsub;
  }, []);
  
  return (
    <div className="relative bg-gray-100 rounded-lg p-4" style={{ minHeight: 400 }}>
      {/* Background image of cafe layout */}
      <img src="/floor-plan-bg.png" className="absolute inset-0 opacity-20" />
      
      {/* Table positions */}
      {tables.map(table => (
        <button
          key={table.id}
          onClick={() => onTableClick(table)}
          className={`absolute w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all ${
            table.status === 'available' ? 'bg-green-500 hover:bg-green-600' :
            table.status === 'occupied' ? 'bg-red-500' :
            'bg-yellow-500'
          }`}
          style={{ left: table.x, top: table.y }}
        >
          {table.number}
          {table.status === 'occupied' && (
            <span className="absolute -top-2 -right-2 bg-white text-xs px-2 py-1 rounded-full text-gray-800">
              {table.session?.partySize}p
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

---

## 3.4 Station-Specific KDS Views

**Current:** Single KDS view for all orders.

**Target:** Filtered KDS per kitchen station.

### Implementation

```tsx
// src/components/kds/station-kds.tsx
export function StationKDS({ stationId }: { stationId: string }) {
  const { orders, updateItemStatus } = useStationOrders(stationId);
  const [timeRange, setTimeRange] = useState<'all' | '15min' | '30min'>('all');
  
  const filteredOrders = filterByTimeRange(orders, timeRange);
  
  return (
    <div className="h-full flex flex-col">
      <StationHeader 
        stationId={stationId} 
        orderCount={filteredOrders.length}
        onTimeRangeChange={setTimeRange}
      />
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => (
            <StationOrderCard
              key={order.id}
              order={order}
              stationId={stationId}
              onUpdateStatus={updateItemStatus}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 3.5 Staff Tip Tracking

**Current:** No tip tracking.

**Target:** Daily tip reports, staff distribution.

### DB Schema

```sql
CREATE TABLE staff_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  tip_amount INTEGER NOT NULL,
  tip_method TEXT NOT NULL, -- 'cash', 'card', 'qr'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE INDEX idx_staff_tips_date ON staff_tips(created_at);
CREATE INDEX idx_staff_tips_staff ON staff_tips(staff_id);
```

### API Endpoints

```
GET  /api/staff/tips/daily?date=2026-08-20     — Daily tip summary
GET  /api/staff/tips/my?staffId=xxx             — Individual staff tips
POST /api/staff/tips/distribute                 — Distribute tips to staff
```

### Report Component

```tsx
// src/components/admin/tip-report.tsx
export function TipReport({ date }: { date: string }) {
  const { data } = useQuery({
    queryKey: ['tips', date],
    queryFn: () => apiFetch(`/api/staff/tips/daily?date=${date}`),
  });
  
  return (
    <div className="space-y-4">
      <h2>Báo cáo tiền boa - {formatDate(date)}</h2>
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Tổng tiền boa" value={formatPrice(data.total)} />
        <StatCard title="Số giao dịch" value={data.transactionCount} />
        <StatCard title="Trung bình" value={formatPrice(data.average)} />
      </div>
      <StaffTipTable tips={data.byStaff} />
    </div>
  );
}
```

---

## Verification

After Phase 3:

1. POS workflow test:
   - Add items → Change table → Hold order → Recall → Pay
2. Split bill test:
   - Split items between 2 people → Pay separately
3. Floor plan test:
   - Start session → View status → End session
4. KDS station test:
   - View station-filtered orders → Update status
5. Tip tracking test:
   - Add tip → View daily report → Distribute to staff

---

*Phase 3 created: 2026-08-20*
