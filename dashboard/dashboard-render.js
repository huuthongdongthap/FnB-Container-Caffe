/**
 * AURA SPACE — Dashboard Render Module
 * All DOM rendering functions
 */

// Local formatCurrency to avoid circular dependency with dashboard.js
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

export function renderStats(stats) {
    const revenueEl = document.querySelector('[data-stat="revenue"]');
    if (revenueEl) {
        revenueEl.textContent = formatCurrency(stats.revenue.total);
    }

    const ordersEl = document.querySelector('[data-stat="orders"]');
    if (ordersEl) {
        ordersEl.textContent = stats.total_orders;
    }

    const customersEl = document.querySelector('[data-stat="customers"]');
    if (customersEl) {
        customersEl.textContent = stats.total_customers;
    }

    const avgOrderEl = document.querySelector('[data-stat="avg_order"]');
    if (avgOrderEl) {
        avgOrderEl.textContent = formatCurrency(stats.average_order_value);
    }
}

export function renderRevenueChart(data) {
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

export function renderOrdersTable(orders) {
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
            <td>${new Intl.DateTimeFormat('vi-VN', {
                weekday: 'short', day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }).format(new Date(order.created_at))}</td>
        </tr>
    `).join('');
}

export function getInitials(name) {
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export function renderTopProducts(products) {
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

export function translatePaymentStatus(status) {
    const translations = {
        'pending': 'Chưa thanh toán',
        'paid': 'Đã thanh toán',
        'failed': 'Thất bại'
    };
    return translations[status] || status;
}

export function translateOrderStatus(status) {
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
