// ═══════════════════════════════════════════════
//  KITCHEN DISPLAY SYSTEM (KDS) — Orchestrator
//  AURA SPACE Cafe — Sa Dec
// ═══════════════════════════════════════════════

import {
  generateRandomOrder,
  fetchKDSOrders as fetchKDSOrdersAPI,
  updateOrderStatusAPI,
  fetchKDSStats as fetchKDSStatsAPI
} from './kds/kds-api.js';

import {
  renderOrderCard,
  renderAllOrders as renderAllOrdersView,
  updateStats as updateStatsView,
  updateClock,
  updateTimers,
  formatCurrency
} from './kds/kds-render.js';

// ─── Configuration ───
const KDS_CONFIG = {
  API_BASE: 'http://localhost:8000/api',
  WS_URL: 'ws://localhost:8080/ws',
  POLL_INTERVAL: 5000,
  SOUND_ENABLED: true,
  AUTO_REFRESH: true
};

// ─── WebSocket Connection ───
let kdsWebSocket = null;

// ─── State Management ───
const KDS_STATE = {
  orders: [],
  settings: {
    soundEnabled: true,
    autoRefresh: true,
    refreshInterval: 5000,
    lastSync: null
  },
  stats: {
    pending: 0,
    preparing: 0,
    ready: 0,
    completed: 0
  },
  lastOrderId: null,
  lastOrderCount: 0
};

// ─── Constants ───
const MENU_ITEMS = {
  drinks: [
    { id: 'D001', name: 'Espresso', price: 45000, category: 'coffee', prepTime: 3 },
    { id: 'D002', name: 'Cappuccino', price: 55000, category: 'coffee', prepTime: 4 },
    { id: 'D003', name: 'Latte Art', price: 60000, category: 'coffee', prepTime: 5 },
    { id: 'D004', name: 'Cold Brew', price: 65000, category: 'coffee', prepTime: 2 },
    { id: 'D005', name: 'Container Special', price: 85000, category: 'drinks', prepTime: 6 },
    { id: 'D006', name: 'Neon Blueberry', price: 75000, category: 'drinks', prepTime: 4 },
    { id: 'D007', name: 'Sa Đéc Sunset', price: 80000, category: 'drinks', prepTime: 5 },
    { id: 'D008', name: 'Matcha Fusion', price: 70000, category: 'drinks', prepTime: 4 },
    { id: 'D009', name: 'Coconut Latte', price: 65000, category: 'coffee', prepTime: 4 },
    { id: 'D010', name: 'Pour Over V60', price: 70000, category: 'coffee', prepTime: 6 }
  ],
  food: [
    { id: 'F001', name: 'Croissant Bơ', price: 45000, category: 'food', prepTime: 2 },
    { id: 'F002', name: 'Bagel Sandwich', price: 65000, category: 'food', prepTime: 8 },
    { id: 'F003', name: 'Fries Giòn', price: 55000, category: 'food', prepTime: 6 },
    { id: 'F004', name: 'Nachos Cheese', price: 70000, category: 'food', prepTime: 7 },
    { id: 'F005', name: 'Salad Cá Ngừ', price: 75000, category: 'food', prepTime: 5 },
    { id: 'F006', name: 'Bánh Mì Que Pate', price: 35000, category: 'food', prepTime: 3 }
  ]
};

const ORDER_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed'
};

const PRIORITY = {
  RUSH: 'rush',
  NORMAL: 'normal',
  LOW: 'low'
};

// ─── Convenience wrappers (bind state to pure render fns) ───
function renderAllOrders() {
  renderAllOrdersView(KDS_STATE.orders, ORDER_STATUS);
}

function updateStats() {
  updateStatsView(KDS_STATE.orders, ORDER_STATUS, KDS_STATE);
}

// ─── API Wrappers ───
async function fetchKDSOrders() {
  try {
    const result = await fetchKDSOrdersAPI(KDS_CONFIG.API_BASE);

    if (result.success) {
      const previousCount = KDS_STATE.orders.length;
      KDS_STATE.orders = result.orders;
      KDS_STATE.settings.lastSync = result.lastUpdated;

      if (result.orders.length > previousCount) {
        const newOrder = result.orders[result.orders.length - 1];
        handleNewOrder(newOrder);
      }

      KDS_STATE.lastOrderCount = result.orders.length;
      saveOrders();
      renderAllOrders();
      updateStats();
    }
  } catch (error) {
    loadOrders();
    renderAllOrders();
  }
}

async function fetchKDSStats() {
  try {
    const result = await fetchKDSStatsAPI(KDS_CONFIG.API_BASE);

    if (result.success) {
      KDS_STATE.stats = result.stats;
      document.getElementById('statPending').textContent = result.stats.pending;
      document.getElementById('statPreparing').textContent = result.stats.preparing;
      document.getElementById('statReady').textContent = result.stats.ready;
    }
  } catch (error) {
    // Silently fail
  }
}

// ─── Local Storage Helpers ───
function loadOrders() {
  const stored = localStorage.getItem('kds_orders');
  if (stored) {
    KDS_STATE.orders = JSON.parse(stored);
    const oneHourAgo = Date.now() - 3600000;
    KDS_STATE.orders = KDS_STATE.orders.filter(order => {
      if (order.status === ORDER_STATUS.COMPLETED) {
        return new Date(order.completedAt).getTime() > oneHourAgo;
      }
      return true;
    });
  } else {
    KDS_STATE.orders = [
      generateRandomOrder(MENU_ITEMS, ORDER_STATUS, PRIORITY),
      generateRandomOrder(MENU_ITEMS, ORDER_STATUS, PRIORITY),
      generateRandomOrder(MENU_ITEMS, ORDER_STATUS, PRIORITY)
    ];
    KDS_STATE.orders[0].status = ORDER_STATUS.PREPARING;
    KDS_STATE.orders[0].prepStartTime = new Date(Date.now() - 300000).toISOString();
    KDS_STATE.orders[1].status = ORDER_STATUS.READY;
    KDS_STATE.orders[1].prepStartTime = new Date(Date.now() - 420000).toISOString();
    KDS_STATE.orders[1].readyAt = new Date(Date.now() - 60000).toISOString();
  }
  saveOrders();
}

function saveOrders() {
  localStorage.setItem('kds_orders', JSON.stringify(KDS_STATE.orders));
}

// ─── Order Actions ───
function advanceOrderStatus(orderId) {
  const order = KDS_STATE.orders.find(o => o.id === orderId);
  if (!order) {return;}

  const transitions = {
    [ORDER_STATUS.PENDING]: ORDER_STATUS.PREPARING,
    [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
    [ORDER_STATUS.READY]: ORDER_STATUS.COMPLETED,
    [ORDER_STATUS.COMPLETED]: null
  };

  const newStatus = transitions[order.status];
  if (!newStatus) {return;}

  order.status = newStatus;
  order.updatedAt = new Date().toISOString();

  if (newStatus === ORDER_STATUS.PREPARING) {
    order.prepStartTime = new Date().toISOString();
  } else if (newStatus === ORDER_STATUS.READY) {
    order.readyAt = new Date().toISOString();
  } else if (newStatus === ORDER_STATUS.COMPLETED) {
    order.completedAt = new Date().toISOString();
  }

  updateOrderStatusAPI(KDS_CONFIG.API_BASE, orderId, newStatus).catch(() => {});

  saveOrders();
  renderAllOrders();
  updateStats();
}

function moveToPreviousStatus(orderId) {
  const order = KDS_STATE.orders.find(o => o.id === orderId);
  if (!order) {return;}

  const transitions = {
    [ORDER_STATUS.PREPARING]: ORDER_STATUS.PENDING,
    [ORDER_STATUS.READY]: ORDER_STATUS.PREPARING,
    [ORDER_STATUS.COMPLETED]: ORDER_STATUS.READY,
    [ORDER_STATUS.PENDING]: null
  };

  const newStatus = transitions[order.status];
  if (!newStatus) {return;}

  order.status = newStatus;
  order.updatedAt = new Date().toISOString();

  if (newStatus === ORDER_STATUS.PENDING) {
    order.prepStartTime = null;
  } else if (newStatus === ORDER_STATUS.PREPARING) {
    order.readyAt = null;
  }

  updateOrderStatusAPI(KDS_CONFIG.API_BASE, orderId, newStatus).catch(() => {});

  saveOrders();
  renderAllOrders();
  updateStats();
}

// ─── New Order Alert ───
function handleNewOrder(order) {
  showAlert(order);
  if (KDS_STATE.settings.soundEnabled) {
    playNotificationSound();
  }
}

function checkNewOrders() {
  const currentCount = KDS_STATE.orders.length;

  if (currentCount > KDS_STATE.lastOrderCount) {
    const newOrder = KDS_STATE.orders[currentCount - 1];
    handleNewOrder(newOrder);
  }

  KDS_STATE.lastOrderCount = currentCount;
}

function showAlert(order) {
  const alert = document.getElementById('orderAlert');
  const alertOrderId = document.getElementById('alertOrderId');

  if (!alert || !alertOrderId) {return;}

  alertOrderId.textContent = order.id;
  alert.classList.add('show');

  setTimeout(() => {
    alert.classList.remove('show');
  }, 5000);
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    // Audio not supported
  }
}

// ─── Modal Functions ───
function openSettingsModal() {
  const modal = document.getElementById('kdsModal');
  if (modal) {modal.classList.add('show');}
}

function closeSettingsModal() {
  const modal = document.getElementById('kdsModal');
  if (modal) {modal.classList.remove('show');}
}

function closeOrderDetailModal() {
  const modal = document.getElementById('orderDetailModal');
  if (modal) {modal.classList.remove('show');}
}

// ─── Settings Handlers ───
function initSettings() {
  const toggleSound = document.getElementById('toggleSound');
  const toggleAutoRefresh = document.getElementById('toggleAutoRefresh');
  const refreshInterval = document.getElementById('refreshInterval');
  const btnGenerateTest = document.getElementById('btnGenerateTestOrder');
  const btnViewAll = document.getElementById('btnViewAllOrders');

  if (toggleSound) {
    toggleSound.checked = KDS_STATE.settings.soundEnabled;
    toggleSound.addEventListener('change', (e) => {
      KDS_STATE.settings.soundEnabled = e.target.checked;
    });
  }

  if (toggleAutoRefresh) {
    toggleAutoRefresh.checked = KDS_STATE.settings.autoRefresh;
    toggleAutoRefresh.addEventListener('change', (e) => {
      KDS_STATE.settings.autoRefresh = e.target.checked;
    });
  }

  if (refreshInterval) {
    refreshInterval.value = KDS_STATE.settings.refreshInterval / 1000;
    refreshInterval.addEventListener('change', (e) => {
      KDS_STATE.settings.refreshInterval = Math.max(3000, Math.min(60000, parseInt(e.target.value) * 1000));
    });
  }

  if (btnGenerateTest) {
    btnGenerateTest.addEventListener('click', () => {
      const newOrder = generateRandomOrder(MENU_ITEMS, ORDER_STATUS, PRIORITY);
      KDS_STATE.orders.push(newOrder);
      saveOrders();
      renderAllOrders();
      updateStats();
      showAlert(newOrder);
      if (KDS_STATE.settings.soundEnabled) {
        playNotificationSound();
      }
      closeSettingsModal();
    });
  }

  if (btnViewAll) {
    btnViewAll.addEventListener('click', () => {
      const report = KDS_STATE.orders.map(o => `${o.id} - ${o.status} - ${formatCurrency(o.total)}`).join('\n');
      alert(`Tất cả Orders:\n\n${report}`);
    });
  }
}

// ─── WebSocket Integration ───
function initWebSocket() {
  if (!window.WebSocketClient) {
    return;
  }

  kdsWebSocket = new window.WebSocketClient(KDS_CONFIG.WS_URL);

  kdsWebSocket.on('connected', (data) => {
    // Silent for production
  });

  kdsWebSocket.on('new_order', (data) => {
    handleNewOrderFromWebSocket(data);
  });

  kdsWebSocket.on('order_updated', (data) => {
    updateOrderFromWebSocket(data);
  });

  kdsWebSocket.on('order_cancelled', (data) => {
    removeOrderFromWebSocket(data.orderId);
  });

  kdsWebSocket.connect('kitchen', null).then(() => {
    kdsWebSocket.startHeartbeat(30000);
  }).catch(err => {
    // Silent fail for production
  });

  window.addEventListener('beforeunload', () => {
    if (kdsWebSocket) {
      kdsWebSocket.disconnect();
    }
  });
}

function handleNewOrderFromWebSocket(order) {
  const existing = KDS_STATE.orders.find(o => o.id === order.id);
  if (existing) {
    return;
  }

  const newOrder = {
    id: order.id,
    tableNumber: order.table?.number || null,
    orderType: order.type || 'takeaway',
    status: ORDER_STATUS.PENDING,
    priority: order.priority || PRIORITY.NORMAL,
    items: order.items || [],
    total: order.total || 0,
    createdAt: order.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prepStartTime: null,
    readyAt: null,
    completedAt: null,
    notes: order.notes || ''
  };

  KDS_STATE.orders.unshift(newOrder);
  saveOrders();
  renderAllOrders();
  updateStats();

  handleNewOrder(newOrder);
}

function updateOrderFromWebSocket(orderData) {
  const order = KDS_STATE.orders.find(o => o.id === orderData.id);
  if (!order) {return;}

  if (orderData.status) {
    order.status = orderData.status;
    order.updatedAt = new Date().toISOString();

    if (orderData.status === 'preparing') {
      order.prepStartTime = new Date().toISOString();
    } else if (orderData.status === 'ready') {
      order.readyAt = new Date().toISOString();
    } else if (orderData.status === 'completed') {
      order.completedAt = new Date().toISOString();
    }
  }

  saveOrders();
  renderAllOrders();
  updateStats();
}

function removeOrderFromWebSocket(orderId) {
  const index = KDS_STATE.orders.findIndex(o => o.id === orderId);
  if (index > -1) {
    KDS_STATE.orders.splice(index, 1);
    saveOrders();
    renderAllOrders();
    updateStats();
  }
}

// ─── Initialization ───
async function initKDS() {
  await fetchKDSOrders();
  await fetchKDSStats();

  if (KDS_STATE.orders.length === 0) {
    loadOrders();
    renderAllOrders();
  }

  initWebSocket();

  updateClock();

  setInterval(updateClock, 1000);
  setInterval(() => updateTimers(KDS_STATE.orders), 1000);

  setInterval(() => {
    if (KDS_STATE.settings.autoRefresh) {
      fetchKDSOrders();
      fetchKDSStats();
    }
  }, KDS_CONFIG.POLL_INTERVAL);

  document.getElementById('kdsSettings')?.addEventListener('click', openSettingsModal);
  document.getElementById('kdsModalClose')?.addEventListener('click', closeSettingsModal);
  document.getElementById('orderDetailClose')?.addEventListener('click', closeOrderDetailModal);
  document.getElementById('alertDismiss')?.addEventListener('click', () => {
    document.getElementById('orderAlert').classList.remove('show');
  });

  document.querySelectorAll('.kds-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      document.querySelectorAll('.kds-modal').forEach(m => m.classList.remove('show'));
    });
  });

  initSettings();
}

// ─── Dark Mode Theme Toggle ───
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon') || themeToggle;

  if (!themeToggle) {return;}

  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  }

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (themeIcon) {
      themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    }
  });
}

// ─── Start KDS ───
document.addEventListener('DOMContentLoaded', () => {
  initKDS();
  initThemeToggle();
});

// Expose functions globally for onclick handlers
window.advanceOrderStatus = advanceOrderStatus;
window.moveToPreviousStatus = moveToPreviousStatus;