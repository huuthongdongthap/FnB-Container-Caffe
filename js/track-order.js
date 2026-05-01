/**
 * ═══════════════════════════════════════════════
 *  AURA CAFE — Order Tracking UI
 *  Real-time Order Status Tracking
 * ═══════════════════════════════════════════════
 */


// HTTP Polling
let pollTimer = null;
let currentOrderId = null;

// API Configuration
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://127.0.0.1:8787/api'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';

// Status labels in Vietnamese
const STATUS_LABELS = {
  pending: 'Chờ Xử Lý',
  confirmed: 'Đã Xác Nhận',
  preparing: 'Đang Chế Biến',
  ready: 'Sẵn Sàng',
  delivered: 'Đã Giao',
  cancelled: 'Đã Hủy'
};

// DOM Elements
const ui = {
  orderIdInput: null,
  trackOrderBtn: null,
  trackingLoading: null,
  statusCard: null,
  errorCard: null,
  emptyCard: null,
  displayOrderId: null,
  orderDate: null,
  currentStatus: null,
  connectionDot: null,
  connectionText: null,
  themeToggle: null
};

// Cache DOM elements
function cacheElements() {
  ui.orderIdInput = document.getElementById('orderIdInput');
  ui.trackOrderBtn = document.getElementById('trackOrderBtn');
  ui.trackingLoading = document.getElementById('trackingLoading');
  ui.statusCard = document.getElementById('statusCard');
  ui.errorCard = document.getElementById('errorCard');
  ui.emptyCard = document.getElementById('emptyCard');
  ui.displayOrderId = document.getElementById('displayOrderId');
  ui.orderDate = document.getElementById('orderDate');
  ui.currentStatus = document.getElementById('currentStatus');
  ui.connectionDot = document.getElementById('connectionDot');
  ui.connectionText = document.getElementById('connectionText');
  ui.themeToggle = document.getElementById('themeToggle');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  setupEventListeners();
  initThemeToggle();

  // Auto-track if order ID in URL or localStorage
  const urlOrderId = new URLSearchParams(window.location.search).get('order_id');
  const storedOrderId = localStorage.getItem('trackingOrderId');

  if (urlOrderId) {
    trackOrder(urlOrderId);
  } else if (storedOrderId) {
    trackOrder(storedOrderId);
  } else {
    ui.emptyCard.style.display = 'block';
  }
});

// Setup event listeners
function setupEventListeners() {
  if (ui.trackOrderBtn) {
    ui.trackOrderBtn.addEventListener('click', handleTrackClick);
  }

  if (ui.orderIdInput) {
    ui.orderIdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleTrackClick();
      }
    });
  }
}

// Handle track button click
function handleTrackClick() {
  const orderId = ui.orderIdInput?.value.trim();
  if (orderId) {
    trackOrder(orderId);
  } else {
    showToast('⚠️ Vui lòng nhập mã đơn hàng', 'error');
  }
}

// Track order
async function trackOrder(orderId) {
  currentOrderId = orderId;

  // Show loading
  ui.trackingLoading.style.display = 'flex';
  ui.emptyCard.style.display = 'none';
  ui.errorCard.style.display = 'none';
  ui.statusCard.style.display = 'none';

  try {
    // Fetch order details from API
    const response = await fetch(`${API_BASE}/orders/${orderId}`);

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.order) {
        displayOrderStatus(result.order);
        startPolling(orderId);
      } else {
        showError('Không tìm thấy đơn hàng #' + orderId);
      }
    } else {
      showError('Không tìm thấy đơn hàng #' + orderId);
    }
  } catch (err) {
    showError('Lỗi kết nối: ' + err.message);
  }
}

// Display order status
function displayOrderStatus(order) {
  ui.trackingLoading.style.display = 'none';
  ui.statusCard.style.display = 'block';

  // Update header info
  ui.displayOrderId.textContent = order.id;
  ui.orderDate.textContent = formatDate(new Date(order.created_at));

  // Update current status
  ui.currentStatus.textContent = STATUS_LABELS[order.status] || order.status;
  ui.currentStatus.className = `status-badge ${order.status}`;

  // Update timeline
  updateTimeline(order.status);

  // Update order details
  document.getElementById('customerName').textContent = order.customer?.full_name || '--';
  document.getElementById('customerPhone').textContent = order.customer?.phone || '--';
  document.getElementById('deliveryAddress').textContent = order.customer?.address || '--';
  document.getElementById('orderTotal').textContent = formatCurrency(order.total);

  // Save for WebSocket updates
  localStorage.setItem('trackingOrderId', order.id);
}

// Update timeline visualization
function updateTimeline(currentStatus) {
  const statusOrder = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
  const currentIndex = statusOrder.indexOf(currentStatus);

  document.querySelectorAll('.timeline-item').forEach(item => {
    const itemStatus = item.dataset.status;
    const itemIndex = statusOrder.indexOf(itemStatus);

    if (itemIndex <= currentIndex && currentStatus !== 'cancelled') {
      item.classList.add('completed');
    } else {
      item.classList.remove('completed');
    }

    // Show cancelled timeline if cancelled
    if (currentStatus === 'cancelled') {
      document.querySelector('.timeline-item[data-status="cancelled"]').style.display = 'flex';
    }
  });

  // Update timestamps
  const now = new Date();
  const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  for (let i = 0; i <= currentIndex && currentStatus !== 'cancelled'; i++) {
    const statusEl = document.getElementById(`${statusOrder[i]}Time`);
    if (statusEl && !statusEl.textContent.includes(':')) {
      statusEl.textContent = timeString;
    }
  }
}

// Start HTTP polling for order updates
function startPolling(orderId) {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  updateConnectionStatus(true);

  pollTimer = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/orders/${orderId}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.order) {
          updateOrderStatus(result.order);

          // Stop polling if order is completed
          if (result.order.status === 'delivered' || result.order.status === 'cancelled') {
            stopPolling();
          }
        }
      }
    } catch (err) {
      updateConnectionStatus(false);
    }
  }, 5000); // Poll every 5 seconds
}

// Stop polling
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  updateConnectionStatus(false);
}

// Update order status on UI
function updateOrderStatus(order) {
  const status = order.status || order.order_status;
  const currentDisplayedStatus = ui.currentStatus.textContent;
  const newDisplayedStatus = STATUS_LABELS[status] || status;

  // Only update if status changed (to avoid unnecessary notifications)
  if (currentDisplayedStatus !== newDisplayedStatus) {
    ui.currentStatus.textContent = newDisplayedStatus;
    ui.currentStatus.className = `status-badge ${status}`;

    updateTimeline(status);

    // Update timestamps with animation
    const timeEl = document.getElementById(`${status}Time`);
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      timeEl.style.animation = 'pulse 0.5s ease-in-out';
    }

    // Show toast notification
    showToast(`📦 Đơn hàng: ${newDisplayedStatus}`, 'info');
  }
}

// Update connection status indicator
function updateConnectionStatus(connected) {
  if (ui.connectionDot) {
    ui.connectionDot.className = `connection-dot ${connected ? 'connected' : 'disconnected'}`;
  }
  if (ui.connectionText) {
    ui.connectionText.textContent = connected ? 'Kết nối real-time' : 'Mất kết nối';
  }
}

// Show error state
function showError(message) {
  ui.trackingLoading.style.display = 'none';
  ui.errorCard.style.display = 'block';
  document.getElementById('errorMessage').textContent = message;
}

// Retry search
function retrySearch() {
  ui.errorCard.style.display = 'none';
  ui.emptyCard.style.display = 'block';
  ui.orderIdInput.value = '';
  ui.orderIdInput.focus();
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {return;}

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️';

  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message; // XSS prevention: dùng textContent thay vì innerHTML

  toast.appendChild(iconSpan);
  toast.appendChild(messageSpan);

  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format currency
function formatCurrency(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Format date
function formatDate(date) {
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Theme toggle
function initThemeToggle() {
  if (!ui.themeToggle) {return;}

  const themeIcon = ui.themeToggle.querySelector('.theme-icon');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  }

  ui.themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (themeIcon) {
      themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    }
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopPolling();
});

// Export for global access
window.trackOrderGlobal = trackOrder;
window.retrySearch = retrySearch;
