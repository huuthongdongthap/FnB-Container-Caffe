/**
 * AURA SPACE — Admin Dashboard (Orchestrator)
 * ES Module entry point
 */

import DashboardAPI from './dashboard-api.js';
import {
    renderStats,
    renderRevenueChart,
    renderOrdersTable,
    renderTopProducts,
    translatePaymentStatus,
    translateOrderStatus
} from './dashboard-render.js';

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

// ─── Utility Functions ───

export function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

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

window.DashboardUtils = {
    formatCurrency,
    formatDate,
    debounce
};

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

// ─── Initialize Dashboard ───

function initializeDashboard() {
    loadDashboardData();
    initializeSearch();
    initializeFilters();
    initializeExport();
    initializeRealTimeRefresh();

    // Sidebar Toggle (Mobile)
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

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
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
            }
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

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

// ─── Search ───

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

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

// ─── Filters ───

function initializeFilters() {
    const filterBtns = document.querySelectorAll('[data-filter]');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            DashboardState.currentFilter = this.dataset.filter;
            loadOrders();
        });
    });

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

// ─── Export ───

function initializeExport() {
    const exportBtn = document.querySelector('[data-export]');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', function() {
        const format = this.dataset.export;
        exportData(format);
    });
}

// ─── Real-time Refresh ───

function initializeRealTimeRefresh() {
    setInterval(() => {
        refreshData();
    }, 60000);
}

// ─── Date Range ───

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

// ─── Data Loading ───

async function loadDashboardData() {
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
        Skeleton.show(statsGrid, 'card', 4);
    }

    const stats = await DashboardAPI.fetchStats(7);
    if (stats) {
        DashboardState.stats = stats;
        renderStats(stats);
    }

    const revenueData = await DashboardAPI.fetchRevenue(7);
    if (revenueData.length > 0) {
        renderRevenueChart(revenueData);
    }

    await loadOrders();

    const products = await DashboardAPI.fetchTopProducts(5);
    if (products.length > 0) {
        renderTopProducts(products);
    }

    if (statsGrid) {
        Skeleton.hide(statsGrid);
    }
}

async function loadOrders() {
    const tableBody = document.querySelector('.orders-table tbody');
    if (!tableBody) return;

    Skeleton.show(tableBody.parentElement, 'table', 5);

    try {
        const orders = await DashboardAPI.fetchOrders(
            DashboardState.currentFilter === 'all' ? null : DashboardState.currentFilter,
            20,
            DashboardState.currentPage,
            DashboardState
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

        updatePagination();
    } catch (error) {
        Toast.error('Không thể tải danh sách đơn hàng');
    }

    Skeleton.hide(tableBody.parentElement);
}

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

// ─── Export Data ───

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

// ─── Refresh ───

function refreshData() {
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(stat => {
        stat.style.transition = 'opacity 0.3s';
        stat.style.opacity = '0.5';
        setTimeout(() => {
            stat.style.opacity = '1';
        }, 300);
    });

    loadDashboardData();
    Toast.info('Dữ liệu đã được làm mới', 2000);
}

// ─── Order Detail Modal ───

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

// ─── Order Actions ───

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

// ─── Global Exports ───

window.showOrderDetail = showOrderDetail;
window.handleOrderAction = handleOrderAction;
window.DashboardState = DashboardState;

// ─── DOMContentLoaded ───

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    initThemeToggle();
});
