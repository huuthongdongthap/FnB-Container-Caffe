// ═══════════════════════════════════════════════
//  KDS Render Module — Pure rendering functions
//  AURA CAFE Cafe — Sa Dec
// ═══════════════════════════════════════════════

// ─── Formatters ───
export function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

export function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ─── Priority Helpers ───
export function getPriorityClass(priority) {
  switch (priority) {
  case 'rush': return 'priority-rush';
  case 'low': return 'priority-low';
  default: return 'priority-normal';
  }
}

export function getPriorityLabel(priority) {
  switch (priority) {
  case 'rush': return '🔥 GẤP';
  case 'low': return '⏱️ Từ từ';
  default: return '';
  }
}

// ─── Render Single Order Card ───
export function renderOrderCard(order, ORDER_STATUS) {
  const elapsed = order.prepStartTime
    ? Date.now() - new Date(order.prepStartTime).getTime()
    : null;

  const elapsedMinutes = elapsed ? Math.floor(elapsed / 60000) : 0;
  const isOverdue = elapsed && elapsedMinutes > 10;

  return `
        <div class="order-card ${getPriorityClass(order.priority)} ${isOverdue ? 'order-overdue' : ''}" data-order-id="${order.id}">
            <div class="order-card-header">
                <div class="order-id">
                    <span class="order-number">${order.id}</span>
                    ${getPriorityLabel(order.priority) ? `<span class="priority-badge ${order.priority}">${getPriorityLabel(order.priority)}</span>` : ''}
                </div>
                <div class="order-meta">
                    ${order.orderType === 'dine-in' ? `<span class="table-badge">Bàn ${order.tableNumber}</span>` : ''}
                    <span class="order-type-badge ${order.orderType}">${order.orderType === 'dine-in' ? 'Tại quán' : 'Mang về'}</span>
                </div>
            </div>

            <div class="order-items">
                ${order.items.map(item => `
                    <div class="order-item">
                        <span class="item-qty">${item.quantity}x</span>
                        <span class="item-name">${item.name}</span>
                        <span class="item-price">${formatCurrency(item.price * item.quantity)}</span>
                    </div>
                `).join('')}
            </div>

            <div class="order-card-footer">
                <div class="order-total">
                    <span>Tổng:</span>
                    <span class="total-amount">${formatCurrency(order.total)}</span>
                </div>
                ${elapsed !== null ? `
                    <div class="order-timer ${isOverdue ? 'timer-danger' : ''}">
                        ⏱️ ${formatDuration(elapsed)}
                    </div>
                ` : ''}
            </div>

            <div class="order-actions">
                ${order.status !== ORDER_STATUS.PENDING ? `
                    <button class="btn-back" onclick="moveToPreviousStatus('${order.id}')" title="Quay lại">
                        ↩️
                    </button>
                ` : ''}
                <button class="btn-advance" onclick="advanceOrderStatus('${order.id}')" title="Chuyển trạng thái">
                    ${order.status === ORDER_STATUS.PENDING ? '▶️ Bắt đầu' : order.status === ORDER_STATUS.PREPARING ? '✅ Xong' : '✓ Đóng'}
                </button>
            </div>
        </div>
    `;
}

// ─── Render All Orders into DOM ───
// Support BOTH legacy IDs (pendingOrders) and new kds.html IDs (colPending)
export function renderAllOrders(orders, ORDER_STATUS) {
  const pendingContainer = document.getElementById('colPending') || document.getElementById('pendingOrders');
  const preparingContainer = document.getElementById('colPreparing') || document.getElementById('preparingOrders');
  const readyContainer = document.getElementById('colReady') || document.getElementById('readyOrders');
  const completedContainer = document.getElementById('colServed') || document.getElementById('completedOrders');

  if (!pendingContainer || !preparingContainer || !readyContainer || !completedContainer) {return;}

  const pending = orders.filter(o => o.status === ORDER_STATUS.PENDING);
  const preparing = orders.filter(o => o.status === ORDER_STATUS.PREPARING);
  const ready = orders.filter(o => o.status === ORDER_STATUS.READY);
  const completed = orders.filter(o => o.status === ORDER_STATUS.COMPLETED || o.status === 'served');

  pendingContainer.innerHTML = pending.map(o => renderOrderCard(o, ORDER_STATUS)).join('') || '<div class="kds-empty">Không có đơn chờ</div>';
  preparingContainer.innerHTML = preparing.map(o => renderOrderCard(o, ORDER_STATUS)).join('') || '<div class="kds-empty">Không có đơn</div>';
  readyContainer.innerHTML = ready.map(o => renderOrderCard(o, ORDER_STATUS)).join('') || '<div class="kds-empty">Không có đơn</div>';
  completedContainer.innerHTML = completed.map(o => renderOrderCard(o, ORDER_STATUS)).join('') || '<div class="kds-empty">Không có đơn</div>';

  // Update counts (support both naming conventions)
  const setCount = (newId, oldId, val) => {
    const el = document.getElementById(newId) || document.getElementById(oldId);
    if (el) {el.textContent = val;}
  };
  setCount('cntPending', 'pendingCount', pending.length);
  setCount('cntPreparing', 'preparingCount', preparing.length);
  setCount('cntReady', 'readyCount', ready.length);
  setCount('cntServed', 'completedCount', completed.length);
  // Top-bar stats on kds.html
  setCount('statPending', '', pending.length);
  setCount('statPreparing', '', preparing.length);
  setCount('statReady', '', ready.length);
}

// ─── Update Stats DOM ───
export function updateStats(orders, ORDER_STATUS, KDS_STATE) {
  const stats = {
    pending: orders.filter(o => o.status === ORDER_STATUS.PENDING).length,
    preparing: orders.filter(o => o.status === ORDER_STATUS.PREPARING).length,
    ready: orders.filter(o => o.status === ORDER_STATUS.READY).length,
    completed: orders.filter(o => o.status === ORDER_STATUS.COMPLETED).length
  };

  KDS_STATE.stats = stats;

  document.getElementById('statPending').textContent = stats.pending;
  document.getElementById('statPreparing').textContent = stats.preparing;
  document.getElementById('statReady').textContent = stats.ready;
}

// ─── Clock ───
export function updateClock() {
  const now = new Date();
  const clockEl = document.getElementById('kdsClock');
  const dateEl = document.getElementById('kdsDate');

  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

// ─── Timer Update ───
export function updateTimers(orders) {
  document.querySelectorAll('.order-timer').forEach(el => {
    const card = el.closest('.order-card');
    const orderId = card?.dataset.orderId;
    if (!orderId) {return;}

    const order = orders.find(o => o.id === orderId);
    if (!order || !order.prepStartTime) {return;}

    const elapsed = Date.now() - new Date(order.prepStartTime).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    el.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (minutes > 10) {
      el.classList.add('timer-danger');
      card.classList.add('order-overdue');
    }
  });
}
