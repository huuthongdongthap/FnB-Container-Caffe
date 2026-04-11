/**
 * AURA SPACE — Admin Dashboard
 * Interactive Dashboard JavaScript
 */

// API Configuration
const API_BASE = 'http://localhost:8000/api';

// Dashboard State
const DashboardState = {
    currentPage: 1,
    totalPages: 1,
    currentFilter: 'all',
    dateRange: { start: null, end: null },
    searchQuery: '',
    orders: [],
    stats: null
};

// Dashboard API Integration Module
const DashboardAPI = {
    async fetchStats(days = 7) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/stats?days=${days}`);
            const data = await response.json();
            return data.success ? data.stats : null;
        } catch (error) {
            // Return mock data for demo
            return this.getMockStats();
        }
    },

    async fetchRevenue(days = 7) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/revenue?days=${days}`);
            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            // Return mock data for demo
            return this.getMockRevenue(days);
        }
    },

    async fetchOrders(status = null, limit = 20, page = 1) {
        try {
            const params = new URLSearchParams({
                status: status || 'all',
                limit: limit.toString(),
                page: page.toString()
            });
            const response = await fetch(`${API_BASE}/dashboard/orders?${params}`);
            const data = await response.json();
            if (data.success) {
                DashboardState.totalPages = data.total_pages || 1;
                return data.orders || [];
            }
            return [];
        } catch (error) {
            // Return mock data for demo
            return this.getMockOrders(limit);
        }
    },

    async fetchOrderDetail(orderId) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/orders/${orderId}`);
            const data = await response.json();
            return data.success ? data.order : null;
        } catch (error) {
            // Return mock data for demo
            return this.getMockOrderDetail(orderId);
        }
    },

    async fetchTopProducts(limit = 10) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/products/top?limit=${limit}`);
            const data = await response.json();
            return data.success ? data.products : [];
        } catch (error) {
            // Return mock data for demo
            return this.getMockTopProducts(limit);
        }
    },

    async updateOrderStatus(orderId, action) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/orders/${orderId}/status?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            return data.success ? data.order : null;
        } catch (error) {
            Toast.error('Không thể cập nhật trạng thái đơn hàng');
            return null;
        }
    },

    // Mock Data for Demo (remove when backend is ready)
    getMockStats() {
        return {
            revenue: { total: 24580000, growth: 12.5 },
            total_orders: 156,
            total_customers: 89,
            average_order_value: 157000
        };
    },

    getMockRevenue(days = 7) {
        const data = [];
        const now = new Date();
        const baseRevenue = 15000000;

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);

            const variance = Math.random() * 10000000;
            const weekendBoost = (date.getDay() === 6 || date.getDay() === 0) ? 5000000 : 0;

            data.push({
                date: date.toISOString().split('T')[0],
                revenue: baseRevenue + variance + weekendBoost
            });
        }

        return data;
    },

    getMockOrders(limit = 20) {
        const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
        const paymentStatuses = ['pending', 'paid'];
        const names = ['Nguyễn Thành', 'Trần Phương', 'Lê Văn', 'Phạm Huyền', 'Đặng Minh', 'Hoàng Anh', 'Phan Cường', 'Vũ Hạnh'];
        const items = ['Cà phê sữa đá', 'Trà sữa trân châu', 'Bánh mì ốp la', 'Cà phê đen', 'Nước ép cam', 'Latte', 'Americano', 'Sandwich'];

        return Array.from({ length: limit }, (_, i) => ({
            id: 1000 + i + 1,
            customer: {
                full_name: names[i % names.length],
                phone: '090' + Math.floor(Math.random() * 1000000),
                email: `customer${i}@example.com`
            },
            items: [
                { name: items[i % items.length], quantity: 1 + Math.floor(Math.random() * 3), price: 45000 + Math.floor(Math.random() * 30000) }
            ],
            total: 85000 + Math.floor(Math.random() * 200000),
            payment_status: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
            order_status: statuses[Math.floor(Math.random() * statuses.length)],
            created_at: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString()
        }));
    },

    getMockOrderDetail(orderId) {
        const names = ['Nguyễn Thành', 'Trần Phương', 'Lê Văn', 'Phạm Huyền'];
        return Promise.resolve({
            id: orderId,
            customer: {
                full_name: names[orderId % names.length],
                phone: '090' + Math.floor(Math.random() * 1000000),
                email: `customer${orderId}@example.com`
            },
            items: [
                { name: 'Cà phê sữa đá', quantity: 2, price: 45000 },
                { name: 'Bánh mì ốp la', quantity: 1, price: 55000 }
            ],
            total: 145000,
            payment_status: 'paid',
            payment_method: 'Tiền mặt',
            order_status: 'pending',
            created_at: new Date().toISOString()
        });
    },

    getMockTopProducts(limit = 10) {
        const products = [
            { name: 'Cà phê sữa đá', quantity: 245 },
            { name: 'Trà sữa trân châu', quantity: 198 },
            { name: 'Bánh mì ốp la', quantity: 167 },
            { name: 'Cà phê đen', quantity: 142 },
            { name: 'Nước ép cam', quantity: 128 },
            { name: 'Latte', quantity: 95 },
            { name: 'Americano', quantity: 87 },
            { name: 'Sandwich', quantity: 76 }
        ];
        return products.slice(0, limit);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    initializeDashboard();

    // Initialize theme toggle
    initThemeToggle();
});

// ─── Dark Mode Theme Toggle ───
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon') || themeToggle;

    if (!themeToggle) return;

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

/**
 * Initialize Dashboard
 */
function initializeDashboard() {
    // Load dashboard data
    loadDashboardData();

    // Initialize search with debounce
    initializeSearch();

    // Initialize filters
    initializeFilters();

    // Initialize export buttons
    initializeExport();

    // Initialize real-time refresh
    initializeRealTimeRefresh();

    // Sidebar Toggle (Mobile)
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Close sidebar when clicking outside (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Navigation Active State
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Allow navigation
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
            }

            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Update page title based on navigation
            const pageLabel = this.querySelector('.nav-label');
            if (pageLabel) {
                const pageTitle = document.querySelector('.page-title');
                if (pageTitle) {
                    pageTitle.textContent = pageLabel.textContent;
                }
            }
        });
    });

    // Stats Card Hover Animation Enhancement
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            statCards.forEach(c => {
                if (c !== card) {
                    c.style.opacity = '0.7';
                }
            });
        });

        card.addEventListener('mouseleave', function() {
            statCards.forEach(c => {
                c.style.opacity = '1';
            });
        });
    });
}

/**
 * Initialize Search
 */
function initializeSearch() {
    const searchInput = document.querySelector('.search-box input');
    if (!searchInput) return;

    let debounceTimer = null;

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            DashboardState.searchQuery = query;
            filterOrders();
        }, 300);
    });

    // Keyboard shortcut for search (Cmd/Ctrl + K)
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

/**
 * Initialize Filters
 */
function initializeFilters() {
    // Status filter buttons
    const filterBtns = document.querySelectorAll('[data-filter]');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            DashboardState.currentFilter = this.dataset.filter;
            loadOrders();
        });
    });

    // Date range preset buttons
    const datePresets = document.querySelectorAll('[data-date-range]');
    datePresets.forEach(btn => {
        btn.addEventListener('click', function() {
            datePresets.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const range = this.dataset.dateRange;
            const dates = calculateDateRange(range);
            DashboardState.dateRange = dates;
            loadDashboardData();
        });
    });
}

/**
 * Initialize Export Functionality
 */
function initializeExport() {
    const exportBtn = document.querySelector('[data-export]');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', function() {
        const format = this.dataset.export;
        exportData(format);
    });
}

/**
 * Initialize Real-time Refresh
 */
function initializeRealTimeRefresh() {
    // Auto-refresh every 60 seconds
    setInterval(() => {
        refreshData();
    }, 60000);
}

/**
 * Calculate Date Range
 */
function calculateDateRange(range) {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (range) {
        case 'today':
            break;
        case 'yesterday':
            start.setDate(now.getDate() - 1);
            end.setDate(now.getDate() - 1);
            break;
        case '7d':
            start.setDate(now.getDate() - 6);
            break;
        case '30d':
            start.setDate(now.getDate() - 29);
            break;
        case 'month':
            start.setDate(1);
            break;
    }

    return { start, end };
}

/**
 * Load Dashboard Data
 */
async function loadDashboardData() {
    // Show skeletons
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
        Skeleton.show(statsGrid, 'card', 4);
    }

    // Load stats
    const stats = await DashboardAPI.fetchStats(7);
    if (stats) {
        DashboardState.stats = stats;
        renderStats(stats);
    }

    // Load revenue chart
    const revenueData = await DashboardAPI.fetchRevenue(7);
    if (revenueData.length > 0) {
        renderRevenueChart(revenueData);
    }

    // Load orders table
    await loadOrders();

    // Load top products
    const products = await DashboardAPI.fetchTopProducts(5);
    if (products.length > 0) {
        renderTopProducts(products);
    }

    // Hide skeletons
    if (statsGrid) {
        Skeleton.hide(statsGrid);
    }
}

/**
 * Load Orders with Pagination
 */
async function loadOrders() {
    const tableBody = document.querySelector('.orders-table tbody');
    if (!tableBody) return;

    // Show skeleton
    Skeleton.show(tableBody.parentElement, 'table', 5);

    try {
        const orders = await DashboardAPI.fetchOrders(
            DashboardState.currentFilter === 'all' ? null : DashboardState.currentFilter,
            20,
            DashboardState.currentPage
        );

        DashboardState.orders = orders;

        if (orders.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">
                        Không có đơn hàng nào
                    </td>
                </tr>
            `;
        } else {
            renderOrdersTable(orders);
        }

        // Update pagination
        updatePagination();
    } catch (error) {
        Toast.error('Không thể tải danh sách đơn hàng');
    }

    // Hide skeleton
    Skeleton.hide(tableBody.parentElement);
}

/**
 * Filter Orders by Search Query
 */
function filterOrders() {
    const query = DashboardState.searchQuery.toLowerCase();

    const filteredOrders = DashboardState.orders.filter(order => {
        const customerName = order.customer?.full_name?.toLowerCase() || '';
        const orderId = order.id?.toString() || '';
        const items = order.items?.map(i => i.name?.toLowerCase()).join(' ') || '';

        return customerName.includes(query) ||
               orderId.includes(query) ||
               items.includes(query);
    });

    renderOrdersTable(filteredOrders);
}

/**
 * Update Pagination
 */
function updatePagination() {
    const paginationContainer = document.querySelector('.pagination-container');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';
    const pagination = Pagination.create({
        currentPage: DashboardState.currentPage,
        totalPages: DashboardState.totalPages,
        onPageChange: (page) => {
            DashboardState.currentPage = page;
            loadOrders();
        }
    });
    paginationContainer.appendChild(pagination);
}

/**
 * Export Data
 */
function exportData(format) {
    const { orders } = DashboardState;

    if (orders.length === 0) {
        Toast.warning('Không có dữ liệu để xuất');
        return;
    }

    switch (format) {
        case 'csv':
            exportToCSV(orders);
            Toast.success('Đã xuất file CSV');
            break;
        case 'pdf':
            Toast.info('Tính năng xuất PDF đang phát triển');
            break;
        case 'xlsx':
            Toast.info('Tính năng xuất Excel đang phát triển');
            break;
    }
}

/**
 * Export to CSV
 */
function exportToCSV(orders) {
    const headers = ['Mã đơn', 'Khách hàng', 'Sản phẩm', 'Tổng tiền', 'Trạng thái thanh toán', 'Trạng thái đơn', 'Thời gian'];
    const rows = orders.map(order => [
        `#${order.id}`,
        order.customer?.full_name || 'N/A',
        order.items?.map(i => i.name).join(', ') || 'N/A',
        order.total?.toString() || '0',
        translatePaymentStatus(order.payment_status),
        translateOrderStatus(order.order_status),
        new Date(order.created_at).toLocaleString('vi-VN')
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `don-hang-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

/**
 * Refresh Data
 */
function refreshData() {
    // Animate stat values
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(stat => {
        stat.style.transition = 'opacity 0.3s';
        stat.style.opacity = '0.5';
        setTimeout(() => {
            stat.style.opacity = '1';
        }, 300);
    });

    // Reload data
    loadDashboardData();

    Toast.info('Dữ liệu đã được làm mới', 2000);
}

/**
 * Show Order Detail Modal
 */
async function showOrderDetail(orderId) {
    try {
        const order = await DashboardAPI.fetchOrderDetail(orderId);
        if (!order) {
            Toast.error('Không thể tải chi tiết đơn hàng');
            return;
        }

        const content = `
            <div class="order-detail-grid">
                <div class="order-detail-section">
                    <h4>Thông tin đơn hàng</h4>
                    <div class="order-info-row">
                        <span class="order-info-label">Mã đơn</span>
                        <span class="order-info-value">#${order.id}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="order-info-label">Ngày đặt</span>
                        <span class="order-info-value">${formatDate(new Date(order.created_at))}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="order-info-label">Tổng tiền</span>
                        <span class="order-info-value">${formatCurrency(order.total)}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="order-info-label">Phương thức thanh toán</span>
                        <span class="order-info-value">${order.payment_method || 'Tiền mặt'}</span>
                    </div>
                </div>

                <div class="order-detail-section">
                    <h4>Thông tin khách hàng</h4>
                    <div class="order-info-row">
                        <span class="order-info-label">Tên khách</span>
                        <span class="order-info-value">${order.customer?.full_name || 'N/A'}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="order-info-label">Số điện thoại</span>
                        <span class="order-info-value">${order.customer?.phone || 'N/A'}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="order-info-label">Email</span>
                        <span class="order-info-value">${order.customer?.email || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div class="order-detail-section">
                <h4>Sản phẩm</h4>
                <div class="order-items-list">
                    ${order.items?.map(item => `
                        <div class="order-item-row">
                            <div class="order-item-qty">x${item.quantity}</div>
                            <span class="order-item-name">${item.name}</span>
                            <span class="order-item-price">${formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    `).join('') || '<p style="color: var(--text-dim);">Không có sản phẩm</p>'}
                </div>
            </div>

            <div class="status-actions">
                ${order.order_status === 'pending' ? `
                    <button class="btn btn-primary" onclick="handleOrderAction(${order.id}, 'confirm')">Xác nhận</button>
                    <button class="btn btn-danger" onclick="handleOrderAction(${order.id}, 'cancel')">Hủy đơn</button>
                ` : ''}
                ${order.order_status === 'confirmed' ? `
                    <button class="btn btn-primary" onclick="handleOrderAction(${order.id}, 'prepare')">Chuẩn bị</button>
                ` : ''}
                ${order.order_status === 'preparing' ? `
                    <button class="btn btn-primary" onclick="handleOrderAction(${order.id}, 'ready')">Sẵn sàng</button>
                ` : ''}
                ${order.order_status === 'ready' ? `
                    <button class="btn btn-primary" onclick="handleOrderAction(${order.id}, 'deliver')">Giao hàng</button>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: `Chi tiết đơn hàng #${order.id}`,
            content,
            size: 'large',
            actions: [
                {
                    id: 'close',
                    label: 'Đóng',
                    variant: 'secondary',
                    onClick: () => {},
                    close: false
                }
            ]
        });
    } catch (error) {
        Toast.error('Không thể tải chi tiết đơn hàng');
    }
}

/**
 * Handle Order Action
 */
async function handleOrderAction(orderId, action) {
    const actions = {
        view: () => showOrderDetail(orderId),
        confirm: { label: 'Xác nhận', apiAction: 'confirm' },
        cancel: { label: 'Hủy', apiAction: 'cancel', confirm: true },
        prepare: { label: 'Chuẩn bị', apiAction: 'prepare' },
        ready: { label: 'Sẵn sàng', apiAction: 'ready' },
        deliver: { label: 'Giao hàng', apiAction: 'deliver' }
    };

    const actionConfig = actions[action];
    if (!actionConfig) return;

    // Confirm destructive actions
    if (actionConfig.confirm) {
        const confirmed = await Confirm.show({
            title: 'Xác nhận hủy đơn',
            message: 'Bạn có chắc chắn muốn hủy đơn hàng này? Hành động này không thể hoàn tác.',
            confirmLabel: 'Hủy đơn',
            cancelLabel: 'Quay lại',
            type: 'danger'
        });

        if (!confirmed) return;
    }

    try {
        const result = await DashboardAPI.updateOrderStatus(orderId, actionConfig.apiAction);
        if (result) {
            Toast.success(`Đã ${actionConfig.label.toLowerCase()} đơn hàng #${orderId}`);
            loadOrders();
            loadDashboardData();
        } else {
            Toast.error('Có lỗi xảy ra khi cập nhật đơn hàng');
        }
    } catch (error) {
        Toast.error('Có lỗi xảy ra khi cập nhật đơn hàng');
    }
}

/**
 * Utility Functions
 */

// Format currency in Vietnamese Dong
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Format date in Vietnamese
function formatDate(date) {
    return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export for use in other modules
window.DashboardUtils = {
    formatCurrency,
    formatDate,
    debounce
};

function renderStats(stats) {
    // Update revenue stat
    const revenueEl = document.querySelector('[data-stat="revenue"]');
    if (revenueEl) {
        revenueEl.textContent = formatCurrency(stats.revenue.total);
    }

    // Update orders count
    const ordersEl = document.querySelector('[data-stat="orders"]');
    if (ordersEl) {
        ordersEl.textContent = stats.total_orders;
    }

    // Update customers count
    const customersEl = document.querySelector('[data-stat="customers"]');
    if (customersEl) {
        customersEl.textContent = stats.total_customers;
    }

    // Update average order value
    const avgOrderEl = document.querySelector('[data-stat="avg_order"]');
    if (avgOrderEl) {
        avgOrderEl.textContent = formatCurrency(stats.average_order_value);
    }
}

function renderRevenueChart(data) {
    const chartContainer = document.querySelector('.revenue-chart');
    if (!chartContainer) return;

    const maxRevenue = Math.max(...data.map(d => d.revenue));

    chartContainer.innerHTML = data.map((day, index) => {
        const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const dayName = dayNames[new Date(day.date).getDay()] || day.date.slice(5);

        return `
        <div class="bar-group" style="--chart-delay: ${index * 100}ms">
            <div class="bar" style="height: ${(day.revenue / maxRevenue) * 100}%">
                <span class="bar-value">${(day.revenue / 1000000).toFixed(1)}tr</span>
            </div>
            <span class="bar-label">${dayName}</span>
        </div>
    `;
    }).join('');
}

function renderOrdersTable(orders) {
    const tableBody = document.querySelector('.orders-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = orders.map(order => `
        <tr data-order-id="${order.id}">
            <td class="order-id">#${order.id}</td>
            <td>
                <div class="customer-cell">
                    <div class="customer-avatar">${getInitials(order.customer.full_name)}</div>
                    <span>${order.customer.full_name}</span>
                </div>
            </td>
            <td>${order.items.map(i => i.name).join(', ')}</td>
            <td class="amount">${formatCurrency(order.total)}</td>
            <td>
                <span class="status-badge ${order.payment_status}">
                    ${translatePaymentStatus(order.payment_status)}
                </span>
            </td>
            <td>
                <span class="status-badge ${order.order_status}">
                    ${translateOrderStatus(order.order_status)}
                </span>
            </td>
            <td>${formatDate(new Date(order.created_at))}</td>
        </tr>
    `).join('');
}

function getInitials(name) {
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function renderTopProducts(products) {
    const container = document.querySelector('.top-products');
    if (!container) return;

    container.innerHTML = products.map((product, index) => `
        <div class="product-item">
            <div class="product-rank">${index + 1}</div>
            <div class="product-info">
                <span class="product-name">${product.name}</span>
                <span class="product-category">Đồ uống</span>
            </div>
            <span class="product-sales">${product.quantity} đơn</span>
            <div class="product-bar" style="width: ${(product.quantity / products[0].quantity) * 100}%"></div>
        </div>
    `).join('');
}

function translatePaymentStatus(status) {
    const translations = {
        'pending': 'Chưa thanh toán',
        'paid': 'Đã thanh toán',
        'failed': 'Thất bại'
    };
    return translations[status] || status;
}

function translateOrderStatus(status) {
    const translations = {
        'pending': 'Chờ xử lý',
        'confirmed': 'Đã xác nhận',
        'preparing': 'Đang chuẩn bị',
        'ready': 'Sẵn sàng',
        'delivered': 'Đã giao',
        'cancelled': 'Đã hủy'
    };
    return translations[status] || status;
}

/**
 * Handle Order Action (legacy - kept for compatibility)
 */
function handleOrderActionLegacy(orderId, action) {
    // Legacy handler - kept for compatibility only
}

// Make functions globally accessible
window.showOrderDetail = showOrderDetail;
window.handleOrderAction = handleOrderAction;
window.DashboardState = DashboardState;
