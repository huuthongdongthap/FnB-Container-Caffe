// ═══════════════════════════════════════════════
//  KITCHEN DISPLAY SYSTEM (KDS) — Real-time Order Queue
//  F&B Container Café — Sa Đéc
// ═══════════════════════════════════════════════

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
    }
};

// ─── Mock Order Data Generator ───
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

// ─── Order ID Generator ───
function generateOrderId() {
    const date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `ORD-${hours}${minutes}-${random}`;
}

function generateTableNumber() {
    return Math.floor(Math.random() * 20) + 1;
}

// ─── Random Order Generator ───
function generateRandomOrder() {
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

    if (Math.random() > 0.8) priority = PRIORITY.RUSH;
    else if (Math.random() < 0.2) priority = PRIORITY.LOW;

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

// ─── Local Storage Helpers ───
function loadOrders() {
    const stored = localStorage.getItem('kds_orders');
    if (stored) {
        KDS_STATE.orders = JSON.parse(stored);
        // Filter out completed orders older than 1 hour
        const oneHourAgo = Date.now() - 3600000;
        KDS_STATE.orders = KDS_STATE.orders.filter(order => {
            if (order.status === ORDER_STATUS.COMPLETED) {
                return new Date(order.completedAt).getTime() > oneHourAgo;
            }
            return true;
        });
    } else {
        // Initialize with some sample orders
        KDS_STATE.orders = [
            generateRandomOrder(),
            generateRandomOrder(),
            generateRandomOrder()
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
    if (!order) return;

    const transitions = {
        [ORDER_STATUS.PENDING]: ORDER_STATUS.PREPARING,
        [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
        [ORDER_STATUS.READY]: ORDER_STATUS.COMPLETED,
        [ORDER_STATUS.COMPLETED]: null
    };

    const newStatus = transitions[order.status];
    if (!newStatus) return;

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    if (newStatus === ORDER_STATUS.PREPARING) {
        order.prepStartTime = new Date().toISOString();
    } else if (newStatus === ORDER_STATUS.READY) {
        order.readyAt = new Date().toISOString();
    } else if (newStatus === ORDER_STATUS.COMPLETED) {
        order.completedAt = new Date().toISOString();
    }

    saveOrders();
    renderAllOrders();
    updateStats();
}

function moveToPreviousStatus(orderId) {
    const order = KDS_STATE.orders.find(o => o.id === orderId);
    if (!order) return;

    const transitions = {
        [ORDER_STATUS.PREPARING]: ORDER_STATUS.PENDING,
        [ORDER_STATUS.READY]: ORDER_STATUS.PREPARING,
        [ORDER_STATUS.COMPLETED]: ORDER_STATUS.READY,
        [ORDER_STATUS.PENDING]: null
    };

    const newStatus = transitions[order.status];
    if (!newStatus) return;

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    if (newStatus === ORDER_STATUS.PENDING) {
        order.prepStartTime = null;
    } else if (newStatus === ORDER_STATUS.PREPARING) {
        order.readyAt = null;
    }

    saveOrders();
    renderAllOrders();
    updateStats();
}

// ─── Render Functions ───
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getPriorityClass(priority) {
    switch (priority) {
        case PRIORITY.RUSH: return 'priority-rush';
        case PRIORITY.LOW: return 'priority-low';
        default: return 'priority-normal';
    }
}

function getPriorityLabel(priority) {
    switch (priority) {
        case PRIORITY.RUSH: return '🔥 GẤP';
        case PRIORITY.LOW: return '⏱️ Từ từ';
        default: return '';
    }
}

function renderOrderCard(order) {
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

function renderAllOrders() {
    const pendingContainer = document.getElementById('pendingOrders');
    const preparingContainer = document.getElementById('preparingOrders');
    const readyContainer = document.getElementById('readyOrders');
    const completedContainer = document.getElementById('completedOrders');

    if (!pendingContainer || !preparingContainer || !readyContainer || !completedContainer) return;

    const pending = KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.PENDING);
    const preparing = KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.PREPARING);
    const ready = KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.READY);
    const completed = KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.COMPLETED);

    pendingContainer.innerHTML = pending.map(renderOrderCard).join('') || '<div class="empty-state">Không có order chờ</div>';
    preparingContainer.innerHTML = preparing.map(renderOrderCard).join('') || '<div class="empty-state">Không có order đang làm</div>';
    readyContainer.innerHTML = ready.map(renderOrderCard).join('') || '<div class="empty-state">Không có order sẵn sàng</div>';
    completedContainer.innerHTML = completed.map(renderOrderCard).join('') || '<div class="empty-state">Không có order hoàn thành</div>';

    // Update counts
    document.getElementById('pendingCount').textContent = pending.length;
    document.getElementById('preparingCount').textContent = preparing.length;
    document.getElementById('readyCount').textContent = ready.length;
    document.getElementById('completedCount').textContent = completed.length;
}

function updateStats() {
    const stats = {
        pending: KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.PENDING).length,
        preparing: KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.PREPARING).length,
        ready: KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.READY).length,
        completed: KDS_STATE.orders.filter(o => o.status === ORDER_STATUS.COMPLETED).length
    };

    KDS_STATE.stats = stats;

    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statPreparing').textContent = stats.preparing;
    document.getElementById('statReady').textContent = stats.ready;
}

// ─── Clock ───
function updateClock() {
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
function updateTimers() {
    document.querySelectorAll('.order-timer').forEach(el => {
        const card = el.closest('.order-card');
        const orderId = card?.dataset.orderId;
        if (!orderId) return;

        const order = KDS_STATE.orders.find(o => o.id === orderId);
        if (!order || !order.prepStartTime) return;

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

// ─── New Order Alert ───
let lastOrderCount = 0;

function checkNewOrders() {
    if (KDS_STATE.orders.length > lastOrderCount && lastOrderCount > 0) {
        // New order detected
        const newOrder = KDS_STATE.orders[KDS_STATE.orders.length - 1];
        showAlert(newOrder);
        if (KDS_STATE.settings.soundEnabled) {
            playNotificationSound();
        }
    }
    lastOrderCount = KDS_STATE.orders.length;
}

function showAlert(order) {
    const alert = document.getElementById('orderAlert');
    const alertOrderId = document.getElementById('alertOrderId');

    if (!alert || !alertOrderId) return;

    alertOrderId.textContent = order.id;
    alert.classList.add('show');

    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}

function playNotificationSound() {
    // Simple beep using Web Audio API
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
        console.warn('Audio not supported');
    }
}

// ─── Modal Functions ───
function openSettingsModal() {
    const modal = document.getElementById('kdsModal');
    if (modal) modal.classList.add('show');
}

function closeSettingsModal() {
    const modal = document.getElementById('kdsModal');
    if (modal) modal.classList.remove('show');
}

function closeOrderDetailModal() {
    const modal = document.getElementById('orderDetailModal');
    if (modal) modal.classList.remove('show');
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
            const newOrder = generateRandomOrder();
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

// ─── Initialization ───
function initKDS() {
    loadOrders();
    lastOrderCount = KDS_STATE.orders.length;

    renderAllOrders();
    updateStats();
    updateClock();

    // Clock update every second
    setInterval(updateClock, 1000);

    // Timer update every second
    setInterval(updateTimers, 1000);

    // Auto-refresh orders
    setInterval(() => {
        if (KDS_STATE.settings.autoRefresh) {
            // Simulate fetching new orders from server
            if (Math.random() > 0.7) {
                const newOrder = generateRandomOrder();
                KDS_STATE.orders.push(newOrder);
                saveOrders();
                renderAllOrders();
                updateStats();
                checkNewOrders();
            }
        }
    }, KDS_STATE.settings.refreshInterval);

    // Modal handlers
    document.getElementById('kdsSettings')?.addEventListener('click', openSettingsModal);
    document.getElementById('kdsModalClose')?.addEventListener('click', closeSettingsModal);
    document.getElementById('orderDetailClose')?.addEventListener('click', closeOrderDetailModal);
    document.getElementById('alertDismiss')?.addEventListener('click', () => {
        document.getElementById('orderAlert').classList.remove('show');
    });

    // Close modals on overlay click
    document.querySelectorAll('.kds-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            document.querySelectorAll('.kds-modal').forEach(m => m.classList.remove('show'));
        });
    });

    initSettings();

    console.log('👨‍🍳 KDS Initialized');
}

// Start KDS
document.addEventListener('DOMContentLoaded', initKDS);

// Expose functions globally for onclick handlers
window.advanceOrderStatus = advanceOrderStatus;
window.moveToPreviousStatus = moveToPreviousStatus;
