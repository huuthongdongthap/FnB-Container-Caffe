/**
 * F&B Admin Dashboard - Quan ly don hang, doanh thu, thong ke
 * Keth noi API Dashboard va cap nhat real-time
 */

// Import API Client
import {
    fetchAdminOrders,
    fetchDashboardStats,
    fetchRevenue,
    fetchTopProducts,
    getAdminOrderDetail,
    updateOrderStatus as apiUpdateOrderStatus
} from '../js/api-client.js';

// ═══════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════
const API_BASE = '/api';
const REFRESH_INTERVAL = 30000; // 30 seconds

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let dashboardState = {
    stats: null,
    orders: [],
    products: [],
    revenue: [],
    loading: false,
    lastUpdated: null
};

// ═══════════════════════════════════════════════════
//  MOCK DATA (Fallback khi API chưa có)
// ═══════════════════════════════════════════════════
const mockData = {
    stats: {
        stats: {
            total_orders: 24,
            revenue: { total: 12500000, growth: 12.5 },
            total_customers: 18,
            orders_by_status: { pending: 3, confirmed: 5, preparing: 2, ready: 4, delivered: 8, completed: 2 }
        }
    },
    orders: {
        orders: [
            { id: 'ORD001', customer: { name: 'Nguyễn Văn A', phone: '0901234567' }, total: 125000, order_status: 'pending', payment_method: 'cod', payment_status: 'unpaid', created_at: new Date().toISOString(), items: [{ name: 'Cà phê sữa đá', quantity: 2, price: 45000 }] },
            { id: 'ORD002', customer: { name: 'Trần Thị B', phone: '0912345678' }, total: 85000, order_status: 'confirmed', payment_method: 'momo', payment_status: 'paid', created_at: new Date(Date.now() - 3600000).toISOString(), items: [{ name: 'Trà đào cam sả', quantity: 2, price: 42000 }] },
            { id: 'ORD003', customer: { name: 'Lê Văn C', phone: '0923456789' }, total: 210000, order_status: 'preparing', payment_method: 'cod', payment_status: 'unpaid', created_at: new Date(Date.now() - 7200000).toISOString(), items: [{ name: 'Cà phê đen', quantity: 3, price: 35000 }, { name: 'Bánh mì chảo', quantity: 2, price: 55000 }] },
            { id: 'ORD004', customer: { name: 'Phạm Thị D', phone: '0934567890' }, total: 65000, order_status: 'ready', payment_method: 'vnpay', payment_status: 'paid', created_at: new Date(Date.now() - 10800000).toISOString(), items: [{ name: 'Cà phê bạc xỉu', quantity: 2, price: 45000 }] },
            { id: 'ORD005', customer: { name: 'Hoàng Văn E', phone: '0945678901' }, total: 320000, order_status: 'delivered', payment_method: 'cod', payment_status: 'paid', created_at: new Date(Date.now() - 14400000).toISOString(), items: [{ name: 'Set cà phê gia đình', quantity: 4, price: 80000 }] }
        ]
    },
    products: {
        products: [
            { name: 'Cà phê sữa đá', quantity: 156, revenue: 7020000 },
            { name: 'Cà phê đen', quantity: 98, revenue: 3430000 },
            { name: 'Trà đào cam sả', quantity: 87, revenue: 3654000 },
            { name: 'Cà phê bạc xỉu', quantity: 72, revenue: 3240000 },
            { name: 'Bánh mì chảo', quantity: 45, revenue: 2475000 },
            { name: 'Nước cam ép', quantity: 38, revenue: 1900000 }
        ]
    },
    revenue: {
        total: 45800000,
        data: [
            { date: new Date(Date.now() - 6 * 86400000).toISOString(), revenue: 5200000, orders: 18 },
            { date: new Date(Date.now() - 5 * 86400000).toISOString(), revenue: 6800000, orders: 22 },
            { date: new Date(Date.now() - 4 * 86400000).toISOString(), revenue: 4500000, orders: 15 },
            { date: new Date(Date.now() - 3 * 86400000).toISOString(), revenue: 7200000, orders: 24 },
            { date: new Date(Date.now() - 2 * 86400000).toISOString(), revenue: 8900000, orders: 28 },
            { date: new Date(Date.now() - 86400000).toISOString(), revenue: 6100000, orders: 20 },
            { date: new Date().toISOString(), revenue: 7100000, orders: 24 }
        ]
    }
};

// ═══════════════════════════════════════════════════
//  API CLIENT
// ═══════════════════════════════════════════════════
const api = {
    async get(endpoint) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            if (!response.ok) {
                // Fallback to mock data when API fails
                console.warn(`API failed (${response.status}), using mock data`);
                return this.getMockData(endpoint);
            }
            return await response.json();
        } catch (error) {
            // Fallback to mock data when network fails
            console.warn('API network error, using mock data:', error.message);
            return this.getMockData(endpoint);
        }
    },

    getMockData(endpoint) {
        // Parse endpoint to return appropriate mock data
        if (endpoint.includes('/stats')) return mockData.stats;
        if (endpoint.includes('/orders')) return mockData.orders;
        if (endpoint.includes('/products/top')) return mockData.products;
        if (endpoint.includes('/revenue')) return mockData.revenue;
        return { success: true };
    },

    async post(endpoint, data = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            throw error;
        }
    },

    // Dashboard Stats
    async getStats(days = 7) {
        return await this.get(`/dashboard/stats?days=${days}`);
    },

    async getRevenue(days = 7) {
        return await this.get(`/dashboard/revenue?days=${days}`);
    },

    async getOrders(status = null, limit = 50) {
        const url = status
            ? `/dashboard/orders?status=${status}&limit=${limit}`
            : `/dashboard/orders?limit=${limit}`;
        return await this.get(url);
    },

    async getTopProducts(limit = 10) {
        return await this.get(`/dashboard/products/top?limit=${limit}`);
    },

    async getOrderDetail(orderId) {
        return await this.get(`/dashboard/orders/${orderId}`);
    },

    async updateOrderStatus(orderId, status, action = 'update') {
        return await this.post(`/dashboard/orders/${orderId}/status?status=${status}&action=${action}`);
    },

    // Analytics
    async getAnalytics() {
        return await this.get('/dashboard/analytics/summary');
    }
};

// ═══════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    });
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'confirmed': 'status-confirmed',
        'preparing': 'status-processing',
        'ready': 'status-ready',
        'delivered': 'status-completed',
        'cancelled': 'status-cancelled',
        'completed': 'status-completed'
    };
    return statusMap[status] || 'status-pending';
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Chờ xử lý',
        'confirmed': 'Đã xác nhận',
        'preparing': 'Đang chế biến',
        'ready': 'Sẵn sàng',
        'delivered': 'Đã giao',
        'cancelled': 'Đã hủy',
        'completed': 'Hoàn thành'
    };
    return statusMap[status] || status;
}

// ═══════════════════════════════════════════════════
//  UI RENDERERS
// ═══════════════════════════════════════════════════
const ui = {
    renderStats(stats) {
        const statCards = document.querySelectorAll('.stat-card');
        if (!stats || !stats.stats) return;

        const data = stats.stats;

        // Update stat cards
        const statMappings = [
            { selector: '.stat-card:nth-child(1)', value: data.total_orders || 0, label: 'Đơn hôm nay' },
            { selector: '.stat-card:nth-child(2)', value: formatCurrency(data.revenue?.total || 0), label: 'Doanh thu' },
            { selector: '.stat-card:nth-child(3)', value: data.total_customers || 0, label: 'Khách hàng' },
            { selector: '.stat-card:nth-child(4)', value: data.orders_by_status?.completed || 0, label: 'Sản phẩm bán' }
        ];

        statMappings.forEach(mapping => {
            const card = document.querySelector(mapping.selector);
            if (card) {
                const valueEl = card.querySelector('.stat-info h3');
                const labelEl = card.querySelector('.stat-info p');
                if (valueEl) valueEl.textContent = mapping.value;
                if (labelEl) labelEl.textContent = mapping.label;
            }
        });

        // Update last updated
        const lastUpdatedEl = document.querySelector('.last-updated');
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = `Cập nhật: ${new Date().toLocaleTimeString('vi-VN')}`;
        }
    },

    renderOrders(ordersData) {
        const tbody = document.querySelector('.orders-table tbody');
        if (!tbody || !ordersData.orders) return;

        const orders = ordersData.orders.slice(0, 10); // Show latest 10

        if (orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        Không có đơn hàng nào
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr data-order-id="${order.id}">
                <td><strong>#${order.id?.slice(-6) || 'N/A'}</strong></td>
                <td>${order.customer?.name || 'Khách lẻ'}</td>
                <td>${formatCurrency(order.total || 0)}</td>
                <td>
                    <span class="status-badge ${getStatusClass(order.order_status || 'pending')}">
                        ${getStatusText(order.order_status || 'pending')}
                    </span>
                </td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <md-icon-button onclick="admin.viewOrder('${order.id}')" title="Xem chi tiết">
                            <span class="material-symbols-outlined">visibility</span>
                        </md-icon-button>
                        <md-icon-button onclick="admin.showOrderActions('${order.id}')" title="Hành động">
                            <span class="material-symbols-outlined">more_vert</span>
                        </md-icon-button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    renderProducts(productsData) {
        const grid = document.querySelector('.popular-grid');
        if (!grid || !productsData.products) return;

        const products = productsData.products.slice(0, 6);
        const icons = ['local_cafe', 'local_drink', 'cake', 'bakery_dining', 'icecream', 'set_meal'];

        grid.innerHTML = products.map((product, index) => `
            <div class="popular-item">
                <div class="popular-icon">
                    <span class="material-symbols-outlined">${icons[index % icons.length]}</span>
                </div>
                <div class="popular-info">
                    <h4>${product.name}</h4>
                    <p>${product.quantity} lượt đặt</p>
                    <small>${formatCurrency(product.revenue)}</small>
                </div>
                <span class="material-symbols-outlined trending">trending_up</span>
            </div>
        `).join('');
    },

    renderRevenueChart(revenueData) {
        const chartContainer = document.querySelector('.revenue-chart');
        if (!chartContainer || !revenueData.data) return;

        const data = revenueData.data;
        const maxRevenue = Math.max(...data.map(d => d.revenue));

        chartContainer.innerHTML = `
            <div class="chart-header">
                <h3>Doanh thu 7 ngày qua</h3>
                <p class="chart-total">Tổng: ${formatCurrency(revenueData.total)}</p>
            </div>
            <div class="chart-bars">
                ${data.map((day, index) => {
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                    const date = new Date(day.date);
                    const dayName = date.toLocaleDateString('vi-VN', { weekday: 'short' });
                    const dayDate = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

                    return `
                        <div class="chart-bar-container">
                            <div class="chart-bar" style="height: ${height}%">
                                <span class="chart-value">${formatCurrency(day.revenue)}</span>
                            </div>
                            <div class="chart-label">
                                <span class="label-day">${dayName}</span>
                                <span class="label-date">${dayDate}</span>
                            </div>
                            <div class="chart-orders">${day.orders} đơn</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    showLoading(show) {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    },

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 16px 24px;
            border-radius: 8px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideInRight 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// ═══════════════════════════════════════════════════
//  ADMIN CONTROLLER
// ═══════════════════════════════════════════════════
const admin = {
    async init() {
        this.setupNavigation();
        this.setupEventListeners();
        await this.refreshData();

        // Auto refresh
        setInterval(() => this.refreshData(), REFRESH_INTERVAL);
    },

    async refreshData() {
        if (dashboardState.loading) return;

        dashboardState.loading = true;
        ui.showLoading(true);

        try {
            // Fetch all data in parallel using api-client
            const [stats, orders, products, revenue, analytics] = await Promise.all([
                fetchDashboardStats(7),
                fetchAdminOrders({ limit: 50 }),
                fetchTopProducts(10),
                fetchRevenue(7),
                Promise.resolve(null) // Analytics not implemented in api-client yet
            ]);

            dashboardState = {
                stats,
                orders: orders.orders || orders || [],
                products: products.products || products || [],
                revenue: revenue.data || revenue || [],
                analytics: analytics?.analytics || null,
                loading: false,
                lastUpdated: new Date()
            };

            // Render UI
            ui.renderStats(stats);
            ui.renderOrders({ orders });
            ui.renderProducts({ products });
            ui.renderRevenueChart({ data: revenue });
        } catch (error) {
            console.error('Dashboard refresh error:', error);
            // Fallback to mock data
            dashboardState.loading = false;
            ui.showToast('Không thể tải dữ liệu. Dùng dữ liệu mẫu.', 'error');
        } finally {
            ui.showLoading(false);
        }
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const section = item.getAttribute('href').slice(1);
                this.navigateTo(section);
            });
        });
    },

    navigateTo(section) {
        // Handle navigation between dashboard sections
        const sections = ['dashboard', 'orders', 'menu', 'inventory', 'analytics', 'settings'];

        sections.forEach(s => {
            const el = document.getElementById(s);
            if (el) {
                el.style.display = s === section || section === 'dashboard' ? 'block' : 'none';
            }
        });
    },

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.querySelector('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Filter buttons
        const filterBtns = document.querySelectorAll('[data-filter]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const status = btn.dataset.filter;
                this.filterOrders(status);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                this.refreshData();
            }
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    },

    async filterOrders(status) {
        ui.showLoading(true);
        try {
            const orders = status === 'all'
                ? await fetchAdminOrders({ limit: 50 })
                : await fetchAdminOrders({ status, limit: 50 });

            ui.renderOrders({ orders });
        } catch (error) {
            console.error('Filter orders error:', error);
            // Silently fail, UI still shows loading state
        } finally {
            ui.showLoading(false);
        }
    },

    async viewOrder(orderId) {
        try {
            const order = await getAdminOrderDetail(orderId);

            // Show order detail modal
            const modal = document.getElementById('orderDetailModal');
            if (modal) {
                modal.innerHTML = this.renderOrderDetailModal(order);
                modal.show();
            }
        } catch (error) {
            ui.showToast('Không thể tải chi tiết đơn hàng', 'error');
        }
    },

    renderOrderDetailModal(order) {
        return `
            <md-dialog id="order-detail-dialog">
                <div slot="headline">Đơn hàng #${order.id?.slice(-6)}</div>
                <div slot="content">
                    <div class="order-detail">
                        <div class="order-section">
                            <h4>Thông tin khách hàng</h4>
                            <p><strong>Tên:</strong> ${order.customer?.name || 'N/A'}</p>
                            <p><strong>Điện thoại:</strong> ${order.customer?.phone || 'N/A'}</p>
                            <p><strong>Email:</strong> ${order.customer?.email || 'N/A'}</p>
                        </div>
                        <div class="order-section">
                            <h4>Sản phẩm</h4>
                            <ul>
                                ${(order.items || []).map(item => `
                                    <li>${item.name} x ${item.quantity} - ${formatCurrency(item.price * item.quantity)}</li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="order-section">
                            <h4>Thanh toán</h4>
                            <p><strong>Tổng:</strong> ${formatCurrency(order.total)}</p>
                            <p><strong>Phương thức:</strong> ${order.payment_method || 'COD'}</p>
                            <p><strong>Trạng thái:</strong> ${getStatusText(order.order_status)}</p>
                        </div>
                        <div class="order-section">
                            <h4>Thời gian</h4>
                            <p><strong>Đặt lúc:</strong> ${formatDate(order.created_at)}</p>
                        </div>
                    </div>
                </div>
                <div slot="actions">
                    <md-text-button onclick="document.getElementById('order-detail-dialog').close()">Đóng</md-text-button>
                </div>
            </md-dialog>
        `;
    },

    async showOrderActions(orderId) {
        const actions = prompt('Hành động cho đơn #' + orderId.slice(-6) + ':\n1. Xác nhận\n2. Đang chế biến\n3. Sẵn sàng\n4. Đã giao\n5. Hủy\n\nNhập số hành động:');

        if (actions) {
            const actionMap = {
                '1': 'confirmed',
                '2': 'preparing',
                '3': 'ready',
                '4': 'delivered',
                '5': 'cancelled'
            };

            const status = actionMap[actions.trim()];
            if (status) {
                await this.updateOrderStatus(orderId, status);
            }
        }
    },

    async updateOrderStatus(orderId, status) {
        try {
            await api.updateOrderStatus(orderId, status, status);
            ui.showToast(`Cập nhật trạng thái thành công: ${getStatusText(status)}`);
            await this.refreshData();
        } catch (error) {
            ui.showToast('Không thể cập nhật trạng thái', 'error');
        }
    },

    closeModals() {
        const dialogs = document.querySelectorAll('md-dialog');
        dialogs.forEach(dialog => dialog.close());
    }
};

// ═══════════════════════════════════════════════════
//  INITIALIZE
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    admin.init();
});

// Export for global access
window.admin = admin;
window.api = api;
