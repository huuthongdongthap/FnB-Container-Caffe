/**
 * F&B Caffe Container — Admin Dashboard
 * Interactive Dashboard JavaScript
 */

// API Configuration
const API_BASE = 'http://localhost:8000/api';

// Dashboard API Integration Module
const DashboardAPI = {
    async fetchStats(days = 7) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/stats?days=${days}`);
            const data = await response.json();
            return data.success ? data.stats : null;
        } catch (error) {
            console.error('Error fetching stats:', error);
            return null;
        }
    },

    async fetchRevenue(days = 7) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/revenue?days=${days}`);
            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching revenue:', error);
            return [];
        }
    },

    async fetchOrders(status = null, limit = 50) {
        try {
            const url = status
                ? `${API_BASE}/dashboard/orders?status=${status}&limit=${limit}`
                : `${API_BASE}/dashboard/orders?limit=${limit}`;
            const response = await fetch(url);
            const data = await response.json();
            return data.success ? data.orders : [];
        } catch (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
    },

    async fetchTopProducts(limit = 10) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/products/top?limit=${limit}`);
            const data = await response.json();
            return data.success ? data.products : [];
        } catch (error) {
            console.error('Error fetching top products:', error);
            return [];
        }
    },

    async updateOrderStatus(orderId, action) {
        try {
            const response = await fetch(`${API_BASE}/dashboard/orders/${orderId}/status?action=${action}`, {
                method: 'POST'
            });
            const data = await response.json();
            return data.success ? data.order : null;
        } catch (error) {
            console.error('Error updating order:', error);
            return null;
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {

    // Load dashboard data
    loadDashboardData();

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

    // Search Functionality
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            // Add search logic here
            console.log('Searching for:', query);
        });

        // Keyboard shortcut for search (Cmd/Ctrl + K)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }

    // Notification Button
    const notificationBtn = document.querySelector('.notification-btn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            const dot = notificationBtn.querySelector('.notification-dot');
            if (dot) {
                dot.style.display = 'none';
            }
            console.log('Notifications opened');
            // Add notification panel logic here
        });
    }

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

    // Bar Chart Animation on Scroll
    const barChart = document.querySelector('.bar-chart');
    if (barChart) {
        const bars = barChart.querySelectorAll('.bar');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    bars.forEach((bar, index) => {
                        setTimeout(() => {
                            bar.style.transform = 'scaleY(1)';
                        }, index * 100);
                    });
                }
            });
        }, { threshold: 0.5 });

        observer.observe(barChart);
    }

    // Status Badge Pulse Animation for Pending Orders
    const pendingBadges = document.querySelectorAll('.status-badge.pending');
    pendingBadges.forEach(badge => {
        badge.style.animation = 'pulse 2s infinite';

        // Add pulse keyframes dynamically
        if (!document.getElementById('pulse-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pulse-keyframes';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                        box-shadow: 0 0 0 0 rgba(232, 159, 113, 0.4);
                    }
                    50% {
                        opacity: 0.8;
                        box-shadow: 0 0 0 8px rgba(232, 159, 113, 0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    });

    // Product List Stagger Animation
    const productItems = document.querySelectorAll('.product-item');
    productItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * 100);
    });

    // Quick Actions Button Click Effects
    const actionBtns = document.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Add ripple effect
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                background: rgba(212, 165, 116, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;

            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

            btn.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);

            // Log action
            const actionName = btn.querySelector('span:last-child')?.textContent;
            console.log('Action triggered:', actionName);
        });
    });

    // Add ripple keyframes
    if (!document.getElementById('ripple-keyframes')) {
        const style = document.createElement('style');
        style.id = 'ripple-keyframes';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Table Row Hover Effect Enhancement
    const tableRows = document.querySelectorAll('.orders-table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            tableRows.forEach(r => {
                if (r !== row) {
                    r.style.background = 'transparent';
                }
            });
        });
    });

    // Real-time Clock Update (Optional feature)
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        // Could display clock in header if needed
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Mock Data Refresh (Simulating real-time updates)
    function refreshData() {
        // This would connect to a real backend in production
        console.log('Data refreshed at', new Date().toLocaleTimeString());

        // Animate stat values
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
            stat.style.transition = 'opacity 0.3s';
            stat.style.opacity = '0.5';
            setTimeout(() => {
                stat.style.opacity = '1';
            }, 300);
        });
    }

    // Auto-refresh every 30 seconds (for demo purposes)
    // setInterval(refreshData, 30000);

    // Keyboard Navigation (Accessibility)
    document.addEventListener('keydown', (e) => {
        // Escape to close mobile sidebar
        if (e.key === 'Escape') {
            sidebar.classList.remove('open');
        }

        // Alt + Number for quick navigation
        if (e.altKey && e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            if (navItems[index]) {
                navItems[index].click();
            }
        }
    });

    // Tooltip Initialization (for icons without labels)
    const iconBtns = document.querySelectorAll('.icon-btn');
    iconBtns.forEach(btn => {
        const tooltipText = btn.getAttribute('title') || 'Click để xem';
        btn.setAttribute('data-tooltip', tooltipText);
    });

    console.log('Dashboard fully loaded with all interactions');
});

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

/**
 * Dashboard Data Loading Functions
 */
async function loadDashboardData() {
    console.log('Loading dashboard data...');

    // Load stats
    const stats = await DashboardAPI.fetchStats(7);
    if (stats) {
        renderStats(stats);
    }

    // Load revenue chart
    const revenueData = await DashboardAPI.fetchRevenue(7);
    if (revenueData.length > 0) {
        renderRevenueChart(revenueData);
    }

    // Load orders table
    const orders = await DashboardAPI.fetchOrders(null, 20);
    if (orders.length > 0) {
        renderOrdersTable(orders);
    }

    // Load top products
    const products = await DashboardAPI.fetchTopProducts(5);
    if (products.length > 0) {
        renderTopProducts(products);
    }
}

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

    console.log('Stats rendered:', stats);
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

    console.log('Revenue chart rendered:', data);
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

    console.log('Orders table rendered:', orders.length, 'orders');
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

    console.log('Top products rendered:', products.length, 'products');
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

function handleOrderAction(orderId, action) {
    console.log(`Order ${orderId}: ${action}`);

    if (action === 'view') {
        window.location.href = `order-detail.html?id=${orderId}`;
        return;
    }

    if (action === 'confirm' || action === 'cancel') {
        DashboardAPI.updateOrderStatus(orderId, action).then((updatedOrder) => {
            if (updatedOrder) {
                console.log(`Order ${orderId} ${action}ed successfully`);
                // Reload orders table
                loadDashboardData();
            } else {
                alert('Có lỗi xảy ra khi cập nhật đơn hàng');
            }
        });
    }
}
