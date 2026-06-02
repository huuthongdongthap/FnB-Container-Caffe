// ═══════════════════════════════════════════════
//  KDS API Module — Network & Data Generation
//  AURA CAFE Cafe — Sa Dec
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
function getAuthHeaders() {
  const token = localStorage.getItem('aura_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function normalizeOrder(order = {}) {
  const status = order.order_status || order.status || 'pending';
  const items = Array.isArray(order.items) ? order.items : [];
  const normalizedItems = items.map((item) => ({
    id: item.id || item.product_id || '',
    name: item.product_name || item.name || 'Món',
    price: Number(item.price || item.unit_price || 0),
    quantity: Number(item.quantity || 1),
    notes: item.note || item.notes || ''
  }));

  const total = Number(order.total_amount || order.total || 0);
  return {
    id: order.id,
    tableNumber: order.table_number || order.tableNumber || null,
    orderType: order.order_type || order.orderType || 'dine-in',
    status,
    priority: order.priority || 'normal',
    items: normalizedItems,
    total,
    createdAt: order.created_at || order.createdAt || new Date().toISOString(),
    updatedAt: order.updated_at || order.updatedAt || order.created_at || new Date().toISOString(),
    prepStartTime: order.prep_started_at || order.prepStartTime || null,
    readyAt: order.ready_at || order.readyAt || null,
    completedAt: order.completed_at || order.completedAt || null,
    notes: order.notes || ''
  };
}

export async function fetchKDSOrders(apiBase) {
  const response = await fetch(`${apiBase}/kds/orders`, { headers: getAuthHeaders() });
  const result = await response.json();

  if (!response.ok || !result.success) {
    return { success: false, orders: [], lastUpdated: new Date().toISOString() };
  }

  return {
    success: true,
    orders: (result.data || []).map(normalizeOrder),
    lastUpdated: new Date().toISOString()
  };
}

export async function updateOrderStatusAPI(apiBase, orderId, status) {
  const response = await fetch(`${apiBase}/kds/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
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
  try {
    const response = await fetch(`${apiBase}/kds/orders?status=pending,preparing,ready&include=items`);
    const result = await response.json();

    if (result.success && result.data) {
      const orders = result.data;

      // Count orders by status
      const stats = {
        pending: orders.filter(o => o.order_status === 'pending' || o.status === 'pending').length,
        preparing: orders.filter(o => o.order_status === 'preparing' || o.status === 'preparing').length,
        ready: orders.filter(o => o.order_status === 'ready' || o.status === 'ready').length
      };

      return {
        success: true,
        stats: stats
      };
    } else {
      return {
        success: false,
        stats: { pending: 0, preparing: 0, ready: 0 }
      };
    }
  } catch (error) {
    return {
      success: false,
      stats: { pending: 0, preparing: 0, ready: 0 }
    };
  }
}
