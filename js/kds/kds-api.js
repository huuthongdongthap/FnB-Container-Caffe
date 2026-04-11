// ═══════════════════════════════════════════════
//  KDS API Module — Network & Data Generation
//  AURA SPACE Cafe — Sa Dec
// ═══════════════════════════════════════════════


// ─── Order ID Generator ───
export function generateOrderId() {
  const date = new Date();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `ORD-${hours}${minutes}-${random}`;
}

export function generateTableNumber() {
  return Math.floor(Math.random() * 20) + 1;
}

// ─── Random Order Generator ───
export function generateRandomOrder(MENU_ITEMS, ORDER_STATUS, PRIORITY) {
  const numDrinks = Math.floor(Math.random() * 3) + 1;
  const numFood = Math.floor(Math.random() * 2);

  const items = [];
  const usedDrinks = new Set();
  const usedFood = new Set();

  for (let i = 0; i < numDrinks; i++) {
    let item;
    do {
      item = MENU_ITEMS.drinks[Math.floor(Math.random() * MENU_ITEMS.drinks.length)];
    } while (usedDrinks.has(item.id));
    usedDrinks.add(item.id);
    items.push({ ...item, quantity: Math.floor(Math.random() * 2) + 1, notes: '' });
  }

  if (numFood > 0) {
    for (let i = 0; i < numFood; i++) {
      let item;
      do {
        item = MENU_ITEMS.food[Math.floor(Math.random() * MENU_ITEMS.food.length)];
      } while (usedFood.has(item.id));
      usedFood.add(item.id);
      items.push({ ...item, quantity: 1, notes: '' });
    }
  }

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const orderType = Math.random() > 0.7 ? 'takeaway' : 'dine-in';
  let priority = PRIORITY.NORMAL;

  if (Math.random() > 0.8) {priority = PRIORITY.RUSH;}
  else if (Math.random() < 0.2) {priority = PRIORITY.LOW;}

  return {
    id: generateOrderId(),
    tableNumber: orderType === 'dine-in' ? generateTableNumber() : null,
    orderType,
    status: ORDER_STATUS.PENDING,
    priority,
    items,
    total,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prepStartTime: null,
    readyAt: null,
    completedAt: null,
    notes: ''
  };
}

// ─── API Functions ───
export async function fetchKDSOrders(apiBase) {
  const response = await fetch(`${apiBase}/kds/orders`);
  return await response.json();
}

export async function updateOrderStatusAPI(apiBase, orderId, status) {
  const response = await fetch(`${apiBase}/kds/orders/${orderId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: orderId,
      status: status,
      prep_started_at: status === 'preparing' ? new Date().toISOString() : null,
      ready_at: status === 'ready' ? new Date().toISOString() : null,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    })
  });
  return await response.json();
}

export async function fetchKDSStats(apiBase) {
  const response = await fetch(`${apiBase}/kds/stats`);
  return await response.json();
}
